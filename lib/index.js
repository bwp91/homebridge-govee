/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const PLUGIN = require('./../package.json')
class GoveePlatform {
  constructor (log, config, api) {
    if (!log || !api) {
      return
    }
    this.consts = require('./utils/constants')
    this.messages = this.consts.messages
    this.funcs = require('./utils/functions')
    this.colourUtils = require('./utils/colour-utils')
    try {
      if (!config || !config.apiKey) {
        throw new Error(this.messages.apiKeyMissing)
      }
      this.log = log
      this.api = api
      this.devicesInHB = new Map()
      this.devicesInGV = new Map()
      this.config = this.consts.defaultConfig
      this.applyUserConfig(config)
      this.api.on('didFinishLaunching', this.pluginSetup.bind(this))
      this.api.on('shutdown', this.pluginShutdown.bind(this))
    } catch (err) {
      const eText = this.funcs.parseError(err)
      log.warn('*** %s [v%s]. ***', this.messages.disabling, PLUGIN.version)
      log.warn('*** %s. ***', eText)
    }
  }

  applyUserConfig (config) {
    for (const [key, val] of Object.entries(config)) {
      switch (key) {
        case 'apiKey':
          this.config.apiKey = this.funcs.parseApiKey(val)
          break
        case 'debug':
          this.config.debug = !!val
          break
        case 'disableDeviceLogging':
          this.config.disableDeviceLogging = !!val
          break
        case 'disablePlugin':
          this.config.disablePlugin = !!val
          break
        case 'ignoredDevices': {
          let newVal = val
          if (typeof val === 'string' && val.length > 0) {
            newVal = val.split(',')
          }
          if (Array.isArray(newVal) && newVal.length > 0) {
            newVal.forEach(serialNumber => {
              const toAdd = this.funcs.parseSerialNumber(serialNumber)
              this.config.ignoredDevices.push(toAdd)
            })
          }
          break
        }
        case 'name':
          this.config.name = val
          break
        case 'platform':
          break
        case 'refreshTime':
          this.config.refreshTime = this.funcs.parseNumber(
            val,
            this.config.refreshTime,
            this.consts.minValues.refreshTime
          )
          break
        default:
          this.log.warn('%s [%s:%s].', this.messages.removeConfig, key, val)
          break
      }
    }
  }

  async pluginSetup () {
    try {
      if (this.config.disablePlugin) {
        this.devicesInHB.forEach(accessory => {
          this.removeAccessory(accessory)
        })
        throw new Error(this.messages.disabled)
      }
      this.log('[v%s] %s.', PLUGIN.version, this.messages.initialised)
      this.httpClient = new (require('./connection/http'))(this)
      await this.goveeSync()
      this.refreshInterval = setInterval(
        () => this.goveeSync(),
        this.config.refreshTime * 1000
      )
      const randIndex = Math.floor(Math.random() * this.consts.welcomeMessages.length)
      this.log('%s %s', this.messages.complete, this.consts.welcomeMessages[randIndex])
    } catch (err) {
      const eText = err.message.includes('401')
        ? this.messages.invalidApiKey
        : this.funcs.parseError(err)
      this.log.warn('*** %s [v%s]. ***', this.messages.disabling, PLUGIN.version)
      this.log.warn('*** %s. ***', eText)
      this.pluginShutdown()
    }
  }

  pluginShutdown () {
    clearInterval(this.refreshInterval)
  }

  async goveeSync () {
    try {
      const deviceList = await this.httpClient.getDevices()
      deviceList.forEach(device => {
        this.devicesInGV.set(device.device, device)
      })
      this.devicesInGV.forEach(device => {
        // *** Part 1 - sync devices from Govee into HB *** \\
        try {
          let instance
          if (this.consts.modelsRGB.includes(device.model)) {
            instance = 'light-colour'
          } else if (this.consts.modelsSwitch.includes(device.model)) {
            instance = 'switch'
          } else {
            return
          }
          const accessory = this.devicesInHB.has(device.device)
            ? this.devicesInHB.get(device.device)
            : this.addAccessory(device)
          accessory.context.controllable = device.controllable
          accessory.context.retrievable = device.retrievable
          accessory.context.supportedCmds = device.supportCmds
          if (!accessory.control) {
            accessory.control = new (require('./device/' + instance))(this, accessory)
          }
          if (!this.firstRunDone) {
            this.log(
              '[%s] %s %s.',
              accessory.displayName,
              this.messages.devInit,
              device.device
            )
          }
          if (accessory) {
            this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
            this.devicesInHB.set(device.device, accessory)
          }
        } catch (e) {
          const eText = this.funcs.parseError(e)
          this.log.warn('[%s] %s %s.', device.deviceName, this.messages.devNotInit, eText)
        }
      })
      this.devicesInHB.forEach(async accessory => {
        // *** Part 2 - get state for each device in HB *** //
        if (!this.devicesInGV.has(accessory.context.gvDeviceId)) {
          this.removeAccessory(accessory)
          return
        }
        try {
          if (!accessory.context.retrievable) {
            throw new Error(this.messages.devNotRetrievable)
          }
          const res = await this.httpClient.getDevice(accessory.context)
          accessory.control.externalUpdate(Object.assign({}, ...res))
        } catch (e) {
          const eText = this.funcs.parseError(e)
          this.log.warn(
            '[%s] %s %s.',
            accessory.displayName,
            this.messages.devNotRefreshed,
            eText
          )
        }
      })
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('%s %s.', this.messages.syncFailed, eText)
    }
    this.firstRunDone = true
  }

  addAccessory (device) {
    try {
      const uuid = this.api.hap.uuid.generate(device.device)
      const accessory = new this.api.platformAccessory(device.deviceName, uuid)
      accessory.getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, this.messages.brand)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true)
      accessory.on('identify', (paired, callback) => {
        callback()
        this.log('[%s] %s.', accessory.displayName, this.messages.identify)
      })
      accessory.context.gvDeviceId = device.device
      accessory.context.gvModel = device.model
      this.api.registerPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.set(device.device, accessory)
      this.log('[%s] %s.', device.deviceName, this.messages.devAdd)
      return accessory
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', device.deviceName, this.messages.devNotAdd, eText)
    }
  }

  configureAccessory (accessory) {
    try {
      if (!this.log) {
        return
      }
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory)
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', accessory.displayName, this.messages.devNotConf, eText)
    }
  }

  removeAccessory (accessory) {
    try {
      this.api.unregisterPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.delete(accessory.context.gvDeviceId)
      this.log('[%s] %s.', accessory.displayName, this.messages.devRemove)
    } catch (err) {
      const eText = this.funcs.parseError(err)
      const name = accessory.displayName
      this.log.warn('[%s] %s %s.', name, this.messages.devNotRemove, eText)
    }
  }
}

module.exports = hb => hb.registerPlatform(PLUGIN.alias, GoveePlatform)

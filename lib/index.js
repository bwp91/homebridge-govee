/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
const PLUGIN = require('./../package.json')
class GoveePlatform {
  constructor (log, config, api) {
    if (!log || !api) {
      return
    }
    try {
      if (!config || !config.apiKey) {
        throw new Error('*** Govee API key missing from configuration ***')
      }
      this.log = log
      this.config = config
      this.helpers = require('./utils/helpers')
      this.colourUtils = require('./utils/colour-utils')
      this.debug = config.debug
      this.api = api
      this.devicesInHB = new Map()
      this.devicesInGV = new Map()
      this.refreshTime = parseInt(config.refreshTime)
      this.refreshTime = isNaN(this.refreshTime) || this.refreshTime < 15
        ? this.helpers.defaults.refreshTime
        : this.refreshTime
      this.api.on('didFinishLaunching', this.goveeSetup.bind(this))
      this.api.on('shutdown', this.goveeShutdown.bind(this))
    } catch (err) {
      const errToShow = err.message + ' [line ' + err.lineNumber + ']'
      log.warn('*** Disabling plugin [v%s] ***', PLUGIN.version)
      log.warn('*** %s. ***', errToShow)
    }
  }

  async goveeSetup () {
    try {
      if (this.config.disablePlugin) {
        this.devicesInHB.forEach(a => this.removeAccessory(a))
        throw new Error('To change this, set disablePlugin to false')
      }
      this.log('Plugin [v%s] initialised. Syncing with Govee...', PLUGIN.version)
      this.httpClient = new (require('./connection/http'))(this)
      await this.goveeSync()
      this.refreshInterval = setInterval(() => this.goveeSync(), this.refreshTime * 1000)
      this.log('✓ Setup complete. %s', this.helpers.logMessages[Math.floor(Math.random() * this.helpers.logMessages.length)])
    } catch (err) {
      const errToShow = err.message.includes('401') ? 'Invalid Govee API key' : err.message + ' [line ' + err.lineNumber + ']'
      this.log.warn('*** Disabling plugin [v%s] ***', PLUGIN.version)
      this.log.warn('*** %s. ***', errToShow)
      this.goveeShutdown()
    }
  }

  goveeShutdown () {
    clearInterval(this.refreshInterval)
  }

  async goveeSync () {
    try {
      const res = await this.httpClient.getDevices()
      res.forEach(device => this.devicesInGV.set(device.device, device))
      this.devicesInGV.forEach(device => {
        // *** Part 1 - sync devices from Govee into HB *** //
        try {
          let instance
          if (this.helpers.modelsRGB.includes(device.model)) {
            instance = 'light-colour'
          } else if (this.helpers.modelsSwitch.includes(device.model)) {
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
            this.log('[%s] initialised with id %s.', accessory.displayName, device.device)
          }
          if (accessory) {
            this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
            this.devicesInHB.set(device.device, accessory)
          }
        } catch (e) {
          const eToShow = this.debug ? ':\n' + e : ' ' + e.message + ' [line ' + e.lineNumber + '].'
          this.log.warn('[%s] could not be initialised as%s', device.deviceName, eToShow)
        }
      })
      this.devicesInHB.forEach(async a => {
        // *** Part 2 - get state for each device in HB *** //
        if (!this.devicesInGV.has(a.context.gvDeviceId)) {
          this.removeAccessory(a)
          return
        }
        try {
          if (!a.context.retrievable) {
            throw new Error('current status could not be retrieved')
          }
          const res = await this.httpClient.getDevice(a.context)
          a.control.externalUpdate(Object.assign({}, ...res))
        } catch (e) {
          const eToShow = this.debug ? ':\n' + e : ' ' + e.message + ' [line ' + e.lineNumber + '].'
          this.log.warn('[%s] could not be refreshed as%s', a.displayName, eToShow)
        }
      })
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('goveeSync failed as%s', errToShow)
    }
    this.firstRunDone = true
  }

  addAccessory (device) {
    try {
      const accessory = new this.api.platformAccessory(device.deviceName, this.api.hap.uuid.generate(device.device))
      accessory.getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Govee')
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true)
      accessory.on('identify', (paired, callback) => {
        callback()
        this.log('[%s] identify button pressed.', accessory.displayName)
      })
      accessory.context.gvDeviceId = device.device
      accessory.context.gvModel = device.model
      this.api.registerPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.set(device.device, accessory)
      this.log('[%s] has been added to Homebridge.', device.deviceName)
      return accessory
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be added to Homebridge as%s', device.deviceName, errToShow)
    }
  }

  configureAccessory (accessory) {
    try {
      if (!this.log) {
        return
      }
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory)
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be configured as%s', accessory.displayName, errToShow)
    }
  }

  removeAccessory (accessory) {
    try {
      this.api.unregisterPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.delete(accessory.context.gvDeviceId)
      this.log('[%s] has been removed from Homebridge.', accessory.displayName)
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be removed from Homebridge as%s', accessory.displayName, errToShow)
    }
  }
}

module.exports = hb => hb.registerPlatform(PLUGIN.alias, GoveePlatform)

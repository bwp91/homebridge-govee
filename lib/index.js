/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
class GoveePlatform {
  constructor (log, config, api) {
    this.version = require('./../package.json').version
    if (!log || !api || !config) return
    if (!config.apiKey) {
      log.warn('*** Disabling plugin [v%s] ***', this.version)
      log.warn('*** Govee API key missing from configuration ***')
      return
    }
    this.log = log
    this.config = config
    this.helpers = require('./utils/helpers')
    this.debug = config.debug || false
    this.api = api
    this.Service = api.hap.Service
    this.Characteristic = api.hap.Characteristic
    this.devicesInHB = new Map()
    this.devicesInGV = new Map()
    this.refreshTime = parseInt(this.config.refreshTime)
    this.refreshTime = isNaN(this.refreshTime)
      ? this.helpers.defaults.refreshTime
      : this.refreshTime < 15
        ? this.helpers.defaults.refreshTime
        : this.refreshTime
    this.api
      .on('didFinishLaunching', this.goveeSetup.bind(this))
      .on('shutdown', this.goveeShutdown.bind(this))
  }

  async goveeSetup () {
    try {
      if (this.config.disablePlugin) {
        this.devicesInHB.forEach(a => this.removeAccessory(a))
        this.log.warn('*** Disabling plugin [v%s] ***', this.version)
        this.log.warn('*** To change this, set disablePlugin to false ***')
        return
      }
      this.log('Plugin [v%s] initialised. Syncing with Govee...', this.version)
      this.httpClient = new (require('./connection/http'))(this.config, this.log, this.helpers)
      await this.goveeSync()
      this.log('[%s] devices loaded from your Govee account.', this.devicesInGV.size)
      this.refreshInterval = setInterval(async () => {
        try {
          await this.goveeSync()
        } catch (err) {
          if (this.debug) this.log.warn(err.message)
        }
      }, this.refreshTime * 1000)
      this.log("Govee setup complete. Don't forget to ⭐️  this plugin on GitHub if you're finding it useful!")
      if (this.config.debugReqRes) this.log.warn("Note: 'Request & Response Logging' is not advised for long-term use.")
    } catch (err) {
      this.log.warn('*** Disabling plugin [v%s] ***', this.version)
      this.log.warn(
        err.message.includes('401')
          ? 'Invalid Govee API key - please double check it.'
          : this.debug ? err : err.message
      )
    }
  }

  goveeShutdown () {
    clearInterval(this.refreshInterval)
  }

  async goveeSync () {
    const res = await this.httpClient.getDevices()
    res.forEach(device => this.devicesInGV.set(device.device, device))
    this.devicesInGV.forEach(d => this.refreshDevice(d))
    this.devicesInHB.forEach(async a => {
      if (this.devicesInGV.has(a.context.gvDeviceId)) {
        try {
          if (!a.context.retrievable) throw new Error('current status could not be retrieved')
          const res = await this.httpClient.getDevice(a.context)
          a.control.externalUpdate(Object.assign({}, ...res))
        } catch (err) {
          if (this.debug) this.log.warn(' → [%s] status could not be updated as %s.', a.displayName, err.message)
        }
      } else {
        this.removeAccessory(a)
      }
    })
  }

  refreshDevice (device) {
    try {
      let accessory
      if (this.helpers.modelsLED.includes(device.model)) {
        /*********
        LED LIGHTS
        *********/
        accessory = this.devicesInHB.has(device.device)
          ? this.devicesInHB.get(device.device)
          : this.addAccessory(device)
        accessory.context.controllable = device.controllable
        accessory.context.retrievable = device.retrievable
        accessory.context.supportedCmds = device.supportCmds
        if (!this.helpers.hasProperty(accessory, 'control')) {
          accessory.control = new (require('./device/led-strip'))(this, accessory)
        }
        /********/
      } else {
        /**********
        UNSUPPORTED
        **********/
        return
        /*********/
      }
      if (!accessory) return
      this.api.updatePlatformAccessories('homebridge-govee', 'Govee', [accessory])
      this.devicesInHB.set(device.vacuum.did, accessory)
    } catch (err) {
      if (this.debug) this.log.warn('[%s] could not be refreshed as %s.', device.deviceName, err)
    }
  }

  addAccessory (device) {
    try {
      const accessory = new this.api.platformAccessory(device.deviceName, this.api.hap.uuid.generate(device.device).toString())
      accessory
        .getService(this.Service.AccessoryInformation)
        .setCharacteristic(this.Characteristic.Manufacturer, 'Govee')
        .setCharacteristic(this.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.Characteristic.Model, device.model)
        .setCharacteristic(this.Characteristic.Identify, true)
      accessory.on('identify', (paired, callback) => {
        this.log('[%s] - identify button pressed.', accessory.displayName)
        callback()
      })
      accessory.context.gvDeviceId = device.device
      accessory.context.gvModel = device.model
      this.api.registerPlatformAccessories('homebridge-govee', 'Govee', [accessory])
      this.devicesInHB.set(device.device, accessory)
      return accessory
    } catch (err) {
      this.log.warn(' → [%s] could not be added to Homebridge as %s.', device.deviceName, err)
    }
  }

  configureAccessory (accessory) {
    if (!this.log) return
    this.devicesInHB.set(accessory.context.gvDeviceId, accessory)
  }

  removeAccessory (accessory) {
    try {
      this.api.unregisterPlatformAccessories('homebridge-govee', 'Govee', [accessory])
      this.devicesInHB.delete(accessory.context.gvDeviceId)
    } catch (err) {
      this.log.warn("[%s] needed to be removed but couldn't as %s.", accessory.displayName, err)
    }
  }
}

module.exports = hb => hb.registerPlatform('homebridge-govee', 'Govee', GoveePlatform)

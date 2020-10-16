/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
const helpers = require('./helpers')
const deviceLED = require('./device-led')
const goveeHTTP = require('./govee-http')
const promInterval = require('interval-promise')
module.exports = class goveePlatform {
  constructor (log, config, api) {
    if (!log || !api || !config) return
    if (!config.apiKey) {
      log.warn('********** Cannot load homebridge-govee *********')
      log.warn('Govee API Key missing from the Homebridge config.')
      return
    }
    this.log = log
    this.config = config
    this.debug = config.debug || false
    this.api = api
    this.Service = api.hap.Service
    this.Characteristic = api.hap.Characteristic
    this.devicesInHB = new Map()
    this.devicesInGV = new Map()
    this.refreshFlag = true
    this.refreshTime = parseInt(this.config.refreshTime)
    this.refreshTime = isNaN(this.refreshTime)
      ? helpers.refreshTime
      : this.refreshTime < 10
        ? helpers.refreshTime
        : this.refreshTime
    this.api
      .on('didFinishLaunching', () => this.goveeSetup())
      .on('shutdown', () => this.goveeShutdown())
  }

  async goveeSetup () {
    try {
      if (this.config.disablePlugin) {
        this.devicesInHB.forEach(a => this.removeAccessory(a))
        this.log.warn('********** Not loading homebridge-govee **********')
        this.log.warn('*** To change this, set disablePlugin to false ***')
        return
      }
      this.log('Plugin has finished initialising. Syncing with Govee.')
      this.httpClient = new goveeHTTP(this)
      await this.goveeSync()
      this.log('[%s] devices loaded from your Govee account.', this.devicesInGV.size)
      this.refreshInterval = promInterval(
        async () => {
          if (this.refreshFlag) {
            try {
              await this.goveeSync()
            } catch (err) {
              if (this.debug) {
                this.log.warn(err.message)
              }
            }
          }
        },
        this.refreshTime * 1000,
        { stopOnError: false }
      )
      this.log("Govee setup complete. Don't forget to ⭐️  this plugin on GitHub if you're finding it useful!")
      if (this.config.debugReqRes) {
        this.log.warn("Note: 'Request & Response Logging' is not advised for long-term use.")
      }
    } catch (err) {
      this.log.warn('********* Cannot load homebridge-govee *******')
      this.log.warn(
        err.message.includes('401')
          ? 'Invalid Govee API key - please double check it.'
          : this.debug ? err : err.message
      )
    }
  }

  goveeShutdown () {
    this.refreshFlag = false
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
      if (helpers.modelsLED.includes(device.model)) {
        /*********
        LED LIGHTS
        *********/
        accessory = this.devicesInHB.has(device.device)
          ? this.devicesInHB.get(device.device)
          : this.addAccessory(device)
        if (!helpers.hasProperty(accessory, 'control')) accessory.control = new deviceLED(this, accessory)
        /********/
      } else {
        /**********
        UNSUPPORTED
        **********/
        return
        /*********/
      }
      accessory.context.controllable = device.controllable
      accessory.context.retrievable = device.retrievable
      accessory.context.supportedCmds = device.supportCmds
      this.devicesInHB.set(device.device, accessory)
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
      accessory.context = {
        gvDeviceId: device.device,
        gvModel: device.model
      }
      this.devicesInHB.set(device.device, accessory)
      this.api.registerPlatformAccessories('homebridge-govee', 'Govee', [accessory])
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

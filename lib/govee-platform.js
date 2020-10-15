/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
const helpers = require('./helpers')
const DeviceLED = require('./device-led')
const GoveeHTTP = require('./govee-http')
const promInterval = require('interval-promise')
module.exports = class goveePlatform {
  constructor (log, config, api) {
    if (!log || !api || !config) return
    if (!config.apiKey) {
      log.warn('********** Cannot load homebridge-govee *********')
      log.warn('Govee API Key missing from the Homebridge config.')
      log.warn('*************************************************')
      return
    }
    this.log = log
    this.config = config
    this.api = api
    this.Service = api.hap.Service
    this.Characteristic = api.hap.Characteristic
    this.debug = config.debug || false
    this.devicesInHB = new Map()
    this.devicesInGV = new Map()
    this.refreshFlag = true
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
      this.log('Plugin has finished initialising. Synching with Govee.')
      this.httpClient = new GoveeHTTP(this.config, this.log)
      await this.goveeSync(true)
      this.log('[%s] devices loaded from your Govee account.', this.devicesInGV.size)
      await this.goveeSync()
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
        (parseInt(this.config.refreshTime) || helpers.refreshTime) * 1000,
        { stopOnError: false }
      )
      this.log("Govee setup complete. Don't forget to ⭐️  this plugin on GitHub if you're finding it useful!")
      if (this.config.debugReqRes) {
        this.log.warn("Note: 'Request & Response Logging' is not advised for long-term use.")
      }
    } catch (err) {
      if (err.message.includes('401')) {
        this.log.warn('********** Notice [homebridge-govee] *********')
        this.log.warn('Invalid Govee API key - please double check it.')
        this.log.warn('**********************************************')
      } else {
        this.log.warn('********** Cannot load homebridge-govee *********')
        this.log.warn(err.message)
        this.log.warn('*************************************************')
      }
    }
  }

  goveeShutdown () {
    this.refreshFlag = false
  }

  async goveeSync () {
    const res = await this.httpClient.getDevices()
    res.forEach(device => this.devicesInGV.set(device.device, device))
    this.devicesInHB.forEach(a => {
      if (!this.devicesInGV.has(a.context.gvDeviceId)) {
        this.removeAccessory(a)
        this.devicesInHB.delete(a.context.gvDeviceId)
      }
    })
    this.devicesInGV.forEach(d => this.refreshDevice(d))
    this.devicesInHB.forEach(async accessory => {
      try {
        if (!accessory.context.retrievable) throw new Error('current status could not be retrieved')
        const res = await this.httpClient.getDevice(accessory.context)
        accessory.control.externalUpdate(Object.assign({}, ...res))
      } catch (err) {
        if (this.debug) this.log.warn(' → [%s] status could not be updated as %s.', accessory.displayName, err.message)
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
        if (!helpers.hasProperty(accessory, 'control')) accessory.control = new DeviceLED(this, accessory)
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
      if (this.debug) {
        this.log.warn('[%s] could not be refreshed as %s.', device.deviceName, err)
      }
    }
  }

  addAccessory (device) {
    try {
      const accessory = new this.api.platformAccessory(device.deviceName, this.api.hap.uuid.generate(device.device).toString())
      accessory
        .getService(this.Service.AccessoryInformation)
        .setCharacteristic(this.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.Characteristic.Manufacturer, 'Govee')
        .setCharacteristic(this.Characteristic.Model, device.model)
        .setCharacteristic(this.Characteristic.Identify, false)
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
      this.devicesInHB.delete(accessory.context.gvDeviceId)
      this.api.unregisterPlatformAccessories('homebridge-govee', 'Govee', [accessory])
    } catch (err) {
      this.log.warn("[%s] needed to be removed but couldn't as %s.", accessory.displayName, err)
    }
  }
}

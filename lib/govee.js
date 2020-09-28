'use strict'
let Accessory, Characteristic, Service
const cConvert = require('color-convert')
const cns = require('./constants')
const cTemp = require('color-temp')
const GoveeHTTP = require('./goveeHTTP')
const promInterval = require('interval-promise')
class Govee {
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
    this.debug = this.config.debug || false
    this.devicesInHB = new Map()
    this.devicesInGV = new Map()
    this.apiKeyCheck = false
    this.ignoreNextSync = false
    this.refreshFlag = true
    this.api
      .on('didFinishLaunching', () => this.goveeSetup())
      .on('shutdown', () => (this.refreshFlag = false))
  }

  async goveeSetup() {
    try {
      this.log('Plugin has finished initialising. Synching with Govee.')
      this.httpClient = new GoveeHTTP(this.config, this.log)
      await this.goveeSync()
      this.log('[%s] devices loaded from your Govee account.', this.devicesInGV.size)
      this.devicesInGV.forEach(d => this.log(' → [%s] found in your Govee account.', d.deviceName))
      this.refresh = promInterval(
        async () => {
          if (this.refreshFlag) {
            try {
              await this.goveeSync()
            } catch (err) {
              this.log.warn(this.debug ? err : err.message)
            }
          }
        },
        cns.refreshTime, {
          stopOnError: false
        }
      )
      this.log("Govee setup complete. Don't forget to ⭐️  this plugin on GitHub!")
      if (this.config.debugReqRes || false) {
        this.log.warn("Note: 'Request & Response Logging' is not advised for long-term use.")
      }
    } catch (err) {
      if (err.message.includes('401')) {
        this.log.warn('********** Notice [homebridge-govee] *********')
        this.log.warn('Invalid Govee API key - please double check it.')
        this.log.warn('**********************************************')
      } else {
        this.log.warn(this.debug ? err : err.message)
      }
    }
  }

  async goveeSync () {
    if (this.ignoreNextSync) {
      this.ignoreNextSync = false
      return
    }
    const res = await this.httpClient.getDevices()
    res.forEach(device => this.devicesInGV.set(device.device, device))
    this.devicesInHB.forEach(a => {
      if (!this.devicesInGV.has(a.context.gvDeviceId)) {
        this.removeAccessory(a)
        this.devicesInHB.delete(a.context.gvDeviceId)
      }
    })
    this.devicesInGV.forEach(d => this.initialiseDevice(d))
  }

  async initialiseDevice (device) {
    try {
      if (!cns.supportedModels.includes(device.model)) {
        this.log.warn('[%s] is model type [%s] which is not supported by this plugin.', device.deviceName, device.model)
        return
      }
      let accessory
      if (!this.devicesInHB.has(device.device)) this.addAccessory(device)
      if ((accessory = this.devicesInHB.get(device.device))) {
        accessory.context.controllable = device.controllable
        accessory.context.supportedCmds = device.supportCmds
        const res = await this.httpClient.getDevice(accessory.context)
        this.refreshAccessory(accessory, Object.assign({}, ...res))
      } else {
        this.log.warn("[%s] could not be initialised as it wasn't found in Homebridge.", device.deviceName)
      }
    } catch (err) {
      this.log.warn('[%s] could not be initialised.', device.deviceName)
      this.log.warn(err.message || err)
    }
  }

  addAccessory (device) {
    try {
      const accessory = new Accessory(device.deviceName, this.api.hap.uuid.generate(device.device).toString())
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.SerialNumber, device.device)
        .setCharacteristic(Characteristic.Manufacturer, 'Govee')
        .setCharacteristic(Characteristic.Model, device.model)
        .setCharacteristic(Characteristic.Identify, false)
      accessory.context = {
        gvDeviceId: device.device,
        gvModel: device.model
      }
      this.devicesInHB.set(device.device, accessory)
      this.api.registerPlatformAccessories('homebridge-govee', 'Govee', [accessory])
      this.configureAccessory(accessory)
      this.log('[%s] has been added to Homebridge.', device.deviceName)
    } catch (err) {
      this.log.warn('[%s] could not be added to Homebridge as %s.', device.deviceName, err)
    }
  }

  configureAccessory (accessory) {
    if (!this.log) return
    try {
      const lightService = accessory.getService(Service.Lightbulb) || accessory.addService(Service.Lightbulb)
      lightService
        .getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => this.internalOnOffUpdate(accessory, value, callback))
      lightService
        .getCharacteristic(Characteristic.Brightness)
        .on('set', (value, callback) => {
          if (value > 0) {
            if (!lightService.getCharacteristic(Characteristic.On).value) {
              this.internalOnOffUpdate(accessory, true, function () {})
            }
            setTimeout(() => this.internalBrightnessUpdate(accessory, value, callback), 500)
          } else {
            this.internalOnOffUpdate(accessory, false, callback)
          }
        })
      lightService
        .getCharacteristic(Characteristic.Hue)
        .on('set', (value, callback) => this.internalColourUpdate(accessory, value, callback))
      lightService
        .getCharacteristic(Characteristic.Saturation)
        .on('set', (value, callback) => callback())
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory)
    } catch (err) {
      this.log.warn(err)
    }
  }

  removeAccessory (accessory) {
    try {
      this.devicesInHB.delete(accessory.context.gvDeviceId)
      this.api.unregisterPlatformAccessories('homebridge-govee', 'Govee', [accessory])
      this.log('[%s] has been removed from Homebridge.', accessory.displayName)
    } catch (err) {
      this.log.warn("[%s] needed to be removed but couldn't as %s.", accessory.displayName, err)
    }
  }

  refreshAccessory (accessory, newParams) {
    const lightService = accessory.getService(Service.Lightbulb)
    const rgb = {}
    if (Object.prototype.hasOwnProperty.call(newParams, 'colorTemInKelvin')) {
      const rgbArray = cTemp.temp2rgb(newParams.colorTemInKelvin)
      rgb.r = rgbArray[0]
      rgb.b = rgbArray[1]
      rgb.g = rgbArray[2]
    } else {
      rgb.r = newParams.color.r
      rgb.g = newParams.color.g
      rgb.b = newParams.color.b
    }
    const newColour = cConvert.rgb.hsv(rgb.r, rgb.g, rgb.b)
    lightService
      .updateCharacteristic(Characteristic.On, newParams.powerState === 'on')
      .updateCharacteristic(Characteristic.Brightness, Math.round((newParams.brightness / 254) * 100))
      .updateCharacteristic(Characteristic.Hue, newColour[0])
      .updateCharacteristic(Characteristic.Saturation, newColour[1])
    accessory.context.online = newParams.online
    this.devicesInHB.set(accessory.context.gvDeviceId, accessory)
  }

  async internalOnOffUpdate (accessory, value, callback) {
    callback()
    try {
      await this.httpClient.updateDevice(accessory.context, {
        name: 'turn',
        value: value ? 'on' : 'off'
      })
      if (this.debug) {
        this.log('[%s] has been turned [%s].', accessory.displayName, value ? 'on' : 'off')
      }
      this.ignoreNextSync = true
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will be reverted soon. Error: \n%s.', accessory.displayName, err)
    }
  }

  async internalBrightnessUpdate (accessory, value, callback) {
    callback()
    try {
      await this.httpClient.updateDevice(accessory.context, {
        name: 'brightness',
        value: value
      })
      if (this.debug) {
        this.log('[%s] has changed brightness to [%s%].', accessory.displayName, value)
      }
      this.ignoreNextSync = true
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will be reverted soon. Error: \n%s.', accessory.displayName, err)
    }
  }

  async internalColourUpdate (accessory, value, callback) {
    callback()
    try {
      const lightService = accessory.getService(Service.Lightbulb)
      const curSat = lightService.getCharacteristic(Characteristic.Saturation).value
      const newRGB = cConvert.hsv.rgb(value, curSat, 100)
      const newColour = {
        r: newRGB[0],
        g: newRGB[1],
        b: newRGB[2]
      }
      await this.httpClient.updateDevice(accessory.context, {
        name: 'color',
        value: newColour
      })
      if (this.debug) {
        this.log('[%s] updating hue to [%s°].', accessory.displayName, value)
      }
      this.ignoreNextSync = true
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will be reverted soon. Error: \n%s.', accessory.displayName, err)
    }
  }
}
module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  return Govee
}

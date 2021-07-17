/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceSensorThermo {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.funcs = platform.funcs
    this.hapChar = platform.api.hap.Characteristic
    this.hapErr = platform.api.hap.HapStatusError
    this.hapServ = platform.api.hap.Service
    this.lang = platform.lang
    this.log = platform.log
    this.platform = platform

    // Set up variables from the accessory
    this.accessory = accessory
    this.name = accessory.displayName

    // Set up custom variables for this device type
    // Set up custom variables for this device type
    const deviceConf = platform.deviceConf[accessory.context.gvDeviceId]
    this.lowBattThreshold =
      deviceConf && deviceConf.lowBattThreshold
        ? Math.min(deviceConf.lowBattThreshold, 100)
        : platform.consts.defaultValues.lowBattThreshold

    // Set the correct logging variables for this accessory
    this.enableLogging = accessory.context.enableLogging
    this.enableDebugLogging = accessory.context.enableDebugLogging

    // Add the temperature service if it doesn't already exist
    this.tempService =
      this.accessory.getService(this.hapServ.TemperatureSensor) ||
      this.accessory.addService(this.hapServ.TemperatureSensor)

    // Add the humidity service if it doesn't already exist
    this.humiService =
      this.accessory.getService(this.hapServ.HumiditySensor) ||
      this.accessory.addService(this.hapServ.HumiditySensor)

    // Add the battery service if it doesn't already exist
    this.battService =
      this.accessory.getService(this.hapServ.Battery) ||
      this.accessory.addService(this.hapServ.Battery)

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('custom', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })

    // Output the customised options to the log
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable'
    })
    this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
  }

  externalUpdate (params) {
    // Check to see if the provided battery is different from the cached state
    if (params.battery !== this.cacheBatt) {
      // Battery is different so update Homebridge with new values
      this.cacheBatt = params.battery
      this.battService.updateCharacteristic(this.hapChar.BatteryLevel, this.cacheBatt)
      this.battService.updateCharacteristic(
        this.hapChar.StatusLowBattery,
        this.cacheBatt < this.lowBattThreshold ? 1 : 0
      )

      // Log the change if appropriate
      if (this.accessory.context.enableLogging) {
        this.log('[%s] %s [%s%].', this.name, this.lang.curBatt, this.cacheBatt)
      }
    }

    // Setup flag for eve entry
    let eveLog = false

    // Check to see if the provided temperature is different from the cached state
    if (this.funcs.hasProperty(params, 'temperature') && params.temperature !== this.cacheTempRaw) {
      // Temperature is different so update Homebridge with new values
      this.cacheTempRaw = params.temperature
      this.cacheTemp = parseInt(this.cacheTempRaw) / 100
      this.tempService.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp)

      // Log the change if appropriate
      if (this.accessory.context.enableLogging) {
        this.log('[%s] %s [%s°C].', this.name, this.lang.curTemp, this.cacheTemp)
      }
      eveLog = true
    }

    // Check to see if the provided humidity is different from the cached state
    if (this.funcs.hasProperty(params, 'humidity') && params.humidity !== this.cacheHumiRaw) {
      // Humidity is different so update Homebridge with new values
      this.cacheHumiRaw = params.humidity
      this.cacheHumi = Math.max(Math.min(parseInt(this.cacheHumiRaw / 100), 100), 0)
      this.humiService.updateCharacteristic(this.hapChar.CurrentRelativeHumidity, this.cacheHumi)

      // Log the change if appropriate
      if (this.accessory.context.enableLogging) {
        this.log('[%s] %s [%s°%].', this.name, this.lang.curHumi, this.cacheHumi)
      }
    }

    if (eveLog) {
      this.accessory.eveService.addEntry({
        temp: this.cacheTemp,
        humidity: this.cacheHumi,
        time: Math.round(new Date().valueOf() / 1000)
      })
    }
  }
}

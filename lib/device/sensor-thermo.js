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
    this.tempOffset =
      deviceConf && deviceConf.offset ? deviceConf.offset : platform.consts.defaultValues.offset
    this.humiOffset =
      deviceConf && deviceConf.humidityOffset
        ? parseInt(deviceConf.humidityOffset)
        : platform.consts.defaultValues.humidityOffset

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
      humidityOffset: this.humiOffset,
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable',
      lowBattThreshold: this.lowBattThreshold,
      offset: this.tempOffset
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
    if (this.funcs.hasProperty(params, 'temperature')) {
      const newTemp = parseInt(params.temperature) / 100 + this.tempOffset
      if (newTemp !== this.cacheTemp) {
        // Temperature is different so update Homebridge with new values
        this.cacheTemp = newTemp
        this.tempService.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp)

        // Log the change if appropriate
        if (this.accessory.context.enableLogging) {
          this.log('[%s] %s [%s°C].', this.name, this.lang.curTemp, this.cacheTemp)
        }
      }
      eveLog = true
    }

    // Check to see if the provided humidity is different from the cached state
    if (this.funcs.hasProperty(params, 'humidity')) {
      const newHumi = Math.max(Math.min(parseInt(params.humidity / 100 + this.humiOffset), 100), 0)
      if (newHumi !== this.cacheHumi) {
        // Humidity is different so update Homebridge with new values
        this.cacheHumi = newHumi
        this.humiService.updateCharacteristic(this.hapChar.CurrentRelativeHumidity, this.cacheHumi)

        // Log the change if appropriate
        if (this.accessory.context.enableLogging) {
          this.log('[%s] %s [%s°%].', this.name, this.lang.curHumi, this.cacheHumi)
        }
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

/* jshint node: true, esversion: 10, -W014, -W033 */
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
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable',
      lowBattThreshold: this.lowBattThreshold
    })
    this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
  }

  externalUpdate (params) {
    // Check to see if the provided online status is different from the cache value
    if (this.funcs.hasProperty(params, 'online') && this.cacheOnline !== params.online) {
      this.cacheOnline = params.online
      this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline)
    }

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

    // Check to see if the provided temperature is different from the cached state
    if (this.funcs.hasProperty(params, 'temperature')) {
      let newTemp = parseInt(params.temperature + this.accessory.context.offTemp)
      newTemp /= 100
      if (newTemp !== this.cacheTemp) {
        // Temperature is different so update Homebridge with new values
        this.cacheTemp = newTemp
        this.tempService.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp)
        this.accessory.eveService.addEntry({ temp: this.cacheTemp })

        // Log the change if appropriate
        if (this.accessory.context.enableLogging) {
          this.log('[%s] %s [%s°C].', this.name, this.lang.curTemp, this.cacheTemp)
        }
      }
    }

    // Check to see if the provided humidity is different from the cached state
    if (this.funcs.hasProperty(params, 'humidity')) {
      let newHumi = parseInt(params.humidity + this.accessory.context.offHumi)
      newHumi /= 100
      newHumi = Math.max(Math.min(newHumi, 100), 0)
      if (newHumi !== this.cacheHumi) {
        // Humidity is different so update Homebridge with new values
        this.cacheHumi = newHumi
        this.humiService.updateCharacteristic(this.hapChar.CurrentRelativeHumidity, this.cacheHumi)
        this.accessory.eveService.addEntry({ humidity: this.cacheHumi })

        // Log the change if appropriate
        if (this.accessory.context.enableLogging) {
          this.log('[%s] %s [%s%].', this.name, this.lang.curHumi, this.cacheHumi)
        }
      }
    }
  }
}

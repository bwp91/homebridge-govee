/* jshint node: true,esversion: 9, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceSensorLeak {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.eveChar = platform.eveChar
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
    const deviceConf = platform.deviceConf[accessory.context.gvDeviceId]
    this.lowBattThreshold =
      deviceConf && deviceConf.lowBattThreshold
        ? Math.min(deviceConf.lowBattThreshold, 100)
        : platform.consts.defaultValues.lowBattThreshold

    // Set the correct logging variables for this accessory
    this.enableLogging = accessory.context.enableLogging
    this.enableDebugLogging = accessory.context.enableDebugLogging

    // Add the leak sensor service if it doesn't already exist
    if (!(this.service = this.accessory.getService(this.hapServ.LeakSensor))) {
      this.service = this.accessory.addService(this.hapServ.LeakSensor)

      // Adding the characteristic here avoids Homebridge characteristic warnings
      this.service.addCharacteristic(this.eveChar.LastActivation)
    }

    // Add the battery service if it doesn't already exist
    this.battService =
      this.accessory.getService(this.hapServ.Battery) ||
      this.accessory.addService(this.hapServ.Battery)

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('motion', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })

    // Output the customised options to the log
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable'
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

    // Check to see if the provided leak status is different from the cached state
    if (params.leakDetected !== this.cacheLeak) {
      // Leak status is different so update Homebridge with new values
      this.cacheLeak = params.leakDetected
      this.service.updateCharacteristic(this.hapChar.LeakDetected, this.cacheLeak ? 1 : 0)

      // Add the alert to Eve if a leak has been detected
      if (this.cacheLeak) {
        this.service.updateCharacteristic(
          this.eveChar.LastActivation,
          Math.round(new Date().valueOf() / 1000) - this.accessory.eveService.getInitialTime()
        )
      }

      // Log the change if appropriate
      if (this.accessory.context.enableLogging) {
        this.log(
          '[%s] %s [%s].',
          this.name,
          this.lang.curLeak,
          this.cacheLeak ? this.lang.labelYes : this.lang.labelNo
        )
      }
    }

    // Check to see if the provided fault status is different from the cached state
    if (params.statusFault !== this.cacheFault) {
      // Fault status is different so update Homebridge with new values
      this.cacheFault = params.statusFault
      this.service.updateCharacteristic(this.hapChar.StatusFault, this.cacheFault ? 1 : 0)

      // Log the change if appropriate
      if (this.accessory.context.enableLogging) {
        this.log(
          '[%s] %s [%s].',
          this.name,
          this.lang.curFault,
          this.cacheFault ? this.lang.labelYes : this.lang.labelNo
        )
      }
    }
  }
}

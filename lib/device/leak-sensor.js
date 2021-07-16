/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceLeakSensor {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.lang = platform.lang
    this.log = platform.log
    this.funcs = platform.funcs
    this.hapChar = platform.api.hap.Characteristic
    this.hapErr = platform.api.hap.HapStatusError
    this.hapServ = platform.api.hap.Service
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

    // Add the switch service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.LeakSensor) ||
      this.accessory.addService(this.hapServ.LeakSensor)

    // Add the battery characteristic if it doesn't already exist
    if (!this.service.testCharacteristic(this.hapChar.BatteryLevel)) {
      this.service.addCharacteristic(this.hapChar.BatteryLevel)
    }

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
    /*
      We have:
      params.battery      -> INT[0, 100]
      params.leakDetected -> BOOL
      params.online       -> BOOL

      Characteristics to update:
      hapChar.LeakDetected
      hapChar.StatusFault
      hapChar.BatteryLevel
      hapChar.StatusLowBattery
    */

    if (params.battery !== this.cacheBatt) {
      this.cacheBatt = params.battery
      this.service.updateCharacteristic(this.hapChar.BatteryLevel, this.cacheBatt)
      this.service.updateCharacteristic(
        this.hapChar.StatusLowBattery,
        this.cacheBatt < this.lowBattThreshold ? 0 : 1
      )
      this.log('[%s] %s [%s%]', this.name, 'current battery', this.cacheBatt)
    }

    if (params.leakDetected !== this.cacheLeak) {
      this.cacheLeak = params.leakDetected
      this.service.updateCharacteristic(this.hapChar.LeakDetected, this.cacheLeak ? 1 : 0)
      this.log('[%s] %s [%s]', this.name, 'current leak', this.cacheLeak ? 'yes' : 'no')
    }

    if (params.statusFault !== this.cacheFault) {
      this.cacheFault = params.statusFault
      this.service.updateCharacteristic(this.hapChar.StatusFault, this.cacheFault ? 1 : 0)
      this.log('[%s] %s [%s]', this.name, 'current fault', this.cacheFault ? 'yes' : 'no')
    }
  }
}

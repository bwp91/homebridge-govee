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

    // Set the correct logging variables for this accessory
    this.enableLogging = accessory.context.enableLogging
    this.enableDebugLogging = accessory.context.enableDebugLogging

    // Add the switch service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.LeakSensor) ||
      this.accessory.addService(this.hapServ.LeakSensor)

    // Add the battery service if it doesn't already exist
    this.batteryService =
      this.accessory.getService(this.hapServ.BatteryService) ||
      this.accessory.addService(this.hapServ.BatteryService)

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

  externalUpdate (newParams) {
    // Log the incoming update if appropriate
    if (this.enableDebugLogging) {
      this.log(
        '[%s] %s [%s] [%s].',
        this.name,
        this.lang.receivingUpdate,
        newParams.source,
        JSON.stringify(newParams)
      )
    }
  }
}

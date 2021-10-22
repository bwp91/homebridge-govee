/* jshint node: true,esversion: 9, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceHeater {
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

    // Set the correct logging variables for this accessory
    this.enableLogging = accessory.context.enableLogging
    this.enableDebugLogging = accessory.context.enableDebugLogging

    // Add the fan service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.Fan) || this.accessory.addService(this.hapServ.Fan)

    // Add the set handler to the fan on/off characteristic
    this.service
      .getCharacteristic(this.hapChar.On)
      .onSet(async value => await this.internalStateUpdate(value))
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off'

    // Add the set handler to the fan rotation speed characteristic
    this.service.getCharacteristic(this.hapChar.RotationSpeed).setProps({
      minStep: 33,
      validValues: [0, 33, 66, 99]
    })
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value

    if (!this.service.testCharacteristic(this.hapChar.LockPhysicalControls)) {
      this.service.addCharacteristic(this.hapChar.LockPhysicalControls)
    }

    if (!this.service.testCharacteristic(this.hapChar.SwingMode)) {
      this.service.addCharacteristic(this.hapChar.SwingMode)
    }

    // Output the customised options to the log
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable'
    })
    this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
  }

  async internalStateUpdate (value) {
    try {
      const newValue = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (this.cacheState === newValue) {
        return
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateHeat',
        value: value ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI='
      })

      // Cache the new state and log if appropriate
      this.cacheState = newValue
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curState, newValue)
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn(
        '[%s] %s %s.',
        this.name,
        this.lang.devNotUpdated,
        eText.includes('p-queue') ? this.lang.timeout : eText
      )

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  externalUpdate (params) {
    this.log('%s.', JSON.stringify(params))

    switch (params.scene) {
      case 'MwEBAAAAAAAAAAAAAAAAAAAAADM=': {
        // Turned ON
        if (this.cacheState !== 'on') {
          this.cacheState = 'on'
          this.service.updateCharacteristic(this.hapChar.On, true)

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, this.lang.curState, this.cacheState)
          }
        }
        break
      }
      case 'MwEAAAAAAAAAAAAAAAAAAAAAADI=': {
        // Turned OFF
        if (this.cacheState !== 'off') {
          this.cacheState = 'off'
          this.service.updateCharacteristic(this.hapChar.On, false)

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, this.lang.curState, this.cacheState)
          }
        }
        break
      }
    }
  }
}

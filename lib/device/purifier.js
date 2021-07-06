/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class devicePurifier {
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
    const deviceConf = platform.lightDevices[accessory.context.gvDeviceId]

    // Set the correct logging variables for this accessory
    this.enableLogging = !platform.config.disableDeviceLogging
    this.enableDebugLogging = platform.config.debug
    if (deviceConf && deviceConf.overrideLogging) {
      switch (deviceConf.overrideLogging) {
        case 'standard':
          this.enableLogging = true
          this.enableDebugLogging = false
          break
        case 'debug':
          this.enableLogging = true
          this.enableDebugLogging = true
          break
        case 'disable':
          this.enableLogging = false
          this.enableDebugLogging = false
          break
      }
    }

    // If the accessory has a lightbulb service then remove it
    if (this.accessory.getService(this.hapServ.Lightbulb)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Lightbulb))
    }

    // If the accessory has a switch service then remove it
    if (this.accessory.getService(this.hapServ.Switch)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Switch))
    }

    // If the accessory has an outlet service then remove it
    if (this.accessory.getService(this.hapServ.Outlet)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Outlet))
    }

    // Add the purifier service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.AirPurifier) ||
      this.accessory.addService(this.hapServ.AirPurifier)

    // Add the set handler to the switch on/off characteristic
    this.service.getCharacteristic(this.hapChar.Active).onSet(async value => {
      await this.internalStateUpdate(value)
    })

    // Add options to the purifier target state characteristic
    this.service
      .getCharacteristic(this.hapChar.TargetAirPurifierState)
      .setProps({
        minValue: 1,
        maxValue: 1,
        validValues: [1]
      })
      .updateValue(1)

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('switch', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })

    // Output the customised options to the log
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable',
      showAs: 'purifier'
    })
    this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
  }

  async internalStateUpdate (value) {
    try {
      const onoff = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (onoff === this.cacheState) {
        return
      }

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppTurn
        throw new Error(eText)
      }

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, this.lang.devNotControl)
      }

      // Set up a two minute timeout for the plugin to ignore incoming updates
      const timerKey = Math.random()
        .toString(36)
        .substr(2, 8)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 120000)

      // Submit the request via the HTTP client
      await this.platform.sendDeviceUpdate(this.accessory, {
        name: 'turn',
        value: onoff
      })

      // Cache the new state and log if appropriate
      this.cacheState = onoff
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curState, this.cacheState)
      }

      // Add the entry to the Eve history service
      this.accessory.eveService.addEntry({ status: value ? 1 : 0 })
      this.service.updateCharacteristic(this.hapChar.CurrentAirPurifierState, value === 1 ? 2 : 0)
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.lang.devNotUpdated, eText)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  externalUpdate (newParams) {
    // Log the incoming update if appropriate
    if (this.enableDebugLogging && this.firstUpdateDone) {
      const params = JSON.stringify(newParams)
      const text = this.updateTimeout ? this.lang.ignoringUpdate : this.lang.receivingUpdate
      this.log('[%s] %s [%s].', this.name, text, params)
    }

    // Don't continue during the two minute timeout from controlling a device
    if (this.updateTimeout) {
      return
    }

    // Check to see if the provided online status is different from the cache value
    if (this.funcs.hasProperty(newParams, 'online')) {
      const status = this.funcs.parseStatus(newParams.online)
      if (this.cacheOnline !== status) {
        this.cacheOnline = status
        this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline)
      }
    }

    // Check to see if the provided state is different from the cached state
    if (newParams.powerState && newParams.powerState !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = newParams.powerState
      this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0)
      this.service.updateCharacteristic(
        this.hapChar.CurrentAirPurifierState,
        this.cacheState === 'on' ? 2 : 0
      )

      // Log the change if appropriate
      if (this.firstUpdateDone && this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curState, newParams.powerState)
      }

      // Add the entry to the Eve history service
      this.accessory.eveService.addEntry({ status: this.cacheState === 'on' ? 1 : 0 })
    }

    // Update the variable that the first run has completed
    this.firstUpdateDone = true
  }
}

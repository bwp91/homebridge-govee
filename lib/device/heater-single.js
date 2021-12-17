/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceHeaterSingle {
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
    this.temperatureSource = accessory.context.temperatureSource

    // Remove any old services from simulations
    ;['AirPurifier', 'Lightbulb', 'Outlet', 'Switch', 'Valve'].forEach(service => {
      if (this.accessory.getService(this.hapServ[service])) {
        this.accessory.removeService(this.accessory.getService(this.hapServ[service]))
      }
    })

    // Set up the accessory with default target temp when added the first time
    if (!this.funcs.hasProperty(this.accessory.context, 'cacheTarget')) {
      this.accessory.context.cacheTarget = 20
    }

    // Check to make sure user has not switched from cooler to heater
    if (this.accessory.context.cacheType !== 'heater') {
      // Remove and re-setup as a HeaterCooler
      if (this.accessory.getService(this.hapServ.HeaterCooler)) {
        this.accessory.removeService(this.accessory.getService(this.hapServ.HeaterCooler))
      }
      this.accessory.context.cacheType = 'heater'
      this.accessory.context.cacheTarget = 20
    }

    // Add the heater service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.HeaterCooler) ||
      this.accessory.addService(this.hapServ.HeaterCooler)

    // Set custom properties of the current temperature characteristic
    this.service.getCharacteristic(this.hapChar.CurrentTemperature).setProps({
      minStep: 0.1
    })
    this.cacheTemp = this.service.getCharacteristic(this.hapChar.CurrentTemperature).value

    // Add the set handler to the heater active characteristic
    this.service
      .getCharacteristic(this.hapChar.Active)
      .onSet(async value => await this.internalStateUpdate(value))

    // Add options to the target state characteristic
    this.service.getCharacteristic(this.hapChar.TargetHeaterCoolerState).setProps({
      minValue: 0,
      maxValue: 0,
      validValues: [0]
    })

    // Add the set handler to the target temperature characteristic
    this.service
      .getCharacteristic(this.hapChar.HeatingThresholdTemperature)
      .updateValue(this.accessory.context.cacheTarget)
      .setProps({ minStep: 0.5 })
      .onSet(async value => await this.internalTargetTempUpdate(value))

    // Initialise these caches now since they aren't determined by the initial externalUpdate()
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value === 1 ? 'on' : 'off'
    this.cacheHeat =
      this.cacheState === 'on' &&
      this.service.getCharacteristic(this.hapChar.TargetHeaterCoolerState).value === 2
        ? 'on'
        : 'off'

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('custom', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })

    // Set up an interval to get regular temperature updates
    setTimeout(() => {
      this.getTemperature()
      this.intervalPoll = setInterval(() => this.getTemperature(), 120000)
    }, 5000)

    // Stop the intervals on Homebridge shutdown
    platform.api.on('shutdown', () => {
      clearInterval(this.intervalPoll)
    })

    // Output the customised options to the log
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable',
      showAs: 'heater',
      temperatureSource: this.temperatureSource
    })
    this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
  }

  async internalStateUpdate (value) {
    try {
      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds &&
        !this.accessory.context.supportedCmds.includes('turn')
      ) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppTurn
        throw new Error(eText)
      }

      let newState
      let newHeat
      let newValue
      if (value === 0) {
        newValue = 'off'
        newState = 'off'
        newHeat = 'off'
      } else {
        if (this.cacheTemp < this.accessory.context.cacheTarget) {
          newValue = 'on'
          newState = 'on'
          newHeat = 'on'
        } else {
          newValue = 'off'
          newState = 'on'
          newHeat = 'off'
        }
      }

      // Only send the update if either:
      // * The new value (state) is OFF and the cacheHeat was ON
      // * The new value (state) is ON and newHeat is 'on'
      if ((value === 0 && this.cacheHeat === 'on') || (value === 1 && newHeat === 'on')) {
        // Log a message in debug if the device is not currently controllable
        if (!this.cacheOnline && this.enableDebugLogging) {
          this.log('[%s] %s.', this.name, this.lang.devNotControl)
        }

        // Set up a one minute timeout for the plugin to ignore incoming updates
        const timerKey = this.funcs.generateRandomString(5)
        this.updateTimeout = timerKey
        setTimeout(() => {
          if (this.updateTimeout === timerKey) {
            this.updateTimeout = false
          }
        }, 60000)

        // Send the request to the platform sender function
        await this.platform.sendDeviceUpdate(this.accessory, {
          cmd: 'state',
          value: newValue
        })
      }

      // Cache and log
      if (newState !== this.cacheState) {
        this.cacheState = newState
        if (this.enableLogging) {
          this.log('[%s] %s [%s].', this.name, this.lang.curState, this.cacheState)
        }
      }
      if (newHeat !== this.cacheHeat) {
        this.cacheHeat = newHeat
        if (this.enableLogging) {
          this.log('[%s] %s [%s].', this.name, this.lang.curHeat, this.cacheHeat)
        }
      }
      this.service.updateCharacteristic(
        this.hapChar.CurrentHeaterCoolerState,
        value === 1 ? (this.cacheHeat === 'on' ? 2 : 1) : 0
      )
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
        this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  async internalTargetTempUpdate (value) {
    try {
      // Don't continue if the new value is the same as before
      if (value === this.accessory.context.cacheTarget) {
        return
      }
      this.accessory.context.cacheTarget = value
      if (this.enableLogging) {
        this.log('[%s] %s [%s°C].', this.name, this.lang.curTarg, value)
      }
      if (this.cacheState === 'off') {
        return
      }

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds &&
        !this.accessory.context.supportedCmds.includes('turn')
      ) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppTurn
        throw new Error(eText)
      }

      // Check to see if we need to turn on or off
      let newValue
      let newHeat
      if (this.cacheTemp < value) {
        newValue = 'on'
        newHeat = 'on'
      } else {
        newValue = 'off'
        newHeat = 'off'
      }

      // Don't continue if no change needed to device state
      if (newHeat === this.cacheHeat) {
        return
      }

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, this.lang.devNotControl)
      }

      // Set up a one minute timeout for the plugin to ignore incoming updates
      const timerKey = this.funcs.generateRandomString(5)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 60000)

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'state',
        value: newValue
      })

      // Cache and log
      this.cacheHeat = newHeat
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curHeat, this.cacheHeat)
      }
      this.service.updateCharacteristic(
        this.hapChar.CurrentHeaterCoolerState,
        this.cacheHeat === 'on' ? 2 : 1
      )
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
        this.service.updateCharacteristic(
          this.hapChar.HeatingThresholdTemperature,
          this.accessory.context.cacheTarget
        )
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  async internalCurrentTempUpdate () {
    try {
      // Don't continue if the device is off
      if (this.cacheState === 'off') {
        return
      }

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds &&
        !this.accessory.context.supportedCmds.includes('turn')
      ) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppTurn
        throw new Error(eText)
      }

      // Check to see if we need to turn on or off
      let newValue
      let newHeat
      if (this.cacheTemp < this.accessory.context.cacheTarget) {
        newValue = 'on'
        newHeat = 'on'
      } else {
        newValue = 'off'
        newHeat = 'off'
      }

      // Don't continue if no change needed to device state
      if (newHeat === this.cacheHeat) {
        return
      }

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, this.lang.devNotControl)
      }

      // Set up a one minute timeout for the plugin to ignore incoming updates
      const timerKey = this.funcs.generateRandomString(5)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 60000)

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'state',
        value: newValue
      })

      // Log and cache
      this.cacheHeat = newHeat
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curHeat, this.cacheHeat)
      }
      this.service.updateCharacteristic(
        this.hapChar.CurrentHeaterCoolerState,
        this.cacheHeat === 'on' ? 2 : 1
      )
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s.', this.name, eText)
    }
  }

  async getTemperature () {
    try {
      // Skip polling if the storage hasn't initialised properly
      if (!this.platform.storageClientData) {
        return
      }

      const newTemp = await this.platform.storageData.getItem(this.temperatureSource + '_temp')
      if (newTemp && newTemp !== this.cacheTemp) {
        this.cacheTemp = newTemp
        this.service.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp)
        this.accessory.eveService.addEntry({ temp: this.cacheTemp })
        if (this.enableLogging) {
          this.log('[%s] %s [%s°C].', this.name, this.lang.curTemp, this.cacheTemp)
        }
        await this.internalCurrentTempUpdate()
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s.', this.name, eText)
    }
  }

  externalUpdate (params) {}
}

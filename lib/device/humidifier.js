/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceHumidifier {
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

    // Speed codes
    this.value2Code = {
      1: 'MwUBAQAAAAAAAAAAAAAAAAAAADY=',
      2: 'MwUBAgAAAAAAAAAAAAAAAAAAADU=',
      3: 'MwUBAwAAAAAAAAAAAAAAAAAAADQ=',
      4: 'MwUBBAAAAAAAAAAAAAAAAAAAADM=',
      5: 'MwUBBQAAAAAAAAAAAAAAAAAAADI=',
      6: 'MwUBBgAAAAAAAAAAAAAAAAAAADE=',
      7: 'MwUBBwAAAAAAAAAAAAAAAAAAADA=',
      8: 'MwUBCAAAAAAAAAAAAAAAAAAAAD8='
    }

    // Add the fan service if it doesn't already exist
    this.service =
      this.accessory.getService(this.hapServ.HumidifierDehumidifier) || this.accessory.addService(this.hapServ.HumidifierDehumidifier)

    this.service
        .getCharacteristic(this.hapChar.TargetHumidifierDehumidifierState)
        .setProps({
          validValues: [1]
        })
        .updateValue(1)
    this.service
        .getCharacteristic(this.hapChar.RelativeHumidityDehumidifierThreshold)
        .setProps({
          validValues: [100]
        })
        .updateValue(100)

    this.service
        .getCharacteristic(this.hapChar.Active)
        .onSet(async value => await this.internalStateUpdate(value))
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value;
    this.service
        .getCharacteristic(this.hapChar.CurrentHumidifierDehumidifierState)
        .setProps({
          validValues: [0, 2]
        })
        .updateValue(this.cacheState ? 2 : 0)

    this.service
        .getCharacteristic(this.hapChar.RelativeHumidityHumidifierThreshold)
        .setProps({
          minValue: 0,
          maxValue: 100,
          minStep: 1
        })
        .onSet(async percent => await this.internalHumidityUpdate(percent))
    this.cachePercent = this.service.getCharacteristic(this.hapChar.RelativeHumidityHumidifierThreshold).value;
    if (this.cachePercent < 1) {
      this.cachePercent = 1;
    } else if (this.cachePercent > 100) {
      this.cachePercent = 100;
    }
    this.cacheLevel = this._percentToHumidityLevel(this.cachePercent)

    // Output the customised options to the log
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : this.enableLogging ? 'standard' : 'disable'
    })
    this.log('[%s] %s %s. %d %d', this.name, this.lang.devInitOpts, opts, this.cacheState, this.cachePercent)
  }

  async internalStateUpdate (value) {
    try {

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateHumi',
        value: value
      })

      // Cache the new state and log if appropriate
      this.cacheState = value
      if (this.enableLogging) {
        this.log('[%s] %s [%d].', this.name, this.lang.curState, value)
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
        this.service.setCharacteristic(this.hapChar.Active, this.cacheState)
        this.service.setCharacteristic(this.hapChar.CurrentHumidifierDehumidifierState, this.cacheState ? 2 : 0)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  _percentToHumidityLevel (percent) {
    let level = Math.round(0.0707070707070707 * percent + 0.93);
    if (level < 1) {
      return 1;
    } else if (level > 8) {
      return 8
    }

    return level;
  }

  _humidityLevelToPercent (level) {
    const percent = Math.round(14.142857142857142 * level - 13.14);
    if (percent < 1) {
      return 1;
    } else if (percent > 100) {
      return 100;
    }

    return percent;
  }

  async internalHumidityUpdate (newPercent) {
    try {
      // Get the single Govee value {1, 2, ..., 8}
      if (newPercent < 1) {
        newPercent = 1;
      } else if (newPercent > 100) {
        newPercent = 100;
      }
      this.log('%d %d %d', newPercent, this.cachePercent, this.cacheLevel)
      let newValue = this._percentToHumidityLevel(newPercent)
      if (newValue < 1) {
        newValue = 1;
      } else if (newValue > 8) {
        newValue = 8;
      }

      // Don't continue if the speed value won't have effect
      this.cachePercent = newPercent
      // Cache the new state and log if appropriate
      if (this.enableLogging) {
        this.log('[%s] %s [%d %d].', this.name, this.lang.curSpeed, newValue, newPercent)
      }
      if (newValue === this.cacheLevel) {
        this.log('No change in mist level')
        return
      }
      this.cacheLevel = newValue

      // Get the scene code for this value
      const newCode = this.value2Code[newValue]

      // Send the request to the platform sender function
      this.log('Update mist level')
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedHumi',
        value: newCode
      })
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
        this.cachePercent = this.cachePercent ? this.cachePercent : 1
        this.service.updateCharacteristic(this.hapChar.RelativeHumidityHumidifierThreshold, this.cachePercent)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  externalUpdate (params) {
    // Check for an ON/OFF change
    params.scene = params.command ? JSON.parse(params.command)[0] : null
    if (params.state && params.state !== this.cacheState) {
      this.cacheState = params.state === 'on' ? 1 : 0

      this.service.updateCharacteristic(this.hapChar.CurrentHumidifierDehumidifierState, this.cacheState ? 2 : 0)
      this.service.updateCharacteristic(this.hapChar.Active, this.cacheState)

      // Log the change if appropriate
      if (this.enableLogging) {
        this.log('[%s] %s [%d].', this.name, this.lang.curState, this.cacheState)
      }
    }

    // Check for some scene change
    if (params.scene) {
      this.log('Receiving percentage change %s', params.scene)
      if (Object.values(this.value2Code).includes(params.scene)) {
        Object.keys(this.value2Code).forEach((key, idx) => {
          if (this.value2Code[key] === params.scene) {
            this.log('Found match %s', key)
            this.cacheLevel = parseInt(key)
            this.cachePercent = this._humidityLevelToPercent(this.cacheLevel)
            this.cachePercent = this.cachePercent ? this.cachePercent : 1
            this.log('Updating percent %d %d', this.cachePercent, this.cacheLevel)
            this.service.updateCharacteristic(this.hapChar.RelativeHumidityHumidifierThreshold, this.cachePercent)
          }
        })
      } else {
        this.log.warn(
            '[%s] New/Unknown scene code received:\n%s.',
            this.name,
            JSON.stringify(params)
        )
      }
    }
  }
}

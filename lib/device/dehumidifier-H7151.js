import {
  base64ToHex,
  getTwoItemPosition,
  hexToTwoItems,
  parseError,
} from '../utils/functions.js'
import platformLang from '../utils/lang-en.js'

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.hapChar = platform.api.hap.Characteristic
    this.hapErr = platform.api.hap.HapStatusError
    this.hapServ = platform.api.hap.Service
    this.platform = platform

    // Set up variables from the accessory
    this.accessory = accessory

    // Rotation speed to value in {1, 2, ..., 8}
    this.speed2Value = speed => Math.min(Math.max(Number.parseInt(Math.round(speed / 10), 10), 1), 8)

    // Speed codes
    this.value2Code = {
      1: 'MwUBAQAAAAAAAAAAAAAAAAAAADY=',
      2: 'MwUBAgAAAAAAAAAAAAAAAAAAADU=',
      3: 'MwUBAwAAAAAAAAAAAAAAAAAAADQ=',
      4: 'MwUBBAAAAAAAAAAAAAAAAAAAADM=',
      5: 'MwUBBQAAAAAAAAAAAAAAAAAAADI=',
      6: 'MwUBBgAAAAAAAAAAAAAAAAAAADE=',
      7: 'MwUBBwAAAAAAAAAAAAAAAAAAADA=',
      8: 'MwUBCAAAAAAAAAAAAAAAAAAAAD8=',
    }

    // Add the fan service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Fan) || this.accessory.addService(this.hapServ.Fan)

    // Add the set handler to the fan on/off characteristic
    this.service
      .getCharacteristic(this.hapChar.On)
      .onSet(async value => this.internalStateUpdate(value))
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off'

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 10,
        validValues: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      })
      .onSet(async value => this.internalSpeedUpdate(value))
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value

    // Output the customised options to the log
    const opts = JSON.stringify({})
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts)
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (this.cacheState === newValue) {
        return
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateHumi',
        value: value ? 1 : 0,
      })

      // Cache the new state and log if appropriate
      this.cacheState = newValue
      this.accessory.log(`${platformLang.curState} [${newValue}]`)
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  async internalSpeedUpdate(value) {
    try {
      // Don't continue if the speed is 0
      if (value === 0) {
        return
      }

      // Get the single Govee value {1, 2, ..., 8}
      const newValue = this.speed2Value(value)

      // Don't continue if the speed value won't have effect
      if (newValue * 10 === this.cacheSpeed) {
        return
      }

      // Get the scene code for this value
      const newCode = this.value2Code[newValue]

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: newCode,
      })

      // Cache the new state and log if appropriate
      this.cacheSpeed = newValue * 10
      this.accessory.log(`${platformLang.curSpeed} [${newValue}]`)
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  externalUpdate(params) {
    // Check for an ON/OFF change
    if (params.state && params.state !== this.cacheState) {
      this.cacheState = params.state
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`)
    }

    // Check for some other scene/mode change
    (params.commands || []).forEach((command) => {
      const hexString = base64ToHex(command)
      const hexParts = hexToTwoItems(hexString)

      // Return now if not a device query update code
      if (getTwoItemPosition(hexParts, 1) !== 'aa') {
        return
      }

      const deviceFunction = `${getTwoItemPosition(hexParts, 1)}${getTwoItemPosition(hexParts, 2)}`

      switch (deviceFunction) {
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)
          break
      }
    })
  }
}

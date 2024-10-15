import { hs2rgb } from '../utils/colour.js'
import {
  base64ToHex,
  generateCodeFromHexValues,
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

    // Add the night light service if it doesn't already exist
    this.lightService = this.accessory.getService(this.hapServ.Lightbulb)
    || this.accessory.addService(this.hapServ.Lightbulb)

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

    // Add the set handler to the lightbulb on/off characteristic
    this.lightService.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalLightStateUpdate(value)
    })
    this.cacheLightState = this.lightService.getCharacteristic(this.hapChar.On).value ? 'on' : 'off'

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
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`)
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

  async internalLightStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (this.cacheLightState === newValue) {
        return
      }

      // Generate the hex values for the code
      let hexValues
      if (value) {
        // Calculate current RGB values
        const newRGB = hs2rgb(
          this.lightService.getCharacteristic(this.hapChar.Hue).value,
          this.lightService.getCharacteristic(this.hapChar.Saturation).value,
        )
        hexValues = [0x33, 0x1B, 0x01, this.cacheBright, ...newRGB]
      } else {
        hexValues = [0x33, 0x1B, 0x00]
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: generateCodeFromHexValues(hexValues),
      })

      // Cache the new state and log if appropriate
      if (this.cacheLightState !== newValue) {
        this.cacheLightState = newValue
        this.accessory.log(`${platformLang.curLight} [${newValue}]`)
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.lightService.updateCharacteristic(this.hapChar.On, this.cacheLightState === 'on')
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

      const deviceFunction = `${getTwoItemPosition(hexParts, 2)}${getTwoItemPosition(hexParts, 3)}`

      switch (deviceFunction) {
        case '1b00': // night light off
        case '1b01': { // night light on
          const newNight = deviceFunction === '1b01' ? 'on' : 'off'
          if (newNight !== this.cacheLightState) {
            this.cacheLightState = newNight
            this.lightService.updateCharacteristic(this.hapChar.On, this.cacheLightState === 'on')
            this.accessory.log(`current night light state [${this.cacheLightState}]`)
          }
          break
        }
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)
          break
      }
    })
  }
}

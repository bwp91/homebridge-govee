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

    // Codes etc
    this.speedCodes = {
      7: 'MwUBAQAAAAAAAAAAAAAAAAAAADY=',
      14: 'MwUBAgAAAAAAAAAAAAAAAAAAADU=',
      21: 'MwUBAwAAAAAAAAAAAAAAAAAAADQ=',
      28: 'MwUBBAAAAAAAAAAAAAAAAAAAADM=',
      35: 'MwUBBQAAAAAAAAAAAAAAAAAAADI=',
      42: 'MwUBBgAAAAAAAAAAAAAAAAAAADE=',
      49: 'MwUBBwAAAAAAAAAAAAAAAAAAADA=',
      56: 'MwUBCAAAAAAAAAAAAAAAAAAAAD8=',
      63: 'MwUBCQAAAAAAAAAAAAAAAAAAAD4=',
      70: 'MwUBCgAAAAAAAAAAAAAAAAAAAD0=', // guessed
      77: 'MwUBCwAAAAAAAAAAAAAAAAAAADw=', // guessed
      84: 'MwUBDAAAAAAAAAAAAAAAAAAAADs=', // guessed
    }

    // Remove any old original Fan services
    if (this.accessory.getService(this.hapServ.Fan)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Fan))
    }

    // temp: remove any old lightbulb services
    if (this.accessory.getService(this.hapServ.Lightbulb)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Lightbulb))
    }

    // Add the fan service for the fan if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Fanv2) || this.accessory.addService(this.hapServ.Fanv2)

    // Add the set handler to the fan on/off characteristic
    this.service
      .getCharacteristic(this.hapChar.Active)
      .onSet(async value => this.internalStateUpdate(value))
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value ? 'on' : 'off'

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 7,
        minValue: 0,
        validValues: [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91],
      })
      .onSet(async value => this.internalSpeedUpdate(value))
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value
    this.cacheMode = this.cacheSpeed >= 91 ? 'auto' : 'manual'

    // Add the set handler to the fan swing mode
    this.service
      .getCharacteristic(this.hapChar.SwingMode)
      .onSet(async value => this.internalSwingUpdate(value))
    this.cacheSwing = this.service.getCharacteristic(this.hapChar.SwingMode).value === 1 ? 'on' : 'off'

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
        cmd: 'ptReal',
        value: value ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI=',
      })

      // Cache the new state and log if appropriate
      if (this.cacheState !== newValue) {
        this.cacheState = newValue
        this.accessory.log(`${platformLang.curState} [${newValue}]`)
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  async internalSpeedUpdate(value) {
    try {
      if (value < 3) {
        return
      }

      let newValue
      if (value < 10) {
        newValue = 7
      } else if (value < 17) {
        newValue = 14
      } else if (value < 24) {
        newValue = 21
      } else if (value < 31) {
        newValue = 28
      } else if (value < 38) {
        newValue = 35
      } else if (value < 45) {
        newValue = 42
      } else if (value < 52) {
        newValue = 49
      } else if (value < 59) {
        newValue = 56
      } else if (value < 66) {
        newValue = 63
      } else if (value < 73) {
        newValue = 70
      } else if (value < 80) {
        newValue = 77
      } else if (value < 87) {
        newValue = 84
      } else {
        newValue = 91
      }

      let newMode = value === 91 ? 'auto' : 'manual'

      // Don't continue if the new value is the same as before
      if (this.cacheSpeed === newValue) {
        return
      }

      // Don't continue if trying to access auto mode but there is no sensor attached
      let codeToSend
      if (newMode === 'auto') {
        if (!this.accessory.context.sensorAttached || !this.cacheAutoCode) {
          this.accessory.logWarn('auto mode not supported without a linked sensor')
          codeToSend = this.speedCodes[84]
          newMode = 'manual'
          newValue = 84
        } else {
          codeToSend = this.cacheAutoCode
        }
      } else {
        codeToSend = this.speedCodes[newValue]
      }

      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: codeToSend,
      })

      // Cache the new state and log if appropriate
      if (this.cacheMode !== newMode) {
        this.cacheMode = newMode
        this.accessory.log(`${platformLang.curMode} [${this.cacheMode}]`)
      }
      if (this.cacheSpeed !== newValue) {
        this.cacheSpeed = newValue
        this.accessory.log(`${platformLang.curSpeed} [${newValue}%]`)
      }
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

  async internalSwingUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off'
      // Don't continue if the new value is the same as before
      if (this.cacheSwing === value) {
        return
      }

      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: value ? 'Mx8BAQAAAAAAAAAAAAAAAAAAACw=' : 'Mx8BAAAAAAAAAAAAAAAAAAAAAC0=',
      })

      // Cache the new state and log if appropriate
      if (this.cacheSwing !== newValue) {
        this.cacheSwing = newValue
        this.accessory.log(`${platformLang.curSwing} [${newValue}]`)
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.SwingMode, this.cacheSwing === 'on' ? 1 : 0)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  externalUpdate(params) {
    // Update the active characteristic
    if (params.state && params.state !== this.cacheState) {
      this.cacheState = params.state
      this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0)
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

      if (getTwoItemPosition(hexParts, 2) === '08') {
        // Sensor Attached?
        const dev = hexString.substring(4, hexString.length - 24)
        this.accessory.context.sensorAttached = dev !== '000000000000'
        return
      }

      const deviceFunction = `${getTwoItemPosition(hexParts, 2)}${getTwoItemPosition(hexParts, 3)}`
      this.accessory.logWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)
      switch (deviceFunction) {
        case '0501': {
          // Fan speed
          const newSpeed = getTwoItemPosition(hexParts, 4)
          const newSpeedInt = Number.parseInt(newSpeed, 10) * 7
          const newMode = 'manual'
          if (this.cacheMode !== newMode) {
            this.cacheMode = newMode
            this.accessory.log(`${platformLang.curMode} [${this.cacheMode}]`)
          }
          if (this.cacheSpeed !== newSpeedInt) {
            this.cacheSpeed = newSpeedInt
            this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed)
            this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}%]`)
          }
          break
        }
        case '0500': {
          // Auto mode on/off
          // Maybe this relates to
          // (Guess) Fixed Speed: 1
          // Custom:              2
          // Auto:                3
          // Sleep:               5
          // Nature:              6
          // Turbo:               7
          const newMode = getTwoItemPosition(hexParts, 4) === '03' ? 'auto' : 'manual'
          if (this.cacheMode !== newMode) {
            this.cacheMode = newMode
            this.accessory.log(`${platformLang.curMode} [${this.cacheMode}]`)

            if (this.cacheMode === 'auto' && this.cacheSpeed < 91) {
              this.cacheSpeed = 91
              this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed)
              this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}%]`)
            }
          }
          break
        }
        case '0503': {
          // Auto mode, we need to keep this code to send it back to the device
          const code = hexToTwoItems(`33${hexString.substring(2, hexString.length - 2)}`)
          this.cacheAutoCode = generateCodeFromHexValues(code.map(p => Number.parseInt(p, 16)))
          break
        }
        case '1f01': {
          // Swing Mode
          const newSwing = getTwoItemPosition(hexParts, 4) === '01' ? 'on' : 'off'
          if (this.cacheSwing !== newSwing) {
            this.cacheSwing = newSwing
            this.service.updateCharacteristic(this.hapChar.SwingMode, this.cacheSwing === 'on' ? 1 : 0)
            this.accessory.log(`${platformLang.curSwing} [${this.cacheSwing}]`)
          }
          break
        }
        default:
          // this.accessory.logWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)
          break
      }
    })
  }
}

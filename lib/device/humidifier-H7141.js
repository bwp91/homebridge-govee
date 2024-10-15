import {
  base64ToHex,
  getTwoItemPosition,
  hexToTwoItems,
  parseError,
} from '../utils/functions.js'
import platformLang from '../utils/lang-en.js'

/*
  H7141
  {
    "mode": {
      "options": [
        {
          "name": "Custom",
          "value": 2
        },
        {
          "name": "Auto",
          "value": 3
        }
      ]
    },
    "gear": {
      "options": [
        {
          "name": "gear",
          "value": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8
          ]
        }
      ]
    }
  }
*/
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
    this.cacheSpeedRaw = `0${this.cacheSpeed / 10}` // example '02' for 20%

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
        case '0500': { // mode
          // Mode
          const newModeRaw = getTwoItemPosition(hexParts, 4)
          let newMode
          switch (newModeRaw) {
            case '01': {
              // Manual
              newMode = 'manual'
              break
            }
            case '02': {
              // Custom
              newMode = 'custom'
              break
            }
            case '03': {
              // Auto
              newMode = 'auto'
              break
            }
            default:
              return
          }
          if (this.cacheMode !== newMode) {
            this.cacheMode = newMode
            this.accessory.log(`${platformLang.curMode} [${this.cacheMode}]`)
          }
          this.accessory.logDebug(`mode: ${command}`)
          break
        }
        case '0501': {
          // Manual speed
          const newSpeedRaw = getTwoItemPosition(hexParts, 4)
          if (newSpeedRaw !== this.cacheSpeedRaw) {
            this.cacheSpeedRaw = newSpeedRaw
            this.cacheSpeed = Number.parseInt(newSpeedRaw, 10) * 10
            this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed)
            this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`)
          }
          this.accessory.logDebug(`speed: ${command}`)
          break
        }
        case '1100': // timer
        case '1101': // timer
        case '1300': // scheduling
        case '1500': // scheduling
        case '1800': { // indicator light
          break
        }
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)
          break
      }
    })
  }
}

// H7141
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qhIAAAAAAAAAAAAAAAAAAAAAALg=] [aa12 0000 000000000000000000000000000000b8].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qhEAAAAAAAAAAAAAAAAAAAAAALs=] [aa11 0000 000000000000000000000000000000bb].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qgUAAQAAAAAAAAAAAAAAAAAAAK4=] [aa05 0001 000000000000000000000000000000ae].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qgUBCAAAAAAAAAAAAAAAAAAAAKY=] [aa05 0108 000000000000000000000000000000a6].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qgUCAAgAPAA8BQA8ADwB/////6E=] [aa05 0200 08003c003c05003c003c01ffffffffa1].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qgUDuAAAAAAAAAAAAAAAAAAAABQ=] [aa05 03b8 00000000000000000000000000000014].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qhYACAAWDwAAAAAAAAAAAAAAAK0=] [aa16 0008 00160f000000000000000000000000ad].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qghrCzU3MsUAAAAAAAAAAAAAADc=] [aa08 6b0b 353732c5000000000000000000000037].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qhABAvveAAAAAAAAAAAAAAAAAJw=] [aa10 0102 fbde000000000000000000000000009c].
// [25/12/2022, 06:22:13] [Govee] [Small Humidifier] new scene code: [qhgACAAWDwAAAAAAAAAAAAAAAKM=] [aa18 0008 00160f000000000000000000000000a3].
// [25/12/2022, 06:35:49] [Govee] [Small Humidifier] new scene code: [qhABAvAbAAAAAAAAAAAAAAAAAFI=] [aa10 0102 f01b0000000000000000000000000052].
// [25/12/2022, 06:39:44] [Govee] [Small Humidifier] new scene code: [qhABAvfUAAAAAAAAAAAAAAAAAJo=] [aa10 0102 f7d4000000000000000000000000009a].
// [25/12/2022, 06:41:32] [Govee] [Small Humidifier] new scene code: [qh4CAAAAAAAAAAAAAAAAAAAAALY=] [aa1e 0200 000000000000000000000000000000b6].
// [25/12/2022, 06:41:32] [Govee] [Small Humidifier] new scene code: [qh4CAAAAAAAAAAAAAAAAAAAAALY=] [aa1e 0200 000000000000000000000000000000b6].

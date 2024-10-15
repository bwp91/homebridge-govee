import {
  base64ToHex,
  getTwoItemPosition,
  hexToTwoItems,
  parseError,
  sleep,
} from '../utils/functions.js'
import platformLang from '../utils/lang-en.js'

/*
  Custom Mode:                                 aa050001010000000000000000000000000000af

  Green Tea:      MwUAAgAAAAAAAAAAAAAAAAAAADQ= 3305000200000000000000000000000000000034 [switch]
                  MwEBAgAAAAAAAAAAAAAAAAAAADk= 3301010200000000000000000000000000000039 [enable]

  Oolong Tea:     MwUAAwAAAAAAAAAAAAAAAAAAADU= 3305000300000000000000000000000000000035 [switch]
                  MwEBAwAAAAAAAAAAAAAAAAAAADg= 3301010300000000000000000000000000000038 [enable]

  Coffee:         MwUABAAAAAAAAAAAAAAAAAAAADI= 3305000400000000000000000000000000000032 [switch]
                  MwEBBAAAAAAAAAAAAAAAAAAAADc= 3301010400000000000000000000000000000037 [enable]

  Black Tea/Boil: MwUABQAAAAAAAAAAAAAAAAAAADM= 3305000500000000000000000000000000000033 [switch]
                  MwEBBQAAAAAAAAAAAAAAAAAAADY= 3301010500000000000000000000000000000036 [enable]
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
    const deviceConf = platform.deviceConf[accessory.context.gvDeviceId] || {}

    this.codes = {
      greenTea: 'MwUAAgAAAAAAAAAAAAAAAAAAADQ=',
      oolongTea: 'MwUAAwAAAAAAAAAAAAAAAAAAADU=',
      coffee: 'MwUABAAAAAAAAAAAAAAAAAAAADI=',
      blackTea: 'MwUABQAAAAAAAAAAAAAAAAAAADM=',
      customMode1: 'MwUAAQEAAAAAAAAAAAAAAAAAADY=',
      customMode2: 'MwUAAQIAAAAAAAAAAAAAAAAAADU=',
    }

    // Add a switch service for Green Tea
    this.service1 = this.accessory.getService('Green Tea')
    if (deviceConf.hideModeGreenTea) {
      if (this.service1) {
        this.accessory.removeService(this.service1)
      }
    } else if (!this.service1) {
      this.service1 = this.accessory.addService(this.hapServ.Switch, 'Green Tea', 'greenTea')
      this.service1.addCharacteristic(this.hapChar.ConfiguredName)
      this.service1.updateCharacteristic(this.hapChar.ConfiguredName, 'Green Tea')
      this.service1.addCharacteristic(this.hapChar.ServiceLabelIndex)
      this.service1.updateCharacteristic(this.hapChar.ServiceLabelIndex, 1)
    }

    // Add a switch service for Oolong Tea
    this.service2 = this.accessory.getService('Oolong Tea')
    if (deviceConf.hideModeOolongTea) {
      if (this.service2) {
        this.accessory.removeService(this.service2)
      }
    } else if (!this.service2) {
      this.service2 = this.accessory.addService(this.hapServ.Switch, 'Oolong Tea', 'oolongTea')
      this.service2.addCharacteristic(this.hapChar.ConfiguredName)
      this.service2.updateCharacteristic(this.hapChar.ConfiguredName, 'Oolong Tea')
      this.service2.addCharacteristic(this.hapChar.ServiceLabelIndex)
      this.service2.updateCharacteristic(this.hapChar.ServiceLabelIndex, 2)
    }

    // Add a switch service for Coffee
    this.service3 = this.accessory.getService('Coffee')
    if (deviceConf.hideModeCoffee) {
      if (this.service3) {
        this.accessory.removeService(this.service3)
      }
    } else if (!this.service3) {
      this.service3 = this.accessory.addService(this.hapServ.Switch, 'Coffee', 'coffee')
      this.service3.addCharacteristic(this.hapChar.ConfiguredName)
      this.service3.updateCharacteristic(this.hapChar.ConfiguredName, 'Coffee')
      this.service3.addCharacteristic(this.hapChar.ServiceLabelIndex)
      this.service3.updateCharacteristic(this.hapChar.ServiceLabelIndex, 3)
    }

    // Add a switch service for Black Tea/Boil
    this.service4 = this.accessory.getService('Black Tea/Boil')
    if (deviceConf.hideModeBlackTeaBoil) {
      if (this.service4) {
        this.accessory.removeService(this.service4)
      }
    } else if (!this.service4) {
      this.service4 = this.accessory.addService(this.hapServ.Switch, 'Black Tea/Boil', 'blackTeaBoil')
      this.service4.addCharacteristic(this.hapChar.ConfiguredName)
      this.service4.updateCharacteristic(this.hapChar.ConfiguredName, 'Black Tea/Boil')
      this.service4.addCharacteristic(this.hapChar.ServiceLabelIndex)
      this.service4.updateCharacteristic(this.hapChar.ServiceLabelIndex, 4)
    }

    // Add a switch service for Custom Mode 1
    this.service5 = this.accessory.getService('Custom Mode 1')
    if (deviceConf.showCustomMode1) {
      if (!this.service5) {
        this.service5 = this.accessory.addService(this.hapServ.Switch, 'Custom Mode 1', 'customMode1')
        this.service5.addCharacteristic(this.hapChar.ConfiguredName)
        this.service5.updateCharacteristic(this.hapChar.ConfiguredName, 'Custom Mode 1')
        this.service5.addCharacteristic(this.hapChar.ServiceLabelIndex)
        this.service5.updateCharacteristic(this.hapChar.ServiceLabelIndex, 5)
      }
    } else if (this.service5) {
      this.accessory.removeService(this.service5)
    }

    // Add a switch service for Custom Mode 2
    this.service6 = this.accessory.getService('Custom Mode 2')
    if (deviceConf.showCustomMode2) {
      if (!this.service6) {
        this.service6 = this.accessory.addService(this.hapServ.Switch, 'Custom Mode 2', 'customMode2')
        this.service6.addCharacteristic(this.hapChar.ConfiguredName)
        this.service6.updateCharacteristic(this.hapChar.ConfiguredName, 'Custom Mode 2')
        this.service6.addCharacteristic(this.hapChar.ServiceLabelIndex)
        this.service6.updateCharacteristic(this.hapChar.ServiceLabelIndex, 6)
      }
    } else if (this.service6) {
      this.accessory.removeService(this.service6)
    }

    // Remove the temperature sensor service if it exists
    if (this.accessory.getService(this.hapServ.TemperatureSensor)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.TemperatureSensor))
    }

    // Add the set handler to the green tea switch if it exists
    if (this.service1) {
      this.service1.getCharacteristic(this.hapChar.On)
        .updateValue(false)
        .onSet(async value => this.internalStateUpdate(this.service1, value, this.codes.greenTea))
    }

    // Add the set handler to the oolong tea switch if it exists
    if (this.service2) {
      this.service2.getCharacteristic(this.hapChar.On)
        .updateValue(false)
        .onSet(async value => this.internalStateUpdate(this.service2, value, this.codes.oolongTea))
    }

    // Add the set handler to the coffee switch if it exists
    if (this.service3) {
      this.service3.getCharacteristic(this.hapChar.On)
        .updateValue(false)
        .onSet(async value => this.internalStateUpdate(this.service3, value, this.codes.coffee))
    }

    // Add the set handler to the black tea/boil switch if it exists
    if (this.service4) {
      this.service4.getCharacteristic(this.hapChar.On)
        .updateValue(false)
        .onSet(async value => this.internalStateUpdate(this.service4, value, this.codes.blackTea))
    }

    // Add the set handler to the custom mode 1 switch if it exists
    if (this.service5) {
      this.service5.getCharacteristic(this.hapChar.On)
        .updateValue(false)
        .onSet(async value => this.internalStateUpdate(this.service5, value, this.codes.customMode1))
    }

    // Add the set handler to the custom mode 2 switch if it exists
    if (this.service6) {
      this.service6.getCharacteristic(this.hapChar.On)
        .updateValue(false)
        .onSet(async value => this.internalStateUpdate(this.service6, value, this.codes.customMode2))
    }

    // Output the customised options to the log
    const opts = JSON.stringify({})
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts)
  }

  async internalStateUpdate(service, value, b64Code) {
    try {
      if (!value) {
        return
      }

      // Send the request to the platform sender function to change the mode
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: b64Code,
      })

      await sleep(1000)

      // Send the request to the platform sender function to turn to boiling mode
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: 'MwEBAAAAAAAAAAAAAAAAAAAAADM=',
      })

      // Cache the new state and log if appropriate
      this.cacheState = 'on'
      this.accessory.log(`${platformLang.curMode} [${service.displayName}]`)
      setTimeout(() => {
        service.updateCharacteristic(this.hapChar.On, false)
      }, 3000)
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`)

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        service.updateCharacteristic(this.hapChar.On, false)
      }, 2000)
      throw new this.hapErr(-70402)
    }
  }

  externalUpdate(params) {
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
        case '0500': { // current mode
          // switch to green tea_: aa050002000000000000000000000000000000ad
          // switch to oolong tea: aa050003000000000000000000000000000000ac
          // switch to coffee____: aa050004000000000000000000000000000000ab
          // switch to black tea_: aa050005000000000000000000000000000000aa
          // switch to preset1___: aa050001010000000000000000000000000000af
          // switch to preset2___: aa050001020000000000000000000000000000ac
          // No point in changing any switches for the sake of three seconds, no action taken here
          break
        }
        case '1001': { // current temperature in F
          // const currentTempInF = hexToDecimal(`${getTwoItemPosition(hexParts, 4)}${getTwoItemPosition(hexParts, 5)}`);
          // const currentTempInC = farToCen(currentTempInF / 100);
          break
        }
        case '1700': { // on/off base?
          const onBase = getTwoItemPosition(hexParts, 4) === '00' ? 'yes' : 'no'
          if (this.cacheOnBase !== onBase) {
            this.cacheOnBase = onBase
            this.accessory.log(`current on base [${this.cacheOnBase}]`)
          }
          break
        }
        case '2200': // keep warm off
        case '2201': // keep warm on
        case '2300': // scheduled start off
        case '2301': { // scheduled start on
          break
        }
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)
          break
      }
    })
  }
}

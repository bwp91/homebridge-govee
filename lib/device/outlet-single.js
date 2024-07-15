import { generateRandomString, parseError } from '../utils/functions.js'
import platformLang from '../utils/lang-en.js'

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.hapChar = platform.api.hap.Characteristic
    this.hapErr = platform.api.hap.HapStatusError
    this.hapServ = platform.api.hap.Service
    this.platform = platform

    // Set up variables from the accessory
    this.accessory = accessory;

    // Remove any old services from simulations
    ['AirPurifier', 'HeaterCooler', 'Lightbulb', 'Switch', 'Valve'].forEach((service) => {
      if (this.accessory.getService(this.hapServ[service])) {
        this.accessory.removeService(this.accessory.getService(this.hapServ[service]))
      }
    })

    // Add the outlet service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Outlet)
    || this.accessory.addService(this.hapServ.Outlet)

    // Add the set handler to the switch on/off characteristic
    this.service.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(value)
    })
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off'

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('switch', this.accessory, {
      log: () => {},
    })

    // Output the customised options to the log
    const opts = JSON.stringify({
      showAs: 'outlet',
    })
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts)
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (newValue === this.cacheState) {
        return
      }

      // Set up a one-minute timeout for the plugin to ignore incoming updates
      const timerKey = generateRandomString(5)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 60000)

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateOutlet',
        value: newValue,
      })

      // Cache the new state and log if appropriate
      if (this.cacheState !== newValue) {
        this.cacheState = newValue
        this.accessory.log(`${platformLang.curState} [${this.cacheState}]`)
      }

      // Add the entry to the Eve history service
      this.accessory.eveService.addEntry({ status: value ? 1 : 0 })
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

  externalUpdate(params) {
    // Check to see if the provided state is different from the cached state
    if (params.state && params.state !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = params.state
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`)

      // Add the entry to the Eve history service
      this.accessory.eveService.addEntry({
        status: this.cacheState === 'on' ? 1 : 0,
      })
    }
  }
}

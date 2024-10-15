import { base64ToHex, getTwoItemPosition, hexToTwoItems } from '../utils/functions.js'
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

    // Add the occupancy sensor if it does not already exist
    this.service = this.accessory.getService(this.hapServ.OccupancySensor) || this.accessory.addService(this.hapServ.OccupancySensor)
    this.cacheState = this.service.getCharacteristic(this.hapChar.OccupancyDetected).value

    // Output the customised options to the log
    const opts = JSON.stringify({})
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts)
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

      const deviceFunction = `${getTwoItemPosition(hexParts, 1)}${getTwoItemPosition(hexParts, 2)}`

      switch (deviceFunction) {
        case 'aa01': { // lock
          const newState = getTwoItemPosition(hexParts, 3) === '01' ? 1 : 0
          if (newState !== this.cacheState) {
            this.cacheState = newState
            this.service.updateCharacteristic(this.hapChar.OccupancyDetected, this.cacheState)
            this.accessory.log(`${platformLang.curOcc} [${this.cacheState === 1 ? 'yes' : 'no'}]`)
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

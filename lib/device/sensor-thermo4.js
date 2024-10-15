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

    // remove temperature sensor, humidity sensor, battery service
    if (this.accessory.getService(this.hapServ.TemperatureSensor)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.TemperatureSensor))
    }
    if (this.accessory.getService(this.hapServ.HumiditySensor)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.HumiditySensor))
    }
    if (this.accessory.getService(this.hapServ.Battery)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Battery))
    }

    // Output the customised options to the log
    const opts = JSON.stringify({})
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts)
  }

  externalUpdate(params) {
    this.accessory.logWarn(JSON.stringify(params, null, 2));

    // Check for some other scene/mode change
    (params.commands || []).forEach((command) => {
      const hexString = base64ToHex(command)
      const hexParts = hexToTwoItems(hexString)

      this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`)

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

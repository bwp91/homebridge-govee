import {
  base64ToHex,
  farToCen,
  getTwoItemPosition,
  hasProperty,
  hexToDecimal,
  hexToTwoItems,
  parseError,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  Green Tea:      MwUAAgAAAAAAAAAAAAAAAAAAADQ= 3305000200000000000000000000000000000034
  Oolong Tea:     MwUAAwAAAAAAAAAAAAAAAAAAADU= 3305000300000000000000000000000000000035
  Coffee:         MwUABAAAAAAAAAAAAAAAAAAAADI= 3305000400000000000000000000000000000032
  Black Tea/Boil: MwUABQAAAAAAAAAAAAAAAAAAADM= 3305000500000000000000000000000000000033
 */
export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;

    // Accessory codes
    this.codeSwitchOn = 'MwEBBQAAAAAAAAAAAAAAAAAAADY=';
    this.codeSwitchOff = 'MwEAAAAAAAAAAAAAAAAAAAAAADI=';

    // Add the switch service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Switch)
      || this.accessory.addService(this.hapServ.Switch);

    // Add the temperature sensor service if it doesn't already exist
    this.serviceTemp = this.accessory.getService(this.hapServ.TemperatureSensor)
      || this.accessory.addService(this.hapServ.TemperatureSensor);
    this.cacheCurTemp = this.serviceTemp.getCharacteristic(this.hapChar.CurrentTemperature).value;

    // Add the set handler to the switch on/off characteristic
    this.service.getCharacteristic(this.hapChar.On)
      .updateValue(false)
      .onSet(async (value) => this.internalStateUpdate(value));
    this.cacheState = 'off';

    // Output the customised options to the log
    const opts = JSON.stringify({});
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      if (!value) {
        return;
      }

      // Don't continue if the new value is the same as before
      if (this.cacheState === 'on') {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateKett',
        value: this.codeSwitchOn,
      });

      // Cache the new state and log if appropriate
      this.cacheState = 'on';
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
      this.delayThenTurnOff();
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, false);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  delayThenTurnOff = () => {
    try {
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, false);
        this.cacheState = 'off';
        this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
      }, 3000);
    } catch (err) {
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);
    }
  };

  externalUpdate(params) {
    // Set temperature is found in the params, this is not in a characteristic, but useful for logging?
    if (hasProperty(params, 'setTemperature')) {
      const newTemp = Math.round(farToCen(params.setTemperature / 100));
      if (newTemp !== this.cacheTarg) {
        this.cacheTarg = newTemp;
        this.accessory.log(`${platformLang.curTarg} [${this.cacheTarg}°C]`);
      }
    }

    // Check for some other scene/mode change
    (params.commands || []).forEach((command) => {
      const hexString = base64ToHex(command);
      const hexParts = hexToTwoItems(hexString);

      // Return now if not a device query update code
      if (getTwoItemPosition(hexParts, 1) !== 'aa') {
        return;
      }

      const deviceFunction = `${getTwoItemPosition(hexParts, 2)}${getTwoItemPosition(hexParts, 3)}`;

      switch (deviceFunction) {
        case '1001': { // current temperature in F
          const currentTempInF = hexToDecimal(`${getTwoItemPosition(hexParts, 4)}${getTwoItemPosition(hexParts, 5)}`);
          const currentTempInC = farToCen(currentTempInF / 100);
          if (currentTempInF !== this.cacheCurTemp) {
            this.cacheCurTemp = currentTempInC;
            this.accessory.log(`${platformLang.curTemp} [${this.cacheCurTemp}°C]`);
          }
          break;
        }
        case '1700': { // on/off base?
          const onBase = getTwoItemPosition(hexParts, 4) === '00' ? 'yes' : 'no';
          if (this.cacheOnBase !== onBase) {
            this.cacheOnBase = onBase;
            this.accessory.log(`current on base [${this.cacheOnBase}]`);
          }
          break;
        }
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`);
          break;
      }
    });
  }
}

import { parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

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
    switch (params.scene) {
      case undefined:
        return;
      case this.codeSwitchOn:
        if (this.cacheState !== 'on') {
          this.service.updateCharacteristic(this.hapChar.On, true);
          this.cacheState = 'on';
          this.delayThenTurnOff();
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        break;
      case this.codeSwitchOff:
        if (this.cacheState !== 'off') {
          this.service.updateCharacteristic(this.hapChar.On, false);
          this.cacheState = 'off';
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        break;
      default:
        this.accessory.logWarn(`new/unknown scene code received: [${params.scene}]`);
        break;
    }
  }
}

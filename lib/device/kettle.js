import { parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.log = platform.log;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;
    this.name = accessory.displayName;

    // Set the correct logging variables for this accessory
    this.enableLogging = true;
    this.enableDebugLogging = true;

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
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      if (!value) {
        return;
      }

      // Don't continue if the new value is the same as before
      if (value && this.cacheState === 'on') {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateKett',
        value: this.codeSwitchOn,
      });

      // Cache the new state and log if appropriate
      this.cacheState = 'on';
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curState, 'on');
      }
      this.delayThenTurnOff();
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

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
      }, 3000);
    } catch (err) {
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);
    }
  };

  externalUpdate(params) {
    switch (params.scene) {
      case this.codeSwitchOn:
        this.service.updateCharacteristic(this.hapChar.On, true);
        this.cacheState = 'on';
        this.delayThenTurnOff();
        break;
      case this.codeSwitchOff:
        this.service.updateCharacteristic(this.hapChar.On, false);
        this.cacheState = 'off';
        break;
      default:
        this.log.warn('[%s] New/Unknown scene code received: [%s].', this.name, params.scene);
        break;
    }
  }
}

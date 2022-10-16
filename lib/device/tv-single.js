import { generateRandomString, hasProperty, parseError } from '../utils/functions.js';
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

    // Add the tv service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Television)
      || this.accessory.addService(this.hapServ.Television);

    // Add the set handler to the tv active characteristic
    this.service.getCharacteristic(this.hapChar.Active).onSet(async (value) => {
      await this.internalUpdate(value);
    });
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value === 1 ? 'on' : 'off';

    // Output the customised options to the log
    const opts = JSON.stringify({
      showAs: 'audio/box/stick',
    });
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (newValue === this.cacheState) {
        return;
      }

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds
        && !this.accessory.context.supportedCmds.includes('turn')
      ) {
        const eText = this.accessory.context.gvModel + platformLang.notSuppTurn;
        throw new Error(eText);
      }

      // Set up a one-minute timeout for the plugin to ignore incoming updates
      const timerKey = generateRandomString(5);
      this.updateTimeout = timerKey;
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false;
        }
      }, 60000);

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'state',
        value: newValue,
      });

      // Cache the new state and log if appropriate
      if (this.cacheState !== newValue) {
        this.cacheState = newValue;
        this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    // Don't apply the update during the one-minute timeout if update is from API
    if (this.updateTimeout) {
      return;
    }

    // Check to see if the provided online status is different from the cache value
    if (hasProperty(params, 'online') && this.cacheOnline !== params.online) {
      this.cacheOnline = params.online;
      this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline);
    }

    // Check to see if the provided state is different from the cached state
    if (params.state && params.state !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0);

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
    }
  }
}

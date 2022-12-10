import { generateRandomString, hasProperty, parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.cusChar = platform.cusChar;
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;
    this.offlineAsOff = platform.config.offlineAsOff;
    this.isLANOnly = !accessory.context.useAWSControl && !accessory.context.useAPIControl && !accessory.context.useBLEControl;

    // Remove any lightbulb service
    if (accessory.getService(this.hapServ.Lightbulb)) {
      accessory.removeService(accessory.getService(this.hapServ.Lightbulb));
    }

    // Add the main switch service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Switch)
      || this.accessory.addService(this.hapServ.Switch);

    // Add the set handler to the lightbulb on/off characteristic
    this.service.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(value);
    });
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Output the customised options to the log
    const useAWSControl = accessory.context.useAWSControl ? 'enabled' : 'disabled';
    const useBLEControl = accessory.context.useBLEControl ? 'enabled' : 'disabled';
    const useLANControl = accessory.context.useLANControl ? 'enabled' : 'disabled';
    const opts = JSON.stringify({
      aws: accessory.context.hasAWSControl ? useAWSControl : 'unsupported',
      ble: accessory.context.hasBLEControl ? useBLEControl : 'unsupported',
      lan: accessory.context.hasLANControl ? useLANControl : 'unsupported',
      showAs: 'switch',
    });
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (newValue === this.cacheState) {
        return;
      }

      // Set up a one-minute timeout for the plugin to ignore incoming updates
      const timerKey = generateRandomString(5);
      this.updateTimeoutAPI = timerKey;
      setTimeout(() => {
        if (this.updateTimeoutAPI === timerKey) {
          this.updateTimeoutAPI = false;
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
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    // Don't apply the update during timeouts
    if (this.updateTimeoutAPI && params.source === 'API') {
      return;
    }

    if (params.source === 'AWS') {
      // Set up a one-minute timeout for the plugin to ignore incoming API updates if update is from AWS
      // API can take a while to update from changes, so always go with the AWS update
      const updateKey = generateRandomString(5);
      this.updateTimeoutAPI = updateKey;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKey) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);
    }

    // Check to see if the provided online status is different from the cache value
    if (hasProperty(params, 'online') && this.cacheOnline !== params.online) {
      this.cacheOnline = params.online;
      this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline);
    }

    // If offline and user enabled offlineAsOff, then mark accessory as off, and only if this device is not LAN-only
    if (!this.isLANOnly && !this.cacheOnline && this.offlineAsOff) {
      params.state = 'off';
      this.accessory.logDebug(platformLang.offlineAsOff);
    }

    // Check to see if the provided state is different from the cached value
    if (params.state && params.state !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
    }
  }
}

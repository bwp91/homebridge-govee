import axios from 'axios';
import platformConsts from '../utils/constants.js';
import { hasProperty, parseError } from '../utils/functions.js';
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

    // Set up custom variables for this device type
    const deviceConf = platform.deviceConf[accessory.context.gvDeviceId];
    this.lowBattThreshold = deviceConf && deviceConf.lowBattThreshold
      ? Math.min(deviceConf.lowBattThreshold, 100)
      : platformConsts.defaultValues.lowBattThreshold;

    this.endpoint = deviceConf && deviceConf.acEndpoint;
    if (this.endpoint) {
      this.log('[%s] is using the following endpoint [%s].', this.name, deviceConf.acEndpoint);
    } else {
      this.log.warn('[%s] acEndpoint is undefined for this device.', this.name);
    }

    // Set the correct logging variables for this accessory
    this.enableLogging = accessory.context.enableLogging;
    this.enableDebugLogging = accessory.context.enableDebugLogging;

    // Check for old services
    if (accessory.getService(this.hapServ.TemperatureSensor)) {
      accessory.removeService(this.hapServ.TemperatureSensor);
    }
    if (accessory.getService(this.hapServ.HumiditySensor)) {
      accessory.removeService(this.hapServ.HumiditySensor);
    }

    this.thermostatService = this.accessory.getService(this.hapServ.Thermostat)
      || this.accessory.addService(this.hapServ.Thermostat);

    this.thermostatService.getCharacteristic(this.hapChar.TargetTemperature)
      .setProps({ minValue: 16, maxValue: 32, minStep: 0.1 })
      .onSet(async (value) => this.internalSetTargetTempUpdate(value));
    this.cacheTargetTemp = this.thermostatService.getCharacteristic(this.hapChar.TargetTemperature).value;
    this.cacheTargetTemp = this.cacheTargetTemp < 16 || this.cacheTargetTemp > 32 ? this.cacheTargetTemp : 16;
    this.updateCache();

    this.thermostatService.getCharacteristic(this.hapChar.TargetHeatingCoolingState)
      .onSet(async (value) => this.internalSetTargetHeatingCoolingState(value));
    this.cacheTargetHeatingCoolingState = this.thermostatService.getCharacteristic(this.hapChar.TargetHeatingCoolingState).value;
    this.thermostatService.getCharacteristic(this.hapChar.TargetHeatingCoolingState)
      .onGet(() => this.cacheTargetHeatingCoolingState);

    this.cacheCurHeatingCoolingState = this.thermostatService.getCharacteristic(this.hapChar.CurrentHeatingCoolingState).value;
    this.thermostatService.getCharacteristic(this.hapChar.CurrentHeatingCoolingState).onGet(async () => {
      await this.updateCurStatus();
      return this.cacheCurHeatingCoolingState;
    });
    this.thermostatService.getCharacteristic(this.hapChar.CurrentTemperature)
      .onGet(() => this.cacheTemp);
    this.updateCache();

    // Add the battery service if it doesn't already exist
    this.battService = this.accessory.getService(this.hapServ.Battery)
      || this.accessory.addService(this.hapServ.Battery);
    this.cacheBatt = this.battService.getCharacteristic(this.hapChar.BatteryLevel).value;

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('custom', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {},
    });

    // Output the customised options to the log
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const opts = JSON.stringify({
      acEndpoint: this.endpoint,
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
      lowBattThreshold: this.lowBattThreshold,
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);
  }

  async internalSetTargetTempUpdate(value) {
    try {
      this.log(`Got internal target triggered. newValue [${value}]`);

      // Don't continue if the new value is the same as before
      if (value === this.cacheTargetTemp) {
        return;
      }

      this.thermostatService.updateCharacteristic(this.hapChar.TargetTemperature, value);
      this.cacheTargetTemp = value;
      await this.processTempRequestOrUpdate();
      // Don't continue if the device doesn't support this command
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.thermostatService.updateCharacteristic(this.hapChar.TargetTemperature, this.cacheTargetTemp);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalSetTargetHeatingCoolingState(value) {
    try {
      this.log('[%s] Got internal heating cooling state triggered. newValue: [%s], on cache: [%s]', this.name, value, this.cacheTargetHeatingCoolingState);
      // // Don't continue if the new value is the same as before
      if (value === this.cacheTargetHeatingCoolingState) {
        return;
      }

      this.thermostatService.updateCharacteristic(this.hapChar.TargetHeatingCoolingState, value);
      this.cacheTargetHeatingCoolingState = value;
      this.log('[%s] Thew new target state is: [%s]', this.name, this.cacheTargetHeatingCoolingState);
      await this.processTempRequestOrUpdate();
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.thermostatService.updateCharacteristic(this.hapChar.TargetHeatingCoolingState, this.cacheTargetHeatingCoolingState);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async updateCache() {
    // Don't continue if the storage client hasn't initialised properly
    if (!this.platform.storageClientData) {
      return;
    }

    // Attempt to save the new temperature to the cache
    try {
      await this.platform.storageData.setItem(
        `${this.accessory.context.gvDeviceId}_temp`,
        this.cacheTemp,
      );
    } catch (err) {
      if (this.enableLogging) {
        const eText = parseError(err);
        this.log.warn('[%s] %s %s.', this.name, platformLang.storageWriteErr, eText);
      }
    }
  }

  async processTempRequestOrUpdate() {
    this.log('[%s] Cur state [%s]; asked to [%s]', this.name, this.cacheCurHeatingCoolingState, this.cacheTargetHeatingCoolingState);
    switch (this.cacheTargetHeatingCoolingState) {
      case this.hapChar.TargetHeatingCoolingState.OFF: {
        this.log('[%s] AC requested OFF', this.name);
        await this.turnAcOnOff(false);
        break;
      }

      case this.hapChar.TargetHeatingCoolingState.HEAT: {
        this.log('[%s] [HEAT] %s < %s ', this.name, this.cacheTemp, this.cacheTargetTemp);
        await this.turnAcOnOff(this.cacheTemp < this.cacheTargetTemp);
        break;
      }

      case this.hapChar.TargetHeatingCoolingState.COOL: {
        this.log('[%s] [COOL] %s > %s ', this.name, this.cacheTemp, this.cacheTargetTemp);
        await this.turnAcOnOff(this.cacheTemp > this.cacheTargetTemp);
        break;
      }

      case this.hapChar.TargetHeatingCoolingState.AUTO: {
        this.log('[%s] [AUTO] %s !== %s ', this.name, this.cacheTemp, this.cacheTargetTemp);
        if (this.cacheTemp !== this.cacheTargetTemp) {
          await this.internalSetTargetHeatingCoolingState((this.cacheTemp < this.cacheTargetTemp ? this.hapChar.CurrentHeatingCoolingState.HEAT : this.hapChar.CurrentHeatingCoolingState.COOL));
          await this.turnAcOnOff(this.cacheTemp !== this.cacheTargetTemp);
        }
        break;
      }

      default: {
        this.log.warn('[%s] Unrecognized target state of: [%s]', this.name, this.cacheTargetHeatingCoolingState);
        await this.turnAcOnOff(false);
        break;
      }
    }
    await this.updateCurStatus();
  }

  async updateCurStatus() {
    this.log('[%s] Checking status at: [%s]', this.name, this.endpoint);

    if (!this.endpoint) {
      this.log('[%s] Endpoint is empty, returning OFF by default', this.name);
      this.thermostatService.updateCharacteristic(this.hapChar.CurrentHeatingCoolingState, this.hapChar.CurrentHeatingCoolingState.OFF);
      return;
    }

    try {
      const response = await axios.get(this.endpoint, { responseType: 'text' });
      this.log.debug('[%s] Queried to [%s] and the response was: %s', this.name, this.endpoint, response.data);
      const acOn = response.data.toLowerCase().includes('ac is now: on');
      if (acOn) {
        this.thermostatService.updateCharacteristic(this.hapChar.CurrentHeatingCoolingState, this.cacheTargetHeatingCoolingState);
        this.cacheCurHeatingCoolingState = this.cacheTargetHeatingCoolingState;
      } else {
        this.thermostatService.updateCharacteristic(this.hapChar.CurrentHeatingCoolingState, this.hapChar.CurrentHeatingCoolingState.OFF);
        this.cacheCurHeatingCoolingState = this.hapChar.CurrentHeatingCoolingState.OFF;
      }
    } catch (error) {
      this.log.warn('[%s] Error getting status, response was: %s', this.name, error);
      this.thermostatService.updateCharacteristic(this.hapChar.CurrentHeatingCoolingState, new Error('Polling failed'));
    }
  }

  async turnAcOnOff(isOn) {
    if (!this.endpoint) {
      this.log('[%s] Cant do turnAcOnOff; Endpoint is empty, returning...', this.name);
      return;
    }

    const ep = `${this.endpoint}/AC=${isOn ? 'ON' : 'OFF'}`;
    this.log('[%s] Calling the following: %s', this.name, ep);
    try {
      const response = await axios.get(ep, { responseType: 'text' });
      this.log.debug('[%s] response data: %s', this.name, response.data);
    } catch (error) {
      this.log.error('[%s] Error on turning onoff, response was: %s', this.name, error);
    }
  }

  async externalUpdate(params) {
    // Check to see if the provided online status is different from the cache value
    if (hasProperty(params, 'online') && this.cacheOnline !== params.online) {
      this.cacheOnline = params.online;
      this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline);
    }

    // Check to see if the provided battery is different from the cached state
    if (params.battery !== this.cacheBatt) {
      // Battery is different so update Homebridge with new values
      this.cacheBatt = params.battery;
      this.battService.updateCharacteristic(this.hapChar.BatteryLevel, this.cacheBatt);
      this.battService.updateCharacteristic(
        this.hapChar.StatusLowBattery,
        this.cacheBatt < this.lowBattThreshold ? 1 : 0,
      );

      // Log the change if appropriate
      if (this.enableLogging) {
        this.log('[%s] %s [%s%].', this.name, platformLang.curBatt, this.cacheBatt);
      }
    }

    // Check to see if the provided temperature is different from the cached state
    if (hasProperty(params, 'temperature')) {
      let newTemp = parseInt(params.temperature + this.accessory.context.offTemp, 10);
      newTemp /= 100;
      if (newTemp !== this.cacheTemp) {
        // Temperature is different so update Homebridge with new values
        this.cacheTemp = newTemp;
        this.thermostatService.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp);
        this.accessory.eveService.addEntry({ temp: this.cacheTemp });

        // Log the change if appropriate
        if (this.enableLogging) {
          this.log('[%s] %s [%s°C].', this.name, platformLang.curTemp, this.cacheTemp);
        }
        await this.processTempRequestOrUpdate();

        // Update the cache file with the new temperature
        this.updateCache();
      }
    }

    // Check to see if the provided humidity is different from the cached state
    if (hasProperty(params, 'humidity')) {
      let newHumi = parseInt(params.humidity + this.accessory.context.offHumi, 10);
      newHumi /= 100;
      newHumi = Math.max(Math.min(newHumi, 100), 0);
      if (newHumi !== this.cacheHumi) {
        // Humidity is different so update Homebridge with new values
        this.cacheHumi = newHumi;
        this.thermostatService.updateCharacteristic(this.hapChar.CurrentRelativeHumidity, this.cacheHumi);
        this.accessory.eveService.addEntry({ humidity: this.cacheHumi });

        // Log the change if appropriate
        if (this.enableLogging) {
          this.log('[%s] %s [%s%].', this.name, platformLang.curHumi, this.cacheHumi);
        }
      }
    }
  }
}

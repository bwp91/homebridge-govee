import {
  base64ToHex,
  farToCen,
  getTwoItemPosition,
  hasProperty,
  hexToTwoItems,
  nearestHalf,
  parseError,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  H7130
  {
    "mode": {
      "options": [
        {
          "name": "Low",
          "value": "1"
        },
        {
          "name": "Medium",
          "value": "2"
        },
        {
          "name": "High",
          "value": "3"
        }
      ]
    }
  }
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

    // Set up objects
    this.tempCode = {
      5: 'MwUDAZAEAAAAAAAAAAAAAAAAAKA=',
      6: 'MwUDAZBoAAAAAAAAAAAAAAAAAMw=',
      7: 'MwUDAZEwAAAAAAAAAAAAAAAAAJU=',
      8: 'MwUDAZH4AAAAAAAAAAAAAAAAAF0=',
      9: 'MwUDAZLAAAAAAAAAAAAAAAAAAGY=',
      10: 'MwUDAZOIAAAAAAAAAAAAAAAAAC8=',
      11: 'MwUDAZPsAAAAAAAAAAAAAAAAAEs=',
      12: 'MwUDAZS0AAAAAAAAAAAAAAAAABQ=',
      13: 'MwUDAZV8AAAAAAAAAAAAAAAAAN0=',
      14: 'MwUDAZZEAAAAAAAAAAAAAAAAAOY=',
      15: 'MwUDAZcMAAAAAAAAAAAAAAAAAK8=',
      16: 'MwUDAZdwAAAAAAAAAAAAAAAAANM=',
      17: 'MwUDAZg4AAAAAAAAAAAAAAAAAJQ=',
      18: 'MwUDAZkAAAAAAAAAAAAAAAAAAK0=',
      19: 'MwUDAZnIAAAAAAAAAAAAAAAAAGU=',
      20: 'MwUDAZqQAAAAAAAAAAAAAAAAAD4=',
      21: 'MwUDAZr0AAAAAAAAAAAAAAAAAFo=',
      22: 'MwUDAZu8AAAAAAAAAAAAAAAAABM=',
      23: 'MwUDAZyEAAAAAAAAAAAAAAAAACw=',
      24: 'MwUDAZ1MAAAAAAAAAAAAAAAAAOU=',
      25: 'MwUDAZ4UAAAAAAAAAAAAAAAAAL4=',
      26: 'MwUDAZ54AAAAAAAAAAAAAAAAANI=',
      27: 'MwUDAZ9AAAAAAAAAAAAAAAAAAOs=',
      28: 'MwUDAaAIAAAAAAAAAAAAAAAAAJw=',
      29: 'MwUDAaDQAAAAAAAAAAAAAAAAAEQ=',
      30: 'MwUDAaGYAAAAAAAAAAAAAAAAAA0=',
    };

    // Remove any old light service
    if (this.accessory.getService(this.hapServ.Lightbulb)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Lightbulb));
    }

    // Add the heater service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.HeaterCooler);
    if (!this.service) {
      this.service = this.accessory.addService(this.hapServ.HeaterCooler);
      this.service.updateCharacteristic(this.hapChar.CurrentTemperature, 20);
      this.service.updateCharacteristic(this.hapChar.HeatingThresholdTemperature, 20);
    }

    // Add the fan service if it doesn't already exist
    this.fanService = this.accessory.getService(this.hapServ.Fan)
      || this.accessory.addService(this.hapServ.Fan);

    // Add the set handler to the heater active characteristic
    this.service
      .getCharacteristic(this.hapChar.Active)
      .onSet(async (value) => this.internalStateUpdate(value));
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value === 1 ? 'on' : 'off';

    // Add options to the heater target state characteristic
    this.service.getCharacteristic(this.hapChar.TargetHeaterCoolerState).setProps({
      minValue: 0,
      maxValue: 1,
      validValues: [0, 1],
    });

    this.cacheTemp = this.service.getCharacteristic(this.hapChar.CurrentTemperature).value;

    // Add the set handler and a range to the heater target temperature characteristic
    this.service
      .getCharacteristic(this.hapChar.HeatingThresholdTemperature)
      .setProps({
        minValue: 5,
        maxValue: 30,
        minStep: 1,
      })
      .onSet(async (value) => this.internalTempUpdate(value));
    this.cacheTarg = this.service.getCharacteristic(this.hapChar.HeatingThresholdTemperature).value;

    // Add the set handler to the fan on/off characteristic
    this.fanService
      .getCharacteristic(this.hapChar.On)
      .onSet(async (value) => this.internalFanStateUpdate(value));
    this.cacheFanState = this.fanService.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Add the set handler to the fan rotation speed characteristic
    this.fanService
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 25,
        validValues: [0, 25, 50, 75, 100],
      })
      .onSet(async (value) => this.internalSpeedUpdate(value));
    this.cacheSpeed = this.fanService.getCharacteristic(this.hapChar.RotationSpeed).value;

    // Output the customised options to the log
    const opts = JSON.stringify({});
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheState === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateHeat',
        value: value ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI=',
      });

      // Cache the new state and log if appropriate
      if (this.cacheState !== newValue) {
        this.cacheState = newValue;
        this.accessory.log(`${platformLang.curState} [${newValue}]`);
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

  async internalTempUpdate(value) {
    try {
      // Don't continue if the new value is the same as before
      if (this.cacheTarg === value) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'swingHeat',
        value: this.tempCode[value],
      });

      // Cache the new state and log if appropriate
      if (this.cacheTarg !== value) {
        this.cacheTarg = value;
        this.accessory.log(`${platformLang.curTarg} [${this.cacheTarg}°C]`);
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.HeatingThresholdTemperature, this.cacheTarg);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalFanStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // The fan is used for the following modes (basically all except Auto):
      //  - 0%__: Auto
      //  - 25%_: Fan Only Mode
      //  - 50%_: Low Mode
      //  - 75%_: Medium Mode
      //  - 100%: High Mode
      // If the main heater is turned off then this fan should be turned off too
      // If the main heater is turned on then this fan speed should revert to the current mode

      // Don't continue if the new value is the same as before
      if (this.cacheFanState === newValue) {
        return;
      }

      // Turning fan on:
      // We should not need to worry about a command for turning the fan ON, since
      // the correct mode command will be sent when selecting the fan speed
      // However we should mark the heater "active" characteristic as ON
      if (newValue === 'on') {
        if (this.cacheState !== 'on') {
          this.cacheState = 'on';
          this.service.updateCharacteristic(this.hapChar.Active, 1);
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        this.cacheFanState = 'on';
        return;
      }

      // Turning fan off:
      // We should send a command to set the heater mode to AUTO
      this.cacheFanState = 'off';
      this.accessory.log(`${platformLang.curMode} [auto]`);
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
    // Update the active characteristic
    if (params.state && params.state !== this.cacheState) {
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0);
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
    }

    // Update the current temperature characteristic
    if (hasProperty(params, 'temperature')) {
      const newTemp = nearestHalf(farToCen(params.temperature / 100));
      if (newTemp !== this.cacheTemp) {
        this.cacheTemp = newTemp;
        this.service.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp);
        this.accessory.log(`${platformLang.curTemp} [${this.cacheTemp}°C]`);
      }
    }

    // Update the target temperature characteristic
    if (hasProperty(params, 'setTemperature')) {
      const newTemp = Math.round(farToCen(params.setTemperature / 100));
      if (newTemp !== this.cacheTarg) {
        this.cacheTarg = newTemp;
        this.service.updateCharacteristic(this.hapChar.HeatingThresholdTemperature, this.cacheTarg);
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
        case '0503': // Target temperature // EXAMPLE FROM H7131/7132
        case '1a01': // Auto-detection:
          // We do not need to do anything for these
          break;
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`);
          break;
      }
    });
  }
}
// auto detection
// aa1a0100913081011a36000100000000000000bd OFF
// aa1a0101913081011a36000000000000000000bd ON

import { generateRandomString, parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  H7121
  {
    "mode": {
      "options": [
        {
          "name": "Low",
          "value": 1
        },
        {
          "name": "Medium",
          "value": 2
        },
        {
          "name": "High",
          "value": 3
        },
        {
          "name": "Sleep",
          "value": 16
        }
      ]
    }
  }

  H7122
  {
    "mode": {
      "options": [
        {
          "name": "Low",
          "value": 1
        },
        {
          "name": "Medium",
          "value": 2
        },
        {
          "name": "High",
          "value": 3
        },
        {
          "name": "Auto mode",
          "value": 4
        },
        {
          "name": "Sleep mode",
          "value": 5
        },
        {
          "name": "CustomMode mode",
          "value": 6
        }
      ]
    }
  }
*/

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.cusChar = platform.cusChar;
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.log = platform.log;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;
    this.name = accessory.displayName;

    // Set the correct logging variables for this accessory
    this.enableLogging = accessory.context.enableLogging;
    this.enableDebugLogging = accessory.context.enableDebugLogging;

    // Rotation speed to value in {1, 2, 3, 4}
    this.speed2Value = (speed) => Math.min(Math.max(parseInt(speed / 25, 10), 1), 4);

    // Speed codes
    this.value2Code = {
      1: 'MwUQAAAAAAAAAAAAAAAAAAAAACY=',
      2: 'MwUBAAAAAAAAAAAAAAAAAAAAADc=',
      3: 'MwUCAAAAAAAAAAAAAAAAAAAAADQ=',
      4: 'MwUDAAAAAAAAAAAAAAAAAAAAADU=',
    };

    // Night light codes
    this.night2Code = {
      on: 'MxgBMgAAAAAAAAAAAAAAAAAAABg=',
      off: 'MxgAMgAAAAAAAAAAAAAAAAAAABk=',
    };

    // Lock codes
    this.lock2Code = {
      on: 'MxABAAAAAAAAAAAAAAAAAAAAACI=',
      off: 'MxAAAAAAAAAAAAAAAAAAAAAAACM=',
    };

    // Display codes
    this.display2Code = {
      on: 'MxYBAAAAAAAAAAAAAAAAAAAAACQ=',
      off: 'MxYAAAAAAAAAAAAAAAAAAAAAACU=',
    };

    // Add the purifier service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.AirPurifier)
      || this.accessory.addService(this.hapServ.AirPurifier);

    // Add the set handler to the switch on/off characteristic
    this.service.getCharacteristic(this.hapChar.Active).onSet(async (value) => {
      await this.internalStateUpdate(value);
    });
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value === 1 ? 'on' : 'off';

    // Add options to the purifier target state characteristic
    this.service
      .getCharacteristic(this.hapChar.TargetAirPurifierState)
      .updateValue(1)
      .setProps({
        minValue: 1,
        maxValue: 1,
        validValues: [1],
      });

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 25,
        validValues: [0, 25, 50, 75, 100],
      })
      .onSet(async (value) => this.internalSpeedUpdate(value));
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value;

    // Add the set handler to the lock controls characteristic
    this.service.getCharacteristic(this.hapChar.LockPhysicalControls).onSet(async (value) => {
      await this.internalLockUpdate(value);
    });
    this.cacheLock = this.service.getCharacteristic(this.hapChar.LockPhysicalControls).value === 0 ? 'on' : 'off';

    // Add night light Eve characteristic if it doesn't exist already
    if (!this.service.testCharacteristic(this.cusChar.NightLight)) {
      this.service.addCharacteristic(this.cusChar.NightLight);
    }

    // Add the set handler to the custom night light characteristic
    this.service.getCharacteristic(this.cusChar.NightLight).onSet(async (value) => {
      await this.internalNightLightUpdate(value);
    });
    this.cacheLight = this.service.getCharacteristic(this.cusChar.NightLight).value ? 'on' : 'off';

    // Add display light Eve characteristic if it doesn't exist already
    if (!this.service.testCharacteristic(this.cusChar.DisplayLight)) {
      this.service.addCharacteristic(this.cusChar.DisplayLight);
    }

    // Add the set handler to the custom display light characteristic
    this.service.getCharacteristic(this.cusChar.DisplayLight).onSet(async (value) => {
      await this.internalDisplayLightUpdate(value);
    });
    this.cacheDisplay = this.service.getCharacteristic(this.cusChar.DisplayLight).value
      ? 'on'
      : 'off';

    // Output the customised options to the log
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);
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
        cmd: 'statePuri',
        value: value ? 1 : 0,
      });

      // Update the current state characteristic
      this.service.updateCharacteristic(this.hapChar.CurrentAirPurifierState, value === 1 ? 2 : 0);

      // Cache the new state and log if appropriate
      this.cacheState = newValue;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curState, newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on' ? 1 : 0);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalSpeedUpdate(value) {
    try {
      // Don't continue if the speed is 0
      if (value === 0) {
        return;
      }

      // Get the single Govee value {1, 2, ..., 8}
      const newValue = this.speed2Value(value);

      // Don't continue if the speed value won't have effect
      if (newValue * 25 === this.cacheSpeed) {
        return;
      }

      // Get the scene code for this value
      const newCode = this.value2Code[newValue];
      const updateTimeoutAWS = generateRandomString(5);
      this.updateTimeoutAWS = updateTimeoutAWS;

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedPuri',
        value: newCode,
      });

      setTimeout(() => {
        if (this.updateTimeoutAWS === updateTimeoutAWS) {
          this.updateTimeoutAWS = false;
        }
      }, 5000);

      // Cache the new state and log if appropriate
      this.cacheSpeed = newValue * 25;
      if (this.enableLogging) {
        this.log('[%s] %s [%s%].', this.name, platformLang.curSpeed, this.cacheSpeed);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalNightLightUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheLight === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedPuri',
        value: this.night2Code[newValue],
      });

      // Cache the new state and log if appropriate
      this.cacheLight = newValue;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, 'current light', newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.cusChar.NightLight, this.cacheLight === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalLockUpdate(value) {
    try {
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheLock === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedPuri',
        value: this.lock2Code[newValue],
      });

      // Cache the new state and log if appropriate
      this.cacheLock = newValue;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, 'current lock', newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.hapChar.LockPhysicalControls,
          this.cacheLock === 'on' ? 1 : 0,
        );
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalDisplayLightUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheDisplay === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedPuri',
        value: this.display2Code[newValue],
      });

      // Cache the new state and log if appropriate
      this.cacheDisplay = newValue;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, 'current display', newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.cusChar.DisplayLight, this.cacheLight === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    // Check for an ON/OFF change
    if (params.state && params.state !== this.cacheState) {
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.Active, this.cacheState === 'on');
      this.service.updateCharacteristic(
        this.hapChar.CurrentAirPurifierState,
        this.cacheState === 'on' ? 2 : 0,
      );

      // Log the change if appropriate
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
      }
    }

    // Don't apply the update during the five-second timeout from controlling speed
    if (this.updateTimeoutAWS) {
      return;
    }

    // Check for some scene change
    if (!params.scene) {
      return;
    }
    if (Object.values(this.value2Code).includes(params.scene)) {
      // Find the corresponding key for this scene code
      const key = Object.keys(this.value2Code).find((k) => this.value2Code[k] === params.scene);

      // Convert to HomeKit speed by multiplying by 25
      const hkSpeed = key * 25;

      // Check if the new speed is different from the cached speed
      if (hkSpeed !== this.cacheSpeed) {
        // Check if the device was previously OFF, if so update HomeKit to show as ON
        if (this.cacheState === 'off') {
          // Update Homekit and the cache
          this.service.updateCharacteristic(this.hapChar.Active, 1);
          this.service.updateCharacteristic(this.hapChar.CurrentAirPurifierState, 2);
          this.cacheState = 'on';

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
          }
        }

        // Update HomeKit and the cache
        this.service.updateCharacteristic(this.hapChar.RotationSpeed, hkSpeed);
        this.cacheSpeed = hkSpeed;

        // Log the change if appropriate
        if (this.enableLogging) {
          this.log('[%s] %s [%s%].', this.name, platformLang.curSpeed, this.cacheSpeed);
        }
      }
    } else if (Object.values(this.night2Code).includes(params.scene)) {
      // Logic
    } else if (Object.values(this.display2Code).includes(params.scene)) {
      // Logic
    } else if (Object.values(this.lock2Code).includes(params.scene)) {
      // Logic
    } else {
      this.log.warn('[%s] New/Unknown scene code received: [%s].', this.name, params.scene);
    }
  }
}

import { base64ToHex, parseError } from '../utils/functions.js';
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
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;

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
        cmd: 'statePuri',
        value: value ? 1 : 0,
      });

      // Update the current state characteristic
      this.service.updateCharacteristic(this.hapChar.CurrentAirPurifierState, value === 1 ? 2 : 0);

      // Cache the new state and log if appropriate
      this.cacheState = newValue;
      this.accessory.log(`${platformLang.curState} [${newValue}]`);
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

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedPuri',
        value: newCode,
      });

      // Cache the new state and log if appropriate
      this.cacheSpeed = newValue * 25;
      this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}%]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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
      this.accessory.log(`${platformLang.curLight} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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
      this.accessory.log(`${platformLang.curLock} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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
      this.accessory.log(`${platformLang.curDisplay} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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
      this.service.updateCharacteristic(this.hapChar.CurrentAirPurifierState, this.cacheState === 'on' ? 2 : 0);

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
    }

    // Check for some other scene/mode change
    (params.commands || []).forEach((command) => {
      const hexString = base64ToHex(command);
      switch (command) {
        default:
          this.accessory.logWarn(`${platformLang.newScene}: [${command}] [${hexString}]`);
          break;
      }
    });
  }
}

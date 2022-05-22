import platformFuncs from '../utils/functions.js';
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
    this.enableLogging = accessory.context.enableLogging;
    this.enableDebugLogging = accessory.context.enableDebugLogging;

    // Add the fan service for the heater if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Fan) || this.accessory.addService(this.hapServ.Fan);

    // Add the set handler to the heater on/off characteristic
    this.service
      .getCharacteristic(this.hapChar.On)
      .onSet(async (value) => this.internalStateUpdate(value));
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 33,
        validValues: [0, 33, 66, 99],
      })
      .onSet(async (value) => this.internalSpeedUpdate(value));
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value;

    // Add the set handler to the fan rotation direction characteristic (for oscillation)
    this.service
      .getCharacteristic(this.hapChar.RotationDirection)
      .onSet(async (value) => this.internalDirectionUpdate(value));
    this.cacheDir = this.service.getCharacteristic(this.hapChar.RotationDirection).value === 1 ? 'on' : 'off';

    // Output the customised options to the log
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

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
      this.cacheState = newValue;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curState, newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = platformFuncs.parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalSpeedUpdate(value) {
    try {
      // Match to a valid value of 0, 33, 66, 99
      let code;
      let speed;
      let speedLabel;
      if (value === 0) {
        // Will be taken care of by the off handler
        return;
      } if (value <= 33) {
        code = 'MwUBAAAAAAAAAAAAAAAAAAAAADc=';
        speed = 33;
        speedLabel = 'low';
      } else if (value <= 66) {
        code = 'MwUCAAAAAAAAAAAAAAAAAAAAADQ=';
        speed = 66;
        speedLabel = 'medium';
      } else if (value <= 100) {
        code = 'MwUDAAAAAAAAAAAAAAAAAAAAADU=';
        speed = 99;
        speedLabel = 'high';
      }

      // Don't continue if the new value is the same as before
      if (this.cacheSpeed === speed) {
        return;
      }
      const updateTimeoutAWS = platformFuncs.generateRandomString(5);
      this.updateTimeoutAWS = updateTimeoutAWS;

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedHeat',
        value: code,
      });

      setTimeout(() => {
        if (this.updateTimeoutAWS === updateTimeoutAWS) {
          this.updateTimeoutAWS = false;
        }
      }, 5000);

      // Cache the new state and log if appropriate
      this.cacheSpeed = speed;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curSpeed, speedLabel);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = platformFuncs.parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalDirectionUpdate(value) {
    try {
      // value === 0 -> clockwise -> oscillation OFF
      // value === 1 -> anticlockwise -> oscillation ON
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheDir === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'speedHeat',
        value: value ? 'MxgBAAAAAAAAAAAAAAAAAAAAACo=' : 'MxgAAAAAAAAAAAAAAAAAAAAAACs=',
      });

      // Cache the new state and log if appropriate
      this.cacheState = newValue;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curOscillation, newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = platformFuncs.parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.hapChar.RotationDirection,
          this.cacheDir === 'on' ? 1 : 0,
        );
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    // Don't apply the update during the five second timeout from controlling speed
    if (this.updateTimeoutAWS) {
      return;
    }

    switch (params.scene) {
      case undefined: {
        return;
      }
      case 'MwEBAAAAAAAAAAAAAAAAAAAAADM=': {
        // Turned ON
        if (this.cacheState !== 'on') {
          this.cacheState = 'on';
          this.service.updateCharacteristic(this.hapChar.On, true);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
          }
        }
        break;
      }
      case 'MwEAAAAAAAAAAAAAAAAAAAAAADI=': {
        // Turned OFF
        if (this.cacheState !== 'off') {
          this.cacheState = 'off';
          this.service.updateCharacteristic(this.hapChar.On, false);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
          }
        }
        break;
      }
      case 'MwUBAAAAAAAAAAAAAAAAAAAAADc=': {
        // Low speed
        // Check if the device was previously OFF, if so update HomeKit to show as ON
        if (this.cacheState === 'off') {
          // Update Homekit and the cache
          this.service.updateCharacteristic(this.hapChar.On, true);
          this.cacheState = 'on';

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
          }
        }
        if (this.cacheSpeed !== 33) {
          this.cacheSpeed = 33;
          this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curSpeed, 'low');
          }
        }
        break;
      }
      case 'MwUCAAAAAAAAAAAAAAAAAAAAADQ=': {
        // Medium speed
        // Check if the device was previously OFF, if so update HomeKit to show as ON
        if (this.cacheState === 'off') {
          // Update Homekit and the cache
          this.service.updateCharacteristic(this.hapChar.On, true);
          this.cacheState = 'on';

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
          }
        }
        if (this.cacheSpeed !== 66) {
          this.cacheSpeed = 66;
          this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curSpeed, 'medium');
          }
        }
        break;
      }

      case 'MwUDAAAAAAAAAAAAAAAAAAAAADU=': {
        // High speed
        // Check if the device was previously OFF, if so update HomeKit to show as ON
        if (this.cacheState === 'off') {
          // Update Homekit and the cache
          this.service.updateCharacteristic(this.hapChar.On, true);
          this.cacheState = 'on';

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
          }
        }
        if (this.cacheSpeed !== 99) {
          this.cacheSpeed = 99;
          this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curSpeed, 'high');
          }
        }
        break;
      }
      case 'MxgBAAAAAAAAAAAAAAAAAAAAACo=': {
        // Start oscillation
        if (this.cacheDir !== 'on') {
          this.cacheDir = 'on';
          this.service.updateCharacteristic(this.hapChar.RotationDirection, 1);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curOscillation, this.cacheDir);
          }
        }
        break;
      }
      case 'MxgAAAAAAAAAAAAAAAAAAAAAACs=': {
        // Stop oscillation
        if (this.cacheDir !== 'off') {
          this.cacheDir = 'off';
          this.service.updateCharacteristic(this.hapChar.RotationDirection, 0);

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log('[%s] %s [%s].', this.name, platformLang.curOscillation, this.cacheDir);
          }
        }
        break;
      }
      default: {
        this.log.warn('[%s] New/Unknown scene code received: [%s].', this.name, params.scene);
      }
    }
  }
}

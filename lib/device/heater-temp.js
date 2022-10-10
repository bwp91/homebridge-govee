import { generateRandomString, hasProperty, parseError } from '../utils/functions.js';
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
    this.temperatureSource = accessory.context.temperatureSource;

    // Remove fan service if exists
    if (accessory.getService(this.hapServ.Fan)) {
      accessory.removeService(accessory.getService(this.hapServ.Fan));
    }

    // Set up the accessory with default target temp when added the first time
    if (!hasProperty(this.accessory.context, 'cacheTarget')) {
      this.accessory.context.cacheTarget = 20;
    }

    // Add the heater service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.HeaterCooler)
      || this.accessory.addService(this.hapServ.HeaterCooler);

    // Add options to the target state characteristic
    this.service.getCharacteristic(this.hapChar.TargetHeaterCoolerState).setProps({
      minValue: 0,
      maxValue: 0,
      validValues: [0],
    });

    // Set custom properties of the current temperature characteristic
    this.service.getCharacteristic(this.hapChar.CurrentTemperature).setProps({
      minStep: 0.1,
    });
    this.cacheTemp = this.service.getCharacteristic(this.hapChar.CurrentTemperature).value;

    // Add the set handler to the heater active characteristic
    this.service
      .getCharacteristic(this.hapChar.Active)
      .onSet(async (value) => this.internalStateUpdate(value));

    // Add the set handler to the target temperature characteristic
    this.service
      .getCharacteristic(this.hapChar.HeatingThresholdTemperature)
      .updateValue(this.accessory.context.cacheTarget)
      .setProps({ minStep: 0.5 })
      .onSet(async (value) => this.internalTargetTempUpdate(value));

    // Add the set handler to the heater rotation speed characteristic
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
      .getCharacteristic(this.hapChar.SwingMode)
      .onSet(async (value) => this.internalDirectionUpdate(value));
    this.cacheDir = this.service.getCharacteristic(this.hapChar.SwingMode).value === 1 ? 'on' : 'off';

    // Initialise these caches now since they aren't determined by the initial externalUpdate()
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value === 1 ? 'on' : 'off';
    this.cacheHeat = this.cacheState === 'on' && this.service.getCharacteristic(this.hapChar.CurrentHeaterCoolerState).value === 2
      ? 'on'
      : 'off';

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('custom', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {},
    });

    // Set up an interval to get regular temperature updates
    setTimeout(() => {
      this.getTemperature();
      this.intervalPoll = setInterval(() => this.getTemperature(), 120000);
    }, 5000);

    // Stop the intervals on Homebridge shutdown
    platform.api.on('shutdown', () => {
      clearInterval(this.intervalPoll);
    });

    // Output the customised options to the log
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
      temperatureSource: this.temperatureSource,
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      let newState;
      let newHeat;
      let newValue;
      if (value === 0) {
        newValue = 'off';
        newState = 'off';
        newHeat = 'off';
      } else if (this.cacheTemp < this.accessory.context.cacheTarget) {
        newValue = 'on';
        newState = 'on';
        newHeat = 'on';
      } else {
        newValue = 'off';
        newState = 'on';
        newHeat = 'off';
      }

      // Only send the update if either:
      // * The new value (state) is OFF and the cacheHeat was ON
      // * The new value (state) is ON and newHeat is 'on'
      if ((value === 0 && this.cacheHeat === 'on') || (value === 1 && newHeat === 'on')) {
        // Send the request to the platform sender function
        await this.platform.sendDeviceUpdate(this.accessory, {
          cmd: 'stateHeat',
          value: newValue === 'on' ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI=',
        });
      }

      // Cache and log
      if (newState !== this.cacheState) {
        this.cacheState = newState;
        if (this.enableLogging) {
          this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
        }
      }
      if (newHeat !== this.cacheHeat) {
        this.cacheHeat = newHeat;
        if (this.enableLogging) {
          this.log('[%s] %s [%s].', this.name, platformLang.curHeat, this.cacheHeat);
        }
      }
      const newOnState = this.cacheHeat === 'on' ? 2 : 1;
      this.service.updateCharacteristic(
        this.hapChar.CurrentHeaterCoolerState,
        value === 1 ? newOnState : 0,
      );
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

  async internalTargetTempUpdate(value) {
    try {
      // Don't continue if the new value is the same as before
      if (value === this.accessory.context.cacheTarget) {
        return;
      }
      this.accessory.context.cacheTarget = value;
      if (this.enableLogging) {
        this.log('[%s] %s [%s°C].', this.name, platformLang.curTarg, value);
      }
      if (this.cacheState === 'off') {
        return;
      }

      // Check to see if we need to turn on or off
      let newValue;
      let newHeat;
      if (this.cacheTemp < value) {
        newValue = 'on';
        newHeat = 'on';
      } else {
        newValue = 'off';
        newHeat = 'off';
      }

      // Don't continue if no change needed to device state
      if (newHeat === this.cacheHeat) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateHeat',
        value: newValue === 'on' ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI=',
      });

      // Cache and log
      this.cacheHeat = newHeat;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curHeat, this.cacheHeat);
      }
      this.service.updateCharacteristic(
        this.hapChar.CurrentHeaterCoolerState,
        this.cacheHeat === 'on' ? 2 : 1,
      );
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.hapChar.HeatingThresholdTemperature,
          this.accessory.context.cacheTarget,
        );
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalCurrentTempUpdate() {
    try {
      // Don't continue if the device is off
      if (this.cacheState === 'off') {
        return;
      }

      // Check to see if we need to turn on or off
      let newValue;
      let newHeat;
      if (this.cacheTemp < this.accessory.context.cacheTarget) {
        newValue = 'on';
        newHeat = 'on';
      } else {
        newValue = 'off';
        newHeat = 'off';
      }

      // Don't continue if no change needed to device state
      if (newHeat === this.cacheHeat) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateHeat',
        value: newValue === 'on' ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI=',
      });

      // Log and cache
      this.cacheHeat = newHeat;
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curHeat, this.cacheHeat);
      }
      this.service.updateCharacteristic(
        this.hapChar.CurrentHeaterCoolerState,
        this.cacheHeat === 'on' ? 2 : 1,
      );
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s.', this.name, eText);
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
      const updateTimeoutAWS = generateRandomString(5);
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
      const eText = parseError(err);
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
      // value === 0 -> oscillation OFF
      // value === 1 -> oscillation ON -> clockwise
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
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.hapChar.SwingMode,
          this.cacheDir === 'on' ? 1 : 0,
        );
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async getTemperature() {
    try {
      // Skip polling if the storage hasn't initialised properly
      if (!this.platform.storageClientData) {
        return;
      }

      const newTemp = await this.platform.storageData.getItem(`${this.temperatureSource}_temp`);
      if (newTemp && newTemp !== this.cacheTemp) {
        this.cacheTemp = newTemp;
        this.service.updateCharacteristic(this.hapChar.CurrentTemperature, this.cacheTemp);
        this.accessory.eveService.addEntry({ temp: this.cacheTemp });
        if (this.enableLogging) {
          this.log('[%s] %s [%s°C].', this.name, platformLang.curTemp, this.cacheTemp);
        }
        await this.internalCurrentTempUpdate();
      }
    } catch (err) {
      const eText = parseError(err);
      this.log.warn('[%s] %s.', this.name, eText);
    }
  }

  externalUpdate(params) {
    // Don't apply the update during the five-second timeout from controlling speed
    if (this.updateTimeoutAWS) {
      return;
    }

    switch (params.scene) {
      case 'qhoAAAAAAAAAAAAAAAAAAAAAALA=':
      case undefined: {
        return;
      }
      case 'MwEBAAAAAAAAAAAAAAAAAAAAADM=': {
        // Turned ON
        if (this.cacheState !== 'on') {
          this.cacheState = 'on';
          this.service.updateCharacteristic(this.hapChar.Active, 1);
          this.service.updateCharacteristic(this.hapChar.CurrentHeaterCoolerState, this.cacheHeat === 'on' ? 2 : 1);

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
          this.cacheHeat = 'off';
          this.service.updateCharacteristic(this.hapChar.Active, 0);
          this.service.updateCharacteristic(this.hapChar.CurrentHeaterCoolerState, 0);

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
          this.service.updateCharacteristic(this.hapChar.Active, 1);
          this.service.updateCharacteristic(this.hapChar.CurrentHeaterCoolerState, this.cacheHeat === 'on' ? 2 : 1);
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
          this.service.updateCharacteristic(this.hapChar.CurrentHeaterCoolerState, this.cacheHeat === 'on' ? 2 : 1);
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
          this.service.updateCharacteristic(this.hapChar.CurrentHeaterCoolerState, this.cacheHeat === 'on' ? 2 : 1);
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
          this.service.updateCharacteristic(this.hapChar.SwingMode, 1);

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
          this.service.updateCharacteristic(this.hapChar.SwingMode, 0);

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

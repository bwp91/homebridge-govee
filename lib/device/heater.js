import { generateRandomString, parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  H7131
  ON: MwEBAAAAAAAAAAAAAAAAAAAAADM=
  OFF: MwEAAAAAAAAAAAAAAAAAAAAAADI=

  LOW: OgUBAQAAAAAAAAAAAAAAAAAAAD8=
  MED: OgUBAgAAAAAAAAAAAAAAAAAAADw=
  HIGH: OgUBAwAAAAAAAAAAAAAAAAAAAD0=
  FAN: OgUJAAAAAAAAAAAAAAAAAAAAADY=

  AUTO TURN ON TO:
    5: OgUDAZAEAAAAAAAAAAAAAAAAAKk=
    6: OgUDAZBoAAAAAAAAAAAAAAAAAMU=
    7: OgUDAZEwAAAAAAAAAAAAAAAAAJw=
    8: OgUDAZH4AAAAAAAAAAAAAAAAAFQ=
    9: OgUDAZLAAAAAAAAAAAAAAAAAAG8=
    10: OgUDAZOIAAAAAAAAAAAAAAAAACY=
    11: OgUDAZPsAAAAAAAAAAAAAAAAAEI=
    12: OgUDAZS0AAAAAAAAAAAAAAAAAB0=
    13: OgUDAZV8AAAAAAAAAAAAAAAAANQ=
    14: OgUDAZZEAAAAAAAAAAAAAAAAAO8=
    15: OgUDAZcMAAAAAAAAAAAAAAAAAKY=
    16: OgUDAZdwAAAAAAAAAAAAAAAAANo=
    17: OgUDAZg4AAAAAAAAAAAAAAAAAJ0=
    18: OgUDAZkAAAAAAAAAAAAAAAAAAKQ=
    19: OgUDAZnIAAAAAAAAAAAAAAAAAGw=
    20: OgUDAZqQAAAAAAAAAAAAAAAAADc=
    21: OgUDAZr0AAAAAAAAAAAAAAAAAFM=
    22: OgUDAZu8AAAAAAAAAAAAAAAAABo=
    23: OgUDAZyEAAAAAAAAAAAAAAAAACU=
    24: OgUDAZ1MAAAAAAAAAAAAAAAAAOw=
    25: OgUDAZ4UAAAAAAAAAAAAAAAAALc=
    26: OgUDAZ54AAAAAAAAAAAAAAAAANs=
    27: OgUDAZ9AAAAAAAAAAAAAAAAAAOI=
    28: OgUDAaAIAAAAAAAAAAAAAAAAAJU=
    29: OgUDAaDQAAAAAAAAAAAAAAAAAE0=
    30: OgUDAaGYAAAAAAAAAAAAAAAAAAQ=

  WHILST IN AUTO SET TO:
    5: MwUDAZAEAAAAAAAAAAAAAAAAAKA=
    6: MwUDAZBoAAAAAAAAAAAAAAAAAMw=
    7: MwUDAZEwAAAAAAAAAAAAAAAAAJU=
    8: MwUDAZH4AAAAAAAAAAAAAAAAAF0=
    9: MwUDAZLAAAAAAAAAAAAAAAAAAGY=
    10: MwUDAZOIAAAAAAAAAAAAAAAAAC8=
    11: MwUDAZPsAAAAAAAAAAAAAAAAAEs=
    12: MwUDAZS0AAAAAAAAAAAAAAAAABQ=
    13: MwUDAZV8AAAAAAAAAAAAAAAAAN0=
    14: MwUDAZZEAAAAAAAAAAAAAAAAAOY=
    15: MwUDAZcMAAAAAAAAAAAAAAAAAK8=
    16: MwUDAZdwAAAAAAAAAAAAAAAAANM=
    17: MwUDAZg4AAAAAAAAAAAAAAAAAJQ=
    18: MwUDAZkAAAAAAAAAAAAAAAAAAK0=
    19: MwUDAZnIAAAAAAAAAAAAAAAAAGU=
    20: MwUDAZqQAAAAAAAAAAAAAAAAAD4=
    21: MwUDAZr0AAAAAAAAAAAAAAAAAFo=
    22: MwUDAZu8AAAAAAAAAAAAAAAAABM=
    23: MwUDAZyEAAAAAAAAAAAAAAAAACw=
    24: MwUDAZ1MAAAAAAAAAAAAAAAAAOU=
    25: MwUDAZ4UAAAAAAAAAAAAAAAAAL4=
    26: MwUDAZ54AAAAAAAAAAAAAAAAANI=
    27: MwUDAZ9AAAAAAAAAAAAAAAAAAOs=
    28: MwUDAaAIAAAAAAAAAAAAAAAAAJw=
    29: MwUDAaDQAAAAAAAAAAAAAAAAAEQ=
    30: MwUDAaGYAAAAAAAAAAAAAAAAAA0=

  OSC ON: Mx8BAQAAAAAAAAAAAAAAAAAAACw=
  OSC OFF: Mx8BAAAAAAAAAAAAAAAAAAAAAC0=

  LIGHT ON: OhsBAQEAAAAAAAAAAAAAAAAAACA=
  LIGHT OFF: OhsBAQAAAAAAAAAAAAAAAAAAACE=

  LOCK ON: Mx8CAQAAAAAAAAAAAAAAAAAAAC8=
  LOCK OFF: Mx8CAAAAAAAAAAAAAAAAAAAAAC4=

  DISPLAY ON: MxYB/////wAAAAAAAAAAAAAAACQ=
  DISPLAY OFF: MxYA/////wAAAAAAAAAAAAAAACU=

  COMMANDS IN FORM:
  {
    msg: {
      transaction: '%%',
      data: {
        command: ['%%'],
      },
      type: 1,
      cmdVersion: 0,
      cmd:"multiSync",
    },
  },
 */

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

  H7131
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
        },
        {
          "name": "Fan",
          "value": "4"
        },
        {
          "name": "Auto",
          "value": "5"
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

    // Remove heater service if exists
    if (accessory.getService(this.hapServ.HeaterCooler)) {
      accessory.removeService(accessory.getService(this.hapServ.HeaterCooler));
    }

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
    const opts = JSON.stringify({});
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);
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
      this.accessory.log(`${platformLang.curState} [${newValue}]`);
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
      this.accessory.log(`${platformLang.curSpeed} [${speedLabel}]`);
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
      this.cacheDir = newValue;
      this.accessory.log(`${platformLang.curOscillation} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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
          this.service.updateCharacteristic(this.hapChar.On, true);

          // Log the change
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        break;
      }
      case 'MwEAAAAAAAAAAAAAAAAAAAAAADI=': {
        // Turned OFF
        if (this.cacheState !== 'off') {
          this.cacheState = 'off';
          this.service.updateCharacteristic(this.hapChar.On, false);

          // Log the change
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
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

          // Log the change
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        if (this.cacheSpeed !== 33) {
          this.cacheSpeed = 33;
          this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);

          // Log the change
          this.accessory.log(`${platformLang.curSpeed} [low]`);
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

          // Log the change
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        if (this.cacheSpeed !== 66) {
          this.cacheSpeed = 66;
          this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);

          // Log the change
          this.accessory.log(`${platformLang.curSpeed} [medium]`);
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

          // Log the change
          this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
        }
        if (this.cacheSpeed !== 99) {
          this.cacheSpeed = 99;
          this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed);

          // Log the change
          this.accessory.log(`${platformLang.curSpeed} [high]`);
        }
        break;
      }
      case 'MxgBAAAAAAAAAAAAAAAAAAAAACo=': {
        // Start oscillation
        if (this.cacheDir !== 'on') {
          this.cacheDir = 'on';
          this.service.updateCharacteristic(this.hapChar.RotationDirection, 1);

          // Log the change
          this.accessory.log(`${platformLang.curOscillation} [${this.cacheDir}]`);
        }
        break;
      }
      case 'MxgAAAAAAAAAAAAAAAAAAAAAACs=': {
        // Stop oscillation
        if (this.cacheDir !== 'off') {
          this.cacheDir = 'off';
          this.service.updateCharacteristic(this.hapChar.RotationDirection, 0);

          // Log the change
          this.accessory.log(`${platformLang.curOscillation} [${this.cacheDir}]`);
        }
        break;
      }
      default: {
        this.accessory.logWarn(`new/unknown scene code received: [${params.scene}]`);
      }
    }
  }
}

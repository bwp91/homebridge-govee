import {
  farToCen,
  hasProperty,
  nearestHalf,
  parseError,
} from '../utils/functions.js';
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

    // Remove fan service if exists
    if (accessory.getService(this.hapServ.Fan)) {
      accessory.removeService(accessory.getService(this.hapServ.Fan));
    }

    // Add the heater service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.HeaterCooler);
    if (!this.service) {
      this.service = this.accessory.addService(this.hapServ.HeaterCooler);
      this.service.updateCharacteristic(this.hapChar.CurrentTemperature, 20);
      this.service.updateCharacteristic(this.hapChar.HeatingThresholdTemperature, 20);
    }

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
      });
    this.cacheTarg = this.service.getCharacteristic(this.hapChar.HeatingThresholdTemperature).value;

    // Add the set handler to the heater swing mode characteristic (for oscillation)
    this.service
      .getCharacteristic(this.hapChar.SwingMode)
      .onSet(async (value) => this.internalSwingUpdate(value));
    this.cacheSwing = this.service.getCharacteristic(this.hapChar.SwingMode).value === 1 ? 'on' : 'off';

    // Add the set handler to the heater lock characteristic (for oscillation)
    this.service
      .getCharacteristic(this.hapChar.LockPhysicalControls)
      .onSet(async (value) => this.internalLockUpdate(value));
    this.cacheLock = this.service.getCharacteristic(this.hapChar.LockPhysicalControls).value === 1 ? 'on' : 'off';

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

  async internalSwingUpdate(value) {
    try {
      // value === 0 -> oscillation OFF
      // value === 1 -> oscillation ON
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheSwing === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'swingHeat',
        value: value ? 'MxgBAAAAAAAAAAAAAAAAAAAAACo=' : 'MxgAAAAAAAAAAAAAAAAAAAAAACs=',
      });

      // Cache the new state and log if appropriate
      this.cacheSwing = newValue;
      this.accessory.log(`${platformLang.curSwing} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.hapChar.SwingMode,
          this.cacheSwing === 'on' ? 1 : 0,
        );
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalLockUpdate(value) {
    try {
      // value === 0 -> lock OFF
      // value === 1 -> lock ON
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheLock === newValue) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'swingHeat',
        value: value ? 'Mx8CAQAAAAAAAAAAAAAAAAAAAC8=' : 'Mx8CAAAAAAAAAAAAAAAAAAAAAC4=',
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

  externalUpdate(params) {
    this.accessory.log(`state:${params.state} temp:${params.temperature} setTemperature:${params.setTemperature}`);
    this.accessory.log(`cacheTarg:${this.cacheTarg}`);

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

    (params.commands || []).forEach((command) => {
      switch (command) {
        case 'qh8AAQAAAAAAAAAAAAAAAAAAALQ=':
          if (this.cacheLock !== 'on') {
            this.cacheLock = 'on';
            this.service.updateCharacteristic(this.hapChar.LockPhysicalControls, 1);
            this.accessory.log(`${platformLang.curLock} [${this.cacheLock}]`);
          }
          break;
        case 'qh8AAAAAAAAAAAAAAAAAAAAAALU=':
          if (this.cacheLock !== 'off') {
            this.cacheLock = 'off';
            this.service.updateCharacteristic(this.hapChar.LockPhysicalControls, 0);
            this.accessory.log(`${platformLang.curLock} [${this.cacheLock}]`);
          }
          break;
        default: {
          this.accessory.logWarn(`new/unknown scene code received: [${command}]`);
        }
      }
    });
  }
}

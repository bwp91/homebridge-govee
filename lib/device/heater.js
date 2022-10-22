import { rgb2hs } from '../utils/colour.js';
import {
  base64ToHex,
  farToCen,
  generateCodeFromHexValues,
  getTwoItemPosition,
  hasProperty,
  hexToDecimal,
  hexToTwoItems,
  nearestHalf,
  parseError,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  H7131
  LOW: OgUBAQAAAAAAAAAAAAAAAAAAAD8= 3a0501010000000000000000000000000000003f
  MED: OgUBAgAAAAAAAAAAAAAAAAAAADw= 3a0501020000000000000000000000000000003c
  HGH: OgUBAwAAAAAAAAAAAAAAAAAAAD0= 3a0501030000000000000000000000000000003d
  FAN: OgUJAAAAAAAAAAAAAAAAAAAAADY= 3a05090000000000000000000000000000000036

  AUTO TURN ON TO:
   05: OgUDAZAEAAAAAAAAAAAAAAAAAKk= 3a050301900400000000000000000000000000a9
   06: OgUDAZBoAAAAAAAAAAAAAAAAAMU= 3a050301906800000000000000000000000000c5
   07: OgUDAZEwAAAAAAAAAAAAAAAAAJw= 3a0503019130000000000000000000000000009c
   08: OgUDAZH4AAAAAAAAAAAAAAAAAFQ=
   09: OgUDAZLAAAAAAAAAAAAAAAAAAG8=
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
   05: MwUDAZAEAAAAAAAAAAAAAAAAAKA=
   06: MwUDAZBoAAAAAAAAAAAAAAAAAMw=
   07: MwUDAZEwAAAAAAAAAAAAAAAAAJU=
   08: MwUDAZH4AAAAAAAAAAAAAAAAAF0=
   09: MwUDAZLAAAAAAAAAAAAAAAAAAGY=
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

  NIGHT LIGHT EXAMPLES
  ON_: OhsBAWQAAAAAAAAAAAAAAAAAAEU= 3a1b010164000000000000000000000000000045
  OFF: OhsBAGQAAAAAAAAAAAAAAAAAAEQ= 3a1b010064000000000000000000000000000044
                                           |^^<< brightness 0-100 as hex
                                           ^<<<< state
  RGB: OhsFDQD/AAAAAAAAAAAAAAAAANY= 3a1b050d00ff00000000000000000000000000d6
                                            ||||^^<< red
                                            ||^^<<<< green
                                            ^^<<<<<< blue

  DISPLAY
  ON_: MxYB/////wAAAAAAAAAAAAAAACQ= 331601ffffffff00000000000000000000000024
  OFF: MxYA/////wAAAAAAAAAAAAAAACU= 331600ffffffff00000000000000000000000025
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

  H7131 and H7132
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

    this.log = platform.log;

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

    // Add the night light service if it doesn't already exist
    this.lightService = this.accessory.getService(this.hapServ.Lightbulb)
      || this.accessory.addService(this.hapServ.Lightbulb);

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

    // Add the set handler to the lightbulb on/off characteristic
    this.lightService.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalLightStateUpdate(value);
    });
    this.cacheLightState = this.lightService.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Add the set handler to the lightbulb brightness characteristic
    this.lightService
      .getCharacteristic(this.hapChar.Brightness)
      .onSet(async (value) => {
        await this.internalBrightnessUpdate(value);
      });
    this.cacheBright = this.lightService.getCharacteristic(this.hapChar.Brightness).value;

    // Add the set handler to the lightbulb hue characteristic
    this.lightService.getCharacteristic(this.hapChar.Hue).onSet(async (value) => {
      await this.internalColourUpdate(value);
    });
    this.cacheHue = this.lightService.getCharacteristic(this.hapChar.Hue).value;
    this.cacheSat = this.lightService.getCharacteristic(this.hapChar.Saturation).value;

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
      this.cacheTarget = value;
      this.accessory.log(`${platformLang.curTarg} [${this.cacheTarg}°C]`);
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

  async internalSwingUpdate(value) {
    try {
      // value === 0 -> swing mode OFF
      // value === 1 -> swing mode ON
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
      // value === 0 -> child lock OFF
      // value === 1 -> child lock ON
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

  async internalLightStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (this.cacheLightState === newValue) {
        return;
      }

      // NIGHT LIGHT EXAMPLES
      // ON_: OhsBAWQAAAAAAAAAAAAAAAAAAEU= 3a1b010164000000000000000000000000000045
      // OFF: OhsBAGQAAAAAAAAAAAAAAAAAAEQ= 3a1b010064000000000000000000000000000044
      //                                   3a1b01003d00000000000000000000000000001d
      //                                          |^^<< brightness 0-100 as hex
      //                                          ^<<<< state
      // OhsBAD0AAAAAAAAAAAAAAAAAAB0=
      // 3a1b01003d00000000000000000000000000001d

      // Generate the hex values for the code
      const hexValues = [0x3a, 0x1b, 0x01, `0x0${value ? '1' : '0'}`, this.cacheBright];

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'swingHeat',
        value: generateCodeFromHexValues(hexValues),
      });

      // Cache the new state and log if appropriate
      this.cacheLightState = newValue;
      this.accessory.log(`${platformLang.curLight} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.lightService.updateCharacteristic(this.hapChar.On, this.cacheLightState === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalBrightnessUpdate() {
    // eslint-disable-next-line no-empty
    try {

    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.lightService.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalColourUpdate() {
    // eslint-disable-next-line no-empty
    try {

    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.lightService.updateCharacteristic(this.hapChar.Hue, this.cacheHue);
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
      const deviceFunction = `${getTwoItemPosition(hexParts, 2)}${getTwoItemPosition(hexParts, 3)}`;

      switch (deviceFunction) {
        case '1b01': {
          const newLightState = getTwoItemPosition(hexParts, 4) === '01' ? 'on' : 'off';
          if (this.cacheLightState !== newLightState) {
            this.cacheLightState = newLightState;
            this.lightService.updateCharacteristic(this.hapChar.On, this.cacheLightState === 'on');
            this.accessory.log(`${platformLang.curLight} [${this.cacheLightState}]`);
          }
          const newBrightness = hexToDecimal(getTwoItemPosition(hexParts, 5));
          if (this.cacheBright !== newBrightness) {
            this.cacheBright = newBrightness;
            this.lightService.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);
            this.accessory.log(`${platformLang.curBright} [${this.cacheBright}%]`);
          }
          break;
        }
        case '1b05': {
          // Night light colour
          const newR = hexToDecimal(getTwoItemPosition(hexParts, 5));
          const newG = hexToDecimal(getTwoItemPosition(hexParts, 6));
          const newB = hexToDecimal(getTwoItemPosition(hexParts, 7));

          const hs = rgb2hs(newR, newG, newB);

          // Check for a colour change
          if (hs[0] !== this.cacheHue) {
            // Colour is different so update Homebridge with new values
            this.lightService.updateCharacteristic(this.hapChar.Hue, hs[0]);
            this.lightService.updateCharacteristic(this.hapChar.Saturation, hs[1]);
            [this.cacheHue] = hs;

            // Log the change
            this.accessory.log(`${platformLang.curColour} [rgb ${newR} ${newG} ${newB}]`);
          }
          break;
        }
        case '1f00':
        case '1f01': {
          // Swing Mode
          const newSwing = getTwoItemPosition(hexParts, 3) === '01' ? 'on' : 'off';
          if (this.cacheSwing !== newSwing) {
            this.cacheSwing = newSwing;
            this.service.updateCharacteristic(this.hapChar.SwingMode, this.cacheSwing === 'on' ? 1 : 0);
            this.accessory.log(`${platformLang.curSwing} [${this.cacheSwing}]`);
          }

          // Child Lock
          const newLock = getTwoItemPosition(hexParts, 4) === '01' ? 'on' : 'off';
          if (this.cacheLock !== newLock) {
            this.cacheLock = newLock;
            this.service.updateCharacteristic(this.hapChar.LockPhysicalControls, this.cacheLock === 'on' ? 1 : 0);
            this.accessory.log(`${platformLang.curLock} [${this.cacheLock}]`);
          }
          break;
        }
        case '0503': // Target temperature
        case '1100': // Timer off
        case '1101': // Timer on
        case '1600': // Display mode off
        case '1601': // Display mode on
          // We do not need to do anything for these
          break;
        default:
          this.accessory.logWarn(`${platformLang.newScene}: [${command}] [${hexString}]`);
          break;
      }
    });
  }
}

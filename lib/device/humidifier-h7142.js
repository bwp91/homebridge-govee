import {
  base64ToHex,
  getTwoItemPosition,
  hexToDecimal,
  hexToTwoItems,
  parseError,
  sleep,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  H7142
  {
    "mode": {
      "options": [
        {
          "name": "Custom",
          "value": 2
        },
        {
          "name": "Auto",
          "value": 3
        }
      ]
    },
    "gear": {
      "options": [
        {
          "name": "gear",
          "value": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9
          ]
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

    // Rotation speed to value in {1, 2, ..., 8}
    this.speed2Value = (speed) => Math.min(Math.max(parseInt(Math.round(speed / 10), 10), 1), 9);

    // Speed codes
    this.value2Code = {
      1: 'MwUBAQAAAAAAAAAAAAAAAAAAADY=',
      2: 'MwUBAgAAAAAAAAAAAAAAAAAAADU=',
      3: 'MwUBAwAAAAAAAAAAAAAAAAAAADQ=',
      4: 'MwUBBAAAAAAAAAAAAAAAAAAAADM=',
      5: 'MwUBBQAAAAAAAAAAAAAAAAAAADI=',
      6: 'MwUBBgAAAAAAAAAAAAAAAAAAADE=',
      7: 'MwUBBwAAAAAAAAAAAAAAAAAAADA=',
      8: 'MwUBCAAAAAAAAAAAAAAAAAAAAD8=',
      9: 'MwUBCQAAAAAAAAAAAAAAAAAAAD4=',
    };

    // Add the fan service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Fan) || this.accessory.addService(this.hapServ.Fan);

    // Add humidity sensor service if it doesn't already exist
    this.humiService = this.accessory.getService(this.hapServ.HumiditySensor)
      || this.accessory.addService(this.hapServ.HumiditySensor);

    this.cacheHumi = this.humiService.getCharacteristic(this.hapChar.CurrentRelativeHumidity).value;

    // Add the set handler to the fan on/off characteristic
    this.service
      .getCharacteristic(this.hapChar.On)
      .onSet(async (value) => this.internalStateUpdate(value));
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';
    this.cacheUV = this.cacheState;

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 10,
        validValues: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      })
      .onSet(async (value) => this.internalSpeedUpdate(value));
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value;

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
        cmd: 'stateHumi',
        value: value ? 1 : 0,
      });

      // If turning on, also turn on the uv light
      if (value && this.cacheUV === 'off') {
        await sleep(200);

        // Send the uv request to the platform sender function
        await this.platform.sendDeviceUpdate(this.accessory, {
          cmd: 'ptReal',
          value: 'MxoBAAAAAAAAAAAAAAAAAAAAACg=',
        });
      }

      // Cache the new state and log if appropriate
      if (this.cacheState !== newValue) {
        this.cacheState = newValue;
        this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
      }
      if (this.cacheUV !== newValue) {
        this.cacheUV = newValue;
        this.accessory.log(`current uv light [${this.cacheUV}]`);
      }
      this.cacheUV = newValue;
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
      // Don't continue if the speed is 0
      if (value === 0) {
        return;
      }

      // Get the single Govee value {1, 2, ..., 8}
      const newValue = this.speed2Value(value);

      // Don't continue if the speed value won't have effect
      if (newValue * 10 === this.cacheSpeed) {
        return;
      }

      // Get the scene code for this value
      const newCode = this.value2Code[newValue];

      this.accessory.log(newCode);

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'ptReal',
        value: newCode,
      });

      // Cache the new state and log if appropriate
      this.cacheSpeed = newValue * 10;
      this.accessory.log(`${platformLang.curSpeed} [${newValue}]`);
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

  externalUpdate(params) {
    // Check for an ON/OFF change
    if (params.state && params.state !== this.cacheState) {
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
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
        case '0500':
        case '0501': {
          // Mode and speed
          this.accessory.logWarn(`mode/speed: [${command}] [${hexString}]`);
          break;
        }
        case '1001': { // sometimes humidity value
          const humiCheck = getTwoItemPosition(hexParts, 4);
          if (humiCheck === '00') {
            const newHumiHex = `${getTwoItemPosition(hexParts, 5)}${getTwoItemPosition(hexParts, 6)}`;
            const newHumiDec = Math.round(hexToDecimal(newHumiHex)) / 10; // eg 55.5%
            const newHumiHKValue = Math.round(newHumiDec); // eg 56%
            if (newHumiHKValue !== this.cacheHumi) {
              this.cacheHumi = newHumiHKValue;
              this.humiService.updateCharacteristic(this.hapChar.CurrentRelativeHumidity, this.cacheHumi);
              this.accessory.log(`${platformLang.curHumi} [${this.cacheHumi}%]`);
            }
          }
          break;
        }
        case '1800': // display off
        case '1801': { // display on
          const newDisplay = deviceFunction === '1801' ? 'on' : 'off';
          if (newDisplay !== this.cacheDisplay) {
            this.cacheDisplay = newDisplay;
            this.accessory.log(`${platformLang.curDisplay} [${this.cacheDisplay ? 'on' : 'off'}]`);
          }
          break;
        }
        case '1a00': // uv light off
        case '1a01': { // uv light on
          // to implement
          const newUV = deviceFunction === '1a01' ? 'on' : 'off';
          if (newUV !== this.cacheUV) {
            this.cacheUV = newUV;
            this.accessory.log(`current uv light [${this.cacheUV}]`);
          }
          break;
        }
        case '1b00': // night light off
        case '1b01': { // night light on
          // to implement
          const newNight = deviceFunction === '1b01' ? 'on' : 'off';
          if (newNight !== this.cacheNight) {
            this.cacheNight = newNight;
            this.accessory.log(`current night light state [${this.cacheNight}]`);
          }
          this.accessory.logWarn(`night light: [${command}] [${hexString}]`);
          break;
        }
        case '1100': // timer
        case '1101': // timer
        case '1300': // scheduling
        case '1500': { // scheduling
          break;
        }
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`);
          break;
      }
    });
  }
}

// H7142

// MANUAL SPEED 1
// [27/12/2022, 16:44:46] [Govee] [Big Humidifier] mode/speed: [qgUAAQAAAAAAAAAAAAAAAAAAAK4=] [aa050001000000000000000000000000000000ae].
// [27/12/2022, 16:44:46] [Govee] [Big Humidifier] mode/speed: [qgUBAQAAAAAAAAAAAAAAAAAAAK8=] [aa050101000000000000000000000000000000af].
// ["MwUAAAAAAAAAAAAAAAAAAAAAADY=","qgUAAQAAAAAAAAAAAAAAAAAAAK4=","qgUBBgAAAAAAAAAAAAAAAAAAAKg="]}}]
// MANUAL SPEED 2
// [27/12/2022, 16:45:23] [Govee] [Big Humidifier] mode/speed: [qgUAAQAAAAAAAAAAAAAAAAAAAK4=] [aa050001000000000000000000000000000000ae].
// [27/12/2022, 16:45:23] [Govee] [Big Humidifier] mode/speed: [qgUBAgAAAAAAAAAAAAAAAAAAAKw=] [aa050102000000000000000000000000000000ac].

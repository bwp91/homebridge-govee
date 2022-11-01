import {
  base64ToHex,
  getTwoItemPosition,
  hexToTwoItems,
  parseError,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  H7101
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
        },
        {
          "name": "Sleep",
          "value": 5
        },
        {
          "name": "Nature",
          "value": 6
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
            8
          ]
        }
      ]
    }
  }

  H7111
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
        },
        {
          "name": "Sleep",
          "value": 5
        },
        {
          "name": "Nature",
          "value": 6
        },
        {
          "name": "Turbo",
          "value": 7
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
            8
          ]
        }
      ]
    }
  }

  // NOTES
  H7101 -> Sleep, Nature, Turbo, Custom, Auto
  H7111 -> Sleep, Nature, Custom, Auto

  sleep
  [31/10/2022, 20:52:08] [Govee] [Smart Tower Fan] [AWS] receiving update {"source":"AWS","result":1,"commands":["qgUFAAAAAAAAAAAAAAAAAAAAAKo=","qgUABQAAAAAAAAAAAAAAAAAAAKo="]}.
  [31/10/2022, 20:52:08] [Govee] [Smart Tower Fan] new scene code: [qgUFAAAAAAAAAAAAAAAAAAAAAKo=] [aa050500000000000000000000000000000000aa].
  [31/10/2022, 20:52:08] [Govee] [Smart Tower Fan] new scene code: [qgUABQAAAAAAAAAAAAAAAAAAAKo=] [aa050005000000000000000000000000000000aa].

  nature
  [31/10/2022, 20:52:43] [Govee] [Smart Tower Fan] [AWS] receiving update {"source":"AWS","result":1,"commands":["qgUGAAAAAAAAAAAAAAAAAAAAAKk=","qgUABgAAAAAAAAAAAAAAAAAAAKk="]}.
  [31/10/2022, 20:52:43] [Govee] [Smart Tower Fan] new scene code: [qgUGAAAAAAAAAAAAAAAAAAAAAKk=] [aa050600000000000000000000000000000000a9].
  [31/10/2022, 20:52:43] [Govee] [Smart Tower Fan] new scene code: [qgUABgAAAAAAAAAAAAAAAAAAAKk=] [aa050006000000000000000000000000000000a9].

  auto
  [31/10/2022, 20:53:09] [Govee] [Smart Tower Fan] [AWS] receiving update {"source":"AWS","result":1,"commands":["qgUDAQkaCApkAAAAAAAAAAAAANg=","qgUAAwAAAAAAAAAAAAAAAAAAAKw="]}.
  [31/10/2022, 20:53:09] [Govee] [Smart Tower Fan] new scene code: [qgUDAQkaCApkAAAAAAAAAAAAANg=] [aa050301091a080a6400000000000000000000d8].
  [31/10/2022, 20:53:09] [Govee] [Smart Tower Fan] new scene code: [qgUAAwAAAAAAAAAAAAAAAAAAAKw=] [aa050003000000000000000000000000000000ac].
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

    // Codes etc
    this.sppedCodes = {
      SPEED_1: 'MwUBAQAAAAAAAAAAAAAAAAAAADY=',
      SPEED_2: 'MwUBAgAAAAAAAAAAAAAAAAAAADU=',
      SPEED_3: 'MwUBAwAAAAAAAAAAAAAAAAAAADQ=',
      SPEED_4: 'MwUBBAAAAAAAAAAAAAAAAAAAADM=',
      SPEED_5: 'MwUBBQAAAAAAAAAAAAAAAAAAADI=',
      SPEED_6: 'MwUBBgAAAAAAAAAAAAAAAAAAADE=',
      SPEED_7: 'MwUBBwAAAAAAAAAAAAAAAAAAADA=',
      SPEED_8: 'MwUBCAAAAAAAAAAAAAAAAAAAAD8=',
    };

    // Remove any old original Fan services
    if (this.accessory.getService(this.hapServ.Fan)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Fan));
    }

    // Add the fan service for the fan if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Fanv2) || this.accessory.addService(this.hapServ.Fanv2);

    // Add the set handler to the fan on/off characteristic
    this.service
      .getCharacteristic(this.hapChar.Active)
      .onSet(async (value) => this.internalStateUpdate(value));
    this.cacheState = this.service.getCharacteristic(this.hapChar.Active).value ? 'on' : 'off';

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 12.5,
        minValue: 0,
      })
      .onSet(async (value) => this.internalSpeedUpdate(value));
    this.cacheSpeed = `SPEED_${this.service.getCharacteristic(this.hapChar.RotationSpeed).value * 0.08}`;

    // Add the set handler to the fan swing mode
    this.service
      .getCharacteristic(this.hapChar.SwingMode)
      .onSet(async (value) => this.internalSwingUpdate(value));
    this.cacheSwing = this.service.getCharacteristic(this.hapChar.SwingMode).value === 1 ? 'on' : 'off';

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
        cmd: 'stateFan',
        value: value ? 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' : 'MwEAAAAAAAAAAAAAAAAAAAAAADI=',
        // 3301010000000000000000000000000000000033 ON
        // 3301000000000000000000000000000000000032 OFF

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

  async internalSpeedUpdate(value) {
    try {
      // Don't continue if the value is lower than 12.5
      if (value < 12.5) {
        return;
      }
      const newValue = `SPEED_${value * 0.08}`;
      // Don't continue if the new value is the same as before
      if (this.cacheSpeed === newValue) {
        return;
      }

      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateFan',
        value: this.sppedCodes[newValue],
      });

      // Cache the new state and log if appropriate
      this.cacheSpeed = newValue;
      this.accessory.log(`${platformLang.curSpeed} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.RotationSpeed, parseInt(this.cacheSpeed.split('_')[1] ?? '0', 10) / 0.08);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalSwingUpdate(value) {
    try {
      const newValue = value ? 'SWING_ON' : 'SWING_OFF';
      // Don't continue if the new value is the same as before
      if (this.cacheSwing === value) {
        return;
      }

      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateFan',
        value: value ? 'Mx8BAQAAAAAAAAAAAAAAAAAAACw=' : 'Mx8BAAAAAAAAAAAAAAAAAAAAAC0=',
      });

      // Cache the new state and log if appropriate
      this.cacheSwing = newValue;
      this.accessory.log(`${platformLang.curState} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.SwingMode, this.cacheSwing === 'SWING_ON' ? 1 : 0);
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
        case '0501': {
          // Fan speed
          const newSpeed = getTwoItemPosition(hexParts, 4);
          // eslint-disable-next-line default-case
          switch (newSpeed) {
            case '01':
              // Set the speed to 1
              if (this.cacheSpeed !== 'SPEED_1') {
                this.cacheSpeed = 'SPEED_1';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 1 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '02':
              // Set the speed to 2
              if (this.cacheSpeed !== 'SPEED_2') {
                this.cacheSpeed = 'SPEED_2';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 2 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '03':
              // Set the speed to 3
              if (this.cacheSpeed !== 'SPEED_3') {
                this.cacheSpeed = 'SPEED_3';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 3 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '04':
              // Set the speed to 4
              if (this.cacheSpeed !== 'SPEED_4') {
                this.cacheSpeed = 'SPEED_4';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 4 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '05':
              // Set the speed to 5
              if (this.cacheSpeed !== 'SPEED_5') {
                this.cacheSpeed = 'SPEED_5';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 5 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '06':
              // Set the speed to 6
              if (this.cacheSpeed !== 'SPEED_6') {
                this.cacheSpeed = 'SPEED_6';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 6 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '07':
              // Set the speed to 7
              if (this.cacheSpeed !== 'SPEED_7') {
                this.cacheSpeed = 'SPEED_7';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 7 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
            case '08':
              // Set the speed to 8
              if (this.cacheSpeed !== 'SPEED_8') {
                this.cacheSpeed = 'SPEED_8';
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 8 * 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [${this.cacheSpeed}]`);
              }
              break;
          }
          break;
        }
        case '1f01': {
          // Swing Mode
          const newSwing = getTwoItemPosition(hexParts, 4) === '01' ? 'on' : 'off';
          if (this.cacheSwing !== newSwing) {
            this.cacheSwing = newSwing;
            this.service.updateCharacteristic(this.hapChar.SwingMode, this.cacheSwing === 'on' ? 1 : 0);
            this.accessory.log(`${platformLang.curSwing} [${this.cacheSwing}]`);
          }
          break;
        }
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}]`);
          break;
      }
    });
  }
}

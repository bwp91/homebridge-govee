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
  [31/10/2022, 20:52:08] [Govee] [Device1] [AWS] receiving update {"source":"AWS","result":1,"commands":["qgUFAAAAAAAAAAAAAAAAAAAAAKo=","qgUABQAAAAAAAAAAAAAAAAAAAKo="]}.
  [31/10/2022, 20:52:08] [Govee] [Device1] new scene code: [qgUFAAAAAAAAAAAAAAAAAAAAAKo=] [aa050500000000000000000000000000000000aa].
  [31/10/2022, 20:52:08] [Govee] [Device1] new scene code: [qgUABQAAAAAAAAAAAAAAAAAAAKo=] [aa050005000000000000000000000000000000aa].

  nature
  [31/10/2022, 20:52:43] [Govee] [Device1] [AWS] receiving update {"source":"AWS","result":1,"commands":["qgUGAAAAAAAAAAAAAAAAAAAAAKk=","qgUABgAAAAAAAAAAAAAAAAAAAKk="]}.
  [31/10/2022, 20:52:43] [Govee] [Device1] new scene code: [qgUGAAAAAAAAAAAAAAAAAAAAAKk=] [aa050600000000000000000000000000000000a9].
  [31/10/2022, 20:52:43] [Govee] [Device1] new scene code: [qgUABgAAAAAAAAAAAAAAAAAAAKk=] [aa050006000000000000000000000000000000a9].

  auto
  [31/10/2022, 20:53:09] [Govee] [Device1] [AWS] receiving update {"source":"AWS","result":1,"commands":["qgUDAQkaCApkAAAAAAAAAAAAANg=","qgUAAwAAAAAAAAAAAAAAAAAAAKw="]}.
  [31/10/2022, 20:53:09] [Govee] [Device1] new scene code: [qgUDAQkaCApkAAAAAAAAAAAAANg=] [aa050301091a080a6400000000000000000000d8].
  [31/10/2022, 20:53:09] [Govee] [Device1] new scene code: [qgUAAwAAAAAAAAAAAAAAAAAAAKw=] [aa050003000000000000000000000000000000ac].
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
    this.speedCodes = {
      1: 'MwUBAQAAAAAAAAAAAAAAAAAAADY=',
      2: 'MwUBAgAAAAAAAAAAAAAAAAAAADU=',
      3: 'MwUBAwAAAAAAAAAAAAAAAAAAADQ=',
      4: 'MwUBBAAAAAAAAAAAAAAAAAAAADM=',
      5: 'MwUBBQAAAAAAAAAAAAAAAAAAADI=',
      6: 'MwUBBgAAAAAAAAAAAAAAAAAAADE=',
      7: 'MwUBBwAAAAAAAAAAAAAAAAAAADA=',
      8: 'MwUBCAAAAAAAAAAAAAAAAAAAAD8=',
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

    this.service
      .getCharacteristic(this.hapChar.TargetFanState)
      .onSet(async (value) => this.internalTargetUpdate(value));
    this.cacheTarg = this.service.getCharacteristic(this.hapChar.TargetFanState).value === 1 ? 'auto' : 'manual';
    this.service.getCharacteristic(this.hapChar.CurrentFanState);

    // Add the set handler to the fan rotation speed characteristic
    this.service
      .getCharacteristic(this.hapChar.RotationSpeed)
      .setProps({
        minStep: 12.5,
        minValue: 0,
        validValues: [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100],
      })
      .onSet(async (value) => this.internalSpeedUpdate(value));
    this.cacheSpeed = this.service.getCharacteristic(this.hapChar.RotationSpeed).value * 0.08;

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

  async internalTargetUpdate(value) {
    try {
      const newValue = value === 1 ? 'auto' : 'manual';

      // Don't continue if the new value is the same as before
      if (this.cacheTarg === newValue) {
        return;
      }

      // Don't continue if the device is not connected to a sensor
      if (!this.accessory.context.sensorAttached) {
        throw new Error('No sensor attached');
      }

      // If turning to 1 (AUTO) then send the code for auto and turn fan speed to 0

      // If turning to 0 (MANUAL) then send the accessory context cache speed

      // Cache the new state and log if appropriate
      this.cacheTarg = newValue;
      this.accessory.log(`${platformLang.curTarg} [${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.TargetFanState, this.cacheTarg === 'auto' ? 1 : 0);
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
      const newValue = value * 0.08;
      // Don't continue if the new value is the same as before
      if (this.cacheSpeed === newValue) {
        return;
      }

      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateFan',
        value: this.speedCodes[newValue],
      });

      // Cache the new state and log if appropriate
      this.cacheSpeed = newValue;
      this.accessory.log(`${platformLang.curSpeed} [speed-${newValue}]`);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.RotationSpeed, this.cacheSpeed / 0.08);
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
              if (this.cacheSpeed !== 1) {
                this.cacheSpeed = 1;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 12.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '02':
              // Set the speed to 2
              if (this.cacheSpeed !== 2) {
                this.cacheSpeed = 2;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 25);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '03':
              // Set the speed to 3
              if (this.cacheSpeed !== 3) {
                this.cacheSpeed = 3;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 37.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '04':
              // Set the speed to 4
              if (this.cacheSpeed !== 4) {
                this.cacheSpeed = 4;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 50);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '05':
              // Set the speed to 5
              if (this.cacheSpeed !== 5) {
                this.cacheSpeed = 5;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 62.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '06':
              // Set the speed to 6
              if (this.cacheSpeed !== 6) {
                this.cacheSpeed = 6;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 75);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '07':
              // Set the speed to 7
              if (this.cacheSpeed !== 7) {
                this.cacheSpeed = 7;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 87.5);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
            case '08':
              // Set the speed to 8
              if (this.cacheSpeed !== 8) {
                this.cacheSpeed = 8;
                this.service.updateCharacteristic(this.hapChar.RotationSpeed, 100);

                // Log the change
                this.accessory.log(`${platformLang.curSpeed} [speed-${this.cacheSpeed}]`);
              }
              break;
          }
          break;
        }
        case '0500': {
          // Sensor Attached?
          this.accessory.context.sensorAttached = getTwoItemPosition(hexParts, 4) === '03';
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

/*
[DT1] [Govee] [Device1] new scene code: [qhIDAAAAAAAAAAAAAAAAAAAAALs=] [aa120300000000000000000000000000000000bb]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhIDAAAAAAAAAAAAAAAAAAAAALs=] [aa120300000000000000000000000000000000bb]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhIDAAAAAAAAAAAAAAAAAAAAALs=] [aa120300000000000000000000000000000000bb]. LINKED
[DT4] [Govee] [Device1] new scene code: [qhIDAAAAAAAAAAAAAAAAAAAAALs=] [aa120300000000000000000000000000000000bb]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qhIDAAAAAAAAAAAAAAAAAAAAALs=] [aa120300000000000000000000000000000000bb]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qhMAgQgAnwMAAAAAAAAAAAAAAKw=] [aa13008108009f030000000000000000000000ac]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhMAgQgAnwMAAAAAAAAAAAAAAKw=] [aa13008108009f030000000000000000000000ac]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhMAgQgAnwMAAAAAAAAAAAAAAKw=] [aa13008108009f030000000000000000000000ac]. LINKED
[DT4] [Govee] [Device1] new scene code: [qhMAgQgAnwMAAAAAAAAAAAAAAKw=] [aa13008108009f030000000000000000000000ac]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qhMAgQgAnwMAAAAAAAAAAAAAAKw=] [aa13008108009f030000000000000000000000ac]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qhMBgQkA4AMAAAAAAAAAAAAAANM=] [aa1301810900e0030000000000000000000000d3]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhMBgQkA4AMAAAAAAAAAAAAAANM=] [aa1301810900e0030000000000000000000000d3]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhMBgQkA4AMAAAAAAAAAAAAAANM=] [aa1301810900e0030000000000000000000000d3]. LINKED
[DT4] [Govee] [Device1] new scene code: [qhMBgQkA4AMAAAAAAAAAAAAAANM=] [aa1301810900e0030000000000000000000000d3]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qhMBgQkA4AMAAAAAAAAAAAAAANM=] [aa1301810900e0030000000000000000000000d3]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qhMCgQwAAAMAAAAAAAAAAAAAADU=] [aa1302810c000003000000000000000000000035]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhMCgQwAAAMAAAAAAAAAAAAAADU=] [aa1302810c000003000000000000000000000035]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhMCgQwAAAMAAAAAAAAAAAAAADU=] [aa1302810c000003000000000000000000000035]. LINKED
[DT4] [Govee] [Device1] new scene code: [qhMCgQwAAAMAAAAAAAAAAAAAADU=] [aa1302810c000003000000000000000000000035]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qhMCgQwAAAMAAAAAAAAAAAAAADU=] [aa1302810c000003000000000000000000000035]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qhEAAAAAAAAAAAAAAAAAAAAAALs=] [aa110000000000000000000000000000000000bb]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhEAAAAAAAAAAAAAAAAAAAAAALs=] [aa110000000000000000000000000000000000bb]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhEAAAAAAAAAAAAAAAAAAAAAALs=] [aa110000000000000000000000000000000000bb]. LINKED
[DT4] [Govee] [Device1] new scene code: [qhEAAAAAAAAAAAAAAAAAAAAAALs=] [aa110000000000000000000000000000000000bb]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qhEAAAAAAAAAAAAAAAAAAAAAALs=] [aa110000000000000000000000000000000000bb]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qgUCAAgAPAA8BQA8ADwB/////6E=] [aa05020008003c003c05003c003c01ffffffffa1]. LINKED
[DT2] [Govee] [Device1] new scene code: [qgUCAAgAPAA8BQA8ADwB/////6E=] [aa05020008003c003c05003c003c01ffffffffa1]. LINKED
[DT3] [Govee] [Device2] new scene code: [qgUCAAgAPAA8BQA8ADwB/////6E=] [aa05020008003c003c05003c003c01ffffffffa1]. LINKED
[DT4] [Govee] [Device1] new scene code: [qgUCAAgAPAA8BQA8ADwB/////6E=] [aa05020008003c003c05003c003c01ffffffffa1]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qgUCAAgAPAA8BQA8ADwB/////6E=] [aa05020008003c003c05003c003c01ffffffffa1]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qgUDAQkaCApkAAAAAAAAAAAAANg=] [aa050301091a080a6400000000000000000000d8]. LINKED
[DT2] [Govee] [Device1] new scene code: [qgUDAQkaCApkAAAAAAAAAAAAANg=] [aa050301091a080a6400000000000000000000d8]. LINKED
[DT3] [Govee] [Device2] new scene code: [qgUDAQlMCApkAAAAAAAAAAAAAI4=] [aa050301094c080a64000000000000000000008e]. LINKED
[DT4] [Govee] [Device1] new scene code: [qgUDBQo8CAuGAAAAAAAAAAAAABo=] [aa0503050a3c080b86000000000000000000001a]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qgUDBQo8CAuGAAAAAAAAAAAAABo=] [aa0503050a3c080b86000000000000000000001a]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qgUAAwAAAAAAAAAAAAAAAAAAAKw=] [aa050003000000000000000000000000000000ac]. LINKED
[DT2] [Govee] [Device1] new scene code: [qgUAAwAAAAAAAAAAAAAAAAAAAKw=] [aa050003000000000000000000000000000000ac]. LINKED
[DT3] [Govee] [Device2] new scene code: [qgUAAwAAAAAAAAAAAAAAAAAAAKw=] [aa050003000000000000000000000000000000ac]. LINKED
[DT4] [Govee] [Device1] new scene code: [qgUAAQAAAAAAAAAAAAAAAAAAAK4=] [aa050001000000000000000000000000000000ae]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qgUAAQAAAAAAAAAAAAAAAAAAAK4=] [aa050001000000000000000000000000000000ae]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qh8CAQAAAAAAAAAAAAAAAAAAALY=] [aa1f0201000000000000000000000000000000b6]. LINKED
[DT2] [Govee] [Device1] new scene code: [qh8CAQAAAAAAAAAAAAAAAAAAALY=] [aa1f0201000000000000000000000000000000b6]. LINKED
[DT4] [Govee] [Device1] new scene code: [qh8CAQAAAAAAAAAAAAAAAAAAALY=] [aa1f0201000000000000000000000000000000b6]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qh8CAQAAAAAAAAAAAAAAAAAAALY=] [aa1f0201000000000000000000000000000000b6]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qhYBCAAWDwAAAAAAAAAAAAAAAKw=] [aa16010800160f000000000000000000000000ac]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhYBCAAWDwAAAAAAAAAAAAAAAKw=] [aa16010800160f000000000000000000000000ac]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhYBCAAWDwAAAAAAAAAAAAAAAKw=] [aa16010800160f000000000000000000000000ac]. LINKED
[DT4] [Govee] [Device1] new scene code: [qhYBCAAWDwAAAAAAAAAAAAAAAKw=] [aa16010800160f000000000000000000000000ac]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qhYBCAAWDwAAAAAAAAAAAAAAAKw=] [aa16010800160f000000000000000000000000ac]. UNLINKED

[DT1] [Govee] [Device1] new scene code: [qhABA7ODAAAAAAAAAAAAAAAAAIg=] [aa100103b3830000000000000000000000000088]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhABA6+zAAAAAAAAAAAAAAAAAKQ=] [aa100103afb300000000000000000000000000a4]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhABA6fcAAAAAAAAAAAAAAAAAMM=] [aa100103a7dc00000000000000000000000000c3]. LINKED

[DT1] [Govee] [Device1] new scene code: [qhcAAAAAAAAAAAAAAAAAAAAAAL0=] [aa170000000000000000000000000000000000bd]. LINKED
[DT2] [Govee] [Device1] new scene code: [qhcAAAAAAAAAAAAAAAAAAAAAAL0=] [aa170000000000000000000000000000000000bd]. LINKED
[DT3] [Govee] [Device2] new scene code: [qhcAAAAAAAAAAAAAAAAAAAAAAL0=] [aa170000000000000000000000000000000000bd]. LINKED

[DT1] [Govee] [Device1] new scene code: [qghERzUyOc4AAAAAAAAAAAAAAFE=] [aa084447353239ce000000000000000000000051]. LINKED
[DT2] [Govee] [Device1] new scene code: [qghERzUyOc4AAAAAAAAAAAAAAFE=] [aa084447353239ce000000000000000000000051]. LINKED

[DT4] [Govee] [Device1] new scene code: [qggAAAAAAAAAAAAAAAAAAAAAAKI=] [aa080000000000000000000000000000000000a2]. UNLINKED
[DT5] [Govee] [Device1] new scene code: [qggAAAAAAAAAAAAAAAAAAAAAAKI=] [aa080000000000000000000000000000000000a2]. UNLINKED

[DT3] [Govee] [Device2] new scene code: [qgg4fTUyOcUAAAAAAAAAAAAAABw=] [aa08387d353239c500000000000000000000001c]. LINKED

 */

import { parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;

    // Remove switch services if they exist
    if (this.accessory.getService('Switch 1')) {
      this.accessory.removeService(this.accessory.getService('Switch 1'));
    }
    if (this.accessory.getService('Switch 2')) {
      this.accessory.removeService(this.accessory.getService('Switch 2'));
    }

    // Add the outlet services if they don't already exist
    this.service1 = this.accessory.getService('Outlet 1')
      || this.accessory.addService(this.hapServ.Outlet, 'Outlet 1', 'outlet1');
    this.service2 = this.accessory.getService('Outlet 2')
      || this.accessory.addService(this.hapServ.Outlet, 'Outlet 2', 'outlet2');

    if (!this.service1.testCharacteristic(this.hapChar.ConfiguredName)) {
      this.service1.addCharacteristic(this.hapChar.ConfiguredName);
      this.service1.updateCharacteristic(this.hapChar.ConfiguredName, 'Outlet 1');
    }
    if (!this.service1.testCharacteristic(this.hapChar.ServiceLabelIndex)) {
      this.service1.addCharacteristic(this.hapChar.ServiceLabelIndex);
      this.service1.updateCharacteristic(this.hapChar.ServiceLabelIndex, 1);
    }
    if (!this.service2.testCharacteristic(this.hapChar.ConfiguredName)) {
      this.service2.addCharacteristic(this.hapChar.ConfiguredName);
      this.service2.updateCharacteristic(this.hapChar.ConfiguredName, 'Outlet 2');
    }
    if (!this.service2.testCharacteristic(this.hapChar.ServiceLabelIndex)) {
      this.service2.addCharacteristic(this.hapChar.ServiceLabelIndex);
      this.service2.updateCharacteristic(this.hapChar.ServiceLabelIndex, 2);
    }

    // Add the set handler to the switch on/off characteristic
    this.service1.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(this.service1, 1, value);
    });
    this.service1.cacheState = this.service1.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';
    this.service2.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(this.service2, 2, value);
    });
    this.service2.cacheState = this.service2.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Output the customised options to the log
    const opts = JSON.stringify({
      showAs: 'outlet',
    });
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);

    // 51 turns BOTH ON
    // 48 turns BOTH OFF
    // 34 turns outlet 1 ON
    // 32 turns outlet 1 OFF
    // 17 turns outlet 2 ON
    // 16 turns outlet 2 OFF

    // new update??
    // 0 turns BOTH OFF
    // 1 turns CHANNEL1 ON and CHANNEL2 OFF
    // 2 turns CHANNEL1 OFF and CHANNEL2 ON
    // 3 turns BOTH ON
  }

  async internalStateUpdate(service, index, value) {
    try {
      const newValue = value === 1 ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (service.cacheState === newValue) {
        return;
      }

      let command;
      switch (index) { // eslint-disable-line default-case
        case 1:
          if (this.service2.cacheState === 'on') {
            command = value === 1 ? 3 : 2;
          } else {
            command = value === 1 ? 1 : 0;
          }
          break;
        case 2:
          if (this.service1.cacheState === 'on') {
            command = value === 1 ? 3 : 1;
          } else {
            command = value === 1 ? 2 : 0;
          }
          break;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateDual',
        value: command,
      });

      // Cache the new state and log if appropriate
      if (service.cacheState !== newValue) {
        service.cacheState = newValue;
        this.accessory.log(`[${service.getCharacteristic(this.hapChar.ConfiguredName).value}] ${platformLang.curState} [${newValue}]`);
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        service.updateCharacteristic(this.hapChar.On, service.cacheState === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    if (!Array.isArray(params.state)) {
      return;
    }

    if (params.state[0] !== this.service1.cacheState) {
      // eslint-disable-next-line prefer-destructuring
      this.service1.cacheState = params.state[0];
      this.service1.updateCharacteristic(this.hapChar.On, this.service1.cacheState === 'on');

      this.accessory.log(`[${this.service1.getCharacteristic(this.hapChar.ConfiguredName).value}] ${platformLang.curState} [${this.service1.cacheState}]`);
    }

    if (params.state[1] !== this.service2.cacheState) {
      // eslint-disable-next-line prefer-destructuring
      this.service2.cacheState = params.state[1];
      this.service2.updateCharacteristic(this.hapChar.On, this.service2.cacheState === 'on');

      this.accessory.log(`[${this.service2.getCharacteristic(this.hapChar.ConfiguredName).value}] ${platformLang.curState} [${this.service2.cacheState}]`);
    }
  }
}

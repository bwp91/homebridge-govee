import { parseError } from '../utils/functions.js';
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

    // Add the set handler to the switch on/off characteristic
    this.service1.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(this.service1, value ? 34 : 32);
    });
    this.cacheState1 = this.service1.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';
    this.service2.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(this.service2, value ? 17 : 16);
    });
    this.cacheState2 = this.service2.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Output the customised options to the log
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const opts = JSON.stringify({
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
      showAs: 'outlet',
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);

    // 51 turns BOTH ON
    // 48 turns BOTH OFF
    // 34 turns outlet 1 ON
    // 32 turns outlet 1 OFF
    // 17 turns outlet 2 ON
    // 16 turns outlet 2 OFF
  }

  async internalStateUpdate(service, value) {
    const isService1 = service.displayName === 'Outlet 1';
    try {
      const newValue = value % 16 === 0 ? 'off' : 'on';

      // Don't continue if the new value is the same as before
      if (
        (isService1 && newValue === this.cacheState1)
        || (!isService1 && newValue === this.cacheState2)
      ) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'stateDual',
        value,
      });

      // Cache the new state and log if appropriate
      let log = false;
      if (isService1) {
        if (this.cacheState1 !== newValue) {
          this.cacheState1 = newValue;
          log = true;
        }
      } else if (this.cacheState2 !== newValue) {
        this.cacheState2 = newValue;
        log = true;
      }
      if (this.enableLogging && log) {
        this.log('[%s] [%s] %s [%s].', this.name, service.displayName, platformLang.curState, newValue);
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        service.updateCharacteristic(
          this.hapChar.On,
          isService1 ? this.cacheState1 === 'on' : this.cacheState2 === 'on',
        );
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    // Check to see if the provided state is different from the cached state
    if (params.stateDual) {
      if ([48, 51].includes(params.stateDual)) {
        const newState = params.stateDual === 51 ? 'on' : 'off';
        if (newState !== this.cacheState1) {
          this.cacheState1 = newState;
          this.service1.updateCharacteristic(this.hapChar.On, this.cacheState1 === 'on');

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log(
              '[%s] [%s] %s [%s].',
              this.name,
              this.service1.displayName,
              platformLang.curState,
              this.cacheState1,
            );
          }
        }
        if (newState !== this.cacheState2) {
          this.cacheState2 = newState;
          this.service2.updateCharacteristic(this.hapChar.On, this.cacheState2 === 'on');

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log(
              '[%s] [%s] %s [%s].',
              this.name,
              this.service2.displayName,
              platformLang.curState,
              this.cacheState2,
            );
          }
        }
      }
      if ([32, 34].includes(params.stateDual)) {
        const newState = params.stateDual === 34 ? 'on' : 'off';
        if (newState !== this.cacheState1) {
          this.cacheState1 = newState;
          this.service1.updateCharacteristic(this.hapChar.On, this.cacheState1 === 'on');

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log(
              '[%s] [%s] %s [%s].',
              this.name,
              this.service1.displayName,
              platformLang.curState,
              this.cacheState1,
            );
          }
        }
      }
      if ([16, 17].includes(params.stateDual)) {
        const newState = params.stateDual === 17 ? 'on' : 'off';
        if (newState !== this.cacheState2) {
          this.cacheState2 = newState;
          this.service2.updateCharacteristic(this.hapChar.On, this.cacheState2 === 'on');

          // Log the change if appropriate
          if (this.enableLogging) {
            this.log(
              '[%s] [%s] %s [%s].',
              this.name,
              this.service2.displayName,
              platformLang.curState,
              this.cacheState2,
            );
          }
        }
      }
    }
  }
}

import {
  hs2rgb,
  k2rgb,
  m2hs,
  rgb2hs,
} from '../utils/colour.js';
import platformConsts from '../utils/constants.js';
import {
  generateRandomString,
  hasProperty,
  parseError,
  sleep,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.cusChar = platform.cusChar;
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.log = platform.log;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;
    this.name = accessory.displayName;
    this.minKelvin = accessory.context?.supportedCmdsOpts?.colorTem?.range?.min || 2000;
    this.maxKelvin = accessory.context?.supportedCmdsOpts?.colorTem?.range?.max || 9000;
    this.model = this.accessory.context.gvModel;
    this.offlineAsOff = platform.config.offlineAsOff;
    this.isLANOnly = !accessory.context.useAWSControl && !accessory.context.useAPIControl && !accessory.context.useBLEControl;

    // Set up custom variables for this device type
    const deviceConf = platform.deviceConf[accessory.context.gvDeviceId] || {};
    this.alShift = deviceConf.adaptiveLightingShift || platformConsts.defaultValues.adaptiveLightingShift;
    this.brightStep = deviceConf.brightnessStep
      ? Math.min(deviceConf.brightnessStep, 100)
      : platformConsts.defaultValues.brightnessStep;
    this.enableLogging = accessory.context.enableLogging;
    this.enableDebugLogging = accessory.context.enableDebugLogging;

    // Add the main lightbulb service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Lightbulb)
      || this.accessory.addService(this.hapServ.Lightbulb);

    // If adaptive lighting has just been disabled then remove and re-add service to hide AL icon
    if (this.alShift === -1 && this.accessory.context.adaptiveLighting) {
      this.accessory.removeService(this.service);
      this.service = this.accessory.addService(this.hapServ.Lightbulb);
      this.accessory.context.adaptiveLighting = false;
    }

    // Setup custom characteristics for different scenes and modes
    this.sceneChars = [];
    this.usedCodes = [];
    [
      'diyMode',
      'diyModeTwo',
      'diyModeThree',
      'diyModeFour',
      'musicMode',
      'musicModeTwo',
      'scene',
      'sceneTwo',
      'sceneThree',
      'sceneFour',
      'segmented',
      'segmentedTwo',
      'segmentedThree',
      'segmentedFour',
      'videoMode',
      'videoModeTwo',
    ].forEach((scene) => {
      const firstChar = scene.charAt();
      const charName = firstChar.toUpperCase() + scene.slice(1);

      // Check if any code has been entered in the config by the user
      if (deviceConf[scene]) {
        // Check the code is potentially valid and the corresponding connection is enabled
        const codeFirstChar = deviceConf[scene].charAt();
        if (
          (codeFirstChar === '0' && accessory.context.useBLEControl)
          || (['M', 'o'].includes(codeFirstChar) && accessory.context.useAWSControl)
        ) {
          // Add the characteristic if not already
          if (!this.service.testCharacteristic(this.cusChar[charName])) {
            this.service.addCharacteristic(this.cusChar[charName]);
          }

          // Add to the global enabled scenes list
          this.sceneChars.push(this.cusChar[charName]);
          this.usedCodes.push(deviceConf[scene]);

          // Add the set handler and also mark all as off when initialising accessory
          this.service
            .getCharacteristic(this.cusChar[charName])
            .onSet(async (value) => {
              await this.internalSceneUpdate(charName, deviceConf[scene], value);
            })
            .updateValue(false);

          // Return now, so we don't hit the code below for removing the characteristic
          return;
        }
      }

      // If here then either not set up or code is invalid or connection method not enabled
      if (this.service.testCharacteristic(this.cusChar[charName])) {
        this.service.removeCharacteristic(this.service.getCharacteristic(this.cusChar[charName]));
      }
    });

    // Add the colour mode characteristic if at least one other scene/mode is exposed
    if (this.sceneChars.length > 0) {
      // Add the colour mode characterstic if not already
      if (!this.service.testCharacteristic(this.cusChar.ColourMode)) {
        this.service.addCharacteristic(this.cusChar.ColourMode);
      }

      // Add the colour mode to the global scene list
      this.sceneChars.push(this.cusChar.ColourMode);

      // Add the set handler and also mark as off when initialising accessory
      this.service
        .getCharacteristic(this.cusChar.ColourMode)
        .onSet(async (value) => {
          if (value) {
            await this.internalColourUpdate(this.cacheHue, true);
          }
        })
        .updateValue(false);
    } else if (this.service.testCharacteristic(this.cusChar.ColourMode)) {
      // Remove the characteristic if it exists already (no need for it)
      this.service.removeCharacteristic(this.service.getCharacteristic(this.cusChar.ColourMode));
    }

    // Add the set handler to the lightbulb on/off characteristic
    this.service.getCharacteristic(this.hapChar.On).onSet(async (value) => {
      await this.internalStateUpdate(value);
    });
    this.cacheState = this.service.getCharacteristic(this.hapChar.On).value ? 'on' : 'off';

    // Add the set handler to the lightbulb brightness characteristic
    this.service
      .getCharacteristic(this.hapChar.Brightness)
      .setProps({ minStep: this.brightStep })
      .onSet(async (value) => {
        await this.internalBrightnessUpdate(value);
      });
    this.cacheBright = this.service.getCharacteristic(this.hapChar.Brightness).value;
    this.cacheBrightRaw = this.cacheBright;

    // Add the set handler to the lightbulb hue characteristic
    this.service.getCharacteristic(this.hapChar.Hue).onSet(async (value) => {
      await this.internalColourUpdate(value);
    });
    this.cacheHue = this.service.getCharacteristic(this.hapChar.Hue).value;

    // Add the set handler to the lightbulb cct characteristic
    this.service.getCharacteristic(this.hapChar.ColorTemperature).onSet(async (value) => {
      await this.internalCTUpdate(value);
    });
    this.cacheMired = this.service.getCharacteristic(this.hapChar.ColorTemperature).value;

    // Set up the adaptive lighting controller if not disabled by user
    if (this.alShift !== -1) {
      this.alController = new platform.api.hap.AdaptiveLightingController(this.service, {
        customTemperatureAdjustment: this.alShift,
      });
      this.accessory.configureController(this.alController);
      this.accessory.context.adaptiveLighting = true;
    }

    // Add a notice about some models which may use different AWS values
    if (
      accessory.context.useAWSControl
      && !platformConsts.awsBrightnessNoScale.includes(accessory.context.gvModel)
    ) {
      this.log('[%s] %s [%s].', this.name, platformLang.noticeAWS, accessory.context.gvModel);
    }

    // Output the customised options to the log
    const normalLogging = this.enableLogging ? 'standard' : 'disable';
    const useAWSControl = accessory.context.useAWSControl ? 'enabled' : 'disabled';
    const useBLEControl = accessory.context.useBLEControl ? 'enabled' : 'disabled';
    const useLANControl = accessory.context.useLANControl ? 'enabled' : 'disabled';
    const opts = JSON.stringify({
      adaptiveLightingShift: this.alShift,
      aws: accessory.context.hasAWSControl ? useAWSControl : 'unsupported',
      ble: accessory.context.hasBLEControl ? useBLEControl : 'unsupported',
      brightnessStep: this.brightStep,
      lan: accessory.context.hasLANControl ? useLANControl : 'unsupported',
      logging: this.enableDebugLogging ? 'debug' : normalLogging,
    });
    this.log('[%s] %s %s.', this.name, platformLang.devInitOpts, opts);
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (newValue === this.cacheState) {
        return;
      }

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds
        && !this.accessory.context.supportedCmds.includes('turn')
      ) {
        const eText = this.model + platformLang.notSuppTurn;
        throw new Error(eText);
      }

      // Await slightly longer than brightness and colour so on/off is sent last
      await sleep(400);

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, platformLang.devNotControl);
      }

      // Set up a one minute timeout for the plugin to ignore incoming updates
      const timerKey = generateRandomString(5);
      this.updateTimeoutAPI = timerKey;
      setTimeout(() => {
        if (this.updateTimeoutAPI === timerKey) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'state',
        value: newValue,
      });

      // Cache the new state and log if appropriate
      if (this.cacheState !== newValue) {
        this.cacheState = newValue;
        if (this.enableLogging) {
          this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
        }
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalBrightnessUpdate(value) {
    try {
      // This acts like a debounce function when endlessly sliding the brightness scale
      const updateKeyBright = generateRandomString(5);
      this.updateKeyBright = updateKeyBright;
      await sleep(350);
      if (updateKeyBright !== this.updateKeyBright) {
        return;
      }

      // Don't continue if the new value is the same as before
      if (value === this.cacheBright) {
        return;
      }

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds
        && !this.accessory.context.supportedCmds.includes('brightness')
      ) {
        const eText = this.model + platformLang.notSuppBrightness;
        throw new Error(eText);
      }

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, platformLang.devNotControl);
      }

      // Set up a one minute timeout for the plugin to ignore incoming updates
      this.updateTimeoutAPI = updateKeyBright;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKeyBright) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'brightness',
        value,
      });

      // Govee considers 0% brightness to be off
      if (value === 0) {
        setTimeout(() => {
          this.cacheState = 'off';
          if (this.service.getCharacteristic(this.hapChar.On).value) {
            this.service.updateCharacteristic(this.hapChar.On, false);
            if (this.enableLogging) {
              this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
            }
          }
          this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);
        }, 1500);
        return;
      }

      // Cache the new state and log if appropriate
      if (this.cacheBright !== value) {
        this.cacheBright = value;
        if (this.enableLogging) {
          this.log('[%s] %s [%s%].', this.name, platformLang.curBright, value);
        }
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalColourUpdate(value, force = false) {
    try {
      // This acts like a debounce function when endlessly sliding the colour wheel
      const updateKeyColour = generateRandomString(5);
      this.updateKeyColour = updateKeyColour;
      await sleep(300);
      if (updateKeyColour !== this.updateKeyColour) {
        return;
      }

      // Updating the cct to the lowest value mimics native adaptive lighting
      this.service.updateCharacteristic(this.hapChar.ColorTemperature, 140);

      // Don't continue if the new value is the same as before
      const currentSat = this.service.getCharacteristic(this.hapChar.Saturation).value;
      const newRGB = hs2rgb(value, currentSat);
      if (
        !force
        && newRGB[0] === this.cacheR
        && newRGB[1] === this.cacheG
        && newRGB[2] === this.cacheB
      ) {
        return;
      }

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds
        && !this.accessory.context.supportedCmds.includes('color')
      ) {
        const eText = this.model + platformLang.notSuppColour;
        throw new Error(eText);
      }

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, platformLang.devNotControl);
      }

      // Set up a one minute timeout for the plugin to ignore incoming updates
      this.updateTimeoutAPI = updateKeyColour;
      this.updateTimeoutAWS = updateKeyColour;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKeyColour) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);
      setTimeout(() => {
        if (this.updateTimeoutAWS === updateKeyColour) {
          this.updateTimeoutAWS = false;
        }
      }, 5000);

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2],
        },
      });

      // Switch off any custom mode/scene characteristics and turn the on switch to on
      setTimeout(() => {
        this.sceneChars.forEach((char) => this.service.updateCharacteristic(char, false));
        this.service.updateCharacteristic(this.hapChar.On, true);
      }, 3000);

      // Cache the new state and log if appropriate
      this.cacheHue = value;
      this.cacheKelvin = 0;
      if (this.cacheR !== newRGB[0] || this.cacheG !== newRGB[1] || this.cacheB !== newRGB[2]) {
        [this.cacheR, this.cacheG, this.cacheB] = newRGB;
        if (this.enableLogging) {
          this.log(
            '[%s] %s [rgb %s].',
            this.name,
            platformLang.curColour,
            `${this.cacheR} ${this.cacheG} ${this.cacheB}`,
          );
        }
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.Hue, this.cacheHue);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalCTUpdate(value) {
    try {
      // This acts like a debounce function when endlessly sliding the colour wheel
      const updateKeyCT = generateRandomString(5);
      this.updateKeyCT = updateKeyCT;
      await sleep(300);
      if (updateKeyCT !== this.updateKeyCT) {
        return;
      }

      // Convert mired to kelvin to nearest 100 (Govee seems to need this)
      const kelvin = Math.round(1000000 / value / 100) * 100;

      // Check and increase/decrease kelvin to range of device
      const k = Math.min(Math.max(kelvin, this.minKelvin), this.maxKelvin);

      // Don't continue if the new value is the same as before
      if (this.cacheState !== 'on' || this.cacheKelvin === k) {
        if (
          this.alController
          && this.alController.isAdaptiveLightingActive()
          && this.enableDebugLogging
        ) {
          this.log('[%s] %s [%sK / %sM].', this.name, platformLang.skippingAL, k, value);
        }
        return;
      }

      // Updating the hue/sat to the corresponding values mimics native adaptive lighting
      const hs = m2hs(value);
      this.service.updateCharacteristic(this.hapChar.Hue, hs[0]);
      this.service.updateCharacteristic(this.hapChar.Saturation, hs[1]);

      // Don't continue if the device doesn't support this command
      if (
        this.accessory.context.supportedCmds
        && !this.accessory.context.supportedCmds.includes('color')
      ) {
        const eText = this.model + platformLang.notSuppColour;
        throw new Error(eText);
      }

      // Log a message in debug if the device is not currently controllable
      if (!this.cacheOnline && this.enableDebugLogging) {
        this.log('[%s] %s.', this.name, platformLang.devNotControl);
      }

      // Set up a one minute timeout for the plugin to ignore incoming updates
      this.updateTimeoutAPI = updateKeyCT;
      this.updateTimeoutAWS = updateKeyCT;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKeyCT) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);
      setTimeout(() => {
        if (this.updateTimeoutAWS === updateKeyCT) {
          this.updateTimeoutAWS = false;
        }
      }, 5000);

      // Convert kelvin to rgb to use in case device doesn't support colour temperature
      const rgb = k2rgb(k);

      // Set up the params object to send
      const objToSend = {};

      // If the device supports colour temperature then send colorTem
      if (
        this.accessory.context.supportedCmds
        && this.accessory.context.supportedCmds.includes('colorTem')
      ) {
        // Send kelvin value
        objToSend.cmd = 'colorTem';
        objToSend.value = k;
      } else {
        // Send rgb values
        objToSend.cmd = 'color';
        objToSend.value = { r: rgb[0], g: rgb[1], b: rgb[2] };
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, objToSend);

      // Cache the new state and log if appropriate
      [this.cacheR, this.cacheG, this.cacheB] = rgb;
      this.cacheMired = value;
      if (this.cacheKelvin !== k) {
        this.cacheKelvin = k;
        if (this.enableLogging) {
          if (this.alController && this.alController.isAdaptiveLightingActive()) {
            this.log(
              '[%s] %s [%sK / %sM] %s.',
              this.name,
              platformLang.curColour,
              k,
              value,
              platformLang.viaAL,
            );
          } else {
            this.log('[%s] %s [%sK / %sM].', this.name, platformLang.curColour, k, value);
          }
        }
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.ColorTemperature, this.cacheMired);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalSceneUpdate(charName, code, value) {
    try {
      // Don't continue if command is to turn off - they are stateless buttons
      if (!value) {
        return;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, {
        cmd: 'scene',
        value: code,
      });

      // Disable adaptive lighting if it's on already
      if (this.alController && this.alController.isAdaptiveLightingActive()) {
        this.alController.disableAdaptiveLighting();
        if (this.enableLogging) {
          this.log('[%s] %s.', this.name, platformLang.alDisabledScene);
        }
      }

      // Log the scene change
      this.log('[%s] %s [%s].', this.name, platformLang.curScene, charName);

      // Turn all the characteristics off and turn the on switch to on
      setTimeout(() => {
        this.sceneChars.forEach((char) => this.service.updateCharacteristic(char, false));
        this.service.updateCharacteristic(this.hapChar.On, true);
      }, 3000);
    } catch (err) {
      // Catch any errors during the process
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', this.name, platformLang.devNotUpdated, eText);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.cusChar[charName], false);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  externalUpdate(params) {
    // Don't apply the update during the one minute timeout if update is from API
    if (
      (this.updateTimeoutAPI && params.source === 'API')
      || (this.updateTimeoutAWS && params.source === 'AWS')
    ) {
      return;
    }

    if (params.source === 'AWS') {
      // Set up a one-minute timeout for the plugin to ignore incoming updates if update is from AWS
      // API can take a while to update from changes, so always go with the AWS update
      const updateKey = generateRandomString(5);
      this.updateTimeoutAPI = updateKey;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKey) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);
    }

    // Check to see if the provided online status is different from the cache value
    if (hasProperty(params, 'online') && this.cacheOnline !== params.online) {
      this.cacheOnline = params.online;
      this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline);
    }

    // If offline and user enabled offlineAsOff, then mark accessory as off, and only if this device is not LAN-only
    if (!this.isLANOnly && !this.cacheOnline && this.offlineAsOff) {
      params.state = 'off';
    }

    // Check to see if the provided state is different from the cached value
    if (params.state && params.state !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');

      // Log the change if appropriate
      if (this.enableLogging) {
        this.log('[%s] %s [%s].', this.name, platformLang.curState, this.cacheState);
      }
    }

    // Check to see if the provided brightness is different from the cached value
    if (hasProperty(params, 'brightness') && params.brightness !== this.cacheBrightRaw) {
      // Brightness is different so update Homebridge with new values
      this.cacheBrightRaw = params.brightness;

      // Govee considers brightness 0 as OFF so change brightness to 1 if light is on
      this.cacheBright = this.cacheState === 'on' ? Math.max(this.cacheBrightRaw, 1) : this.cacheBrightRaw;
      this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);

      // Log the change if appropriate
      if (this.enableLogging) {
        this.log('[%s] %s [%s%].', this.name, platformLang.curBright, this.cacheBright);
      }
    }

    // Check to see if the provided colour is different from the cached state
    if (params.kelvin || params.rgb) {
      // Colour can be provided in rgb or kelvin so either way convert to hs for later
      let hs;
      let rgb;
      let mired;
      let colourChange = false;
      let sigColourChange = false;
      if (params.kelvin) {
        mired = Math.round(1000000 / params.kelvin);
        hs = m2hs(mired);
        rgb = hs2rgb(hs[0], hs[1]);

        // Check for a colour change
        if (params.kelvin !== this.cacheKelvin) {
          colourChange = true;

          // Check for a significant colour change
          const kelvinDiff = Math.abs(params.kelvin - this.cacheKelvin);
          if (kelvinDiff > 100) {
            sigColourChange = true;
          }
        }
      } else {
        rgb = [params.rgb.r, params.rgb.g, params.rgb.b];
        hs = rgb2hs(rgb[0], rgb[1], rgb[2]);

        // Check for a colour change
        if (hs[0] !== this.cacheHue) {
          colourChange = true;

          // Check for a significant colour change
          const rgbDiff = Math.abs(rgb[0] - this.cacheR)
            + Math.abs(rgb[1] - this.cacheG)
            + Math.abs(rgb[2] - this.cacheB);
          if (rgbDiff > 50) {
            sigColourChange = true;
          }
        }
      }

      // Perform the check against the cache
      if (colourChange) {
        // Colour is different so update Homebridge with new values
        this.service.updateCharacteristic(this.hapChar.Hue, hs[0]);
        this.service.updateCharacteristic(this.hapChar.Saturation, hs[1]);
        [this.cacheR, this.cacheG, this.cacheB] = rgb;
        [this.cacheHue] = hs;

        if (mired) {
          this.service.updateCharacteristic(this.hapChar.ColorTemperature, mired);
          this.cacheMired = mired;
          this.cacheKelvin = params.kelvin;
        }

        // Log the change if appropriate
        if (this.enableLogging) {
          if (mired) {
            this.log('[%s] %s [%sK / %sM].', this.name, platformLang.curColour, params.kelvin, mired);
          } else {
            this.log(
              '[%s] %s [rgb %s].',
              this.name,
              platformLang.curColour,
              `${this.cacheR} ${this.cacheG} ${this.cacheB}`,
            );
          }
        }

        // If the difference is significant then disable adaptive lighting
        if (this.alController && this.alController.isAdaptiveLightingActive() && sigColourChange) {
          this.alController.disableAdaptiveLighting();
          if (this.enableLogging) {
            this.log('[%s] %s.', this.name, platformLang.alDisabled);
          }
        }
      }
    }
    if (params.scene) {
      // Disable adaptive lighting
      if (this.alController && this.alController.isAdaptiveLightingActive()) {
        this.alController.disableAdaptiveLighting();
        if (this.enableLogging) {
          this.log('[%s] %s.', this.name, platformLang.alDisabledScene);
        }
      }
      const fullCode = `${params.scene}||${params.cmd}||${params.prop}`;
      if (this.enableDebugLogging && !this.usedCodes.includes(fullCode)) {
        this.log.warn('[%s] %s:\n%s', this.name, platformLang.sceneCode, fullCode);
      }
    }
  }
}

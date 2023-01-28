import {
  hs2rgb,
  k2rgb,
  m2hs,
  rgb2hs,
} from '../utils/colour.js';
import platformConsts from '../utils/constants.js';
import {
  base64ToHex,
  generateRandomString,
  getTwoItemPosition,
  hasProperty,
  hexToTwoItems,
  parseError,
  sleep,
  statusToActionCode,
} from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform, accessory) {
    // Set up variables from the platform
    this.cusChar = platform.cusChar;
    this.hapChar = platform.api.hap.Characteristic;
    this.hapErr = platform.api.hap.HapStatusError;
    this.hapServ = platform.api.hap.Service;
    this.platform = platform;

    // Set up variables from the accessory
    this.accessory = accessory;
    this.colourSafeMode = platform.config.colourSafeMode;
    this.minKelvin = accessory.context?.supportedCmdsOpts?.colorTem?.range?.min || 2000;
    this.maxKelvin = accessory.context?.supportedCmdsOpts?.colorTem?.range?.max || 9000;
    this.offlineAsOff = platform.config.offlineAsOff;
    this.isBLEOnly = !accessory.context.useAWSControl && !accessory.context.useAPIControl && !accessory.context.useLANControl;
    this.isLANOnly = !accessory.context.useAWSControl && !accessory.context.useAPIControl && !accessory.context.useBLEControl;

    // Set up custom variables for this device type
    const deviceConf = platform.deviceConf[accessory.context.gvDeviceId] || {};
    this.alShift = deviceConf.adaptiveLightingShift || platformConsts.defaultValues.adaptiveLightingShift;
    this.brightStep = deviceConf.brightnessStep
      ? Math.min(deviceConf.brightnessStep, 100)
      : platformConsts.defaultValues.brightnessStep;

    // Remove any switch service if it exists
    if (accessory.getService(this.hapServ.Switch)) {
      accessory.removeService(accessory.getService(this.hapServ.Switch));
    }

    // Add the main lightbulb service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Lightbulb)
      || this.accessory.addService(this.hapServ.Lightbulb);

    // If adaptive lighting has just been disabled then remove and re-add service to hide AL icon
    if ((this.colourSafeMode || this.alShift === -1) && this.accessory.context.adaptiveLighting) {
      this.accessory.removeService(this.service);
      this.service = this.accessory.addService(this.hapServ.Lightbulb);
      this.accessory.context.adaptiveLighting = false;
    }

    // Setup custom characteristics for different scenes and modes
    this.usedCodes = {};

    [
      'DiyMode',
      'DiyModeTwo',
      'DiyModeThree',
      'DiyModeFour',
      'MusicMode',
      'MusicModeTwo',
      'Scene',
      'SceneTwo',
      'SceneThree',
      'SceneFour',
      'Segmented',
      'SegmentedTwo',
      'SegmentedThree',
      'SegmentedFour',
      'VideoMode',
      'VideoModeTwo',
    ].forEach((charName) => {
      const confName = charName.charAt(0).toLowerCase() + charName.slice(1);
      const confCode = deviceConf[confName];

      // Check if any code has been entered in the config by the user
      if (confCode) {
        // Check the code is potentially valid and the corresponding connection is enabled
        // The code may be separated by || for older models
        const codeParts = confCode.split('||');
        const codeMethod = codeParts[1];

        // Check the first part starts with 33 and has 40 characters in total
        if (
          ((codeParts[0].substring(0, 2) === '33' && codeParts[0].length === 40) || codeMethod === 'raw')
          && accessory.context.useAWSControl
        ) {
          // The second part can be undefined or needs to be a valid method
          if ([undefined, 'opMode', 'raw'].includes(codeMethod)) {
            // Add the characteristic if not already
            if (!this.service.testCharacteristic(this.cusChar[charName])) {
              this.service.addCharacteristic(this.cusChar[charName]);
            }

            // Add to the global enabled scenes list
            this.usedCodes[codeParts[0]] = charName;

            // Add the set handler and also mark all as off when initialising accessory
            this.service
              .getCharacteristic(this.cusChar[charName])
              .onSet(async (value) => {
                await this.internalSceneUpdate(charName, codeParts[0], value, codeMethod);
              })
              .updateValue(false);

            // Return now, so we don't hit the code below for removing the characteristic
            return;
          }
        }

        // If here then the scene code exists in the config but is invalid format
        accessory.logWarn(`[${codeParts[0]}] is not a valid code - please update with a new code from the log that starts with 33`);
      }

      // If here then either code is invalid or has been removed, so remove the characteristic
      if (this.service.testCharacteristic(this.cusChar[charName])) {
        this.service.removeCharacteristic(this.service.getCharacteristic(this.cusChar[charName]));
      }
    });

    this.hasScenes = Object.keys(this.usedCodes).length > 0;

    // Add the colour mode characteristic if at least one other scene/mode is exposed
    if (this.hasScenes) {
      // Add the colour mode characteristic if not already
      if (!this.service.testCharacteristic(this.cusChar.ColourMode)) {
        this.service.addCharacteristic(this.cusChar.ColourMode);
      }

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
    this.cacheSat = this.service.getCharacteristic(this.hapChar.Saturation).value;

    // Add the set handler to the lightbulb cct characteristic
    if (this.colourSafeMode) {
      if (this.service.testCharacteristic(this.hapChar.ColorTemperature)) {
        this.service.removeCharacteristic(this.service.getCharacteristic(this.hapChar.ColorTemperature));
      }
      this.cacheMired = 0;
    } else {
      this.service.getCharacteristic(this.hapChar.ColorTemperature).onSet(async (value) => {
        await this.internalCTUpdate(value);
      });
      this.cacheMired = this.service.getCharacteristic(this.hapChar.ColorTemperature).value;
    }

    // Set up the adaptive lighting controller if not disabled by user
    if (!this.colourSafeMode && this.alShift !== -1) {
      this.alController = new platform.api.hap.AdaptiveLightingController(this.service, {
        customTemperatureAdjustment: this.alShift,
      });
      this.accessory.configureController(this.alController);
      this.accessory.context.adaptiveLighting = true;
    }

    // Output the customised options to the log
    const useAWSControl = accessory.context.useAWSControl ? 'enabled' : 'disabled';
    const useBLEControl = accessory.context.useBLEControl ? 'enabled' : 'disabled';
    const useLANControl = accessory.context.useLANControl ? 'enabled' : 'disabled';
    const opts = JSON.stringify({
      adaptiveLightingShift: this.alShift,
      aws: accessory.context.hasAWSControl ? useAWSControl : 'unsupported',
      ble: accessory.context.hasBLEControl ? useBLEControl : 'unsupported',
      brightnessStep: this.brightStep,
      colourSafeMode: this.colourSafeMode,
      lan: accessory.context.hasLANControl ? useLANControl : 'unsupported',
    });
    platform.log('[%s] %s %s.', accessory.displayName, platformLang.devInitOpts, opts);
    this.initialised = true;
  }

  async internalStateUpdate(value) {
    try {
      const newValue = value ? 'on' : 'off';

      // Don't continue if the new value is the same as before
      if (newValue === this.cacheState) {
        return;
      }

      // Await slightly longer than brightness and colour so on/off is sent last
      await sleep(400);

      // Set up a one-minute timeout for the plugin to ignore incoming updates
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
        this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
      }
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

      // Set up a one-minute timeout for the plugin to ignore incoming updates
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
            this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
          }
          this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);
        }, 1500);
        return;
      }

      // Cache the new state and log if appropriate
      if (this.cacheBright !== value) {
        this.cacheBright = value;
        this.accessory.log(`${platformLang.curBright} [${value}%]`);
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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

      if (!this.colourSafeMode) {
        // Updating the cct to the lowest value mimics native adaptive lighting
        this.service.updateCharacteristic(this.hapChar.ColorTemperature, 140);
      }

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

      // Set up a one-minute timeout for the plugin to ignore incoming updates
      this.updateTimeoutAPI = updateKeyColour;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKeyColour) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);
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
      if (this.hasScenes) {
        setTimeout(() => {
          this.service.updateCharacteristic(this.hapChar.On, true);
          this.service.updateCharacteristic(this.cusChar.ColourMode, true);
          Object.values(this.usedCodes).forEach((cn) => this.service.updateCharacteristic(this.cusChar[cn], false));
        }, 1000);
      }

      // Cache the new state and log if appropriate
      this.cacheHue = value;
      this.cacheKelvin = 0;
      this.cacheScene = '';
      if (this.cacheR !== newRGB[0] || this.cacheG !== newRGB[1] || this.cacheB !== newRGB[2]) {
        [this.cacheR, this.cacheG, this.cacheB] = newRGB;
        this.accessory.log(`${platformLang.curColour} [rgb ${this.cacheR} ${this.cacheG} ${this.cacheB}]`);
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

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
        if (this.alController?.isAdaptiveLightingActive?.()) {
          this.accessory.logDebug(`${platformLang.skippingAL} [${k}K /${value}M]`);
        }
        return;
      }

      // Updating the hue/sat to the corresponding values mimics native adaptive lighting
      const hs = m2hs(value);
      this.service.updateCharacteristic(this.hapChar.Hue, hs[0]);
      this.service.updateCharacteristic(this.hapChar.Saturation, hs[1]);

      // Set up a one-minute timeout for the plugin to ignore incoming updates
      this.updateTimeoutAPI = updateKeyCT;
      setTimeout(() => {
        if (this.updateTimeoutAPI === updateKeyCT) {
          this.updateTimeoutAPI = false;
        }
      }, 60000);

      // Convert kelvin to rgb to use in case device doesn't support colour temperature
      const rgb = k2rgb(k);

      // Set up the params object to send
      const objToSend = {};

      // For BLE only models, convert to RGB, otherwise send kelvin value
      // TODO we can look at this in the future
      if (this.isBLEOnly) {
        objToSend.cmd = 'color';
        objToSend.value = { r: rgb[0], g: rgb[1], b: rgb[2] };
      } else {
        objToSend.cmd = 'colorTem';
        objToSend.value = k;
      }

      // Send the request to the platform sender function
      await this.platform.sendDeviceUpdate(this.accessory, objToSend);

      // Switch off any custom mode/scene characteristics and turn the on switch to on
      if (this.hasScenes) {
        setTimeout(() => {
          this.service.updateCharacteristic(this.hapChar.On, true);
          this.service.updateCharacteristic(this.cusChar.ColourMode, true);
          Object.values(this.usedCodes).forEach((cn) => this.service.updateCharacteristic(this.cusChar[cn], false));
        }, 1000);
      }

      // Cache the new state and log if appropriate
      [this.cacheR, this.cacheG, this.cacheB] = rgb;
      this.cacheMired = value;
      this.cacheScene = '';
      if (this.cacheKelvin !== k) {
        this.cacheKelvin = k;
        if (this.alController?.isAdaptiveLightingActive?.()) {
          this.accessory.log(`${platformLang.curColour} [${k}K / ${value}M] ${platformLang.viaAL}`);
        } else {
          this.accessory.log(`${platformLang.curColour} [${k}K / ${value}M]`);
        }
      }
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.ColorTemperature, this.cacheMired);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  async internalSceneUpdate(charName, code, value, codeMethod) {
    try {
      // Don't continue if command is to turn off - we should turn off by changing to a colour mode instead, or another scene
      if (!value) {
        return;
      }

      // Send the request to the platform sender function
      switch (codeMethod) {
        case 'opMode': {
          await this.platform.sendDeviceUpdate(this.accessory, {
            cmd: 'sceneOpMode',
            value: code,
          });
          break;
        }
        case 'raw': {
          await this.platform.sendDeviceUpdate(this.accessory, {
            cmd: 'sceneRaw',
            value: code,
          });
          break;
        }
        default: {
          await this.platform.sendDeviceUpdate(this.accessory, {
            cmd: 'scene',
            value: code,
          });
          break;
        }
      }

      // Disable adaptive lighting if it's on already
      if (!this.colourSafeMode && this.alController?.isAdaptiveLightingActive?.()) {
        this.alController.disableAdaptiveLighting();
        this.accessory.log(platformLang.alDisabledScene);
      }

      // Log the scene change
      if (this.cacheScene !== code) {
        this.cacheScene = code;
        this.accessory.log(`${platformLang.curScene} [${this.usedCodes[this.cacheScene]} - ${this.cacheScene}]`);
      }

      // Turn all the characteristics off and turn the on switch to on
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, true);
        this.service.updateCharacteristic(this.cusChar.ColourMode, false);
        Object.values(this.usedCodes).forEach((thisCharName) => {
          if (thisCharName !== charName) {
            this.service.updateCharacteristic(this.cusChar[thisCharName], false);
          }
        });
      }, 1000);
    } catch (err) {
      // Catch any errors during the process
      this.accessory.logWarn(`${platformLang.devNotUpdated} ${parseError(err)}`);

      // Throw a 'no response' error and set a timeout to revert this after 2 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.cusChar[charName], false);
      }, 2000);
      throw new this.hapErr(-70402);
    }
  }

  actionActionCode = (params, hexString, suffix) => {
    const actionCode = statusToActionCode(hexString);
    if (this.cacheScene !== actionCode) {
      if (this.cacheState === 'on') {
        this.cacheScene = actionCode;
        if (hasProperty(this.usedCodes, this.cacheScene)) {
          this.accessory.log(`${platformLang.curScene} [${this.usedCodes[this.cacheScene]} - ${this.cacheScene}] [${params.baseCmd}:${suffix}]`);
        } else {
          this.accessory.log(`${platformLang.curScene} [${this.cacheScene}] [${params.baseCmd}:${suffix}]`);
        }
      } else {
        this.cacheScene = '';
      }
      if (this.hasScenes) {
        this.service.updateCharacteristic(this.cusChar.ColourMode, false);
        Object.values(this.usedCodes).forEach((charName) => {
          this.service.updateCharacteristic(this.cusChar[charName], charName === this.usedCodes[this.cacheScene]);
        });
      }
    }
  };

  externalUpdate(params) {
    // Return if not initialised
    if (!this.initialised) {
      return;
    }

    // Don't apply the update during timeouts
    if (this.updateTimeoutAPI && params.source === 'API') {
      return;
    }

    if (params.source === 'AWS') {
      // Set up a one-minute timeout for the plugin to ignore incoming API updates if update is from AWS
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
      this.accessory.logDebug(platformLang.offlineAsOff);
    }

    // Check to see if the provided state is different from the cached value
    if (params.state && params.state !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = params.state;
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on');

      // Log the change
      this.accessory.log(`${platformLang.curState} [${this.cacheState}]`);
    }

    // Check to see if the provided brightness is different from the cached value
    if (hasProperty(params, 'brightness') && params.brightness !== this.cacheBrightRaw) {
      // Brightness is different so update Homebridge with new values
      this.cacheBrightRaw = params.brightness;

      // Govee considers brightness 0 as OFF so change brightness to 1 if light is on
      this.cacheBright = this.cacheState === 'on' ? Math.max(this.cacheBrightRaw, 1) : this.cacheBrightRaw;
      this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBright);

      // Log the change
      this.accessory.log(`${platformLang.curBright} [${this.cacheBright}%]`);
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
          if (!this.colourSafeMode) {
            this.service.updateCharacteristic(this.hapChar.ColorTemperature, mired);
          }
          this.cacheMired = mired;
          this.cacheKelvin = params.kelvin;
          this.accessory.log(`${platformLang.curColour} [${params.kelvin}K / ${mired}M]`);
        } else {
          this.accessory.log(`${platformLang.curColour} [rgb ${this.cacheR} ${this.cacheG} ${this.cacheB}]`);
        }

        // If the difference is significant then disable adaptive lighting
        if (!this.colourSafeMode && this.alController?.isAdaptiveLightingActive?.() && sigColourChange) {
          this.alController.disableAdaptiveLighting();
          this.accessory.log(platformLang.alDisabled);
        }
      }
    }

    // Some models offer a payload like this
    // {"source":"AWS","onOff":1,"brightness":82,"colorTemInKelvin":0,"color":{"r":255,"g":0,"b":0},"mode":21,"result":1,"op":{"command":["qgUVAQAAAAAAAAAAAAAAAAAAALs=","qqUBZP8AAGSLAP9kiwD/ZP8AAA4=","qqUCZP8AAGSLAP9kiwD/ImRkZNA=","qhEAHg8PAAAAAAAAAAAAAAAAAKU=","qhIAZAAAgAoAAAAAAAAAAAAAAFY=","qiP/AAAAgAAAAIAAAACAAAAAgHY="]}}
    // Here these will have params.baseCmd as 'op'

    // Others like this
    // {"source":"AWS","connected":"true","op":{"opcode":"mode","modeValue":["owABAgGDAf+0/zIABPAAHuoAK44=","o/+8AP/jAP8AAAAAAAAAAAAAAAM=","MwUEawAAAAAAAAAAAAAAAAAAAFk="]}}
    // Here these will have params.baseCmd as 'opCodeMode'

    // Check for some other scene/mode change
    (params.commands || []).forEach((command) => {
      const hexString = base64ToHex(command);
      const hexParts = hexToTwoItems(hexString);
      const firstPart = getTwoItemPosition(hexParts, 1);

      if (firstPart === '33') {
        this.actionActionCode(params, hexString, '33');
      } else if (firstPart === 'a3') {
        this.actionActionCode(params, hexString, 'a3');
      } else if (firstPart !== 'aa') {
        return;
      }

      const deviceFunction = `${getTwoItemPosition(hexParts, 2)}${getTwoItemPosition(hexParts, 3)}`;
      switch (deviceFunction) {
        case '0500': // Some video modes
        case '0501': // Some music modes
        case '0502': // Some manual modes
        case '0503': // Unknown
        case '0504': // Some scene modes
        case '050a': // Some DIY modes
        case '050b': // Some segment modes
        case '050f': // Some music modes
        case '0515': { // Some segment modes
          this.actionActionCode(params, hexString, 'aa');
          break;
        }
        case '1100': // Maybe used for sleep mode off
        case '1101': // Maybe used for sleep mode on
        case '12ff': // Maybe used for wake up mode time unset
        case '1200': // Maybe used for wake up mode time set but off
        case '1201': // Maybe used for wake up mode time set and on
        case '23ff': // Maybe used for the Timer functions
          // Whatever they are for, they don't seem applicable to the plugin, so hide these codes
          break;
        default:
          this.accessory.logDebugWarn(`${platformLang.newScene}: [${command}] [${hexString}] [${params.baseCmd}:aa]`);
          break;
      }
    });
  }
}

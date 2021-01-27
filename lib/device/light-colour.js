/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class deviceLightColour {
  constructor (platform, accessory) {
    this.helpers = platform.helpers
    this.colourUtils = platform.colourUtils
    this.httpClient = platform.httpClient
    this.debug = platform.debug
    this.log = platform.log
    this.disableDeviceLogging = platform.config.disableDeviceLogging
    this.S = platform.api.hap.Service
    this.C = platform.api.hap.Characteristic
    this.dName = accessory.displayName
    this.accessory = accessory

    this.service = this.accessory.getService(this.S.Lightbulb) || this.accessory.addService(this.S.Lightbulb)
    this.service.getCharacteristic(this.C.On)
      .on('set', this.internalOnOffUpdate.bind(this))
    this.service.getCharacteristic(this.C.Brightness)
      .on('set', this.internalBrightnessUpdate.bind(this))
    this.service.getCharacteristic(this.C.Hue)
      .on('set', this.internalColourUpdate.bind(this))
    this.service.getCharacteristic(this.C.Saturation)
      .on('set', (value, callback) => callback())
    this.service.getCharacteristic(this.C.ColorTemperature)
      .on('set', this.internalCTempUpdate.bind(this))
    if (platform.api.versionGreaterOrEqual && platform.api.versionGreaterOrEqual('1.3.0-beta.46')) {
      this.alController = new platform.api.hap.AdaptiveLightingController(this.service)
      this.accessory.configureController(this.alController)
    }
  }

  async internalOnOffUpdate (value, callback) {
    try {
      callback()
      const onoff = value ? 'on' : 'off'
      if (onoff === this.cacheOnOff) {
        return
      }
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [turn]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const timerKey = Math.random().toString(36).substr(2, 8)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(
        this.dName,
        this.accessory.context,
        {
          name: 'turn',
          value: onoff
        }
      )
      this.cacheOnOff = onoff
      if (!this.disableDeviceLogging) {
        this.log('[%s] current state [%s].', this.dName, onoff)
      }
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be updated as%s', this.dName, errToShow)
    }
  }

  async internalBrightnessUpdate (value, callback) {
    try {
      callback()
      if (value === this.cacheBrightness) {
        return
      }
      if (!this.accessory.context.supportedCmds.includes('brightness')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [brightness]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKeyBright = Math.random().toString(36).substr(2, 8)
      this.updateKeyBright = updateKeyBright
      const newBrightness = this.helpers.modelsNoScaleBrightness.includes(this.accessory.context.gvModel)
        ? value
        : Math.round(value * 2.54)
      await this.helpers.sleep(2000)
      if (updateKeyBright !== this.updateKeyBright) {
        return
      }
      this.updateTimeout = updateKeyBright
      setTimeout(() => {
        if (this.updateTimeout === updateKeyBright) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(
        this.dName,
        this.accessory.context,
        {
          name: 'brightness',
          value: newBrightness
        }
      )
      this.cacheBrightness = value
      if (!this.disableDeviceLogging) {
        this.log('[%s] current brightness [%s%].', this.dName, value)
      }
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be updated as%s', this.dName, errToShow)
    }
  }

  async internalColourUpdate (value, callback) {
    try {
      this.service.updateCharacteristic(this.C.ColorTemperature, 140)
      callback()
      const currentSat = this.service.getCharacteristic(this.C.Saturation).value
      const newRGB = this.colourUtils.hs2rgb(value, currentSat)
      if (newRGB[0] === this.cacheR && newRGB[1] === this.cacheG && newRGB[2] === this.cacheB) {
        return
      }
      if (!this.accessory.context.supportedCmds.includes('color')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [color]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKeyColour = Math.random().toString(36).substr(2, 8)
      this.updateKeyColour = updateKeyColour
      await this.helpers.sleep(1000)
      if (updateKeyColour !== this.updateKeyColour) {
        return
      }
      this.updateTimeout = updateKeyColour
      setTimeout(() => {
        if (this.updateTimeout === updateKeyColour) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(
        this.dName,
        this.accessory.context,
        {
          name: 'color',
          value: {
            r: newRGB[0],
            g: newRGB[1],
            b: newRGB[2]
          }
        }
      )
      this.cacheR = newRGB[0]
      this.cacheG = newRGB[1]
      this.cacheB = newRGB[2]
      if (!this.disableDeviceLogging) {
        this.log('[%s] current colour [rgb %s %s %s].', this.dName, newRGB[0], newRGB[1], newRGB[2])
      }
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be updated as%s', this.dName, errToShow)
    }
  }

  async internalCTempUpdate (value, callback) {
    try {
      const hs = this.colourUtils.m2hs(value)
      const newRGB = this.colourUtils.hs2rgb(hs[0], hs[1])
      if (this.cacheOnOff !== 'on' || (newRGB[0] === this.cacheR && newRGB[1] === this.cacheG && newRGB[2] === this.cacheB)) {
        callback()
        return
      }
      this.service.updateCharacteristic(this.C.Hue, hs[0])
      this.service.updateCharacteristic(this.C.Saturation, hs[1])
      callback()
      if (!this.accessory.context.supportedCmds.includes('color')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [color]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKeyCT = Math.random().toString(36).substr(2, 8)
      this.updateKeyCT = updateKeyCT
      await this.helpers.sleep(1000)
      if (updateKeyCT !== this.updateKeyCT) {
        return
      }
      this.updateTimeout = updateKeyCT
      setTimeout(() => {
        if (this.updateTimeout === updateKeyCT) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(
        this.dName,
        this.accessory.context,
        {
          name: 'color',
          value: {
            r: newRGB[0],
            g: newRGB[1],
            b: newRGB[2]
          }
        }
      )
      this.cacheR = newRGB[0]
      this.cacheG = newRGB[1]
      this.cacheB = newRGB[2]
      const mToK = Math.round(1000000 / value)
      if (!this.disableDeviceLogging) {
        if (this.alController && this.alController.isAdaptiveLightingActive()) {
          this.log('[%s] current cct [%sK] via adaptive lighting.', this.dName, mToK)
        } else {
          this.log('[%s] current colour [rgb %s %s %s].', this.dName, newRGB[0], newRGB[1], newRGB[2])
        }
      }
    } catch (err) {
      const errToShow = this.debug ? ':\n' + err : ' ' + err.message + ' [line ' + err.lineNumber + '].'
      this.log.warn('[%s] could not be updated as%s', this.dName, errToShow)
    }
  }

  externalUpdate (newParams) {
    if (this.debug && this.firstUpdateDone) {
      this.log('[%s] received update [%s].', this.dName, JSON.stringify(newParams))
      if (this.updateTimeout) {
        this.log('[%s] ignoring above update as recently controlled.', this.dName)
      }
    }
    if (this.updateTimeout) {
      return
    }

    // *** ON/OFF *** \\
    if (newParams.powerState && newParams.powerState !== this.cacheOnOff) {
      this.cacheOnOff = newParams.powerState
      this.service.updateCharacteristic(this.C.On, this.cacheOnOff === 'on')
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] current state [%s].', this.dName, this.cacheOnOff)
      }
    }
    // ************** \\

    // *** BRIGHTNESS *** \\
    if (newParams.brightness && newParams.brightness !== this.cacheBrightness) {
      const newBrightness = this.helpers.modelsNoScaleBrightness.includes(this.accessory.context.gvModel)
        ? newParams.brightness
        : Math.round(newParams.brightness / 2.54)
      this.cacheBrightness = Math.max(Math.min(newBrightness, 100), 0)
      this.service.updateCharacteristic(this.C.Brightness, this.cacheBrightness)
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] current brightness [%s%].', this.dName, this.cacheBrightness)
      }
    }
    // ****************** \\

    // *** COLOUR *** \\
    if (newParams.colorTemInKelvin || newParams.color) {
      let hs
      let rgb
      if (newParams.colorTemInKelvin) {
        hs = this.colourUtils.m2hs(1000000 / newParams.colorTemInKelvin)
        rgb = this.colourUtils.hs2rgb(hs[0], hs[1])
      } else {
        rgb = [newParams.color.r, newParams.color.g, newParams.color.b]
        hs = this.colourUtils.rgb2hs(rgb[0], rgb[1], rgb[2])
      }
      if (rgb[0] !== this.cacheR || rgb[1] !== this.cacheG || rgb[2] !== this.cacheB) {
        this.service.updateCharacteristic(this.C.Hue, hs[0])
        this.service.updateCharacteristic(this.C.Saturation, hs[1])
        this.cacheR = rgb[0]
        this.cacheG = rgb[1]
        this.cacheB = rgb[2]
        if (this.firstUpdateDone) {
          if (!this.disableDeviceLogging) {
            this.log('[%s] current colour [rgb %s %s %s].', this.dName, rgb[0], rgb[1], rgb[2])
          }
          const variBool = (Math.abs(rgb[0] - this.cacheR) + Math.abs(rgb[1] - this.cacheG) + Math.abs(rgb[2] - this.cacheB)) > 5
          if (variBool && this.alController && this.alController.isAdaptiveLightingActive()) {
            // *** look for a variation greater than five *** \\
            this.alController.disableAdaptiveLighting()
            this.log('[%s] adaptive lighting disabled due to significant colour change.', this.dName)
          }
        }
      }
    }
    // ************** \\
    this.firstUpdateDone = true
  }
}

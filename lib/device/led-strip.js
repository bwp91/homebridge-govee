/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class deviceLEDStrip {
  constructor (platform, accessory) {
    this.helpers = platform.helpers
    this.httpClient = platform.httpClient
    this.debug = platform.debug
    this.log = platform.log
    this.Service = platform.api.hap.Service
    this.Characteristic = platform.api.hap.Characteristic
    this.lightService = accessory.getService(this.Service.Lightbulb) || accessory.addService(this.Service.Lightbulb)
    this.lightService
      .getCharacteristic(this.Characteristic.On)
      .on('set', this.internalOnOffUpdate.bind(this))
    this.lightService
      .getCharacteristic(this.Characteristic.Brightness)
      .on('set', this.internalBrightnessUpdate.bind(this))
    this.lightService
      .getCharacteristic(this.Characteristic.Hue)
      .on('set', this.internalColourUpdate.bind(this))
    this.lightService
      .getCharacteristic(this.Characteristic.Saturation)
      .on('set', (value, callback) => callback())
    this.lightService
      .getCharacteristic(this.Characteristic.ColorTemperature)
      .on('set', this.internalCTempUpdate.bind(this))
    this.accessory = accessory
    if (platform.api.versionGreaterOrEqual && platform.api.versionGreaterOrEqual('1.3.0-beta.41')) {
      this.alController = new platform.api.hap.AdaptiveLightingController(this.lightService)
      this.accessory.configureController(this.alController)
    }
  }

  async internalOnOffUpdate (value, callback) {
    try {
      callback()
      const onoff = value ? 'on' : 'off'
      if (onoff === this.cacheOnOff) return
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [turn]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const timerKey = Math.random().toString(36).substr(2, 8)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) this.updateTimeout = false
      }, 120000)
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'turn',
        value: onoff
      }, this.accessory.displayName)
      this.cacheOnOff = onoff
      this.log('[%s] current state [%s].', this.accessory.displayName, onoff)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalBrightnessUpdate (value, callback) {
    try {
      callback()
      if (value === this.cacheBrightness) return
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
      if (updateKeyBright !== this.updateKeyBright) return
      this.updateTimeout = updateKeyBright
      setTimeout(() => {
        if (this.updateTimeout === updateKeyBright) this.updateTimeout = false
      }, 120000)
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'brightness',
        value: newBrightness
      }, this.accessory.displayName)
      this.cacheBrightness = value
      this.log('[%s] current brightness [%s%].', this.accessory.displayName, value)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalColourUpdate (value, callback) {
    try {
      this.lightService.updateCharacteristic(this.Characteristic.ColorTemperature, 140)
      callback()
      const newRGB = this.helpers.hs2rgb([
        value,
        this.lightService.getCharacteristic(this.Characteristic.Saturation).value
      ])
      if (newRGB[0] === this.cacheR && newRGB[1] === this.cacheG && newRGB[2] === this.cacheB) return
      if (!this.accessory.context.supportedCmds.includes('color')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [color]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKeyColour = Math.random().toString(36).substr(2, 8)
      this.updateKeyColour = updateKeyColour
      await this.helpers.sleep(1000)
      if (updateKeyColour !== this.updateKeyColour) return
      this.updateTimeout = updateKeyColour
      setTimeout(() => {
        if (this.updateTimeout === updateKeyColour) this.updateTimeout = false
      }, 120000)
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2]
        }
      }, this.accessory.displayName)
      this.cacheR = newRGB[0]
      this.cacheG = newRGB[1]
      this.cacheB = newRGB[2]
      this.log('[%s] current colour [rgb %s %s %s].', this.accessory.displayName, newRGB[0], newRGB[1], newRGB[2])
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalCTempUpdate (value, callback) {
    try {
      const hs = this.helpers.m2hs(value)
      const newRGB = this.helpers.hs2rgb(hs)
      if (this.cacheOnOff !== 'on' || (newRGB[0] === this.cacheR && newRGB[1] === this.cacheG && newRGB[2] === this.cacheB)) {
        callback()
        return
      }
      this.lightService
        .updateCharacteristic(this.Characteristic.Hue, hs[0])
        .updateCharacteristic(this.Characteristic.Saturation, hs[1])
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
      if (updateKeyCT !== this.updateKeyCT) return
      this.updateTimeout = updateKeyCT
      setTimeout(() => {
        if (this.updateTimeout === updateKeyCT) this.updateTimeout = false
      }, 120000)
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2]
        }
      }, this.accessory.displayName)
      this.cacheR = newRGB[0]
      this.cacheG = newRGB[1]
      this.cacheB = newRGB[2]
      const mToK = Math.round(1000000 / value)
      if (this.alController && this.alController.isAdaptiveLightingActive()) {
        this.log('[%s] current cct [%sK] via adaptive lighting.', this.accessory.displayName, mToK)
      } else {
        this.log('[%s] current colour [rgb %s %s %s].', this.accessory.displayName, newRGB[0], newRGB[1], newRGB[2])
      }
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  externalUpdate (newParams) {
    if (this.updateTimeout) return
    // *** ON/OFF *** \\
    if (newParams.powerState && newParams.powerState !== this.cacheOnOff) {
      this.lightService.updateCharacteristic(this.Characteristic.On, newParams.powerState === 'on')
      this.cacheOnOff = newParams.powerState
      if (this.firstUpdateDone) this.log('[%s] current state [%s].', this.accessory.displayName, newParams.powerState)
    }
    // ************** \\

    // *** BRIGHTNESS *** \\
    if (newParams.brightness && newParams.brightness !== this.cacheBrightness) {
      const newBrightness = this.helpers.modelsNoScaleBrightness.includes(this.accessory.context.gvModel)
        ? newParams.brightness
        : Math.round(newParams.brightness / 2.54)
      this.lightService.updateCharacteristic(this.Characteristic.Brightness, newBrightness)
      this.cacheBrightness = newBrightness
      if (this.firstUpdateDone) this.log('[%s] current brightness [%s%].', this.accessory.displayName, newBrightness)
    }
    // ****************** \\

    // *** COLOUR *** \\
    if (newParams.colorTemInKelvin || newParams.color) {
      let hs
      let rgb
      if (newParams.colorTemInKelvin) {
        hs = this.helpers.m2hs(1000000 / newParams.colorTemInKelvin)
        rgb = this.helpers.hs2rgb(hs)
      } else {
        rgb = [newParams.color.r, newParams.color.g, newParams.color.b]
        hs = this.helpers.rgb2hs(rgb)
      }
      if (rgb[0] !== this.cacheR || rgb[1] !== this.cacheG || rgb[2] !== this.cacheB) {
        this.lightService.updateCharacteristic(this.Characteristic.Hue, hs[0])
        this.lightService.updateCharacteristic(this.Characteristic.Saturation, hs[1])
        this.cacheR = rgb[0]
        this.cacheG = rgb[1]
        this.cacheB = rgb[2]
        if (this.firstUpdateDone) {
          this.log('[%s] current colour [rgb %s %s %s].', this.accessory.displayName, rgb[0], rgb[1], rgb[2])
          if (
            this.alController &&
            this.alController.isAdaptiveLightingActive() &&
            ((Math.abs(rgb[0] - this.cacheR) + Math.abs(rgb[1] - this.cacheG) + Math.abs(rgb[2] - this.cacheB)) > 5)
          ) {
            // *** look for a variation greater than five *** \\
            this.alController.disableAdaptiveLighting()
            this.log('[%s] adaptive lighting disabled due to significant colour change.', this.accessory.displayName)
          }
        }
      }
    }
    // ************** \\
    this.firstUpdateDone = true
  }
}

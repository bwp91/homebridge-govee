/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class deviceLEDStrip {
  constructor (platform, accessory) {
    this.helpers = platform.helpers
    this.httpClient = platform.httpClient
    this.debug = platform.debug
    this.log = platform.log
    this.skipUpdateForNow = false
    this.Service = platform.api.hap.Service
    this.Characteristic = platform.api.hap.Characteristic
    this.hapConvert = platform.api.hap.ColorUtils
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
    if (platform.api.versionGreaterOrEqual && platform.api.versionGreaterOrEqual('1.3.0-beta.27')) {
      this.alController = new platform.api.hap.AdaptiveLightingController(this.lightService)
      this.accessory.configureController(this.alController)
    }
  }

  async internalOnOffUpdate (value, callback) {
    try {
      if (this.lightService.getCharacteristic(this.Characteristic.On).value === value) {
        callback()
        return
      }
      callback()
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [turn]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'turn',
        value: value ? 'on' : 'off'
      })
      this.log('[%s] setting state to [%s].', this.accessory.displayName, value ? 'on' : 'off')
      this.skipUpdateForNow = true
      setTimeout(() => (this.skipUpdateForNow = false), 30000)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalBrightnessUpdate (value, callback) {
    try {
      if (this.lightService.getCharacteristic(this.Characteristic.Brightness).value === value) {
        callback()
        return
      }
      callback()
      if (!this.accessory.context.supportedCmds.includes('brightness')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [brightness]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKey = Math.random().toString(36).substr(2, 8)
      this.accessory.context.updateKeyBrightness = updateKey
      const newBrightness = this.helpers.modelsNoScaleBrightness.includes(this.accessory.context.gvModel)
        ? value
        : Math.round(value * 2.54)
      await this.helpers.sleep(350)
      if (updateKey !== this.accessory.context.updateKeyBrightness) return
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'brightness',
        value: newBrightness
      })
      this.log('[%s] setting brightness to [%s%].', this.accessory.displayName, value)
      this.skipUpdateForNow = true
      setTimeout(() => (this.skipUpdateForNow = false), 30000)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalColourUpdate (value, callback) {
    try {
      if (
        this.lightService.getCharacteristic(this.Characteristic.Hue).value === value ||
        !this.lightService.getCharacteristic(this.Characteristic.On).value) {
        callback()
        return
      }
      callback()
      if (!this.accessory.context.supportedCmds.includes('color')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [color]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKey = Math.random().toString(36).substr(2, 8)
      this.accessory.context.updateKeyColour = updateKey
      await this.helpers.sleep(700)
      const curSat = this.lightService.getCharacteristic(this.Characteristic.Saturation).value
      const newRGB = this.helpers.hs2rgb([value, curSat])
      const newColour = {
        r: newRGB[0],
        g: newRGB[1],
        b: newRGB[2]
      }
      if (updateKey !== this.accessory.context.updateKeyColour) return
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'color',
        value: newColour
      })
      this.log('[%s] setting hue to [%s°] and sat to [%s%].', this.accessory.displayName, value, curSat)
      this.skipUpdateForNow = true
      setTimeout(() => (this.skipUpdateForNow = false), 30000)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalCTempUpdate (value, callback) {
    try {
      if (
        this.lightService.getCharacteristic(this.Characteristic.ColorTemperature).value === value ||
        !this.lightService.getCharacteristic(this.Characteristic.On).value
      ) {
        callback()
        return
      }
      callback()
      if (!this.accessory.context.supportedCmds.includes('colorTem')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [colorTem]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKey = Math.random().toString(36).substr(2, 8)
      this.cacheCTemp = updateKey
      await this.helpers.sleep(700)
      if (updateKey !== this.cacheCTemp) return
      const kelvin = Math.min(Math.max(2000, Math.round(1000000 / value)), 9000)
      if (this.cacheKelvin === kelvin) return
      this.cacheKelvin = kelvin
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'colorTem',
        value: kelvin
      })
      this.skipUpdateForNow = true
      setTimeout(() => (this.skipUpdateForNow = false), 30000)
      this.log('[%s] setting colour temperature to [%s mired = %s kelvin].', this.accessory.displayName, value, kelvin)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  externalUpdate (newParams) {
    if (this.skipUpdateForNow) {
      if (this.debug) this.log('[%s] skipping external update as recently controlled.', this.accessory.displayName)
      return
    }
    const newBrightness = this.helpers.modelsNoScaleBrightness.includes(this.accessory.context.gvModel)
      ? newParams.brightness
      : Math.round(newParams.brightness / 2.54)
    let newColour
    if (this.helpers.hasProperty(newParams, 'colorTemInKelvin')) {
      const hueSat = this.hapConvert.colorTemperatureToHueAndSaturation(Math.round(1000000 / newParams.colorTemInKelvin))
      newColour = [hueSat.hue, hueSat.saturation]
    } else {
      newColour = this.helpers.rgb2hs([newParams.color.r, newParams.color.g, newParams.color.b])
    }
    this.lightService
      .updateCharacteristic(this.Characteristic.On, newParams.powerState === 'on')
      .updateCharacteristic(this.Characteristic.Brightness, newBrightness)
      .updateCharacteristic(this.Characteristic.Hue, newColour[0])
      .updateCharacteristic(this.Characteristic.Saturation, newColour[1])
  }
}

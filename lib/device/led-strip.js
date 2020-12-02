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
    this.hapConvert = platform.api.hap.ColorUtils
    // this.lightService = accessory.getService(this.Service.Lightbulb) ?? accessory.addService(this.Service.Lightbulb)
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
    this.accessory = accessory
  }

  async internalOnOffUpdate (value, callback) {
    if (this.lightService.getCharacteristic(this.Characteristic.On).value === value) {
      callback()
      return
    }
    callback()
    try {
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
      if (this.debug) this.log('[%s] has been turned [%s].', this.accessory.displayName, value ? 'on' : 'off')
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalBrightnessUpdate (value, callback) {
    if (this.lightService.getCharacteristic(this.Characteristic.Brightness).value === value) {
      callback()
      return
    }
    callback()
    try {
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
      await this.helpers.sleep(500)
      if (updateKey !== this.accessory.context.updateKeyBrightness) return
      await this.httpClient.updateDevice(this.accessory.context, {
        name: 'brightness',
        value: newBrightness
      })
      if (this.debug) this.log('[%s] has changed brightness to [%s%].', this.accessory.displayName, value)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  async internalColourUpdate (value, callback) {
    if (this.lightService.getCharacteristic(this.Characteristic.Hue).value === value) {
      callback()
      return
    }
    callback()
    try {
      if (!this.accessory.context.supportedCmds.includes('color')) {
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [color]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const updateKey = Math.random().toString(36).substr(2, 8)
      this.accessory.context.updateKeyColour = updateKey
      await this.helpers.sleep(500)
      if (!this.accessory.getService(this.Service.Lightbulb).getCharacteristic(this.Characteristic.On).value) {
        this.accessory.getService(this.Service.Lightbulb).updateCharacteristic(this.Characteristic.On, true)
      }
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
      if (this.debug) this.log('[%s] updating hue to [%s°] and sat to [%s%].', this.accessory.displayName, value, curSat)
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.accessory.displayName, err.message)
    }
  }

  externalUpdate (newParams) {
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

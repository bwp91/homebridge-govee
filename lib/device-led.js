/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
const cConvert = require('color-convert')
const cTemp = require('color-temp')
const helpers = require('./helpers')
module.exports = class deviceLED {
  constructor (platform, accessory) {
    this.platform = platform
    this.Service = platform.api.hap.Service
    this.Characteristic = platform.api.hap.Characteristic
    const lightService = accessory.getService(this.Service.Lightbulb) || accessory.addService(this.Service.Lightbulb)
    lightService
      .getCharacteristic(this.Characteristic.On)
      .on('set', (value, callback) => this.internalOnOffUpdate(accessory, value, callback))
    lightService
      .getCharacteristic(this.Characteristic.Brightness)
      .on('set', async (value, callback) => {
        if (value > 0) {
          if (!lightService.getCharacteristic(this.Characteristic.On).value) {
            this.internalOnOffUpdate(accessory, true, function () {})
          }
          await helpers.sleep(500)
          this.internalBrightnessUpdate(accessory, value, callback)
        } else {
          this.internalOnOffUpdate(accessory, false, callback)
        }
      })
    lightService
      .getCharacteristic(this.Characteristic.Hue)
      .on('set', (value, callback) => this.internalColourUpdate(accessory, value, callback))
    lightService
      .getCharacteristic(this.Characteristic.Saturation)
      .on('set', (value, callback) => callback())
  }

  async internalOnOffUpdate (accessory, value, callback) {
    callback()
    try {
      if (!accessory.context.supportedCmds.includes('turn')) {
        throw new Error('model [' + accessory.context.gvModel + '] does not support command [turn]')
      }
      if (!accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      await this.platform.httpClient.updateDevice(accessory.context, {
        name: 'turn',
        value: value ? 'on' : 'off'
      })
      if (this.platform.config.debug) {
        this.platform.log('[%s] has been turned [%s].', accessory.displayName, value ? 'on' : 'off')
      }
    } catch (err) {
      this.platform.log.warn('[%s] could not be updated and its status will be reverted soon. Error: %s.', accessory.displayName, err.message)
    }
  }

  async internalBrightnessUpdate (accessory, value, callback) {
    callback()
    try {
      if (!accessory.context.supportedCmds.includes('brightness')) {
        throw new Error('model [' + accessory.context.gvModel + '] does not support command [brightness]')
      }
      if (!accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const newBrightness = helpers.modelsNoScaleBrightness.includes(accessory.context.gvModel)
        ? value
        : Math.round(value * 2.54)
      await this.platform.httpClient.updateDevice(accessory.context, {
        name: 'brightness',
        value: newBrightness
      })
      if (this.platform.debug) {
        this.platform.log('[%s] has changed brightness to [%s%].', accessory.displayName, value)
      }
    } catch (err) {
      this.platform.log.warn('[%s] could not be updated and its status will be reverted soon. Error: %s.', accessory.displayName, err.message)
    }
  }

  async internalColourUpdate (accessory, value, callback) {
    callback()
    try {
      if (!accessory.context.supportedCmds.includes('color')) {
        throw new Error('model [' + accessory.context.gvModel + '] does not support command [color]')
      }
      if (!accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const lightService = accessory.getService(this.Service.Lightbulb)
      const curSat = lightService.getCharacteristic(this.Characteristic.Saturation).value
      const newRGB = cConvert.hsv.rgb(value, curSat, 100)
      const newColour = {
        r: newRGB[0],
        g: newRGB[1],
        b: newRGB[2]
      }
      await this.platform.httpClient.updateDevice(accessory.context, {
        name: 'color',
        value: newColour
      })
      if (this.platform.debug) {
        this.platform.log('[%s] updating hue to [%s°].', accessory.displayName, value)
      }
    } catch (err) {
      this.platform.log.warn('[%s] could not be updated and its status will be reverted soon. Error: %s.', accessory.displayName, err.message)
    }
  }

  externalUpdate (accessory, newParams) {
    const lightService = accessory.getService(this.Service.Lightbulb)
    const newBrightness = helpers.modelsNoScaleBrightness.includes(accessory.context.gvModel)
      ? newParams.brightness
      : Math.round(newParams.brightness / 2.54)
    const rgb = {}
    if (helpers.hasProperty(newParams, 'colorTemInKelvin')) {
      const rgbArray = cTemp.temp2rgb(newParams.colorTemInKelvin)
      rgb.r = rgbArray[0]
      rgb.b = rgbArray[1]
      rgb.g = rgbArray[2]
    } else {
      rgb.r = newParams.color.r
      rgb.g = newParams.color.g
      rgb.b = newParams.color.b
    }
    const newColour = cConvert.rgb.hsv(rgb.r, rgb.g, rgb.b)
    lightService
      .updateCharacteristic(this.Characteristic.On, newParams.powerState === 'on')
      .updateCharacteristic(this.Characteristic.Brightness, newBrightness)
      .updateCharacteristic(this.Characteristic.Hue, newColour[0])
      .updateCharacteristic(this.Characteristic.Saturation, newColour[1])
  }
}

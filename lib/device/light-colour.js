/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class deviceLightColour {
  constructor (platform, accessory) {
    this.httpClient = platform.httpClient
    this.debug = platform.config.debug
    this.log = platform.log
    this.messages = platform.messages
    this.funcs = platform.funcs
    this.disableDeviceLogging = platform.config.disableDeviceLogging
    this.colourUtils = platform.colourUtils

    // *** Set up these variables for easy access later *** \\
    this.accessory = accessory
    this.name = accessory.displayName
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic

    // *** Add the lightbulb service if it doesn't already exist *** \\
    this.service = this.accessory.getService(this.hapServ.Lightbulb) ||
      this.accessory.addService(this.hapServ.Lightbulb)

    // *** Add the set handler to the lightbulb on/off characteristic *** \\
    this.service.getCharacteristic(this.hapChar.On)
      .on('set', this.internalOnOffUpdate.bind(this))

    // *** Add the set handler to the lightbulb brightness characteristic *** \\
    this.service.getCharacteristic(this.hapChar.Brightness)
      .on('set', this.internalBrightnessUpdate.bind(this))

    // *** Add the set handler to the lightbulb hue characteristic *** \\
    this.service.getCharacteristic(this.hapChar.Hue)
      .on('set', this.internalColourUpdate.bind(this))

    // *** Add the set handler to the lightbulb saturation characteristic *** \\
    this.service.getCharacteristic(this.hapChar.Saturation)
      .on('set', (value, callback) => callback())

    // *** Add the set handler to the lightbulb ct characteristic *** \\
    this.service.getCharacteristic(this.hapChar.ColorTemperature)
      .on('set', this.internalCTempUpdate.bind(this))

    if (
      platform.api.versionGreaterOrEqual &&
      platform.api.versionGreaterOrEqual('1.3.0-beta.46')
    ) {
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
        const eText = this.accessory.context.gvModel + this.messages.notSuppTurn
        throw new Error(eText)
      }
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }
      const timerKey = Math.random().toString(36).substr(2, 8)
      // *** Random number in [0, 400] *** \\
      const randomWait = Math.floor(Math.random() * 401)
      await this.funcs.sleep(randomWait)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'turn',
        value: onoff
      })
      this.cacheOnOff = onoff
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.messages.curState, this.cacheOnOff)
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  async internalBrightnessUpdate (value, callback) {
    try {
      callback()
      if (value === this.cacheBrightness) {
        return
      }
      if (!this.accessory.context.supportedCmds.includes('brightness')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppBrightness
        throw new Error(eText)
      }
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }
      const updateKeyBright = Math.random().toString(36).substr(2, 8)
      this.updateKeyBright = updateKeyBright
      const newBrightness = this.consts.noScale.includes(this.accessory.context.gvModel)
        ? value
        : Math.round(value * 2.54)

      // *** Random number in [1200, 1600] *** \\
      const randomWait = Math.floor(Math.random() * 401 + 1200)
      await this.funcs.sleep(randomWait)
      if (updateKeyBright !== this.updateKeyBright) {
        return
      }
      this.updateTimeout = updateKeyBright
      setTimeout(() => {
        if (this.updateTimeout === updateKeyBright) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'brightness',
        value: newBrightness
      })
      this.cacheBrightness = value
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s%].', this.name, this.messages.curBrightness, value)
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  async internalColourUpdate (value, callback) {
    try {
      this.service.updateCharacteristic(this.hapChar.ColorTemperature, 140)
      callback()
      const currentSat = this.service.getCharacteristic(this.hapChar.Saturation).value
      const newRGB = this.colourUtils.hs2rgb(value, currentSat)
      if (
        newRGB[0] === this.cacheR &&
        newRGB[1] === this.cacheG &&
        newRGB[2] === this.cacheB
      ) {
        return
      }
      if (!this.accessory.context.supportedCmds.includes('color')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppColour
        throw new Error(eText)
      }
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }
      const updateKeyColour = Math.random().toString(36).substr(2, 8)
      this.updateKeyColour = updateKeyColour

      // *** Random number in [600, 1000] *** \\
      const randomWait = Math.floor(Math.random() * 401 + 600)
      await this.funcs.sleep(randomWait)
      if (updateKeyColour !== this.updateKeyColour) {
        return
      }
      this.updateTimeout = updateKeyColour
      setTimeout(() => {
        if (this.updateTimeout === updateKeyColour) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2]
        }
      })
      this.cacheR = newRGB[0]
      this.cacheG = newRGB[1]
      this.cacheB = newRGB[2]
      if (!this.disableDeviceLogging) {
        this.log(
          '[%s] %s [rgb %s %s %s].',
          this.name,
          this.messages.curColour,
          newRGB[0],
          newRGB[1],
          newRGB[2]
        )
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  async internalCTempUpdate (value, callback) {
    try {
      const hs = this.colourUtils.m2hs(value)
      const newRGB = this.colourUtils.hs2rgb(hs[0], hs[1])
      const rgbIsSame = newRGB[0] === this.cacheR &&
        newRGB[1] === this.cacheG &&
        newRGB[2] === this.cacheB
      if (this.cacheOnOff !== 'on' || rgbIsSame) {
        callback()
        return
      }
      this.service.updateCharacteristic(this.hapChar.Hue, hs[0])
      this.service.updateCharacteristic(this.hapChar.Saturation, hs[1])
      callback()
      if (!this.accessory.context.supportedCmds.includes('color')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppColour
        throw new Error(eText)
      }
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }
      const updateKeyCT = Math.random().toString(36).substr(2, 8)
      this.updateKeyCT = updateKeyCT

      // *** Random number in [600, 1000] *** \\
      const randomWait = Math.floor(Math.random() * 401 + 600)
      await this.funcs.sleep(randomWait)
      if (updateKeyCT !== this.updateKeyCT) {
        return
      }
      this.updateTimeout = updateKeyCT
      setTimeout(() => {
        if (this.updateTimeout === updateKeyCT) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2]
        }
      })
      this.cacheR = newRGB[0]
      this.cacheG = newRGB[1]
      this.cacheB = newRGB[2]
      const mToK = Math.round(1000000 / value)
      if (!this.disableDeviceLogging) {
        if (this.alController && this.alController.isAdaptiveLightingActive()) {
          this.log('[%s] %s [%sK].', this.name, this.messages.curCCTAL, mToK)
        } else {
          this.log('[%s] %s [%sK].', this.name, this.messages.curCCT, mToK)
        }
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  externalUpdate (newParams) {
    if (this.debug && this.firstUpdateDone) {
      this.log(
        '[%s] %s [%s].',
        this.name,
        this.messages.receivingUpdate,
        JSON.stringify(newParams)
      )
      if (this.updateTimeout) {
        this.log('[%s] %s.', this.name, this.messages.ignoringUpdate)
      }
    }
    if (this.updateTimeout) {
      return
    }

    // *** ON/OFF *** \\
    if (newParams.powerState && newParams.powerState !== this.cacheOnOff) {
      this.cacheOnOff = newParams.powerState
      this.service.updateCharacteristic(this.hapChar.On, this.cacheOnOff === 'on')
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.messages.curState, newParams.powerState)
      }
    }
    // ************** \\

    // *** BRIGHTNESS *** \\
    if (newParams.brightness && newParams.brightness !== this.cacheBrightness) {
      const newBrightness = this.consts.noScale.includes(this.accessory.context.gvModel)
        ? newParams.brightness
        : Math.round(newParams.brightness / 2.54)
      this.cacheBrightness = Math.max(Math.min(newBrightness, 100), 0)
      this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBrightness)
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log(
          '[%s] %s [%s%].',
          this.name,
          this.messages.curBrightness,
          this.cacheBrightness
        )
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
        this.service.updateCharacteristic(this.hapChar.Hue, hs[0])
        this.service.updateCharacteristic(this.hapChar.Saturation, hs[1])
        this.cacheR = rgb[0]
        this.cacheG = rgb[1]
        this.cacheB = rgb[2]
        if (this.firstUpdateDone) {
          if (!this.disableDeviceLogging) {
            this.log(
              '[%s] %s [rgb %s %s %s].',
              this.name,
              this.messages.curColour,
              rgb[0],
              rgb[1],
              rgb[2]
            )
          }
          const rgbDiff = Math.abs(rgb[0] - this.cacheR) +
            Math.abs(rgb[1] - this.cacheG) +
            Math.abs(rgb[2] - this.cacheB)
          if (
            rgbDiff > 5 &&
            this.alController &&
            this.alController.isAdaptiveLightingActive()
          ) {
            // *** look for a variation greater than five *** \\
            this.alController.disableAdaptiveLighting()
            this.log('[%s] %s.', this.messages.alDisabled, this.name)
          }
        }
      }
    }
    // ************** \\
    this.firstUpdateDone = true
  }
}

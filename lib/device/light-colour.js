/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceLightColour {
  constructor (platform, accessory) {
    // Create variables usable by the class
    this.httpClient = platform.httpClient
    this.debug = platform.config.debug
    this.log = platform.log
    this.messages = platform.messages
    this.funcs = platform.funcs
    this.consts = platform.consts
    this.disableDeviceLogging = platform.config.disableDeviceLogging
    this.colourUtils = platform.colourUtils

    // Create these variables for easy access later
    this.accessory = accessory
    this.name = accessory.displayName
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic

    // Add the lightbulb service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Lightbulb) ||
      this.accessory.addService(this.hapServ.Lightbulb)

    // Add the set handler to the lightbulb on/off characteristic
    this.service.getCharacteristic(this.hapChar.On)
      .on('set', this.internalOnOffUpdate.bind(this))

    // Add the set handler to the lightbulb brightness characteristic
    this.service.getCharacteristic(this.hapChar.Brightness)
      .on('set', this.internalBrightnessUpdate.bind(this))

    // Add the set handler to the lightbulb hue characteristic
    this.service.getCharacteristic(this.hapChar.Hue)
      .on('set', this.internalColourUpdate.bind(this))

    // Add the set handler to the lightbulb saturation characteristic
    this.service.getCharacteristic(this.hapChar.Saturation)
      .on('set', (value, callback) => callback())

    // Add the set handler to the lightbulb cct characteristic
    this.service.getCharacteristic(this.hapChar.ColorTemperature)
      .on('set', this.internalCTempUpdate.bind(this))

    // Setup the adaptive lighting controller if available
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
      // Call callback() first to avoid any 'No Response' errors in HomeKit
      callback()
      const onoff = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (onoff === this.cacheOnOff) {
        return
      }

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppTurn
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }

      // Set up a two minute timeout for the plugin to ignore incoming updates
      const timerKey = Math.random().toString(36).substr(2, 8)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 120000)

      // Submit the request via the HTTP client
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'turn',
        value: onoff
      })

      // Cache the new state and log if appropriate
      this.cacheOnOff = onoff
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.messages.curState, this.cacheOnOff)
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  async internalBrightnessUpdate (value, callback) {
    try {
      // Call callback() first to avoid any 'No Response' errors in HomeKit
      callback()

      // Don't continue if the new value is the same as before
      if (value === this.cacheBright) {
        return
      }

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('brightness')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppBrightness
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }

      // This acts like a debounce function when endlessly sliding the brightness scale
      const updateKeyBright = Math.random().toString(36).substr(2, 8)
      this.updateKeyBright = updateKeyBright
      await this.funcs.sleep(550)
      if (updateKeyBright !== this.updateKeyBright) {
        return
      }

      // Set up a two minute timeout for the plugin to ignore incoming updates
      this.updateTimeout = updateKeyBright
      setTimeout(() => {
        if (this.updateTimeout === updateKeyBright) {
          this.updateTimeout = false
        }
      }, 120000)

      // Some models use a scale of 0-100, others a scale of 0-254
      const newBrightness = this.consts.noScale.includes(this.accessory.context.gvModel)
        ? value
        : Math.round(value * 2.54)

      // Submit the request via the HTTP client
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'brightness',
        value: newBrightness
      })

      // Cache the new state and log if appropriate
      this.cacheBright = value
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s%].', this.name, this.messages.curBright, value)
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  async internalColourUpdate (value, callback) {
    try {
      // Updating the cct to the lowest value mimics native adaptive lighting
      this.service.updateCharacteristic(this.hapChar.ColorTemperature, 140)

      // Call callback() first to avoid any 'No Response' errors in HomeKit
      callback()

      // Don't continue if the new value is the same as before
      const currentSat = this.service.getCharacteristic(this.hapChar.Saturation).value
      const newRGB = this.colourUtils.hs2rgb(value, currentSat)
      if (
        newRGB[0] === this.cacheR &&
        newRGB[1] === this.cacheG &&
        newRGB[2] === this.cacheB
      ) {
        return
      }

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('color')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppColour
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }

      // This acts like a debounce function when endlessly sliding the colour wheel
      const updateKeyColour = Math.random().toString(36).substr(2, 8)
      this.updateKeyColour = updateKeyColour
      await this.funcs.sleep(450)
      if (updateKeyColour !== this.updateKeyColour) {
        return
      }

      // Set up a two minute timeout for the plugin to ignore incoming updates
      this.updateTimeout = updateKeyColour
      setTimeout(() => {
        if (this.updateTimeout === updateKeyColour) {
          this.updateTimeout = false
        }
      }, 120000)

      // Submit the request via the HTTP client
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2]
        }
      })

      // Cache the new state and log if appropriate
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
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  async internalCTempUpdate (value, callback) {
    try {
      // Convert given mired to rgb to check against the current cache
      const hs = this.colourUtils.m2hs(value)
      const newRGB = this.colourUtils.hs2rgb(hs[0], hs[1])
      const rgbIsSame = newRGB[0] === this.cacheR &&
        newRGB[1] === this.cacheG &&
        newRGB[2] === this.cacheB

      // Don't continue if the new value is the same as before
      if (this.cacheOnOff !== 'on' || rgbIsSame) {
        callback()
        return
      }

      // Updating the hue/sat to the corresponding values mimics native adaptive lighting
      this.service.updateCharacteristic(this.hapChar.Hue, hs[0])
      this.service.updateCharacteristic(this.hapChar.Saturation, hs[1])

      // Call callback() next to avoid any 'No Response' errors in HomeKit
      callback()

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('color')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppColour
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }

      // This acts like a debounce function when endlessly sliding the colour wheel
      const updateKeyCT = Math.random().toString(36).substr(2, 8)
      this.updateKeyCT = updateKeyCT
      await this.funcs.sleep(450)
      if (updateKeyCT !== this.updateKeyCT) {
        return
      }

      // Set up a two minute timeout for the plugin to ignore incoming updates
      this.updateTimeout = updateKeyCT
      setTimeout(() => {
        if (this.updateTimeout === updateKeyCT) {
          this.updateTimeout = false
        }
      }, 120000)

      // Submit the request via the HTTP client
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'color',
        value: {
          r: newRGB[0],
          g: newRGB[1],
          b: newRGB[2]
        }
      })

      // Cache the new state and log if appropriate
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
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  externalUpdate (newParams) {
    // Log the incoming update if appropriate
    if (this.debug && this.firstUpdateDone) {
      const params = JSON.stringify(newParams)
      const text = this.updateTimeout
        ? this.messages.ignoringUpdate
        : this.messages.receivingUpdate
      this.log('[%s] %s [%s].', this.name, text, params)
    }

    // Don't continue during the two minute timeout from controlling a device
    if (this.updateTimeout) {
      return
    }

    // Check to see if the provided state is different from the cached value
    if (newParams.powerState && newParams.powerState !== this.cacheOnOff) {
      // State is different so update Homebridge with new values
      this.cacheOnOff = newParams.powerState
      this.service.updateCharacteristic(this.hapChar.On, this.cacheOnOff === 'on')

      // Log the change if appropriate
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.messages.curState, newParams.powerState)
      }
    }

    // Check to see if the provided brightness is different from the cached value
    if (newParams.brightness && newParams.brightness !== this.cacheBright) {
      // Brightness is different so update Homebridge with new values
      const newBrightness = this.consts.noScale.includes(this.accessory.context.gvModel)
        ? newParams.brightness
        : Math.round(newParams.brightness / 2.54)
      this.cacheBright = Math.max(Math.min(newBrightness, 100), 0)
      this.service.updateCharacteristic(this.hapChar.Brightness, this.cacheBright)

      // Log the change if appropriate
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] %s [%s%].', this.name, this.messages.curBright, this.cacheBright)
      }
    }

    // Check to see if the provided colour is different from the cached state
    if (newParams.colorTemInKelvin || newParams.color) {
      // Colour can be provided in rgb or kelvin so either way convert to hs for later
      let hs
      let rgb
      if (newParams.colorTemInKelvin) {
        hs = this.colourUtils.m2hs(1000000 / newParams.colorTemInKelvin)
        rgb = this.colourUtils.hs2rgb(hs[0], hs[1])
      } else {
        rgb = [newParams.color.r, newParams.color.g, newParams.color.b]
        hs = this.colourUtils.rgb2hs(rgb[0], rgb[1], rgb[2])
      }

      // Perform the check against the cache
      if (rgb[0] !== this.cacheR || rgb[1] !== this.cacheG || rgb[2] !== this.cacheB) {
        // Colour is different so update Homebridge with new values
        this.cacheR = rgb[0]
        this.cacheG = rgb[1]
        this.cacheB = rgb[2]
        this.service.updateCharacteristic(this.hapChar.Hue, hs[0])
        this.service.updateCharacteristic(this.hapChar.Saturation, hs[1])

        // Log the change if appropriate
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

          // Check for a difference in rgb values for adaptive lighting
          const rgbDiff = Math.abs(rgb[0] - this.cacheR) +
            Math.abs(rgb[1] - this.cacheG) +
            Math.abs(rgb[2] - this.cacheB)

          // If the difference is significant (> 5) then disable adaptive lighting
          if (
            rgbDiff > 5 &&
            this.alController &&
            this.alController.isAdaptiveLightingActive()
          ) {
            this.alController.disableAdaptiveLighting()
            this.log('[%s] %s.', this.messages.alDisabled, this.name)
          }
        }
      }
    }

    // Update the variable that the first run has completed
    this.firstUpdateDone = true
  }
}

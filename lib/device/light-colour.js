/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceLightColour {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.httpClient = platform.httpClient
    this.debug = platform.config.debug
    this.forceUpdates = platform.config.forceUpdates
    this.log = platform.log
    this.lang = platform.lang
    this.funcs = platform.funcs
    this.consts = platform.consts
    this.colourUtils = platform.colourUtils
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic
    this.cusChar = platform.cusChar
    this.platform = platform

    // Set up variables from the accessory
    this.accessory = accessory
    this.name = accessory.displayName

    // Set up custom variables for this device type
    const deviceId = this.accessory.context.gvDeviceId
    const deviceConf = platform.lightDevices[deviceId]
    this.alShift = deviceConf && deviceConf.adaptiveLightingShift
      ? deviceConf.adaptiveLightingShift
      : platform.consts.defaultValues.adaptiveLightingShift
    this.brightStep = deviceConf && deviceConf.brightnessStep
      ? Math.min(deviceConf.brightnessStep, 100)
      : platform.consts.defaultValues.brightnessStep
    this.disableDeviceLogging = deviceConf && deviceConf.overrideDisabledLogging
      ? false
      : platform.config.disableDeviceLogging

    // Add the main lightbulb service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Lightbulb) ||
      this.accessory.addService(this.hapServ.Lightbulb)

    // Set the main lightbulb service as the primary service
    this.service.setPrimaryService()

    // Add the set handler to the lightbulb on/off characteristic
    this.service.getCharacteristic(this.hapChar.On).onSet(async value => {
      await this.internalStateUpdate(value)
    })

    // Add the set handler to the lightbulb brightness characteristic
    this.service.getCharacteristic(this.hapChar.Brightness)
      .setProps({ minStep: this.brightStep })
      .onSet(async value => {
        await this.internalBrightnessUpdate(value)
      })

    // Add the set handler to the lightbulb hue characteristic
    this.service.getCharacteristic(this.hapChar.Hue).onSet(async value => {
      await this.internalColourUpdate(value)
    })

    // Add the set handler to the lightbulb cct characteristic
    this.service.getCharacteristic(this.hapChar.ColorTemperature).onSet(async value => {
      await this.internalCTUpdate(value)
    })

    // Set up the adaptive lighting controller
    this.alController = new platform.api.hap.AdaptiveLightingController(this.service, {
      customTemperatureAdjustment: this.alShift
    })
    this.accessory.configureController(this.alController)

    // Output the customised options to the log if in debug mode
    if (this.debug) {
      const opts = JSON.stringify({
        adaptiveLightingShift: '+' + this.alShift,
        brightnessStep: this.brightStep,
        disableDeviceLogging: this.disableDeviceLogging
      })
      this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
    }
  }

  async internalStateUpdate (value) {
    try {
      // Await slightly longer than brightness and colour so on/off is sent last
      await this.funcs.sleep(500)

      const newValue = value ? 'on' : 'off'

      // Don't continue if the new value is the same as before
      if (newValue === this.cacheState) {
        return
      }

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppTurn
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.cacheOnline) {
        if (this.forceUpdates) {
          if (this.debug) {
            this.log('[%s] %s.', this.name, this.lang.sendingAnyway)
          }
        } else {
          throw new Error(this.lang.devNotControl)
        }
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
        value: newValue
      })

      // Cache the new state and log if appropriate
      this.cacheState = newValue
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curState, this.cacheState)
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.lang.devNotUpdated, eText)

      // Throw a 'no response' error and set a timeout to revert this after 5 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 5000)
      throw new this.platform.api.hap.HapStatusError(-70402)
    }
  }

  async internalBrightnessUpdate (value) {
    try {
      // This acts like a debounce function when endlessly sliding the brightness scale
      const updateKeyBright = Math.random().toString(36).substr(2, 8)
      this.updateKeyBright = updateKeyBright
      await this.funcs.sleep(400)
      if (updateKeyBright !== this.updateKeyBright) {
        return
      }

      // Don't continue if the new value is the same as before
      if (value === this.cacheBright) {
        return
      }

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('brightness')) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppBrightness
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.cacheOnline) {
        if (this.forceUpdates) {
          if (this.debug) {
            this.log('[%s] %s.', this.name, this.lang.sendingAnyway)
          }
        } else {
          throw new Error(this.lang.devNotControl)
        }
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
        this.log('[%s] %s [%s%].', this.name, this.lang.curBright, value)
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.lang.devNotUpdated, eText)

      // Throw a 'no response' error and set a timeout to revert this after 5 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 5000)
      throw new this.platform.api.hap.HapStatusError(-70402)
    }
  }

  async internalColourUpdate (value) {
    try {
      // This acts like a debounce function when endlessly sliding the colour wheel
      const updateKeyColour = Math.random().toString(36).substr(2, 8)
      this.updateKeyColour = updateKeyColour
      await this.funcs.sleep(300)
      if (updateKeyColour !== this.updateKeyColour) {
        return
      }

      // Updating the cct to the lowest value mimics native adaptive lighting
      this.service.updateCharacteristic(this.hapChar.ColorTemperature, 140)

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
        const eText = this.accessory.context.gvModel + this.lang.notSuppColour
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.cacheOnline) {
        if (this.forceUpdates) {
          if (this.debug) {
            this.log('[%s] %s.', this.name, this.lang.sendingAnyway)
          }
        } else {
          throw new Error(this.lang.devNotControl)
        }
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
        const label = this.cacheR + ' ' + this.cacheG + ' ' + this.cacheB
        this.log('[%s] %s [rgb %s].', this.name, this.lang.curColour, label)
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.lang.devNotUpdated, eText)

      // Throw a 'no response' error and set a timeout to revert this after 5 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 5000)
      throw new this.platform.api.hap.HapStatusError(-70402)
    }
  }

  async internalCTUpdate (value) {
    try {
      // This acts like a debounce function when endlessly sliding the colour wheel
      const updateKeyCT = Math.random().toString(36).substr(2, 8)
      this.updateKeyCT = updateKeyCT
      await this.funcs.sleep(300)
      if (updateKeyCT !== this.updateKeyCT) {
        return
      }

      // Convert mired to kelvin and make sure in range [2000, 9000]
      const k = Math.min(Math.max(Math.round(1000000 / value), 2000), 9000)

      // Convert kelvin to rgb to check against the current cache
      const rgb = this.colourUtils.k2rgb(k)
      const rgbIsSame = rgb[0] === this.cacheR &&
        rgb[1] === this.cacheG &&
        rgb[2] === this.cacheB

      // Don't continue if the new value is the same as before
      if (this.cacheState !== 'on' || rgbIsSame) {
        return
      }

      // Updating the hue/sat to the corresponding values mimics native adaptive lighting
      const hs = this.colourUtils.m2hs(value)
      this.service.updateCharacteristic(this.hapChar.Hue, hs[0])
      this.service.updateCharacteristic(this.hapChar.Saturation, hs[1])

      // Don't continue if the device doesn't support this command
      if (!this.accessory.context.supportedCmds.includes('color')) {
        const eText = this.accessory.context.gvModel + this.lang.notSuppColour
        throw new Error(eText)
      }

      // Don't continue if the device is not currently controllable
      if (!this.cacheOnline) {
        if (this.forceUpdates) {
          if (this.debug) {
            this.log('[%s] %s.', this.name, this.lang.sendingAnyway)
          }
        } else {
          throw new Error(this.lang.devNotControl)
        }
      }

      // Set up a two minute timeout for the plugin to ignore incoming updates
      this.updateTimeout = updateKeyCT
      setTimeout(() => {
        if (this.updateTimeout === updateKeyCT) {
          this.updateTimeout = false
        }
      }, 120000)

      // Set up the params object to send
      const objToSend = {}

      // If the device supports colour temperature then send colorTem
      if (this.accessory.context.supportedCmds.includes('colorTem')) {
        // Send kelvin value
        objToSend.name = 'colorTem'
        objToSend.value = k
      } else {
        // Send rgb values
        objToSend.name = 'color'
        objToSend.value = { r: rgb[0], g: rgb[1], b: rgb[2] }
      }

      // Submit the request via the HTTP client
      await this.httpClient.updateDevice(this.name, this.accessory.context, objToSend)

      // Cache the new state and log if appropriate
      this.cacheR = rgb[0]
      this.cacheG = rgb[1]
      this.cacheB = rgb[2]
      if (!this.disableDeviceLogging) {
        if (this.alController.isAdaptiveLightingActive()) {
          this.log(
            '[%s] %s [%sK / %sM] %s.',
            this.name,
            this.lang.curColour,
            k,
            value,
            this.lang.viaAL
          )
        } else {
          this.log('[%s] %s [%sK / %sM].', this.name, this.lang.curColour, k, value)
        }
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.lang.devNotUpdated, eText)

      // Throw a 'no response' error and set a timeout to revert this after 5 seconds
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 5000)
      throw new this.platform.api.hap.HapStatusError(-70402)
    }
  }

  externalUpdate (newParams) {
    // Log the incoming update if appropriate
    if (this.debug && this.firstUpdateDone) {
      const params = JSON.stringify(newParams)
      const text = this.updateTimeout
        ? this.lang.ignoringUpdate
        : this.lang.receivingUpdate
      this.log('[%s] %s [%s].', this.name, text, params)
    }

    // Don't continue during the two minute timeout from controlling a device
    if (this.updateTimeout) {
      return
    }

    // Check to see if the provided online status is different from the cache value
    if (this.funcs.hasProperty(newParams, 'online')) {
      const status = this.funcs.parseStatus(newParams.online)
      if (this.cacheOnline !== status) {
        this.cacheOnline = status
        this.platform.updateAccessoryStatus(this.accessory, this.cacheOnline)
      }
    }

    // Check to see if the provided state is different from the cached value
    if (newParams.powerState && newParams.powerState !== this.cacheState) {
      // State is different so update Homebridge with new values
      this.cacheState = newParams.powerState
      this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')

      // Log the change if appropriate
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curState, newParams.powerState)
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
        this.log('[%s] %s [%s%].', this.name, this.lang.curBright, this.cacheBright)
      }
    }

    // Check to see if the provided colour is different from the cached state
    if (newParams.colorTem || newParams.colorTemInKelvin || newParams.color) {
      // Colour can be provided in rgb or kelvin so either way convert to hs for later
      let hs
      let rgb
      let kelvin
      let mired
      if (newParams.colorTemInKelvin || newParams.colorTem) {
        kelvin = newParams.colorTemInKelvin || newParams.colorTem
        mired = Math.round(1000000 / kelvin)
        hs = this.colourUtils.m2hs(mired)
        rgb = this.colourUtils.hs2rgb(hs[0], hs[1])
      } else {
        rgb = [newParams.color.r, newParams.color.g, newParams.color.b]
        hs = this.colourUtils.rgb2hs(rgb[0], rgb[1], rgb[2])
      }

      // Perform the check against the cache
      if (rgb[0] !== this.cacheR || rgb[1] !== this.cacheG || rgb[2] !== this.cacheB) {
        // Check for a difference in rgb values for adaptive lighting used later
        const rgbDiff = Math.abs(rgb[0] - this.cacheR) +
          Math.abs(rgb[1] - this.cacheG) +
          Math.abs(rgb[2] - this.cacheB)

        // Colour is different so update Homebridge with new values
        this.cacheR = rgb[0]
        this.cacheG = rgb[1]
        this.cacheB = rgb[2]
        this.service.updateCharacteristic(this.hapChar.Hue, hs[0])
        this.service.updateCharacteristic(this.hapChar.Saturation, hs[1])

        if (mired) {
          this.service.updateCharacteristic(this.hapChar.ColorTemperature, mired)
        }

        if (this.firstUpdateDone) {
          // Log the change if appropriate
          if (!this.disableDeviceLogging) {
            if (mired) {
              this.log(
                '[%s] %s [%sK / %sM].',
                this.name,
                this.lang.curColour,
                kelvin,
                mired
              )
            } else {
              const label = this.cacheR + ' ' + this.cacheG + ' ' + this.cacheB
              this.log('[%s] %s [rgb %s].', this.name, this.lang.curColour, label)
            }
          }

          // If the difference is significant (>50) then disable adaptive lighting
          if (this.alController.isAdaptiveLightingActive() && rgbDiff > 50) {
            this.alController.disableAdaptiveLighting()
            if (!this.disableDeviceLogging) {
              this.log('[%s] %s.', this.name, this.lang.alDisabled)
            }
          }
        }
      }
    }

    // Update the variable that the first run has completed
    this.firstUpdateDone = true
  }
}

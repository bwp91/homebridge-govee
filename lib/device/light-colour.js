/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceLightColour {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.httpClient = platform.httpClient
    this.debug = platform.config.debug
    this.log = platform.log
    this.messages = platform.messages
    this.funcs = platform.funcs
    this.consts = platform.consts
    this.colourUtils = platform.colourUtils
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic

    // Set up variables from the accessory
    this.accessory = accessory
    this.name = accessory.displayName

    // Set up custom variables for this device type
    const deviceId = this.accessory.context.gvDeviceId
    const deviceConf = platform.lightDevices[deviceId]
    this.exposeScenes = deviceConf && deviceConf.exposeScenes
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

    /*
      BETA

      TODO
      - put logging to debug when finished
      - sort out the request to Govee to set a scene
      - externalUpdate() to find which scene is set if set externally (with a cache?)
    */
    if (this.exposeScenes) {
      // Create a fake array of scenes for now
      // I'm assuming somehow we would get a list of available scenes from Govee
      // ...that we will use instead for the array
      this.sceneList = ['Music Mode', 'Party Mode', 'Chill', 'Etc']

      // We need remove scene services for items not in the above list
      this.accessory.services.filter(service => service.displayName)
        .forEach(service => {
          // We have filtered out the main AccessoryInformation and Lightbulb services
          if (!this.sceneList.includes(service.displayName)) {
            // Scene list does not include this service so remove it
            this.accessory.removeService(service)
            // Log whilst under production (todo, debug only)
            this.log('[%s] removed service for scene [%s].', this.name, service.displayName)
          }
        })

      // Next loop through the scene list adding services if they don't already exist
      this.sceneList.forEach(scene => {
        let sceneService
        if (!(sceneService = this.accessory.getService(scene))) {
          // Create a version of the name in lowercase with no spaces for the subtype
          const sType = scene.toLowerCase().replace(/[\s]+/g, '')

          // Add the scene service to the accessory
          sceneService = this.accessory.addService(this.hapServ.Lightbulb, scene, sType)

          // Log whilst under production (todo, debug only)
          this.log('[%s] added service for scene [%s].', this.name, scene)
        }

        // Add the set handler to the scene 'lightbulb' on/off characteristic
        sceneService.getCharacteristic(this.hapChar.On)
          .on('set', (value, callback) => {
            this.internalSceneUpdate(value, callback, scene)
          })

        // Log whilst under production (todo, perhaps one line with csv)
        this.log(
          '[%s] has scene service [%s].',
          this.name,
          sceneService.displayName
        )
      })
    } else {
      // User has not chosen to expose scenes so remove all the scene services
      this.accessory.services.filter(service => service.displayName)
        .forEach(service => {
        // We have filtered out the main AccessoryInformation and Lightbulb services
          this.accessory.removeService(service)

          // Log whilst under production (todo, debug only)
          this.log('[%s] removed service for scene [%s].', this.name, service.displayName)
        })
    }
    /*
      END BETA
    */

    // Set the main lightbulb service as the primary service
    this.service.setPrimaryService()

    // Add the set handler to the lightbulb on/off characteristic
    this.service.getCharacteristic(this.hapChar.On)
      .on('set', this.internalOnOffUpdate.bind(this))

    // Add the set handler to the lightbulb brightness characteristic
    this.service.getCharacteristic(this.hapChar.Brightness)
      .on('set', this.internalBrightnessUpdate.bind(this))
      .setProps({ minStep: this.brightStep })

    // Add the set handler to the lightbulb hue characteristic
    this.service.getCharacteristic(this.hapChar.Hue)
      .on('set', this.internalColourUpdate.bind(this))

    // Add the set handler to the lightbulb saturation characteristic
    this.service.getCharacteristic(this.hapChar.Saturation)
      .on('set', (value, callback) => callback())

    // Add the set handler to the lightbulb cct characteristic
    this.service.getCharacteristic(this.hapChar.ColorTemperature)
      .on('set', this.internalCTempUpdate.bind(this))

    // Set up the adaptive lighting controller if available
    if (
      platform.api.versionGreaterOrEqual &&
      platform.api.versionGreaterOrEqual('1.3.0')
    ) {
      this.alController = new platform.api.hap.AdaptiveLightingController(this.service, {
        customTemperatureAdjustment: this.alShift
      })
      this.accessory.configureController(this.alController)
    }

    // Output the customised options to the log if in debug mode
    if (this.debug) {
      const opts = JSON.stringify({
        adaptiveLightingShift: '+' + this.alShift,
        brightnessStep: this.brightStep,
        disableDeviceLogging: this.disableDeviceLogging,
        exposeScenes: this.exposeScenes
      })
      this.log('[%s] %s %s.', this.name, this.messages.devInitOpts, opts)
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

      // Await slightly longer than brightness and colour so on/off is sent last
      await this.funcs.sleep(500)

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
      await this.funcs.sleep(400)
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
      await this.funcs.sleep(300)
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
      const k = Math.round(1000000 / value)
      const rgb = this.colourUtils.k2rgb(k)
      const hs = this.colourUtils.m2hs(value)
      const rgbIsSame = rgb[0] === this.cacheR &&
        rgb[1] === this.cacheG &&
        rgb[2] === this.cacheB

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
      await this.funcs.sleep(300)
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
          r: rgb[0],
          g: rgb[1],
          b: rgb[2]
        }
      })

      // Cache the new state and log if appropriate
      this.cacheR = rgb[0]
      this.cacheG = rgb[1]
      this.cacheB = rgb[2]
      if (!this.disableDeviceLogging) {
        if (this.alController && this.alController.isAdaptiveLightingActive()) {
          this.log('[%s] %s [%sK / %sM].', this.name, this.messages.curCCTAL, k, value)
        } else {
          this.log('[%s] %s [%sK / %sM].', this.name, this.messages.curCCT, k, value)
        }
      }
    } catch (err) {
      // Catch any errors during the process
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  internalSceneUpdate (value, callback, scene) {
    try {
      callback()

      // Turn all other scene services off as can only have one on at a time
      this.accessory.services.filter(s => s.displayName && s.displayName !== scene)
        .forEach(service => {
          service.updateCharacteristic(this.hapChar.On, false)
        })

      // Turn on the main lightbulb service to show the light is on with this scene
      if (value) {
        this.service.updateCharacteristic(this.hapChar.On, true)
      }

      // Unsure if turning a scene off will turn the main light off too?
      /*
      if (!value) {
        this.service.updateCharacteristic(this.hapChar.On, false)
      }
      */

      // Here we will put the request to Govee to set this scene somehow

      // Log whilst under production (todo, debug only)
      this.log(
        '[%s] current scene [%s].',
        this.name,
        value ? scene : 'none'
      )
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

        if (this.firstUpdateDone) {
          // Log the change if appropriate
          if (!this.disableDeviceLogging) {
            this.log(
              '[%s] %s [rgb %s %s %s].',
              this.name,
              this.messages.curColour,
              this.cacheR,
              this.cacheG,
              this.cacheB
            )
          }

          // If the difference is significant (>50) then disable adaptive lighting
          if (
            this.alController &&
            this.alController.isAdaptiveLightingActive() &&
            rgbDiff > 50
          ) {
            this.alController.disableAdaptiveLighting()
            this.log('[%s] %s.', this.name, this.messages.alDisabled)
          }
        }
      }
    }

    // Update the variable that the first run has completed
    this.firstUpdateDone = true
  }
}

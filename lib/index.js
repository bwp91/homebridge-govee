/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

// Retrieve necessary fields from the package.json file
const PLUGIN = require('./../package.json')

// Create the platform class
class GoveePlatform {
  constructor (log, config, api) {
    // Don't load the plugin if these aren't accessible for any reason
    if (!log || !api) {
      return
    }

    // Retrieve the necessary constants and functions before starting
    this.consts = require('./utils/constants')
    this.messages = this.consts.messages
    this.funcs = require('./utils/functions')

    // Begin plugin initialisation
    try {
      // Check the user has configured the plugin
      if (!config || !config.apiKey) {
        throw new Error(this.messages.apiKeyMissing)
      }

      // Initialise these variables before anything else
      this.log = log
      this.api = api

      // Apply the user's configuration
      this.config = this.consts.defaultConfig
      this.applyUserConfig(config)

      // Create further variables needed by the plugin
      this.devicesInHB = new Map()
      this.devicesInGV = new Map()

      // Setup the Homebridge events
      this.api.on('didFinishLaunching', this.pluginSetup.bind(this))
      this.api.on('shutdown', this.pluginShutdown.bind(this))
    } catch (err) {
      // Catch any errors during initialisation
      const eText = err.message === this.messages.apiKeyMissing
        ? err.message
        : this.funcs.parseError(err)
      log.warn('***** %s [v%s]. *****', this.messages.disabling, PLUGIN.version)
      log.warn('***** %s. *****', eText)
    }
  }

  applyUserConfig (config) {
    // These shorthand functions save line space during config parsing
    const logDefault = (key, def) => {
      this.log.warn('%s [%s] %s %s.', this.messages.cfgItem, key, this.messages.cfgDef, def)
    }
    const logIgnore = key => {
      this.log.warn('%s [%s] %s.', this.messages.cfgItem, key, this.messages.cfgIgn)
    }
    const logIncrease = (key, min) => {
      this.log.warn('%s [%s] %s %s.', this.messages.cfgItem, key, this.messages.cfgLow, min)
    }
    const logQuotes = key => {
      this.log.warn('%s [%s] %s.', this.messages.cfgItem, key, this.messages.cfgQts)
    }
    const logRemove = key => {
      this.log.warn('%s [%s] %s.', this.messages.cfgItem, key, this.messages.cfgRmv)
    }

    // Begin applying the user's config
    for (const [key, val] of Object.entries(config)) {
      switch (key) {
        case 'apiKey':
          if (typeof val !== 'string' || val === '') {
            throw new Error(this.messages.apiKeyMissing)
          }
          this.config.apiKey = val.toLowerCase().replace(/[^a-z0-9-]+/g, '')
          break
        case 'debug':
        case 'disableDeviceLogging':
        case 'disablePlugin':
          if (typeof val === 'string') {
            logQuotes(key)
          }
          this.config[key] = val === 'false' ? false : !!val
          break
        case 'ignoredDevices': {
          if (Array.isArray(val)) {
            if (val.length > 0) {
              val.forEach(serialNumber => {
                this.config.ignoredDevices.push(
                  serialNumber.toString().toUpperCase().replace(/[\s'"]+/g, '')
                )
              })
            } else {
              logRemove(key)
            }
          } else {
            logIgnore(key)
          }
          break
        }
        case 'name':
        case 'platform':
          break
        case 'refreshTime': {
          if (typeof val === 'string') {
            logQuotes(key)
          }
          const intVal = parseInt(val)
          if (isNaN(intVal)) {
            logDefault(key, this.consts.defaultValues[key])
            this.config[key] = this.consts.defaultValues[key]
          } else if (intVal < this.consts.minValues[key]) {
            logIncrease(key, this.consts.minValues[key])
            this.config[key] = this.consts.minValues[key]
          } else {
            this.config[key] = intVal
          }
          break
        }
        default:
          logRemove(key)
          break
      }
    }
  }

  async pluginSetup () {
    // Plugin has finished initialising to now onto setup
    try {
      // If the user has disabled the plugin then remove all accessories
      if (this.config.disablePlugin) {
        this.devicesInHB.forEach(accessory => {
          this.removeAccessory(accessory)
        })
        throw new Error(this.messages.disabled)
      }

      // Log that the plugin initialisation has been successful
      this.log('[v%s] %s.', PLUGIN.version, this.messages.initialised)

      // Require any libraries that the plugin uses
      this.colourUtils = require('./utils/colour-utils')
      this.httpClient = new (require('./connection/http'))(this)

      // The request below is designed to check the API key given is correct
      await this.httpClient.getDevices()

      // Perform the initial sync and setup the interval for further syncs
      await this.goveeSync()
      this.refreshInterval = setInterval(
        () => this.goveeSync(),
        this.config.refreshTime * 1000
      )

      // Log that the plugin setup has been successful with a welcome message
      const randIndex = Math.floor(Math.random() * this.consts.welcomeMessages.length)
      this.log('%s. %s', this.messages.complete, this.consts.welcomeMessages[randIndex])
    } catch (err) {
      // Catch any errors during setup
      const eText = err.message.includes('401')
        ? this.messages.invalidApiKey
        : this.funcs.parseError(err)
      this.log.warn('***** %s [v%s]. *****', this.messages.disabling, PLUGIN.version)
      this.log.warn('***** %s. *****', eText)
      this.pluginShutdown()
    }
  }

  pluginShutdown () {
    // A function that is called when the plugin fails to load or Homebridge restarts
    try {
      // Stop the refresh interval
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval)
      }
    } catch (err) {
      // No need to show errors at this point
    }
  }

  async goveeSync () {
    try {
      // Obtain a device list from Govee
      const deviceList = await this.httpClient.getDevices()

      // Check the request for device list was successful
      if (!Array.isArray(deviceList)) {
        throw new Error(this.messages.deviceListFail)
      }

      // Set each device into our global Govee device list variable
      deviceList.forEach(device => {
        this.devicesInGV.set(device.device, device)
      })

      // SYNC PART ONE
      // Initialise each Govee device into Homebridge
      this.devicesInGV.forEach(device => {
        try {
          // Get the correct device type instance for the device
          let instance
          if (this.consts.modelsRGB.includes(device.model)) {
            // Device is an LED strip/bulb
            instance = 'light-colour'
          } else if (this.consts.modelsSwitch.includes(device.model)) {
            // Device is a wifi switch
            instance = 'switch'
          } else {
            // Device is not in the supported models list
            return
          }

          // Get the cached accessory or add to Homebridge if doesn't exist
          const accessory = this.devicesInHB.has(device.device)
            ? this.devicesInHB.get(device.device)
            : this.addAccessory(device)

          // Final check the accessory now exists in Homebridge
          if (!accessory) {
            throw new Error(this.messages.accNotFound)
          }

          // Save context information for the plugin to use
          accessory.context.controllable = device.controllable
          accessory.context.retrievable = device.retrievable
          accessory.context.supportedCmds = device.supportCmds

          // Create the device instance if it doesn't already exist
          if (!accessory.control) {
            accessory.control = new (require('./device/' + instance))(this, accessory)
          }

          // Log the device initialisation on the first sync run
          if (!this.firstRunDone) {
            const name = accessory.displayName
            this.log('[%s] %s %s.', name, this.messages.devInit, device.device)
          }

          // Update any changes to the accessory to the platform
          this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
          this.devicesInHB.set(device.device, accessory)
        } catch (e) {
          // Catch any errors during device initialisation
          const eText = this.funcs.parseError(e)
          this.log.warn('[%s] %s %s.', device.deviceName, this.messages.devNotInit, eText)
        }
      })

      // SYNC PART TWO
      // Check each Homebridge accessory exists in Govee and refresh its state
      this.devicesInHB.forEach(async accessory => {
        try {
          // If the accessory doesn't exist in Govee then remove it
          if (!this.devicesInGV.has(accessory.context.gvDeviceId)) {
            this.removeAccessory(accessory)
            return
          }

          // Check the device status can be retrieved from Govee
          if (!accessory.context.retrievable) {
            throw new Error(this.messages.devNotRetrievable)
          }

          // Retrieve the current accessory state from Govee
          const res = await this.httpClient.getDevice(accessory.context)

          // Use the accessory type instance to update the accessory's state
          accessory.control.externalUpdate(Object.assign({}, ...res))
        } catch (e) {
          // Catch any errors during accessory state refresh
          const name = accessory.displayName
          const eText = this.funcs.parseError(e)
          this.log.warn('[%s] %s %s.', name, this.messages.devNotRef, eText)
        }
      })
    } catch (err) {
      // Catch any errors during sync process
      const eText = this.funcs.parseError(err)
      this.log.warn('%s %s.', this.messages.syncFailed, eText)
    }
    this.firstRunDone = true
  }

  addAccessory (device) {
    // Add an accessory to Homebridge
    try {
      const uuid = this.api.hap.uuid.generate(device.device)
      const accessory = new this.api.platformAccessory(device.deviceName, uuid)
      accessory.getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, this.messages.brand)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true)
      accessory.on('identify', (paired, callback) => {
        callback()
        this.log('[%s] %s.', accessory.displayName, this.messages.identify)
      })
      accessory.context.gvDeviceId = device.device
      accessory.context.gvModel = device.model
      this.api.registerPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.set(device.device, accessory)
      this.log('[%s] %s.', device.deviceName, this.messages.devAdd)
      return accessory
    } catch (err) {
      // Catch any errors during add
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', device.deviceName, this.messages.devNotAdd, eText)
    }
  }

  configureAccessory (accessory) {
    // Function is called to retrieve each accessory from the cache on startup
    try {
      if (!this.log) {
        return
      }
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory)
    } catch (err) {
      // Catch any errors during retrieve
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', accessory.displayName, this.messages.devNotConf, eText)
    }
  }

  removeAccessory (accessory) {
    // Remove an accessory from Homebridge
    try {
      this.api.unregisterPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.delete(accessory.context.gvDeviceId)
      this.log('[%s] %s.', accessory.displayName, this.messages.devRemove)
    } catch (err) {
      // Catch any errors during remove
      const eText = this.funcs.parseError(err)
      const name = accessory.displayName
      this.log.warn('[%s] %s %s.', name, this.messages.devNotRemove, eText)
    }
  }
}

// Export the plugin to Homebridge
module.exports = hb => hb.registerPlatform(PLUGIN.alias, GoveePlatform)

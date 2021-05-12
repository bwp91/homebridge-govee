/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

// Packages and constant variables for this class
const devicesInHB = new Map()
const plugin = require('./../package.json')

// Variables for this class to use later
let httpClient

// Create the platform class
class GoveePlatform {
  constructor (log, config, api) {
    // Don't load the plugin if these aren't accessible for any reason
    if (!log || !api) {
      return
    }

    // Begin plugin initialisation
    try {
      this.api = api
      this.consts = require('./utils/constants')
      this.funcs = require('./utils/functions')
      this.log = log

      // Configuration objects for accessories
      this.lightDevices = {}
      this.switchDevices = {}

      // Retrieve the user's chosen language file
      this.lang = require('./utils/lang-en')

      // Make sure user is running Homebridge v1.3 or above
      if (!api.versionGreaterOrEqual || !api.versionGreaterOrEqual('1.3.0')) {
        throw new Error(this.lang.hbVersionFail)
      }

      // Check the user has configured the plugin
      if (!config || !config.apiKey) {
        throw new Error(this.lang.apiKeyMissing)
      }

      // Apply the user's configuration
      this.config = this.consts.defaultConfig
      this.applyUserConfig(config)

      // Set up the Homebridge events
      this.api.on('didFinishLaunching', this.pluginSetup.bind(this))
      this.api.on('shutdown', this.pluginShutdown.bind(this))
    } catch (err) {
      // Catch any errors during initialisation
      const hideErrLines = [this.lang.hbVersionFail, this.lang.apiKeyMissing]
      const eText = hideErrLines.includes(err.message) ? err.message : this.funcs.parseError(err)
      log.warn('***** %s [v%s]. *****', this.lang.disabling, plugin.version)
      log.warn('***** %s. *****', eText)
    }
  }

  applyUserConfig (config) {
    // These shorthand functions save line space during config parsing
    const logDefault = (k, def) => {
      this.log.warn('%s [%s] %s %s.', this.lang.cfgItem, k, this.lang.cfgDef, def)
    }
    const logIgnore = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgIgn)
    }
    const logIgnoreItem = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgIgnItem)
    }
    const logIncrease = (k, min) => {
      this.log.warn('%s [%s] %s %s.', this.lang.cfgItem, k, this.lang.cfgLow, min)
    }
    const logQuotes = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgQts)
    }
    const logRemove = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgRmv)
    }

    // Begin applying the user's config
    for (const [key, val] of Object.entries(config)) {
      switch (key) {
        case 'apiKey':
          if (typeof val !== 'string' || val === '') {
            throw new Error(this.lang.apiKeyMissing)
          }
          this.config.apiKey = val.toLowerCase().replace(/[^a-z0-9-]+/g, '')
          break
        case 'controlInterval':
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
        case 'debug':
        case 'debugFakegato':
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
              val.forEach(deviceId => {
                this.config.ignoredDevices.push(this.funcs.parseDeviceId(deviceId))
              })
            } else {
              logRemove(key)
            }
          } else {
            logIgnore(key)
          }
          break
        }
        case 'lightDevices':
        case 'switchDevices':
          if (Array.isArray(val) && val.length > 0) {
            val.forEach(x => {
              if (!x.deviceId) {
                logIgnoreItem(key)
                return
              }
              const id = this.funcs.parseDeviceId(x.deviceId)
              const entries = Object.entries(x)
              if (entries.length === 1) {
                logRemove(key + '.' + id)
                return
              }
              this[key][id] = {}
              for (const [k, v] of entries) {
                if (!this.consts.allowed[key].includes(k)) {
                  logRemove(key + '.' + id + '.' + k)
                  continue
                }
                switch (k) {
                  case 'adaptiveLightingShift':
                  case 'brightnessStep': {
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + k)
                    }
                    const intVal = parseInt(v)
                    if (isNaN(intVal)) {
                      logDefault(key + '.' + id + '.' + k, this.consts.defaultValues[k])
                      this[key][id][k] = this.consts.defaultValues[k]
                    } else if (intVal < this.consts.minValues[k]) {
                      logIncrease(key + '.' + id + '.' + k, this.consts.minValues[k])
                      this[key][id][k] = this.consts.minValues[k]
                    } else {
                      this[key][id][k] = intVal
                    }
                    break
                  }
                  case 'deviceId':
                  case 'label':
                    break
                  case 'overrideDisabledLogging':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this[key][id][k] = v === 'false' ? false : !!v
                    break
                }
              }
            })
          } else {
            logIgnore(key)
          }
          break
        case 'name':
        case 'platform':
        case 'plugin_map':
          break
        default:
          logRemove(key)
          break
      }
    }
  }

  async pluginSetup () {
    // Plugin has finished initialising so now onto setup
    try {
      // If the user has disabled the plugin then remove all accessories
      if (this.config.disablePlugin) {
        devicesInHB.forEach(accessory => {
          this.removeAccessory(accessory)
        })
        throw new Error(this.lang.disabled)
      }

      // Log that the plugin initialisation has been successful
      this.log('[v%s] %s.', plugin.version, this.lang.initialised)

      // Require any libraries that the plugin uses
      this.colourUtils = require('./utils/colour-utils')
      this.eveService = require('./fakegato/fakegato-history')(this.api)
      // this.cusChar = new (require('./utils/custom-chars'))(this.api)
      httpClient = new (require('./connection/http'))(this)

      // The request below is designed to check the API key given is correct
      const checkApiKey = async () => {
        try {
          await httpClient.getDevices()
        } catch (e) {
          // Aim is to retry the request if it's an error that could go away with time
          if (this.funcs.isGoveeError(e)) {
            // Log the warning
            this.log.warn('%s.', this.lang.goveeInitErr)

            // Wait for 30 seconds before retrying
            await this.funcs.sleep(30000)

            // Try the request again
            return await checkApiKey()
          }

          // If it's not an error that could be fixed with time then disable the plugin
          throw e
        }
      }
      await checkApiKey()
      this.hideLogTimeout = false
      this.firstRunDone = false

      // Perform the initial sync and setup the interval for further syncs
      await this.goveeSync()
      this.refreshInterval = setInterval(() => this.goveeSync(), this.config.refreshTime * 1000)

      // Log that the plugin setup has been successful with a welcome message
      const randIndex = Math.floor(Math.random() * this.lang.zWelcome.length)
      this.log('%s. %s', this.lang.complete, this.lang.zWelcome[randIndex])
    } catch (err) {
      // Catch any errors during setup
      const eText = err.message.includes('401')
        ? this.lang.invalidApiKey
        : err.message === this.lang.disabled
        ? err.message
        : this.funcs.parseError(err)
      this.log.warn('***** %s [v%s]. *****', this.lang.disabling, plugin.version)
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
      // Skip the sync if the client is busy sending updates to Govee
      if (httpClient.isBusy()) {
        if (this.config.debug) {
          this.log('%s.', this.lang.clientBusy)
        }
        return
      }

      // Obtain a device list from Govee
      const deviceList = await httpClient.getDevices()

      // Check the request for device list was successful
      if (!Array.isArray(deviceList)) {
        throw new Error(this.lang.deviceListFail)
      }

      // SYNC PART ONE
      // Initialise each Govee device into Homebridge
      deviceList.forEach(device => {
        try {
          // Get the correct device type instance for the device
          let instance
          if (this.consts.models.rgb.includes(device.model)) {
            // Device is an LED strip/bulb
            instance = 'light-colour'
          } else if (this.consts.models.switch.includes(device.model)) {
            // Device is a wifi switch
            instance = 'switch'
          } else {
            // Device is not in the supported models list
            if (!this.firstRunDone) {
              this.log.warn('[%s] %s.', device.deviceName, this.lang.couldSupport)
            }
            return
          }

          // Get the cached accessory or add to Homebridge if doesn't exist
          const uuid = this.api.hap.uuid.generate(device.device)
          const accessory = devicesInHB.get(uuid) || this.addAccessory(device)

          // Final check the accessory now exists in Homebridge
          if (!accessory) {
            throw new Error(this.lang.accNotFound)
          }

          // Finish here if the device is already initialised and HB has control
          if (accessory.control) {
            return
          }

          if (device.properties && device.properties.colorTem && device.properties.colorTem.range) {
            accessory.context.minKelvin = device.properties.colorTem.range.min
            accessory.context.maxKelvin = device.properties.colorTem.range.max
          }

          // Create the instance for this device type
          accessory.control = new (require('./device/' + instance))(this, accessory)

          // Log the device initialisation
          this.log('[%s] %s %s.', accessory.displayName, this.lang.devInit, device.device)

          // Update any changes to the accessory to the platform
          this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory])
          devicesInHB.set(accessory.UUID, accessory)
        } catch (e) {
          // Catch any errors during device initialisation
          const eText = this.funcs.parseError(e)
          this.log.warn('[%s] %s %s.', device.deviceName, this.lang.devNotInit, eText)
        }
      })

      // SYNC PART TWO
      // Check each Homebridge accessory exists in Govee and refresh its state
      devicesInHB.forEach(async accessory => {
        try {
          // If the accessory doesn't exist in Govee then remove it
          if (!deviceList.some(el => el.device === accessory.context.gvDeviceId)) {
            this.removeAccessory(accessory)
            return
          }

          // Retrieve the current accessory state from Govee
          const res = await httpClient.getDevice(accessory.context)

          // Use the accessory type instance to update the accessory's state
          if (accessory.control && accessory.control.externalUpdate) {
            accessory.control.externalUpdate(Object.assign({}, ...res))
          }
        } catch (e) {
          // Catch any errors during accessory state refresh
          // 400 response is normal when a device's state is not retrievable - log in debug mode
          if (e.message.includes('400')) {
            if (this.config.debug) {
              this.log.warn('[%s] %s.', accessory.displayName, this.lang.devNotRet)
            }
            return
          }

          // Response is not 400 so check to see if it's a different standard govee error
          let eText
          if (this.funcs.isGoveeError(e)) {
            if (this.hideLogTimeout) {
              return
            }
            this.hideLogTimeout = true
            setTimeout(() => (this.hideLogTimeout = false), 60000)
            eText = this.lang.goveeErr
          } else {
            eText = this.funcs.parseError(e)
          }
          this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotRef, eText)
        }
      })

      // Flag the first run done to true to avoid any duplicate logging
      if (!this.firstRunDone) {
        this.firstRunDone = true
      }
    } catch (err) {
      // Catch any errors during sync process
      let eText
      if (this.funcs.isGoveeError(err)) {
        if (this.hideLogTimeout) {
          return
        }
        this.hideLogTimeout = true
        setTimeout(() => (this.hideLogTimeout = false), 60000)
        eText = this.lang.goveeErr
      } else {
        eText = this.funcs.parseError(err)
      }
      this.log.warn('%s %s.', this.lang.syncFailed, eText)
    }
  }

  addAccessory (device) {
    // Add an accessory to Homebridge
    try {
      const uuid = this.api.hap.uuid.generate(device.device)
      const accessory = new this.api.platformAccessory(device.deviceName, uuid)
      accessory
        .getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, this.lang.brand)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true)
      accessory.context.gvDeviceId = device.device
      accessory.context.gvModel = device.model
      accessory.context.supportedCmds = device.supportCmds
      this.api.registerPlatformAccessories(plugin.name, plugin.alias, [accessory])
      this.configureAccessory(accessory)
      this.log('[%s] %s.', device.deviceName, this.lang.devAdd)
      return accessory
    } catch (err) {
      // Catch any errors during add
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', device.deviceName, this.lang.devNotAdd, eText)
    }
  }

  configureAccessory (accessory) {
    // Function is called to retrieve each accessory from the cache on startup
    try {
      if (!this.log) {
        return
      }
      accessory.on('identify', (paired, callback) => {
        callback()
        this.log('[%s] %s.', accessory.displayName, this.lang.identify)
      })
      devicesInHB.set(accessory.UUID, accessory)
    } catch (err) {
      // Catch any errors during retrieve
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotConf, eText)
    }
  }

  removeAccessory (accessory) {
    // Remove an accessory from Homebridge
    try {
      this.api.unregisterPlatformAccessories(plugin.name, plugin.alias, [accessory])
      devicesInHB.delete(accessory.UUID)
      this.log('[%s] %s.', accessory.displayName, this.lang.devRemove)
    } catch (err) {
      // Catch any errors during remove
      const eText = this.funcs.parseError(err)
      const name = accessory.displayName
      this.log.warn('[%s] %s %s.', name, this.lang.devNotRemove, eText)
    }
  }

  async sendDeviceUpdate (accessory, params) {
    await httpClient.updateDevice(accessory, params)
  }

  updateAccessoryStatus (accessory, newStatus) {
    // Log the change, at a warning level if the device is reported offline
    if (newStatus) {
      this.log('[%s] %s.', accessory.displayName, this.lang.online)
    } else {
      this.log.warn('[%s] %s.', accessory.displayName, this.lang.offline)
    }

    // Update the context item for the plugin UI
    accessory.context.online = newStatus

    // Update any changes to the accessory to the platform
    this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory])
    devicesInHB.set(accessory.UUID, accessory)
  }
}

// Export the plugin to Homebridge
module.exports = hb => hb.registerPlatform(plugin.alias, GoveePlatform)

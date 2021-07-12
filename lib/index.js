/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

// Packages and constant variables for this class
const devicesInHB = new Map()
const apiDevices = []
const bleDevices = {}
const httpDevices = []
const plugin = require('./../package.json')

// Variables for this class to use later
let apiClient
let httpClient

// See if the bluetooth client is available
let btClient
try {
  btClient = require('@abandonware/noble')
} catch (err) {
  btClient = false
}

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
      this.deviceConf = {}
      this.ignoredDevices = []

      // Retrieve the user's chosen language file
      this.lang = require('./utils/lang-en')

      // Make sure user is running Homebridge v1.3 or above
      if (!api.versionGreaterOrEqual || !api.versionGreaterOrEqual('1.3.0')) {
        throw new Error(this.lang.hbVersionFail)
      }

      // Check the user has configured the plugin
      if (!config) {
        throw new Error(this.lang.pluginNotConf)
      }

      // Log some environment info for debugging
      this.log(
        '%s v%s | Node %s | HB v%s%s...',
        this.lang.initialising,
        plugin.version,
        process.version,
        api.serverVersion,
        config.plugin_map
          ? ' | HOOBS v3'
          : require('os')
              .hostname()
              .includes('hoobs')
          ? ' | HOOBS v4'
          : ''
      )

      // Apply the user's configuration
      this.config = this.consts.defaultConfig
      this.applyUserConfig(config)

      // Set up the Homebridge events
      this.api.on('didFinishLaunching', () => this.pluginSetup())
      this.api.on('shutdown', () => this.pluginShutdown())
    } catch (err) {
      // Catch any errors during initialisation
      const hideErrLines = [this.lang.hbVersionFail, this.lang.pluginNotConf]
      const eText = hideErrLines.includes(err.message) ? err.message : this.funcs.parseError(err)
      log.warn('***** %s. *****', this.lang.disabling)
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
        case 'password':
        case 'username':
          if (typeof val !== 'string' || val === '') {
            logIgnore(key)
          } else {
            if (key === 'apiKey') {
              this.config[key] = val.toLowerCase().replace(/[^a-z0-9-]+/g, '')
            } else {
              this.config[key] = val
            }
          }
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
              this.deviceConf[id] = {}
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
                      this.deviceConf[id][k] = this.consts.defaultValues[k]
                    } else if (intVal < this.consts.minValues[k]) {
                      logIncrease(key + '.' + id + '.' + k, this.consts.minValues[k])
                      this.deviceConf[id][k] = this.consts.minValues[k]
                    } else {
                      this.deviceConf[id][k] = intVal
                    }
                    break
                  }
                  case 'deviceId':
                  case 'label':
                    break
                  case 'enableBT':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this.deviceConf[id][k] = v === 'false' ? false : !!val
                    bleDevices[id.substring(6).toLowerCase()] = id
                    break
                  case 'ignoreDevice':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    if (!!v && v !== 'false') {
                      this.ignoredDevices.push(id)
                    }
                    break
                  case 'overrideLogging':
                  case 'showAs': {
                    const inSet = this.consts.allowed[k].includes(v)
                    if (typeof v !== 'string' || !inSet) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.deviceConf[id][k] = inSet ? v : this.consts.defaultValues[k]
                    }
                    break
                  }
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
        devicesInHB.forEach(accessory => this.removeAccessory(accessory))
        throw new Error(this.lang.disabled)
      }

      // Log that the plugin initialisation has been successful
      this.log('%s.', this.lang.initialised)

      // Require any libraries that the plugin uses
      this.colourUtils = require('./utils/colour-utils')
      this.cusChar = new (require('./utils/custom-chars'))(this.api)
      this.eveService = require('./fakegato/fakegato-history')(this.api)

      // Setup the HTTP client if Govee username and password have been provided
      try {
        if (!this.config.username || !this.config.password) {
          throw new Error(this.lang.noCreds)
        }
        httpClient = new (require('./connection/http'))(this)
        const devices = await httpClient.getDevices()
        if (!Array.isArray(devices)) {
          throw new Error(this.lang.noDevList)
        }
        devices.forEach(device => httpDevices.push(device))
      } catch (err) {
        const eText = this.funcs.parseError(err)
        this.log.warn('%s %s.', this.lang.disableHTTP, eText)
      }

      // Setup the API client if Govee API token has been provided
      try {
        if (!this.config.apiKey) {
          throw new Error(this.lang.noAPIKey)
        }
        apiClient = new (require('./connection/api'))(this)
        const devices = await apiClient.getDevices()
        if (!Array.isArray(devices)) {
          throw new Error(this.lang.noDevList)
        }
        devices.forEach(device => apiDevices.push(device))
      } catch (err) {
        const eText = err.message.includes('401')
          ? this.lang.invalidApiKey
          : this.funcs.parseError(err)
        this.log.warn('%s %s.', this.lang.disableAPI, eText)
        apiClient = false
      }

      // Initialise the devices
      if (httpDevices && httpDevices.length > 0) {
        httpDevices.forEach(device => {
          const apiDevice = apiDevices.find(el => el.device === device.device)
          if (apiDevice) {
            apiDevice.httpInfo = device
            this.initialiseDevice(apiDevice)
          } else {
            // Does this have an entry in the config for bluetooth only support
            if (this.funcs.hasProperty(this.deviceConf, device.device)) {
              const btDevice = this.deviceConf[device.device]
              if (btDevice.enableBT) {
                btDevice.device = device.device
                btDevice.deviceName = device.deviceName
                btDevice.model = device.sku
                btDevice.httpInfo = device
                this.initialiseDevice(btDevice)
              } else {
                this.log('[%s] [%s] - %s.', device.deviceName, device.device, this.lang.noBT)
              }
            } else {
              this.log('[%s] [%s] - %s.', device.deviceName, device.device, this.lang.notSupported)
            }
          }
        })
      } else if (apiDevices && apiDevices.length > 0) {
        apiDevices.forEach(apiDevice => this.initialiseDevice(apiDevice))
      } else {
        throw new Error(this.lang.noDevs)
      }

      // Check for redundant Homebridge accessories
      devicesInHB.forEach(async accessory => {
        // If the accessory doesn't exist in Govee then remove it
        if (
          !httpDevices.some(el => el.device === accessory.context.gvDeviceId) &&
          !apiDevices.some(el => el.device === accessory.context.gvDeviceId)
        ) {
          this.removeAccessory(accessory)
        }
      })

      // Perform a scan for bluetooth devices
      if (btClient && Object.keys(bleDevices).length > 0) {
        btClient.on('discover', async device => {
          if (!Object.keys(bleDevices).includes(device.address)) {
            return
          }
          const accessory = devicesInHB.get(this.api.hap.uuid.generate(bleDevices[device.address]))
          if (!accessory) {
            return
          }
          accessory.btControl = new (require('./connection/ble'))(this, accessory, device)
          accessory.context.onlineBT = true
          this.log('[%s] %s.', accessory.displayName, this.lang.btFound)
          this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory])
          devicesInHB.set(accessory.UUID, accessory)
        })

        process.nextTick(async () => {
          try {
            this.log('%s', this.lang.btStart)
            await btClient.startScanningAsync()
            await this.funcs.sleep(5000)
            this.log('%s', this.lang.btStop)
            btClient.stopScanning()
          } catch (err) {
            const eText = err.message.includes('ENODEV')
              ? '[ENODEV] ' + this.lang.noBTAdapter
              : this.funcs.parseError(err)
            this.log.warn('%s %s.', this.lang.disableBT, eText)
          }
        })
      } else {
        this.log.warn('%s %s.', this.lang.disableBT, this.lang.btNotAvailable)
      }

      // Perform the initial sync and setup the interval for further syncs
      if (apiClient) {
        await this.goveeSync()
        this.refreshInterval = setInterval(() => this.goveeSync(), this.config.refreshTime * 1000)
      }

      // Log that the plugin setup has been successful with a welcome message
      const randIndex = Math.floor(Math.random() * this.lang.zWelcome.length)
      this.log('%s. %s', this.lang.complete, this.lang.zWelcome[randIndex])
    } catch (err) {
      // Catch any errors during setup
      const eText = err.message === this.lang.disabled ? err.message : this.funcs.parseError(err)
      this.log.warn('***** %s. *****', this.lang.disabling)
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

  initialiseDevice (device) {
    // Get the correct device type instance for the device
    try {
      let instance
      let isAPIDevice
      if (this.consts.models.rgb.includes(device.model)) {
        // Device is an API enabled wifi LED strip/bulb
        instance = 'light-colour'
        isAPIDevice = true
      } else if (this.consts.models.rgbBT.includes(device.model)) {
        // Device is a bluetooth-only LED strip/bulb
        instance = 'light-colour-bt'
        isAPIDevice = false
      } else if (this.consts.models.switch.includes(device.model)) {
        // Device is an API enabled wifi switch
        instance =
          this.switchDevices[device.device] && this.switchDevices[device.device].showAs
            ? this.switchDevices[device.device].showAs
            : this.consts.defaultValues.showAs
        if (instance === 'default') {
          instance = 'outlet'
        }
        isAPIDevice = true
      } else {
        // Device is not in any supported model list
        this.log.warn('[%s] [%s] %s.', device.deviceName, device.device, this.lang.notSupported)
        return
      }

      // Get the cached accessory or add to Homebridge if doesn't exist
      const uuid = this.api.hap.uuid.generate(device.device)
      const accessory = devicesInHB.get(uuid) || this.addAccessory(device)
      const deviceConf = this.deviceConf[device.device]

      // Final check the accessory now exists in Homebridge
      if (!accessory) {
        throw new Error(this.lang.accNotFound)
      }

      // Set the logging level for this device
      accessory.context.enableLogging = !this.config.disableDeviceLogging
      accessory.context.enableDebugLogging = this.config.debug
      if (deviceConf && deviceConf.overrideLogging) {
        switch (deviceConf.overrideLogging) {
          case 'standard':
            accessory.context.enableLogging = true
            accessory.context.enableDebugLogging = false
            break
          case 'debug':
            accessory.context.enableLogging = true
            accessory.context.enableDebugLogging = true
            break
          case 'disable':
            accessory.context.enableLogging = false
            accessory.context.enableDebugLogging = false
            break
        }
      }

      // Get a kelvin range if provided
      if (device.properties && device.properties.colorTem && device.properties.colorTem.range) {
        accessory.context.minKelvin = device.properties.colorTem.range.min
        accessory.context.maxKelvin = device.properties.colorTem.range.max
      }

      // Get a supported command list if provided
      if (device.supportCmds) {
        accessory.context.supportedCmds = device.supportCmds
      }

      // See if we have extra HTTP client info for this device
      if (device.httpInfo) {
        accessory.context.firmware = device.httpInfo.versionSoft
        accessory.context.hardware = device.httpInfo.versionHard
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.extResources) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.extResources)
          if (parsed && parsed.skuUrl) {
            accessory.context.image = parsed.skuUrl
          }
        }
        accessory.context.bluetooth = true
        accessory.context.onlineBT = false
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.deviceSettings) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.deviceSettings)
          if (parsed && parsed.bleName) {
            accessory.context.isBluetooth = parsed.bleName
          }
        }
      } else {
        accessory.context.firmware = false
        accessory.context.hardware = false
        accessory.context.image = false
        accessory.context.bluetooth = false
        accessory.context.isBluetooth = false
      }

      // Create the instance for this device type
      accessory.context.isAPIDevice = isAPIDevice
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
  }

  async goveeSync () {
    devicesInHB.forEach(async accessory => {
      try {
        if (accessory.context.isAPIDevice) {
          // Skip the sync if the client is busy sending updates to Govee
          if (apiClient.isBusy()) {
            if (this.config.debug) {
              this.log('%s.', this.lang.clientBusy)
            }
            return
          }

          // Retrieve the current accessory state from Govee
          const res = await apiClient.getDevice(accessory.context)

          // Use the accessory type instance to update the accessory's state
          if (accessory.control && accessory.control.externalUpdate) {
            accessory.control.externalUpdate(Object.assign({}, ...res))
          }
        }
      } catch (e) {
        // Catch any errors during accessory state refresh
        // 400 response is normal when a device's state is not retrievable - log in debug mode
        if (e.message.includes('400')) {
          if (accessory.context.enableDebugLogging) {
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
        if (accessory.context.enableDebugLogging) {
          this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotRef, eText)
        }
      }
    })
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

      // Set the correct firmware version if we can
      if (this.api && accessory.context.firmware) {
        accessory
          .getService(this.api.hap.Service.AccessoryInformation)
          .updateCharacteristic(
            this.api.hap.Characteristic.FirmwareRevision,
            accessory.context.firmware
          )
      }

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
    try {
      if (accessory.btControl) {
        // Try sending the command over bluetooth
        await accessory.btControl.updateDevice(params)
      } else {
        throw new Error(this.lang.notAvailable)
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      if (accessory.context.isAPIDevice) {
        if (accessory.btControl && accessory.context.enableDebugLogging) {
          this.log('[%s] %s %s.', accessory.displayName, this.lang.notBTSent, eText)
        }
        await apiClient.updateDevice(accessory, params)
      } else {
        throw err
      }
    }
  }

  updateAccessoryAPIStatus (accessory, newStatus) {
    // Log the change, at a warning level if the device is reported offline
    if (accessory.context.enableLogging) {
      if (newStatus) {
        this.log('[%s] %s.', accessory.displayName, this.lang.onlineAPI)
      } else {
        this.log.warn('[%s] %s.', accessory.displayName, this.lang.offlineAPI)
      }
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

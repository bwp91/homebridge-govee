/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

// Packages and constant variables for this class
const devicesInHB = new Map()
const apiDevices = []
const httpDevices = []
const nodeMachineId = require('node-machine-id')
const plugin = require('./../package.json')
const { default: PQueue } = require('p-queue')

// Variables for this class to use later
let apiClient
let btClient
let httpClient

// See if the bluetooth client is available
let noble
try {
  noble = require('@abandonware/noble')
} catch (err) {
  noble = false
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
      this.bleDevices = {}
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
        case 'leakDevices':
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
                  case 'enableAWS':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this.deviceConf[id][k] = v === 'false' ? false : !!val
                    break
                  case 'enableBT':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this.deviceConf[id][k] = v === 'false' ? false : !!val
                    this.bleDevices[id.substring(6).toLowerCase()] = id
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
      this.machineId = nodeMachineId.machineIdSync().slice(0, 10)

      // Create the queue used for sending device requests
      this.queue = new PQueue({
        concurrency: 1,
        interval: this.config.controlInterval,
        intervalCap: 1,
        timeout: 10000,
        throwOnTimeout: true
      })
      this.queue.on('idle', () => {
        this.disableAPISync = false
      })

      // Setup the HTTP client if Govee username and password have been provided
      try {
        if (!this.config.username || !this.config.password) {
          throw new Error(this.lang.noCreds)
        }
        httpClient = new (require('./connection/http'))(this)
        const data = await httpClient.getDevices()
        this.accountTopic = data.accountTopic
        if (!Array.isArray(data.deviceList)) {
          throw new Error(this.lang.noDevList)
        }
        data.deviceList.forEach(device => httpDevices.push(device))
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

      // Setup the bluetooth client
      try {
        if (!noble) {
          throw new Error(this.lang.btNoPackage)
        }
        if (Object.keys(this.bleDevices).length === 0) {
          throw new Error(this.lang.btNoDevices)
        }
        btClient = new (require('./connection/ble'))(this)
      } catch (err) {
        const eText = this.funcs.parseError(err)
        this.log.warn('%s %s.', this.lang.disableBT, eText)
      }

      // Initialise the devices
      if (httpDevices && httpDevices.length > 0) {
        // We have some devices from HTTP client
        httpDevices.forEach(device => {
          this.log.warn(device)
          // Find the matching device from the API client
          const apiDevice = apiDevices.find(el => el.device === device.device)
          if (apiDevice) {
            // Device exists in API data so add the http info to the API object and initialise
            apiDevice.httpInfo = device
            this.initialiseDevice(apiDevice)
          } else {
            // Devices doesn't exist in API data, so is a bluetooth only model or other device type
            // Does this have an entry in the config for bluetooth only support
            if (this.funcs.hasProperty(this.deviceConf, device.device)) {
              // An entry exists, so check if the bluetooth has actually been enabled by user
              const btDevice = this.deviceConf[device.device]
              if (btDevice.enableBT) {
                // Add info needed to this "ghost" device property so it can be initialised
                btDevice.device = device.device
                btDevice.deviceName = device.deviceName
                btDevice.model = device.sku
                btDevice.httpInfo = device
                this.initialiseDevice(btDevice)
              } else {
                // Device isn't in API data, has been configured but not bluetooth enabled by user
                this.log('[%s] [%s] - %s.', device.deviceName, device.device, this.lang.devNoSupp)
              }
            } else {
              // Device isn't in API data, and hasn't been configured
              this.log('[%s] [%s] - %s.', device.deviceName, device.device, this.lang.devNotSupp)
            }
          }
        })
      } else if (apiDevices && apiDevices.length > 0) {
        // No devices from HTTP client, but API token has been given, and devices exist there
        apiDevices.forEach(apiDevice => this.initialiseDevice(apiDevice))
      } else {
        // No devices either from HTTP client or API client
        // Remove any redundant Homebridge accessories
        devicesInHB.forEach(accessory => this.removeAccessory(accessory))
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

      // Perform the initial sync and setup the interval for further syncs
      if (apiClient) {
        await this.goveeAPISync()
        this.refreshAPIInterval = setInterval(
          () => this.goveeAPISync(),
          this.config.refreshTime * 1000
        )
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
      // Stop the refresh intervals
      if (this.refreshAPIInterval) {
        clearInterval(this.refreshAPIInterval)
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
      let setupAWS = false
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
      } else if (this.consts.models.leak.includes(device.model)) {
        // Device is a bluetooth-only LED strip/bulb
        instance = 'leak-sensor'
        isAPIDevice = false
      } else {
        // Device is not in any supported model list
        this.log.warn('[%s] [%s] %s.', device.deviceName, device.device, this.lang.devNoSupp)
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
        // Save the hardware and firmware versions
        accessory.context.firmware = device.httpInfo.versionSoft
        accessory.context.hardware = device.httpInfo.versionHard

        // It's possible to show a nice little icon of the device in the Homebridge UI
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.extResources) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.extResources)
          if (parsed && parsed.skuUrl) {
            accessory.context.image = parsed.skuUrl
          }
        }

        // Check for AWS-IOT information
        // context.isAWSDevice -> whether the device supports aws (has a topic)
        // awsControl -> whether the device supports aws and user enabled
        accessory.context.isAWSDevice = false
        accessory.context.awsControl = false
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.deviceSettings) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.deviceSettings)
          if (parsed && parsed.topic) {
            accessory.context.isAWSDevice = !!parsed.topic
            if (accessory.context.isAWSDevice) {
              accessory.context.awsTopic = parsed.topic
              if (deviceConf && deviceConf.enableAWS) {
                setupAWS = true
              }
            }
          }
        }

        // Check for bluetooth information
        // context.isBLEDevice -> whether the device supports bluetooth control
        // context.btControl -> whether the device supports bluetooth control and user enabled
        accessory.context.isBLEDevice = false
        accessory.context.btControl = false
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.deviceSettings) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.deviceSettings)
          if (parsed && parsed.bleName) {
            accessory.context.isBLEDevice = !!parsed.bleName
            if (accessory.context.isBLEDevice) {
              accessory.context.bleAddress = device.device.substring(6).toLowerCase()
              if (deviceConf && deviceConf.enableBT && btClient) {
                accessory.context.btControl = true
              }
            }
          }
        }
      } else {
        // No extra info - most likely case when the user has given API token but not credentials
        accessory.context.firmware = false
        accessory.context.hardware = false
        accessory.context.image = false
        accessory.context.isBLEDevice = false
        accessory.context.btControl = false
      }

      // Create the instance for this device type
      accessory.context.isAPIDevice = isAPIDevice
      accessory.control = new (require('./device/' + instance))(this, accessory)

      if (setupAWS) {
        accessory.awsControl = new (require('./connection/aws'))(this, accessory)
      }

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

  async goveeAPISync () {
    devicesInHB.forEach(async accessory => {
      try {
        if (accessory.context.isAPIDevice) {
          // Skip the sync if the client is busy sending updates to Govee
          if (this.disableAPISync) {
            if (this.config.debug) {
              this.log('%s.', this.lang.clientBusy)
            }
            return
          }

          // Retrieve the current accessory state from Govee
          const res = await apiClient.getDevice(accessory.context)

          // Use the accessory type instance to update the accessory's state
          if (accessory.control && accessory.control.externalUpdate) {
            accessory.control.externalUpdate(Object.assign({ source: 'api' }, ...res))
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
    // Set this flag true to pause the device sync interval
    this.disableAPISync = true

    // Add the request to the queue - don't start an update until the previous has finished
    return await this.queue.add(async () => {
      try {
        // First try over bluetooth, if it's enabled
        if (!accessory.context.btControl) {
          throw new Error(this.lang.notAvailable)
        }
        // Send the command to the bluetooth client to send
        try {
          await btClient.updateDevice(accessory, params)
        } catch (err) {
          try {
            await this.funcs.sleep(250)
            await btClient.updateDevice(accessory, params)
          } catch (err) {
            if (!accessory.context.isAPIDevice) {
              await this.funcs.sleep(250)
              await btClient.updateDevice(accessory, params)
            } else {
              throw err
            }
          }
        }
      } catch (err) {
        // Bluetooth didn't work or not enabled
        if (accessory.context.enableDebugLogging) {
          const eText = this.funcs.parseError(err)
          this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.notBTSent, eText)
        }

        // Try sending the command over AWS
        try {
          if (!accessory.awsControl) {
            throw new Error(this.lang.notAvailable)
          }
          accessory.awsControl.updateDevice(params)
        } catch (err) {
          if (accessory.context.enableDebugLogging) {
            const eText = this.funcs.parseError(err)
            this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.notAWSSent, eText)
          }
        }

        // Try sending the command over cloud
        if (accessory.context.isAPIDevice) {
          await apiClient.updateDevice(accessory, params)
        } else {
          throw err
        }
      }
    })
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

/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

// Packages and constant variables for this class
const devicesInHB = new Map()
const apiDevices = []
const httpDevices = []
const plugin = require('./../package.json')
const storage = require('node-persist')

// Variables for this class to use later
let apiClient
let bleClient
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
        '%s v%s | Node %s | HB v%s | HAPNodeJS v%s%s...',
        this.lang.initialising,
        plugin.version,
        process.version,
        api.serverVersion,
        api.hap.HAPLibraryVersion ? api.hap.HAPLibraryVersion() : '?',
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
      const eText = this.funcs.parseError(err, [this.lang.hbVersionFail, this.lang.pluginNotConf])
      log.warn('***** %s. *****', this.lang.disabling)
      log.warn('***** %s. *****', eText)
    }
  }

  applyUserConfig (config) {
    // These shorthand functions save line space during config parsing
    const logDefault = (k, def) => {
      this.log.warn('%s [%s] %s %s.', this.lang.cfgItem, k, this.lang.cfgDef, def)
    }
    const logDuplicate = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgDup)
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
        case 'offlineAsOff':
          if (typeof val === 'string') {
            logQuotes(key)
          }
          this.config[key] = val === 'false' ? false : !!val
          break
        case 'heaterDevices':
        case 'humidifierDevices':
        case 'leakDevices':
        case 'lightDevices':
        case 'purifierDevices':
        case 'switchDevices':
        case 'thermoDevices':
          if (Array.isArray(val) && val.length > 0) {
            val.forEach(x => {
              if (!x.deviceId) {
                logIgnoreItem(key)
                return
              }
              const id = this.funcs.parseDeviceId(x.deviceId)
              if (Object.keys(this.deviceConf).includes(id)) {
                logDuplicate(key + '.' + id)
                return
              }
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
                  case 'brightnessStep':
                  case 'lowBattThreshold': {
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
                  case 'customAddress':
                  case 'diyMode':
                  case 'diyModeTwo':
                  case 'diyModeThree':
                  case 'diyModeFour':
                  case 'musicMode':
                  case 'musicModeTwo':
                  case 'scene':
                  case 'sceneTwo':
                  case 'sceneThree':
                  case 'sceneFour':
                  case 'segmented':
                  case 'segmentedTwo':
                  case 'segmentedThree':
                  case 'segmentedFour':
                  case 'temperatureSource':
                  case 'videoMode':
                  case 'videoModeTwo':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.deviceConf[id][k] = v.replace(/[\s]+/g, '')
                    }
                    break
                  case 'deviceId':
                  case 'label':
                    break

                  case 'disableAWS':
                  case 'enableBT':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this.deviceConf[id][k] = v === 'false' ? false : !!v
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
      this.eveChar = new (require('./utils/eve-chars'))(this.api)
      this.eveService = require('./fakegato/fakegato-history')(this.api)

      // Persist files are used to store device info that can be used by my other plugins
      try {
        this.storageData = storage.create({
          dir: require('path').join(this.api.user.persistPath(), '/../bwp91_cache'),
          forgiveParseErrors: true
        })
        await this.storageData.init()
        this.storageClientData = true
      } catch (err) {
        if (this.config.debug) {
          const eText = this.funcs.parseError(err)
          this.log.warn('%s %s.', this.lang.storageSetupErr, eText)
        }
      }

      // Setup the HTTP client if Govee username and password have been provided
      try {
        if (!this.config.username || !this.config.password) {
          throw new Error(this.lang.noCreds)
        }
        httpClient = new (require('./connection/http'))(this)
        const data = await httpClient.login()
        this.accountTopic = data.topic
        const devices = await httpClient.getDevices()
        if (!Array.isArray(devices)) {
          throw new Error(this.lang.noDevList)
        }
        devices.forEach(device => httpDevices.push(device))
      } catch (err) {
        const eText = this.funcs.parseError(err, [this.lang.noCreds, this.lang.noDevList])
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
          : this.funcs.parseError(err, [this.lang.noAPIKey, this.lang.noDevList])
        this.log.warn('%s %s.', this.lang.disableAPI, eText)
        apiClient = false
      }

      // Setup the bluetooth client
      try {
        // See if the bluetooth client is available
        /*
          Noble sends the plugin into a crash loop if there is no bluetooth adapter available
          This if statement follows the logic of Noble up to the offending socket.bindRaw(device)
          Put inside a try/catch now to check for error and disable ble control for rest of plugin
        */
        if (['linux', 'freebsd', 'win32'].includes(require('os').platform())) {
          const socket = new (require('@abandonware/bluetooth-hci-socket'))()
          const device = process.env.NOBLE_HCI_DEVICE_ID
            ? parseInt(process.env.NOBLE_HCI_DEVICE_ID, 10)
            : undefined
          socket.bindRaw(device)
        }
        try {
          require('@abandonware/noble')
        } catch (err) {
          throw new Error(this.lang.btNoPackage)
        }
        if (Object.values(this.deviceConf).filter(el => el.enableBT).length === 0) {
          throw new Error(this.lang.btNoDevices)
        }
        bleClient = new (require('./connection/ble'))(this)
        this.log('%s.', this.lang.btAvailable)
      } catch (err) {
        // This error thrown from bluetooth-hci-socket does not contain an err.message
        if (err.code === 'ERR_DLOPEN_FAILED') {
          err.message = 'ERR_DLOPEN_FAILED'
        }
        const eText = this.funcs.parseError(err, [
          this.lang.btNoPackage,
          this.lang.btNoDevices,
          'ENODEV, No such device',
          'ERR_DLOPEN_FAILED'
        ])
        this.log.warn('%s %s.', this.lang.disableBT, eText)
        bleClient = false
      }

      // Initialise the devices
      let httpSyncNeeded = false
      if (httpDevices && httpDevices.length > 0) {
        // We have some devices from HTTP client
        httpDevices.forEach(httpDevice => {
          // It appears sometimes the deviceid isn't quite in the form I first expected
          if (httpDevice.device.length === 16) {
            // Eg converts abcd1234abcd1234 to AB:CD:12:34:AB:CD:12:34
            httpDevice.device = httpDevice.device.replace(/..\B/g, '$&:').toUpperCase()
          }

          // Sets the flag to see if we need to setup the HTTP sync
          if (
            [...this.consts.models.leak, ...this.consts.models.thermoWifi].includes(httpDevice.sku)
          ) {
            httpSyncNeeded = true
          }

          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(httpDevice.device)) {
            return
          }

          // Find the any matching device from the API client
          const apiDevice = apiDevices.find(el => el.device === httpDevice.device)
          if (apiDevice) {
            // Device exists in API data so add the http info to the API object and initialise
            apiDevice.httpInfo = httpDevice
            apiDevice.isAPIDevice = true

            // Initialise the device into Homebridge
            this.initialiseDevice(apiDevice)
          } else {
            // Device doesn't exist in API data, but try to initialise as could be other device type
            this.initialiseDevice({
              device: httpDevice.device,
              deviceName: httpDevice.deviceName,
              model: httpDevice.sku,
              httpInfo: httpDevice,
              isAPIDevice: false
            })
          }
        })
      } else if (apiDevices && apiDevices.length > 0) {
        // No devices from HTTP client, but API token has been given, and devices exist there
        apiDevices.forEach(apiDevice => {
          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(apiDevice.device)) {
            return
          }

          // Initialise the device into Homebridge
          apiDevice.isAPIDevice = true
          this.initialiseDevice(apiDevice)
        })
      } else {
        // No devices either from HTTP client or API client
        throw new Error(this.lang.noDevs)
      }

      // Check for redundant Homebridge accessories
      devicesInHB.forEach(async accessory => {
        // If the accessory doesn't exist in Govee then remove it
        if (
          (!httpDevices.some(el => el.device === accessory.context.gvDeviceId) &&
            !apiDevices.some(el => el.device === accessory.context.gvDeviceId)) ||
          this.ignoredDevices.includes(accessory.context.gvDeviceId)
        ) {
          this.removeAccessory(accessory)
        }
      })

      // Setup the http client sync needed for leak and thermo sensor devices
      if (httpSyncNeeded) {
        this.goveeHTTPSync()
        this.refreshHTTPInterval = setInterval(
          () => this.goveeHTTPSync(),
          this.config.refreshTime * 1000
        )
      }

      // Setup the API client sync used for API token models
      if (apiClient) {
        this.goveeAPISync()
        this.refreshAPIInterval = setInterval(
          () => this.goveeAPISync(),
          this.config.refreshTime * 1000
        )
      }

      // Log that the plugin setup has been successful with a welcome message
      const randIndex = Math.floor(Math.random() * this.lang.zWelcome.length)
      setTimeout(() => {
        this.log('%s. %s', this.lang.complete, this.lang.zWelcome[randIndex])
      }, 2000)
    } catch (err) {
      // Catch any errors during setup
      const eText = this.funcs.parseError(err, [this.lang.noDevs, this.lang.disabled])
      this.log.warn('***** %s. *****', this.lang.disabling)
      this.log.warn('***** %s. *****', eText)
      this.pluginShutdown()
    }
  }

  pluginShutdown () {
    // A function that is called when the plugin fails to load or Homebridge restarts
    try {
      // Stop the refresh intervals
      if (this.refreshHTTPInterval) {
        clearInterval(this.refreshHTTPInterval)
      }
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
      const deviceConf = this.deviceConf[device.device] || {}
      const uuid = this.api.hap.uuid.generate(device.device)
      let instance
      if (this.consts.models.rgb.includes(device.model)) {
        // Device is an API enabled wifi (and maybe bluetooth) LED strip/bulb
        instance = 'light-colour'
      } else if (this.consts.models.rgbBT.includes(device.model)) {
        // Device is a bluetooth-only LED strip/bulb, check it's configured and ble enabled
        if (deviceConf.enableBT) {
          instance = 'light-colour-bt'
        } else {
          // Not configured, so remove if exists, log a helpful message, and return
          if (devicesInHB.has(uuid)) {
            this.removeAccessory(devicesInHB.get(uuid))
          }
          this.log('[%s] [%s] %s.', device.deviceName, device.device, this.lang.devNotBT)
          return
        }
      } else if (this.consts.models.switchSingle.includes(device.model)) {
        // Device is an API enabled wifi switch
        instance = deviceConf.showAs || this.consts.defaultValues.showAs
        switch (instance) {
          case 'heater':
          case 'cooler': {
            if (!deviceConf.temperatureSource) {
              this.log.warn('[%s] %s.', device.deviceName, this.lang.heaterSimNoSensor)
              if (devicesInHB.has(uuid)) {
                this.removeAccessory(devicesInHB.get(uuid))
              }
              return
            }
            break
          }
          case 'default':
            instance = 'outlet'
            break
        }
        instance += '-single'
      } else if (this.consts.models.switchDouble.includes(device.model)) {
        // Device is an API enabled wifi double switch
        instance = deviceConf.showAs || this.consts.defaultValues.showAs
        if (['audio', 'box', 'default', 'purifier', 'stick', 'tap', 'valve'].includes(instance)) {
          instance = 'outlet'
        }
        instance += '-double'
      } else if (this.consts.models.leak.includes(device.model)) {
        // Device is a leak sensor
        instance = 'sensor-leak'
      } else if (this.consts.models.thermoWifi.includes(device.model)) {
        // Device is a wifi (supported) thermo-hygrometer sensor
        instance = 'sensor-thermo'
      } else if (this.consts.models.thermoBLE.includes(device.model)) {
        // Device is a BLE (unsupported) thermo-hygrometer sensor
        this.log('[%s] %s', device.deviceName, this.lang.devBLENoSupp)

        // Remove any existing accessory if exists
        if (devicesInHB.has(uuid)) {
          this.removeAccessory(devicesInHB.get(uuid))
        }
        return
      } else if (this.consts.models.fan.includes(device.model)) {
        // Device is a fan
        instance = 'fan'
      } else if (this.consts.models.heater.includes(device.model)) {
        // Device is a heater
        instance = 'heater'
      } else if (this.consts.models.humidifier.includes(device.model)) {
        // Device is a humidifier
        instance = 'humidifier'
      } else if (this.consts.models.purifier.includes(device.model)) {
        // Device is a purifier
        instance = 'purifier'
      } else if (this.consts.models.noSupport.includes(device.model)) {
        // Device is not and cannot be supported by the plugin
        if (this.config.debug) {
          this.log.warn('[%s] %s.', device.deviceName, this.lang.devNoSupp)
        }

        // Remove any existing accessory if exists
        if (devicesInHB.has(uuid)) {
          this.removeAccessory(devicesInHB.get(uuid))
        }
        return
      } else {
        // Device is not in any supported model list but could be implemented into the plugin
        this.log.warn(
          '[%s] %s:\n%s',
          device.deviceName,
          this.lang.devMaySupp,
          JSON.stringify(device)
        )
        return
      }

      // Get the cached accessory or add to Homebridge if doesn't exist
      let accessory
      switch (instance) {
        case 'audio-single':
          if (devicesInHB.get(uuid)) {
            this.removeAccessory(devicesInHB.get(uuid))
          }
          accessory = this.addExternalAccessory(device, 34)
          instance = 'tv-single'
          break
        case 'box-single':
          if (devicesInHB.get(uuid)) {
            this.removeAccessory(devicesInHB.get(uuid))
          }
          accessory = this.addExternalAccessory(device, 35)
          instance = 'tv-single'
          break
        case 'stick-single':
          if (devicesInHB.get(uuid)) {
            this.removeAccessory(devicesInHB.get(uuid))
          }
          accessory = this.addExternalAccessory(device, 36)
          instance = 'tv-single'
          break
        default:
          accessory = devicesInHB.get(uuid) || this.addAccessory(device)
          break
      }

      // Final check the accessory now exists in Homebridge
      if (!accessory) {
        throw new Error(this.lang.accNotFound)
      }

      // Set the logging level for this device
      accessory.context.enableLogging = !this.config.disableDeviceLogging
      accessory.context.enableDebugLogging = this.config.debug
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

      // Add the config to the context for heater and cooler simulations
      if (['heater', 'cooler'].includes(deviceConf.showAs)) {
        accessory.context.temperatureSource = deviceConf.temperatureSource
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

      // Add some initial context information which is changed later
      accessory.context.hasAPIControl = device.isAPIDevice
      accessory.context.useAPIControl = device.isAPIDevice
      accessory.context.hasAWSControl = false
      accessory.context.useAWSControl = false
      accessory.context.hasBLEControl = false
      accessory.context.useBLEControl = false
      accessory.context.firmware = false
      accessory.context.hardware = false
      accessory.context.image = false

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

        // HTTP info lets us see if other connection methods are available
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.deviceSettings) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.deviceSettings)

          // Check to see if AWS is possible
          if (parsed && parsed.topic) {
            accessory.context.hasAWSControl = !!parsed.topic
            accessory.context.awsTopic = parsed.topic
            if (!deviceConf.disableAWS) {
              accessory.context.useAWSControl = true
              accessory.awsControl = new (require('./connection/aws'))(this, accessory)
            }
          }

          // Check to see if BLE is possible
          if (parsed && parsed.bleName) {
            accessory.context.hasBLEControl = !!parsed.bleName
            accessory.context.bleAddress = deviceConf.customAddress
              ? deviceConf.customAddress.toLowerCase()
              : parsed.address
              ? parsed.address.toLowerCase()
              : device.device.substring(6).toLowerCase()
            accessory.context.bleName = parsed.bleName
            if (
              ['light-colour', 'light-colour-bt'].includes(instance) &&
              deviceConf.enableBT &&
              bleClient
            ) {
              accessory.context.useBLEControl = true
            }
          }

          // Get a min and max temperature/humidity range to show in the homebridge-ui
          if (parsed && this.funcs.hasProperty(parsed, 'temMin') && parsed.temMax) {
            accessory.context.minTemp = parsed.temMin / 100
            accessory.context.maxTemp = parsed.temMax / 100
            accessory.context.offTemp = parsed.temCali
          }
          if (parsed && this.funcs.hasProperty(parsed, 'humMin') && parsed.humMax) {
            accessory.context.minHumi = parsed.humMin / 100
            accessory.context.maxHumi = parsed.humMax / 100
            accessory.context.offHumi = parsed.humCali
          }
        }
      }

      // Create the instance for this device type
      accessory.control = new (require('./device/' + instance))(this, accessory)

      // Log the device initialisation
      this.log(
        '[%s] %s [%s] [%s].',
        accessory.displayName,
        this.lang.devInit,
        device.device,
        device.model
      )

      // Update any changes to the accessory to the platform
      this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory])
      devicesInHB.set(accessory.UUID, accessory)
    } catch (err) {
      // Catch any errors during device initialisation
      const eText = this.funcs.parseError(err, [this.lang.accNotFound])
      this.log.warn('[%s] %s %s.', device.deviceName, this.lang.devNotInit, eText)
    }
  }

  async goveeHTTPSync () {
    try {
      // Obtain a refreshed device list
      const devices = await httpClient.getDevices(true)

      // Filter those which are leak sensors
      devices
        .filter(device =>
          [...this.consts.models.leak, ...this.consts.models.thermoWifi].includes(device.sku)
        )
        .forEach(async device => {
          try {
            // Generate the UIID from which we can match our Homebridge accessory
            const uiid = this.api.hap.uuid.generate(device.device)

            // Don't continue if the accessory doesn't exist
            if (!devicesInHB.has(uiid)) {
              return
            }

            // Retrieve the Homebridge accessory
            const accessory = devicesInHB.get(uiid)

            // Make sure the data we need for the device exists
            if (
              !device.deviceExt ||
              !device.deviceExt.deviceSettings ||
              !device.deviceExt.lastDeviceData
            ) {
              return
            }

            // Parse the data received
            const parsedSettings = JSON.parse(device.deviceExt.deviceSettings)
            const parsedData = JSON.parse(device.deviceExt.lastDeviceData)

            // Temporary debug logging for leak sensor
            if (device.sku === 'H5054' && accessory.context.enableDebugLogging) {
              this.log.warn(
                '[%s] %s.',
                device.deviceName,
                JSON.stringify(device.deviceExt.lastDeviceData)
              )
            }

            const toReturn = { source: 'HTTP' }
            if (this.consts.models.leak.includes(device.sku)) {
              // Leak Sensors - check to see of any warnings if the lastTime is above 0
              let hasUnreadLeak = false
              if (parsedData.lastTime > 0) {
                // Obtain the leak warning messages for this device
                const msgs = await httpClient.getLeakDeviceWarning(device.device)

                // Check to see if unread messages exist
                const unreadCount = msgs.filter(msg => {
                  return !msg.read && msg.message.toLowerCase().indexOf('leakage alert') > -1
                })

                //
                if (unreadCount.length > 0) {
                  hasUnreadLeak = true
                }
              }

              // Generate the params to return
              toReturn.battery = parsedSettings.battery
              toReturn.leakDetected = hasUnreadLeak
              toReturn.online = parsedData.gwonline && parsedData.online
            } else if (this.consts.models.thermoWifi.includes(device.sku)) {
              toReturn.battery = parsedSettings.battery
              toReturn.temperature = parsedData.tem
              toReturn.humidity = parsedData.hum
              toReturn.online = parsedData.online
            }

            // Send the information to the update receiver function
            this.receiveDeviceUpdate(accessory, toReturn)
          } catch (err) {
            const eText = this.funcs.parseError(err)
            this.log.warn('[%s] %s %s.', device.deviceName, this.lang.devNotRef, eText)
          }
        })
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('%s %s.', this.lang.httpSyncFail, eText)
    }
  }

  async goveeAPISync () {
    devicesInHB.forEach(async accessory => {
      try {
        // Don't continue if the device doesn't support API retrieval
        if (!accessory.context.hasAPIControl) {
          return
        }

        // Skip the sync if the client is busy sending updates to Govee
        if (this.disableAPISync) {
          if (this.config.debug) {
            this.log('%s.', this.lang.clientBusy)
          }
          return
        }

        // Retrieve the current accessory state from Govee
        const res = await apiClient.getDevice(accessory.context)

        // Send the data to the receiver function
        this.receiveDeviceUpdate(accessory, Object.assign({ source: 'API' }, ...res))
      } catch (err) {
        // Catch any errors during accessory state refresh
        // 400 response is normal when a device's state is not retrievable - log in debug mode
        if (err.message.includes('400')) {
          if (accessory.context.enableDebugLogging) {
            this.log.warn('[%s] %s.', accessory.displayName, this.lang.devNotRet)
          }
          return
        }

        // Response is not 400 so check to see if it's a different standard govee error
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
        .setCharacteristic(this.api.hap.Characteristic.Name, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, device.deviceName)
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

  addExternalAccessory (device, category) {
    try {
      // Add the new accessory to Homebridge
      const accessory = new this.api.platformAccessory(
        device.deviceName,
        this.api.hap.uuid.generate(device.device),
        category
      )

      // Set the accessory characteristics
      accessory
        .getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Name, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, this.lang.brand)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true)

      // Register the accessory
      this.api.publishExternalAccessories(plugin.name, [accessory])
      this.log('[%s] %s.', device.name, this.lang.devAdd)

      // Return the new accessory
      this.configureAccessory(accessory)
      return accessory
    } catch (err) {
      // Catch any errors during add
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', device.deviceName, this.lang.devNotAdd, eText)
    }
  }

  configureAccessory (accessory) {
    // Set the correct firmware version if we can
    if (this.api && accessory.context.firmware) {
      accessory
        .getService(this.api.hap.Service.AccessoryInformation)
        .updateCharacteristic(
          this.api.hap.Characteristic.FirmwareRevision,
          accessory.context.firmware
        )
    }

    // Add the configured accessory to our global map
    devicesInHB.set(accessory.UUID, accessory)
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
    // Add the request to the queue - don't start an update until the previous has finished
    const data = {}
    try {
      // Construct the params for BLE/API/AWS
      switch (params.cmd) {
        case 'state': {
          /*
            ON/OFF
            <= INPUT params.value with values 'on' or 'off'
            API needs { cmd: 'turn', data: 'on'/'off' }
            AWS needs { cmd: 'turn', data: { val: 1/0 } }
            BLE needs { cmd: 0x01, data: 0x1/0x0 }
          */
          data.apiParams = {
            cmd: 'turn',
            data: params.value
          }
          data.awsParams = {
            cmd: 'turn',
            data: { val: params.value === 'on' ? 1 : 0 }
          }
          data.bleParams = {
            cmd: 0x01,
            data: params.value === 'on' ? 0x1 : 0x0
          }
          break
        }
        case 'stateDual':
        case 'stateFan':
        case 'stateHumi':
        case 'statePuri': {
          data.awsParams = {
            cmd: 'turn',
            data: { val: params.value }
          }
          break
        }
        case 'speedHeat':
        case 'speedHumi':
        case 'speedPuri':
        case 'stateHeat': {
          data.awsParams = {
            cmd: 'ptReal',
            data: { command: [params.value] }
          }
          break
        }
        case 'brightness': {
          /*
            BRIGHTNESS
            <= INPUT params.value INT in range [0, 100]
            API needs { cmd: 'brightness', data: INT[0, 100] or INT[0, 254] }
            AWS needs { cmd: 'brightness', data: { val: INT[0, 254] } }
            BLE needs { cmd: 0x04, data: (based on) INT[0, 100] }
          */
          data.apiParams = {
            cmd: 'brightness',
            data: this.consts.apiBrightnessScale.includes(accessory.context.gvModel)
              ? Math.round(params.value * 2.54)
              : params.value
          }
          data.awsParams = {
            cmd: 'brightness',
            data: {
              val: this.consts.awsBrightnessNoScale.includes(accessory.context.gvModel)
                ? params.value
                : Math.round(params.value * 2.54)
            }
          }
          data.bleParams = {
            cmd: 0x04,
            data: Math.floor((params.value / 100) * 0xff)
          }
          break
        }
        case 'color': {
          /*
            COLOUR (RGB)
            <= INPUT params.value OBJ with properties { r, g, b }
            API needs { cmd: 'color', data: { r, g, b } }
            AWS needs { cmd: 'color', data: { red, green, blue } }
            BLE needs { cmd: 0x05, data: [0x02, r, g, b] }
          */
          data.apiParams = {
            cmd: 'color',
            data: params.value
          }
          if (this.consts.awsColourWC.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorwc',
              data: {
                color: {
                  r: params.value.r,
                  g: params.value.g,
                  b: params.value.b,
                  red: params.value.r,
                  green: params.value.g,
                  blue: params.value.b
                },
                colorTemInKelvin: 0
              }
            }
          } else if (this.consts.awsColourLong.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'color',
              data: {
                r: params.value.r,
                g: params.value.g,
                b: params.value.b,
                red: params.value.r,
                green: params.value.g,
                blue: params.value.b
              }
            }
          } else if (this.consts.awsColourShort.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'color',
              data: params.value
            }
          } else if (!this.consts.awsColourNone.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'color',
              data: {
                red: params.value.r,
                green: params.value.g,
                blue: params.value.b
              }
            }
          }
          data.bleParams = {
            cmd: 0x05,
            data: [0x02, params.value.r, params.value.g, params.value.b]
          }
          break
        }
        case 'colorTem': {
          /*
            COLOUR TEMP (KELVIN)
            <= INPUT params.value INT in [2000, 7143]
            API needs { cmd: 'colorTem', data: INT[2000, 7143] }
            AWS needs { cmd: 'colorTem', data: { color: {},"colorTemInKelvin": } }
            BLE needs { cmd: 0x05, data: [0x02, 0xff, 0xff, 0xff, 0x01, r, g, b] }
          */
          const [r, g, b] = this.colourUtils.k2rgb(params.value)
          data.apiParams = {
            cmd: 'colorTem',
            data: params.value
          }
          if (this.consts.awsColourWC.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorwc',
              data: {
                color: {
                  r: r,
                  g: g,
                  b: b
                },
                colorTemInKelvin: params.value
              }
            }
          } else if (this.consts.awsColourLong.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorTem',
              data: {
                colorTemInKelvin: params.value,
                color: {
                  r: r,
                  g: g,
                  b: b,
                  red: r,
                  green: g,
                  blue: b
                }
              }
            }
          } else if (this.consts.awsColourShort.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorTem',
              data: {
                color: {
                  r: r,
                  g: g,
                  b: b,
                  red: r,
                  green: g,
                  blue: b
                },
                colorTemInKelvin: params.value
              }
            }
          } else if (!this.consts.awsColourNone.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorTem',
              data: {
                color: {
                  red: r,
                  green: g,
                  blue: b
                },
                colorTemInKelvin: params.value
              }
            }
          }
          data.bleParams = {
            cmd: 0x05,
            data: [0x02, 0xff, 0xff, 0xff, 0x01, r, g, b]
          }
          break
        }
        case 'scene': {
          /*
            SCENES
            <= INPUT params.value STR code
            API doesn't support this yet
            AWS needs { cmd: 'pt', data: { op: 'mode' OR opcode: 'mode', value: code STR } }
            BLE plugin doesn't support this yet
          */
          if (params.value.charAt() === '0') {
            data.bleParams = {
              cmd: 0x05,
              data: params.value.replace(/[\s]+/g, '').split(',')
            }
          } else if (['M', 'o'].includes(params.value.charAt())) {
            const codeParts = params.value.trim().split('||')
            if (![2, 3].includes(codeParts.length)) {
              // Code doesn't seem to be in the right format
              throw new Error(this.lang.sceneCodeWrong)
            }
            data.awsParams = {
              cmd: codeParts[1],
              data: {}
            }
            if (codeParts[1] === 'ptReal') {
              data.awsParams.data.command = codeParts[0].split(',')
            } else {
              data.awsParams.data.value = codeParts[0].split(',')
            }
            if (codeParts[2]) {
              data.awsParams.data[codeParts[2]] = 'mode'
            }
          } else {
            // Code doesn't seem to be in the right format
            throw new Error(this.lang.sceneCodeWrong)
          }
          break
        }
      }

      // Check to see if we have the option to use AWS
      try {
        if (!accessory.context.useAWSControl) {
          throw new Error(this.lang.notAvailable)
        }

        // Check the command is supported by AWS
        if (!data.awsParams) {
          throw new Error(this.lang.cmdNotAWS)
        }

        // Send the command (we don't get a response from this)
        accessory.awsControl.updateDevice(data.awsParams)

        // If the only connection method is AWS or we have sent an AWS scene we can return now
        if (
          (!accessory.context.useAPIControl && !accessory.context.useBLEControl) ||
          (data.awsParams && params.cmd === 'scene')
        ) {
          return
        }
        await this.funcs.sleep(500)
      } catch (err) {
        // Print the reason to the log if in debug mode, it's not always necessarily an error
        if (accessory.context.enableDebugLogging) {
          const eText = this.funcs.parseError(err, [
            this.lang.sceneCodeWrong,
            this.lang.notAvailable,
            this.lang.cmdNotAWS
          ])
          this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.notAWSSent, eText)
        }
      }

      // If the only connection method is AWS or BLE is disabled we need to throw the error again
      if (
        (!accessory.context.useAPIControl && !accessory.context.useBLEControl) ||
        !accessory.context.useBLEControl
      ) {
        throw new Error(this.lang.notAvailable)
      }

      // Check the command is supported by bluetooth
      if (!data.bleParams) {
        throw new Error(this.lang.cmdNotBLE)
      }

      /*
        Send the command to the bluetooth client to send
        API+AWS+BLE devices: we try once before reverting to API/AWS
        API+AWS devices: we throw an error to skip straight to API/AWS control in the catch{}
        BLE devices: we try four three before finally returning an error to HomeKit
      */
      try {
        await bleClient.updateDevice(accessory, data.bleParams)
      } catch (err) {
        // Try a couple more times for bt only models
        if (!accessory.context.hasAPIControl) {
          try {
            await bleClient.updateDevice(accessory, data.bleParams)
          } catch (err) {
            // Last attempt not needed inside a try here as it would be caught below in catch
            await bleClient.updateDevice(accessory, data.bleParams)
          }
        } else {
          throw err
        }
      }
    } catch (err) {
      // If it's the 'incorrect scene code format' error then throw it here again
      if (err.message === this.lang.sceneCodeWrong) {
        throw err
      }

      // Check to see if we have the option to use API
      if (accessory.context.useAPIControl && data.apiParams) {
        // Set this flag true to pause the API device sync interval
        this.disableAPISync = true

        // Bluetooth didn't work or not enabled
        if (accessory.context.enableDebugLogging && accessory.context.useBLEControl) {
          const eText = this.funcs.parseError(err, [this.lang.btTimeout])
          this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.notBTSent, eText)
        }

        // Send the command
        return await apiClient.updateDevice(accessory, data.apiParams)
      } else {
        /*
          At this point we return the error to HomeKit to show a 'No Response' message
          API+AWS+BLE devices: bluetooth failed once and API request failed (AWS may have worked)
          API+AWS: API request has failed (AWS may have worked)
          BLE devices: bluetooth failed three times
        */

        // Throw the error to show the no response in HomeKit
        throw err
      }
    }
  }

  receiveDeviceUpdate (accessory, params) {
    // No need to continue if the accessory doesn't have the receiver function setup
    if (!accessory.control || !accessory.control.externalUpdate) {
      return
    }

    // Log the incoming update
    if (accessory.context.enableDebugLogging) {
      this.log(
        '[%s] [%s] %s [%s].',
        accessory.displayName,
        params.source,
        this.lang.receivingUpdate,
        JSON.stringify(params)
      )
    }

    // Standardise the object for the receiver function
    const data = {}

    /*
      ONLINE
      API gives online property with values true/false or "true"/"false" (annoying)
      => OUTPUT property online BOOL with values true or false
    */

    if (this.funcs.hasProperty(params, 'online')) {
      data.online = typeof params.online === 'boolean' ? params.online : params.online === 'true'
    }

    /*
      ON/OFF
      API gives powerState property with values 'on' or 'off'
      AWS gives cmd:'turn' and data.val property INT with values 1 or 0
      => OUTPUT property state STR with values 'on' or 'off
    */
    if (params.powerState) {
      data.state = params.powerState
    } else if (params.cmd === 'turn') {
      if (params.data.val > 1) {
        data.stateDual = params.data.val
      } else {
        data.state = params.data.val ? 'on' : 'off'
      }
    }

    /*
      BRIGHTNESS
      API gives brightness property in range [0, 100] or [0, 254] for some models
      AWS gives cmd:'brightness' and data.val property INT always in range [0, 254]
      => OUTPUT property brightness INT in range [0, 100]
    */
    if (this.funcs.hasProperty(params, 'brightness')) {
      data.brightness = this.consts.apiBrightnessScale.includes(accessory.context.gvModel)
        ? Math.round(params.brightness / 2.54)
        : params.brightness
    } else if (params.cmd === 'brightness') {
      data.brightness = this.consts.awsBrightnessNoScale.includes(accessory.context.gvModel)
        ? params.data.val
        : Math.round(params.data.val / 2.54)
    }

    // Sometimes Govee can provide a value out of range of [0, 100]
    if (this.funcs.hasProperty(data, 'brightness')) {
      data.brightness = Math.max(Math.min(data.brightness, 100), 0)
    }

    /*
      COLOUR (RGB)
      API gives color property which is an object {r, g, b}
      AWS gives cmd:'color|colorwc' and data property OBJ {red, green, blue}
      => OUTPUT property color OBJ in format {r, g, b}
    */
    if (params.color) {
      data.rgb = params.color
    } else if (params.cmd === 'color') {
      if (this.funcs.hasProperty(params.data, 'red')) {
        data.rgb = {
          r: params.data.red,
          g: params.data.green,
          b: params.data.blue
        }
      } else if (this.funcs.hasProperty(params.data, 'r')) {
        data.rgb = {
          r: params.data.r,
          g: params.data.g,
          b: params.data.b
        }

        // Show a message in the log saying this device supports color{r, g, b} command if not known
        if (
          !this.consts.awsColourShort.includes(accessory.context.gvModel) &&
          !this.funcs.hasProperty(params.data, 'red')
        ) {
          this.log.warn(
            '[%s] %s [%s].',
            accessory.displayName,
            this.lang.supportColorShort,
            accessory.context.gvModel
          )
        }
      }
    } else if (params.cmd === 'colorwc' && this.funcs.hasProperty(params.data.color, 'red')) {
      data.rgb = {
        r: params.data.color.red,
        g: params.data.color.green,
        b: params.data.color.blue
      }

      // Show a message in the log saying this device supports colorwc command if not known
      if (!this.consts.awsColourWC.includes(accessory.context.gvModel)) {
        this.log.warn(
          '[%s] %s [%s].',
          accessory.displayName,
          this.lang.supportColorWC,
          accessory.context.gvModel
        )
      }
    }

    /*
      COLOUR TEMP (KELVIN)
      API gives colorTem property normally in range [2000, 9000]
      AWS gives cmd:'colorTem' and data.colorTemInKelvin property INT
      => OUTPUT property kelvin INT in range [2000, 7143] (HomeKit range)
    */
    if (params.colorTem) {
      data.kelvin = Math.max(Math.min(params.colorTem, 7143), 2000)
    } else if (params.cmd === 'colorTem') {
      data.kelvin = Math.max(Math.min(params.data.colorTemInKelvin, 7143), 2000)
    } else if (params.cmd === 'colorwc' && params.data.colorTemInKelvin > 0) {
      data.kelvin = Math.max(Math.min(params.data.colorTemInKelvin, 7143), 2000)

      // Show a message in the log saying this device supports colorwc command if not known
      if (!this.consts.awsColourWC.includes(accessory.context.gvModel)) {
        this.log.warn(
          '[%s] %s [%s].',
          accessory.displayName,
          this.lang.supportColorWC,
          accessory.context.gvModel
        )
      }
    }

    /*
      SCENES
      API doesn't support this yet
      AWS gives cmd:'pt' and data OBJ { op: 'mode' OR opcode: 'mode', value: [code, code2?] } }
      BLE plugin doesn't support this yet
      => OUTPUT property scene STR with the code
    */
    if (['bulb', 'pt', 'ptReal'].includes(params.cmd)) {
      data.scene =
        params.cmd === 'ptReal' ? params.data.command.join(',') : params.data.value.join(',')
      data.cmd = params.cmd
      data.prop = ['bulb', 'ptReal'].includes(params.cmd)
        ? ''
        : params.data.op === 'mode'
        ? 'op'
        : 'opcode'
    }

    /*
      BATTERY (leak and thermo sensors)
    */
    if (this.funcs.hasProperty(params, 'battery')) {
      data.battery = Math.min(Math.max(params.battery, 0), 100)
    }

    /*
      LEAK DETECTED (leak sensors)
    */
    if (this.funcs.hasProperty(params, 'leakDetected')) {
      data.leakDetected = params.leakDetected
    }

    /*
      TEMPERATURE (thermo sensors)
    */
    if (this.funcs.hasProperty(params, 'temperature')) {
      data.temperature = params.temperature
    }

    /*
      HUMIDITY (thermo sensors)
    */
    if (this.funcs.hasProperty(params, 'humidity')) {
      data.humidity = params.humidity
    }

    // Send the update to the receiver function
    data.source = params.source
    try {
      accessory.control.externalUpdate(data)
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotUpdated, eText)
    }
  }

  updateAccessoryStatus (accessory, newStatus) {
    // Log the change, at a warning level if the device is reported offline
    if (accessory.context.enableLogging) {
      if (newStatus) {
        this.log('[%s] %s.', accessory.displayName, this.lang.onlineAPI)
      } else {
        this.log.warn('[%s] %s.', accessory.displayName, this.lang.offlineAPI)
      }
    }

    // Update the context item for the plugin UI
    accessory.context.isOnline = newStatus ? 'yes' : 'no'

    // Update any changes to the accessory to the platform
    this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory])
    devicesInHB.set(accessory.UUID, accessory)
  }
}

// Export the plugin to Homebridge
module.exports = hb => hb.registerPlatform(plugin.alias, GoveePlatform)

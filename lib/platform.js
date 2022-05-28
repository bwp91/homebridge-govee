import { createRequire } from 'module';
import { platform } from 'os';
import { join } from 'path';
import storage from 'node-persist';
import apiClient from './connection/api.js';
import awsClient from './connection/aws.js';
import httpClient from './connection/http.js';
import deviceTypes from './device/index.js';
import eveService from './fakegato/fakegato-history.js';
import { k2rgb } from './utils/colour.js';
import platformConsts from './utils/constants.js';
import platformChars from './utils/custom-chars.js';
import eveChars from './utils/eve-chars.js';
import {
  hasProperty,
  isGoveeError,
  logDefault,
  logDuplicate,
  logIgnore,
  logIgnoreItem,
  logIncrease,
  logQuotes,
  logRemove,
  parseDeviceId,
  parseError,
  sleep,
} from './utils/functions.js';
import platformLang from './utils/lang-en.js';

const require = createRequire(import.meta.url);
const plugin = require('../package.json');

const devicesInHB = new Map();
const apiDevices = [];
const httpDevices = [];

export default class {
  constructor(log, config, api) {
    if (!log || !api) {
      return;
    }

    // Begin plugin initialisation
    try {
      this.api = api;
      this.log = log;

      // Configuration objects for accessories
      this.deviceConf = {};
      this.ignoredDevices = [];

      // Make sure user is running Homebridge v1.4 or above
      if (!api?.versionGreaterOrEqual('1.4.0')) {
        throw new Error(platformLang.hbVersionFail);
      }

      // Check the user has configured the plugin
      if (!config) {
        throw new Error(platformLang.pluginNotConf);
      }

      // Log some environment info for debugging
      this.log(
        '%s v%s | System %s | Node %s | HB v%s | HAPNodeJS v%s...',
        platformLang.initialising,
        plugin.version,
        process.platform,
        process.version,
        api.serverVersion,
        api.hap.HAPLibraryVersion(),
      );

      // Apply the user's configuration
      this.config = platformConsts.defaultConfig;
      this.applyUserConfig(config);

      // Set up empty clients
      this.apiClient = false;
      this.bleClient = false;
      this.httpClient = false;

      // Set up the Homebridge events
      this.api.on('didFinishLaunching', () => this.pluginSetup());
      this.api.on('shutdown', () => this.pluginShutdown());
    } catch (err) {
      // Catch any errors during initialisation
      const eText = parseError(err, [platformLang.hbVersionFail, platformLang.pluginNotConf]);
      log.warn('***** %s. *****', platformLang.disabling);
      log.warn('***** %s. *****', eText);
    }
  }

  applyUserConfig(config) {
    // Begin applying the user's config
    Object.entries(config).forEach((entry) => {
      const [key, val] = entry;
      switch (key) {
        case 'apiKey':
        case 'password':
        case 'username':
          if (typeof val !== 'string' || val === '') {
            logIgnore(key);
          } else if (key === 'apiKey') {
            this.config[key] = val.toLowerCase().replace(/[^a-z\d-]+/g, '');
          } else {
            this.config[key] = val;
          }
          break;
        case 'apiWhitelist':
        case 'debug':
        case 'debugFakegato':
        case 'disableDeviceLogging':
        case 'disablePlugin':
        case 'offlineAsOff':
          if (typeof val === 'string') {
            logQuotes(key);
          }
          this.config[key] = val === 'false' ? false : !!val;
          break;
        case 'controlInterval':
        case 'refreshTime': {
          if (typeof val === 'string') {
            logQuotes(key);
          }
          const intVal = parseInt(val, 10);
          if (Number.isNaN(intVal)) {
            logDefault(key, platformConsts.defaultValues[key]);
            this.config[key] = platformConsts.defaultValues[key];
          } else if (intVal < platformConsts.minValues[key]) {
            logIncrease(key, platformConsts.minValues[key]);
            this.config[key] = platformConsts.minValues[key];
          } else {
            this.config[key] = intVal;
          }
          break;
        }
        case 'heaterDevices':
        case 'humidifierDevices':
        case 'leakDevices':
        case 'lightDevices':
        case 'purifierDevices':
        case 'switchDevices':
        case 'thermoDevices':
          if (Array.isArray(val) && val.length > 0) {
            val.forEach((x) => {
              if (!x.deviceId) {
                logIgnoreItem(key);
                return;
              }
              const id = parseDeviceId(x.deviceId);
              if (Object.keys(this.deviceConf).includes(id)) {
                logDuplicate(`${key}.${id}`);
                return;
              }
              const entries = Object.entries(x);
              if (entries.length === 1) {
                logRemove(`${key}.${id}`);
                return;
              }
              this.deviceConf[id] = {};
              entries.forEach((subEntry) => {
                const [k, v] = subEntry;
                switch (k) {
                  case 'adaptiveLightingShift':
                  case 'brightnessStep':
                  case 'lowBattThreshold': {
                    if (typeof v === 'string') {
                      logQuotes(`${key}.${k}`);
                    }
                    const intVal = parseInt(v, 10);
                    if (Number.isNaN(intVal)) {
                      logDefault(`${key}.${id}.${k}`, platformConsts.defaultValues[k]);
                      this.deviceConf[id][k] = platformConsts.defaultValues[k];
                    } else if (intVal < platformConsts.minValues[k]) {
                      logIncrease(`${key}.${id}.${k}`, platformConsts.minValues[k]);
                      this.deviceConf[id][k] = platformConsts.minValues[k];
                    } else {
                      this.deviceConf[id][k] = intVal;
                    }
                    break;
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
                      logIgnore(`${key}.${id}.${k}`);
                    } else {
                      this.deviceConf[id][k] = v.replace(/\s+/g, '');
                    }
                    break;
                  case 'deviceId':
                  case 'label':
                    break;

                  case 'disableAWS':
                  case 'enableBT':
                    if (typeof v === 'string') {
                      logQuotes(`${key}.${id}.${k}`);
                    }
                    this.deviceConf[id][k] = v === 'false' ? false : !!v;
                    break;
                  case 'ignoreDevice':
                    if (typeof v === 'string') {
                      logQuotes(`${key}.${id}.${k}`);
                    }
                    if (!!v && v !== 'false') {
                      this.ignoredDevices.push(id);
                    }
                    break;
                  case 'overrideLogging':
                  case 'showAs': {
                    const inSet = platformConsts.allowed[k].includes(v);
                    if (typeof v !== 'string' || !inSet) {
                      logIgnore(`${key}.${id}.${k}`);
                    } else {
                      this.deviceConf[id][k] = inSet ? v : platformConsts.defaultValues[k];
                    }
                    break;
                  }
                  default:
                    logRemove(`${key}.${id}.${k}`);
                }
              });
            });
          } else {
            logIgnore(key);
          }
          break;
        case 'name':
        case 'platform':
          break;
        default:
          logRemove(key);
          break;
      }
    });
  }

  async pluginSetup() {
    // Plugin has finished initialising so now onto setup
    try {
      // Log that the plugin initialisation has been successful
      this.log('%s.', platformLang.initialised);

      // If the user has disabled the plugin then remove all accessories
      if (this.config.disablePlugin) {
        devicesInHB.forEach((accessory) => this.removeAccessory(accessory));
        throw new Error(platformLang.disabled);
      }

      // Require any libraries that the plugin uses
      this.cusChar = new platformChars(this.api);
      this.eveChar = new eveChars(this.api);
      this.eveService = eveService(this.api);

      // Persist files are used to store device info that can be used by my other plugins
      try {
        this.storageData = storage.create({
          dir: join(this.api.user.persistPath(), '/../bwp91_cache'),
          forgiveParseErrors: true,
        });
        await this.storageData.init();
        this.storageClientData = true;
      } catch (err) {
        if (this.config.debug) {
          const eText = parseError(err);
          this.log.warn('%s %s.', platformLang.storageSetupErr, eText);
        }
      }

      // Set up the HTTP client if Govee username and password have been provided
      try {
        if (!this.config.username || !this.config.password) {
          throw new Error(platformLang.noCreds);
        }
        this.httpClient = new httpClient(this);
        const data = await this.httpClient.login();
        this.accountTopic = data.topic;
        const devices = await this.httpClient.getDevices();
        if (!Array.isArray(devices)) {
          throw new Error(platformLang.noDevList);
        }
        devices.forEach((device) => httpDevices.push(device));
        this.log('%s.', platformLang.availableAWS);
      } catch (err) {
        const eText = parseError(err, [platformLang.noCreds, platformLang.noDevList]);
        this.log.warn('%s %s.', platformLang.disableHTTP, eText);
        this.httpClient = false;
      }

      // Set up the API client if Govee API token has been provided
      try {
        if (!this.config.apiKey) {
          throw new Error(platformLang.noAPIKey);
        }
        this.apiClient = new apiClient(this);
        const devices = await this.apiClient.getDevices();
        if (!Array.isArray(devices)) {
          throw new Error(platformLang.noDevList);
        }
        devices.forEach((device) => apiDevices.push(device));
        this.log('%s.', platformLang.availableAPI);
      } catch (err) {
        const eText = err.message.includes('401')
          ? platformLang.invalidApiKey
          : parseError(err, [platformLang.noAPIKey, platformLang.noDevList]);
        this.log.warn('%s %s.', platformLang.disableAPI, eText);
        this.apiClient = false;
      }

      // Set up the bluetooth client
      try {
        // See if the bluetooth client is available
        /*
          Noble sends the plugin into a crash loop if there is no bluetooth adapter available
          This if statement follows the logic of Noble up to the offending socket.bindRaw(device)
          Put inside a try/catch now to check for error and disable ble control for rest of plugin
        */
        if (['linux', 'freebsd', 'win32'].includes(platform())) {
          // eslint-disable-next-line import/no-unresolved
          const { default: BluetoothHciSocket } = await import('@abandonware/bluetooth-hci-socket');
          const socket = new BluetoothHciSocket();
          const device = process.env.NOBLE_HCI_DEVICE_ID
            ? parseInt(process.env.NOBLE_HCI_DEVICE_ID, 10)
            : undefined;
          socket.bindRaw(device);
        }
        try {
          // eslint-disable-next-line import/no-extraneous-dependencies
          await import('@abandonware/noble');
        } catch (err) {
          throw new Error(platformLang.btNoPackage);
        }
        if (Object.values(this.deviceConf).filter((el) => el.enableBT).length === 0) {
          throw new Error(platformLang.btNoDevices);
        }
        const { default: bleClient } = await import('./connection/ble.js');
        this.bleClient = new bleClient(this);
        this.log('%s.', platformLang.availableBLE);
      } catch (err) {
        // This error thrown from bluetooth-hci-socket does not contain an 'err.message'
        if (err.code === 'ERR_DLOPEN_FAILED') {
          err.message = 'ERR_DLOPEN_FAILED';
        }
        const eText = parseError(err, [
          platformLang.btNoPackage,
          platformLang.btNoDevices,
          'ENODEV, No such device',
          'ERR_DLOPEN_FAILED',
        ]);
        this.log.warn('%s %s.', platformLang.disableBT, eText);
        this.bleClient = false;
      }

      // Initialise the devices
      let httpSyncNeeded = false;
      if (httpDevices && httpDevices.length > 0) {
        // We have some devices from HTTP client
        httpDevices.forEach((httpDevice) => {
          // It appears sometimes the deviceid isn't quite in the form I first expected
          if (httpDevice.device.length === 16) {
            // Eg converts abcd1234abcd1234 to AB:CD:12:34:AB:CD:12:34
            httpDevice.device = httpDevice.device.replace(/..\B/g, '$&:').toUpperCase();
          }

          // Sets the flag to see if we need to set up the HTTP sync
          if (
            [...platformConsts.models.leak, ...platformConsts.models.thermoWifi].includes(httpDevice.sku)
          ) {
            httpSyncNeeded = true;
          }

          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(httpDevice.device)) {
            return;
          }

          // Find the matching device from the API client
          const apiDevice = apiDevices.find((el) => el.device === httpDevice.device);
          if (apiDevice) {
            // Device exists in API data so add the http info to the API object and initialise
            apiDevice.httpInfo = httpDevice;
            apiDevice.isAPIDevice = true;

            // Initialise the device into Homebridge
            this.initialiseDevice(apiDevice);
          } else {
            // Device doesn't exist in API data, but try to initialise as could be other device type
            this.initialiseDevice({
              device: httpDevice.device,
              deviceName: httpDevice.deviceName,
              model: httpDevice.sku,
              httpInfo: httpDevice,
              isAPIDevice: false,
            });
          }
        });
      } else if (apiDevices && apiDevices.length > 0) {
        // No devices from HTTP client, but API token has been given, and devices exist there
        apiDevices.forEach((apiDevice) => {
          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(apiDevice.device)) {
            return;
          }

          // Initialise the device into Homebridge
          apiDevice.isAPIDevice = true;
          this.initialiseDevice(apiDevice);
        });
      } else {
        // No devices either from HTTP client or API client
        throw new Error(platformLang.noDevs);
      }

      // Check for redundant Homebridge accessories
      devicesInHB.forEach(async (accessory) => {
        // If the accessory doesn't exist in Govee then remove it
        if (
          (!httpDevices.some((el) => el.device === accessory.context.gvDeviceId)
            && !apiDevices.some((el) => el.device === accessory.context.gvDeviceId))
          || this.ignoredDevices.includes(accessory.context.gvDeviceId)
        ) {
          this.removeAccessory(accessory);
        }
      });

      // Set up the http client sync needed for leak and thermo sensor devices
      if (httpSyncNeeded) {
        this.goveeHTTPSync();
        this.refreshHTTPInterval = setInterval(
          () => this.goveeHTTPSync(),
          this.config.refreshTime * 1000,
        );
      }

      // Set up the API client sync used for API token models
      if (this.apiClient) {
        // Count how many API devices there are
        const accessoryArray = [...devicesInHB.values()];
        const apiArray = accessoryArray.filter((el) => el.context.useAPIControl);
        const apiCount = apiArray.length;
        if (apiCount > 0) {
          // Govee API allows one request every 7 seconds per device (based on 10000 per day)
          // Increase this to 10 to also take into account control commands
          // This needs to also take into account number of API devices
          // ie 3 API devices means polling must be every 3x10=30 seconds
          const pollingPeriod = apiCount * 10;
          if (pollingPeriod > this.config.refreshTime) {
            if (this.config.apiWhitelist) {
              this.log.warn('Not increasing API polling as API whitelist selected.');
            } else {
              this.config.refreshTime = pollingPeriod;
              this.log.warn(
                'Increasing API polling to %ss due to amount of API devices.',
                this.config.refreshTime,
              );
            }
          }
          this.goveeAPISync();
          this.refreshAPIInterval = setInterval(
            () => this.goveeAPISync(),
            this.config.refreshTime * 1000,
          );
        }
      }

      // Log that the plugin setup has been successful with a welcome message
      const randIndex = Math.floor(Math.random() * platformLang.zWelcome.length);
      setTimeout(() => {
        this.log('%s. %s', platformLang.complete, platformLang.zWelcome[randIndex]);
      }, 2000);
    } catch (err) {
      // Catch any errors during setup
      const eText = parseError(err, [platformLang.noDevs, platformLang.disabled]);
      this.log.warn('***** %s. *****', platformLang.disabling);
      this.log.warn('***** %s. *****', eText);
      this.pluginShutdown();
    }
  }

  pluginShutdown() {
    // A function that is called when the plugin fails to load or Homebridge restarts
    try {
      // Stop the refresh intervals
      if (this.refreshHTTPInterval) {
        clearInterval(this.refreshHTTPInterval);
      }
      if (this.refreshAPIInterval) {
        clearInterval(this.refreshAPIInterval);
      }
    } catch (err) {
      // No need to show errors at this point
    }
  }

  initialiseDevice(device) {
    // Get the correct device type instance for the device
    try {
      const deviceConf = this.deviceConf[device.device] || {};
      const uuid = this.api.hap.uuid.generate(device.device);
      let accessory;
      let devInstance;
      let isLight = false;
      if (platformConsts.models.rgb.includes(device.model)) {
        // Device is an API enabled Wi-Fi (and maybe bluetooth) LED strip/bulb
        isLight = true;
        devInstance = deviceTypes.deviceLightColour;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.rgbBT.includes(device.model)) {
        // Device is a bluetooth-only LED strip/bulb, check it's configured and ble enabled
        if (this.bleClient) {
          deviceConf.enableBT = true;
          isLight = true;
          devInstance = deviceTypes.deviceLightColourBt;
          accessory = devicesInHB.get(uuid) || this.addAccessory(device);
        } else {
          // Not configured, so remove if exists, log a helpful message, and return
          if (devicesInHB.has(uuid)) {
            this.removeAccessory(devicesInHB.get(uuid));
          }
          this.log('[%s] [%s] %s.', device.deviceName, device.device, platformLang.devNotBT);
          return;
        }
      } else if (platformConsts.models.switchSingle.includes(device.model)) {
        // Device is an API enabled Wi-Fi switch
        switch (deviceConf.showAs || platformConsts.defaultValues.showAs) {
          case 'audio': {
            if (devicesInHB.get(uuid)) {
              this.removeAccessory(devicesInHB.get(uuid));
            }
            devInstance = deviceTypes.deviceTVSingle;
            accessory = this.addExternalAccessory(device, 34);
            break;
          }
          case 'box': {
            if (devicesInHB.get(uuid)) {
              this.removeAccessory(devicesInHB.get(uuid));
            }
            devInstance = deviceTypes.deviceTVSingle;
            accessory = this.addExternalAccessory(device, 35);
            break;
          }
          case 'stick': {
            if (devicesInHB.get(uuid)) {
              this.removeAccessory(devicesInHB.get(uuid));
            }
            devInstance = deviceTypes.deviceTVSingle;
            accessory = this.addExternalAccessory(device, 36);
            break;
          }
          case 'cooler': {
            if (!deviceConf.temperatureSource) {
              this.log.warn('[%s] %s.', device.deviceName, platformLang.heaterSimNoSensor);
              if (devicesInHB.has(uuid)) {
                this.removeAccessory(devicesInHB.get(uuid));
              }
              return;
            }
            devInstance = deviceTypes.deviceCoolerSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          case 'heater': {
            if (!deviceConf.temperatureSource) {
              this.log.warn('[%s] %s.', device.deviceName, platformLang.heaterSimNoSensor);
              if (devicesInHB.has(uuid)) {
                this.removeAccessory(devicesInHB.get(uuid));
              }
              return;
            }
            devInstance = deviceTypes.deviceHeaterSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          case 'purifier': {
            devInstance = deviceTypes.devicePurifierSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          case 'switch': {
            devInstance = deviceTypes.deviceSwitchSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          case 'tap': {
            devInstance = deviceTypes.deviceTapSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          case 'valve': {
            devInstance = deviceTypes.deviceValveSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          default:
            devInstance = deviceTypes.deviceOutletSingle;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
        }
      } else if (platformConsts.models.switchDouble.includes(device.model)) {
        // Device is an API enabled Wi-Fi double switch
        switch (deviceConf.showAs || platformConsts.defaultValues.showAs) {
          case 'switch': {
            devInstance = deviceTypes.deviceSwitchDouble;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          default: {
            devInstance = deviceTypes.deviceOutletDouble;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
        }
      } else if (platformConsts.models.leak.includes(device.model)) {
        // Device is a leak sensor
        devInstance = deviceTypes.deviceSensorLeak;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.thermoWifi.includes(device.model)) {
        // Device is a Wi-Fi (supported) thermo-hygrometer sensor
        devInstance = deviceTypes.deviceSensorThermo;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.thermoBLE.includes(device.model)) {
        // Device is a BLE (unsupported) thermo-hygrometer sensor
        this.log('[%s] %s', device.deviceName, platformLang.devBLENoSupp);

        // Remove any existing accessory if exists
        if (devicesInHB.has(uuid)) {
          this.removeAccessory(devicesInHB.get(uuid));
        }
        return;
      } else if (platformConsts.models.fan.includes(device.model)) {
        // Device is a fan
        devInstance = deviceTypes.deviceFan;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.heater.includes(device.model)) {
        // Device is a heater
        devInstance = deviceTypes.deviceHeater;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.humidifier.includes(device.model)) {
        // Device is a humidifier
        devInstance = deviceTypes.deviceHumidifier;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.purifier.includes(device.model)) {
        // Device is a purifier
        devInstance = deviceTypes.devicePurifier;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.noSupport.includes(device.model)) {
        // Device is not and cannot be supported by the plugin
        if (this.config.debug) {
          this.log.warn('[%s] %s.', device.deviceName, platformLang.devNoSupp);
        }

        // Remove any existing accessory if exists
        if (devicesInHB.has(uuid)) {
          this.removeAccessory(devicesInHB.get(uuid));
        }
        return;
      } else {
        // Device is not in any supported model list but could be implemented into the plugin
        this.log.warn(
          '[%s] %s:\n%s',
          device.deviceName,
          platformLang.devMaySupp,
          JSON.stringify(device),
        );
        return;
      }

      // Final check the accessory now exists in Homebridge
      if (!accessory) {
        throw new Error(platformLang.accNotFound);
      }

      // Set the logging level for this device
      switch (deviceConf.overrideLogging) {
        case 'standard':
          accessory.context.enableLogging = true;
          accessory.context.enableDebugLogging = false;
          break;
        case 'debug':
          accessory.context.enableLogging = true;
          accessory.context.enableDebugLogging = true;
          break;
        case 'disable':
          accessory.context.enableLogging = false;
          accessory.context.enableDebugLogging = false;
          break;
        default:
          accessory.context.enableLogging = !this.config.disableDeviceLogging;
          accessory.context.enableDebugLogging = this.config.debug;
          break;
      }

      // Add the config to the context for heater and cooler simulations
      if (['heater', 'cooler'].includes(deviceConf.showAs)) {
        accessory.context.temperatureSource = deviceConf.temperatureSource;
      }

      // Get a kelvin range if provided
      if (device.properties && device.properties.colorTem && device.properties.colorTem.range) {
        accessory.context.minKelvin = device.properties.colorTem.range.min;
        accessory.context.maxKelvin = device.properties.colorTem.range.max;
      }

      // Get a supported command list if provided
      if (device.supportCmds) {
        accessory.context.supportedCmds = device.supportCmds;
      }

      // Add some initial context information which is changed later
      accessory.context.hasAPIControl = device.isAPIDevice;
      accessory.context.useAPIControl = device.isAPIDevice;
      accessory.context.hasAWSControl = false;
      accessory.context.useAWSControl = false;
      accessory.context.hasBLEControl = false;
      accessory.context.useBLEControl = false;
      accessory.context.firmware = false;
      accessory.context.hardware = false;
      accessory.context.image = false;

      // See if we have extra HTTP client info for this device
      if (device.httpInfo) {
        // Save the hardware and firmware versions
        accessory.context.firmware = device.httpInfo.versionSoft;
        accessory.context.hardware = device.httpInfo.versionHard;

        // It's possible to show a nice little icon of the device in the Homebridge UI
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.extResources) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.extResources);
          if (parsed && parsed.skuUrl) {
            accessory.context.image = parsed.skuUrl;
          }
        }

        // HTTP info lets us see if other connection methods are available
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.deviceSettings) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.deviceSettings);

          // Check to see if AWS is possible
          if (parsed && parsed.topic) {
            accessory.context.hasAWSControl = !!parsed.topic;
            accessory.context.awsTopic = parsed.topic;
            if (!deviceConf.disableAWS) {
              accessory.context.useAWSControl = true;
              accessory.awsControl = new awsClient(this, accessory);
            }
          }

          // Check to see if BLE is possible
          if (parsed && parsed.bleName) {
            const providedBle = parsed.address ? parsed.address.toLowerCase() : device.device.substring(6).toLowerCase();
            accessory.context.hasBLEControl = !!parsed.bleName;
            accessory.context.bleAddress = deviceConf.customAddress
              ? deviceConf.customAddress.toLowerCase()
              : providedBle;
            accessory.context.bleName = parsed.bleName;
            if (isLight && deviceConf.enableBT && this.bleClient) {
              accessory.context.useBLEControl = true;
            }
          }

          // Get a min and max temperature/humidity range to show in the homebridge-ui
          if (parsed && hasProperty(parsed, 'temMin') && parsed.temMax) {
            accessory.context.minTemp = parsed.temMin / 100;
            accessory.context.maxTemp = parsed.temMax / 100;
            accessory.context.offTemp = parsed.temCali;
          }
          if (parsed && hasProperty(parsed, 'humMin') && parsed.humMax) {
            accessory.context.minHumi = parsed.humMin / 100;
            accessory.context.maxHumi = parsed.humMax / 100;
            accessory.context.offHumi = parsed.humCali;
          }
        }
      }

      // Create the instance for this device type
      accessory.control = new devInstance(this, accessory);

      // Log the device initialisation
      this.log(
        '[%s] %s [%s] [%s].',
        accessory.displayName,
        platformLang.devInit,
        device.device,
        device.model,
      );

      // Update any changes to the accessory to the platform
      this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory]);
      devicesInHB.set(accessory.UUID, accessory);
    } catch (err) {
      // Catch any errors during device initialisation
      const eText = parseError(err, [platformLang.accNotFound]);
      this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotInit, eText);
    }
  }

  async goveeHTTPSync() {
    try {
      // Obtain a refreshed device list
      const devices = await this.httpClient.getDevices(true);

      // Filter those which are leak sensors
      devices
        .filter((device) => [...platformConsts.models.leak, ...platformConsts.models.thermoWifi].includes(device.sku))
        .forEach(async (device) => {
          try {
            // Generate the UIID from which we can match our Homebridge accessory
            const uiid = this.api.hap.uuid.generate(device.device);

            // Don't continue if the accessory doesn't exist
            if (!devicesInHB.has(uiid)) {
              return;
            }

            // Retrieve the Homebridge accessory
            const accessory = devicesInHB.get(uiid);

            // Make sure the data we need for the device exists
            if (
              !device.deviceExt
              || !device.deviceExt.deviceSettings
              || !device.deviceExt.lastDeviceData
            ) {
              return;
            }

            // Parse the data received
            const parsedSettings = JSON.parse(device.deviceExt.deviceSettings);
            const parsedData = JSON.parse(device.deviceExt.lastDeviceData);

            // Temporary debug logging for leak sensor
            if (device.sku === 'H5054' && accessory.context.enableDebugLogging) {
              this.log.warn(
                '[%s] %s.',
                device.deviceName,
                JSON.stringify(device.deviceExt.lastDeviceData),
              );
            }

            const toReturn = { source: 'HTTP' };
            if (platformConsts.models.leak.includes(device.sku)) {
              // Leak Sensors - check to see of any warnings if the lastTime is above 0
              let hasUnreadLeak = false;
              if (parsedData.lastTime > 0) {
                // Obtain the leak warning messages for this device
                const msgs = await this.httpClient.getLeakDeviceWarning(device.device);

                // Check to see if unread messages exist
                const unreadCount = msgs.filter((msg) => !msg.read && msg.message.toLowerCase().indexOf('leakage alert') > -1);

                //
                if (unreadCount.length > 0) {
                  hasUnreadLeak = true;
                }
              }

              // Generate the params to return
              toReturn.battery = parsedSettings.battery;
              toReturn.leakDetected = hasUnreadLeak;
              toReturn.online = parsedData.gwonline && parsedData.online;
            } else if (platformConsts.models.thermoWifi.includes(device.sku)) {
              toReturn.battery = parsedSettings.battery;
              toReturn.temperature = parsedData.tem;
              toReturn.humidity = parsedData.hum;
              toReturn.online = parsedData.online;
            }

            // Send the information to the update receiver function
            this.receiveDeviceUpdate(accessory, toReturn);
          } catch (err) {
            const eText = parseError(err);
            this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotRef, eText);
          }
        });
    } catch (err) {
      const eText = parseError(err);
      this.log.warn('%s %s.', platformLang.httpSyncFail, eText);
    }
  }

  async goveeAPISync() {
    devicesInHB.forEach(async (accessory) => {
      try {
        // Don't continue if the device doesn't support API retrieval
        if (!accessory.context.hasAPIControl) {
          return;
        }

        // Skip the sync if the client is busy sending updates to Govee
        if (this.disableAPISync) {
          if (this.config.debug) {
            this.log('%s.', platformLang.clientBusy);
          }
          return;
        }

        // Retrieve the current accessory state from Govee
        const res = await this.apiClient.getDevice(accessory.context);

        // Send the data to the receiver function
        this.receiveDeviceUpdate(accessory, Object.assign({ source: 'API' }, ...res));
      } catch (err) {
        // Catch any errors during accessory state refresh
        // 400 response is normal when a device's state is not retrievable - log in debug mode
        if (err.message.includes('400')) {
          if (accessory.context.enableDebugLogging) {
            this.log.warn('[%s] %s.', accessory.displayName, platformLang.devNotRet);
          }
          return;
        }

        // Response is not 400 so check to see if it's a different standard govee error
        let eText;
        if (isGoveeError(err)) {
          if (this.hideLogTimeout) {
            return;
          }
          this.hideLogTimeout = true;
          setTimeout(() => {
            this.hideLogTimeout = false;
          }, 60000);
          eText = platformLang.goveeErr;
        } else {
          eText = parseError(err);
        }
        if (accessory.context.enableDebugLogging) {
          this.log.warn('[%s] %s %s.', accessory.displayName, platformLang.devNotRef, eText);
        }
      }
    });
  }

  addAccessory(device) {
    // Add an accessory to Homebridge
    try {
      const uuid = this.api.hap.uuid.generate(device.device);
      const accessory = new this.api.platformAccessory(device.deviceName, uuid);
      accessory
        .getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Name, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, platformLang.brand)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true);
      accessory.context.gvDeviceId = device.device;
      accessory.context.gvModel = device.model;
      this.api.registerPlatformAccessories(plugin.name, plugin.alias, [accessory]);
      this.configureAccessory(accessory);
      this.log('[%s] %s.', device.deviceName, platformLang.devAdd);
      return accessory;
    } catch (err) {
      // Catch any errors during add
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotAdd, eText);
      return false;
    }
  }

  addExternalAccessory(device, category) {
    try {
      // Add the new accessory to Homebridge
      const accessory = new this.api.platformAccessory(
        device.deviceName,
        this.api.hap.uuid.generate(device.device),
        category,
      );

      // Set the accessory characteristics
      accessory
        .getService(this.api.hap.Service.AccessoryInformation)
        .setCharacteristic(this.api.hap.Characteristic.Name, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, device.deviceName)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, platformLang.brand)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.device)
        .setCharacteristic(this.api.hap.Characteristic.Model, device.model)
        .setCharacteristic(this.api.hap.Characteristic.Identify, true);

      // Register the accessory
      this.api.publishExternalAccessories(plugin.name, [accessory]);
      this.log('[%s] %s.', device.name, platformLang.devAdd);

      // Return the new accessory
      this.configureAccessory(accessory);
      return accessory;
    } catch (err) {
      // Catch any errors during add
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotAdd, eText);
      return false;
    }
  }

  configureAccessory(accessory) {
    // Set the correct firmware version if we can
    if (this.api && accessory.context.firmware) {
      accessory
        .getService(this.api.hap.Service.AccessoryInformation)
        .updateCharacteristic(
          this.api.hap.Characteristic.FirmwareRevision,
          accessory.context.firmware,
        );
    }

    // Add the configured accessory to our global map
    devicesInHB.set(accessory.UUID, accessory);
  }

  removeAccessory(accessory) {
    // Remove an accessory from Homebridge
    try {
      this.api.unregisterPlatformAccessories(plugin.name, plugin.alias, [accessory]);
      devicesInHB.delete(accessory.UUID);
      this.log('[%s] %s.', accessory.displayName, platformLang.devRemove);
    } catch (err) {
      // Catch any errors during remove
      const eText = parseError(err);
      const name = accessory.displayName;
      this.log.warn('[%s] %s %s.', name, platformLang.devNotRemove, eText);
    }
  }

  async sendDeviceUpdate(accessory, params) {
    const data = {};
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
            data: params.value,
          };
          data.awsParams = {
            cmd: 'turn',
            data: { val: params.value === 'on' ? 1 : 0 },
          };
          data.bleParams = {
            cmd: 0x01,
            data: params.value === 'on' ? 0x1 : 0x0,
          };
          break;
        }
        case 'stateDual':
        case 'stateHumi':
        case 'statePuri': {
          data.awsParams = {
            cmd: 'turn',
            data: { val: params.value },
          };
          break;
        }
        case 'speedHeat':
        case 'speedHumi':
        case 'speedPuri':
        case 'stateFan':
        case 'stateHeat': {
          data.awsParams = {
            cmd: 'ptReal',
            data: { command: [params.value] },
          };
          break;
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
            data: platformConsts.apiBrightnessScale.includes(accessory.context.gvModel)
              ? Math.round(params.value * 2.54)
              : params.value,
          };
          data.awsParams = {
            cmd: 'brightness',
            data: {
              val: platformConsts.awsBrightnessNoScale.includes(accessory.context.gvModel)
                ? params.value
                : Math.round(params.value * 2.54),
            },
          };
          data.bleParams = {
            cmd: 0x04,
            data: Math.floor(
              platformConsts.bleBrightnessNoScale.includes(accessory.context.gvModel)
                ? (params.value / 100) * 0x64
                : (params.value / 100) * 0xff,
            ),
          };
          break;
        }
        case 'color': {
          /*
            COLOUR (RGB)
            <= INPUT params.value OBJ with properties { r, g, b }
            API needs { cmd: 'color', data: { r, g, b } }
            AWS needs { cmd: 'color', data: { red, green, blue } }
            BLE needs { cmd: 0x05, data: [0x02, r, g, b] }
            H613B needs { cmd: 0x05, data: [0x0D, r, g, b] }
          */
          data.apiParams = {
            cmd: 'color',
            data: params.value,
          };
          if (platformConsts.awsColourWC.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorwc',
              data: {
                color: {
                  r: params.value.r,
                  g: params.value.g,
                  b: params.value.b,
                  red: params.value.r,
                  green: params.value.g,
                  blue: params.value.b,
                },
                colorTemInKelvin: 0,
              },
            };
          } else if (platformConsts.awsColourLong.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'color',
              data: {
                r: params.value.r,
                g: params.value.g,
                b: params.value.b,
                red: params.value.r,
                green: params.value.g,
                blue: params.value.b,
              },
            };
          } else if (platformConsts.awsColourShort.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'color',
              data: params.value,
            };
          } else if (!platformConsts.awsColourNone.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'color',
              data: {
                red: params.value.r,
                green: params.value.g,
                blue: params.value.b,
              },
            };
          }
          data.bleParams = {
            cmd: 0x05,
            data: [
              platformConsts.bleColourD.includes(accessory.context.gvModel) ? 0x0d : 0x02,
              params.value.r,
              params.value.g,
              params.value.b,
            ],
          };
          break;
        }
        case 'colorTem': {
          /*
            COLOUR TEMP (KELVIN)
            <= INPUT params.value INT in [2000, 7143]
            API needs { cmd: 'colorTem', data: INT[2000, 7143] }
            AWS needs { cmd: 'colorTem', data: { color: {},"colorTemInKelvin": } }
            BLE needs { cmd: 0x05, data: [0x02, 0xff, 0xff, 0xff, 0x01, r, g, b] }
          */
          const [r, g, b] = k2rgb(params.value);
          data.apiParams = {
            cmd: 'colorTem',
            data: params.value,
          };
          if (platformConsts.awsColourWC.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorwc',
              data: {
                color: {
                  r,
                  g,
                  b,
                },
                colorTemInKelvin: params.value,
              },
            };
          } else if (
            platformConsts.awsColourLong.includes(accessory.context.gvModel)
            || platformConsts.awsColourShort.includes(accessory.context.gvModel)
          ) {
            data.awsParams = {
              cmd: 'colorTem',
              data: {
                colorTemInKelvin: params.value,
                color: {
                  r,
                  g,
                  b,
                  red: r,
                  green: g,
                  blue: b,
                },
              },
            };
          } else if (!platformConsts.awsColourNone.includes(accessory.context.gvModel)) {
            data.awsParams = {
              cmd: 'colorTem',
              data: {
                color: {
                  red: r,
                  green: g,
                  blue: b,
                },
                colorTemInKelvin: params.value,
              },
            };
          }
          data.bleParams = {
            cmd: 0x05,
            data: [
              platformConsts.bleColourD.includes(accessory.context.gvModel) ? 0x0d : 0x02,
              0xff,
              0xff,
              0xff,
              0x01,
              r,
              g,
              b,
            ],
          };
          break;
        }
        case 'scene': {
          /*
            SCENES
            <= INPUT params.value STR code
            API doesn't support this yet
            AWS needs { cmd: 'pt', data: { op: 'mode' OR opcode: 'mode', value: code STR } }
            BLE plugin doesn't support this yet
          */
          if (params.value.charAt(0) === '0') {
            data.bleParams = {
              cmd: 0x05,
              data: params.value.replace(/\s+/g, '').split(','),
            };
          } else if (['M', 'o'].includes(params.value.charAt(0))) {
            const codeParts = params.value.trim().split('||');
            if (![2, 3].includes(codeParts.length)) {
              // Code doesn't seem to be in the right format
              throw new Error(platformLang.sceneCodeWrong);
            }
            data.awsParams = {
              cmd: codeParts[1],
              data: {},
            };
            if (codeParts[1] === 'ptReal') {
              data.awsParams.data.command = codeParts[0].split(',');
            } else {
              data.awsParams.data.value = codeParts[0].split(',');
            }
            if (codeParts[2]) {
              data.awsParams.data[codeParts[2]] = 'mode';
            }
          } else {
            // Code doesn't seem to be in the right format
            throw new Error(platformLang.sceneCodeWrong);
          }
          break;
        }
        default:
          throw new Error('Invalid command');
      }

      // Check to see if we have the option to use AWS
      try {
        if (!accessory.context.useAWSControl) {
          throw new Error(platformLang.notAvailable);
        }

        // Check the command is supported by AWS
        if (!data.awsParams) {
          throw new Error(platformLang.cmdNotAWS);
        }

        // Send the command (we don't get a response from this)
        accessory.awsControl.updateDevice(data.awsParams);

        // We can return now, if the only connection method is AWS, or we have sent an AWS scene
        if (
          (!accessory.context.useAPIControl && !accessory.context.useBLEControl)
          || (data.awsParams && params.cmd === 'scene')
        ) {
          return;
        }
        await sleep(500);
      } catch (err) {
        // Print the reason to the log if in debug mode, it's not always necessarily an error
        if (accessory.context.enableDebugLogging) {
          const eText = parseError(err, [
            platformLang.sceneCodeWrong,
            platformLang.notAvailable,
            platformLang.cmdNotAWS,
            platformLang.notAWSConn,
          ]);
          this.log.warn('[%s] %s %s.', accessory.displayName, platformLang.notAWSSent, eText);
        }
      }

      // Continue if:
      // (API HasSupport AND API params)
      // OR (API NotSupport AND BLE Enabled AND BLE params)
      if (
        (!accessory.context.useAPIControl || !data.apiParams)
        && (accessory.context.useAPIControl || !accessory.context.useBLEControl || !data.bleParams)
      ) {
        throw new Error(platformLang.notAvailable);
      }

      // Check the command is supported by bluetooth
      if (!data.bleParams) {
        throw new Error(platformLang.cmdNotBLE);
      }

      // Send the command to the bluetooth client to send
      await this.bleClient.updateDevice(accessory, data.bleParams);
    } catch (err) {
      // If it's the 'incorrect scene code format' error then throw it here again
      if (err.message === platformLang.sceneCodeWrong) {
        throw err;
      }

      // Check to see if we have the option to use API
      if (accessory.context.useAPIControl && data.apiParams) {
        // Set this flag true to pause the API device sync interval
        this.disableAPISync = true;

        // Bluetooth didn't work or not enabled
        if (accessory.context.enableDebugLogging && accessory.context.useBLEControl) {
          const eText = parseError(err, [platformLang.btTimeout]);
          this.log.warn('[%s] %s %s.', accessory.displayName, platformLang.notBTSent, eText);
        }

        // Send the command
        await this.apiClient.updateDevice(accessory, data.apiParams);
        return;
      }
      /*
          At this point we return the error to HomeKit to show a 'No Response' message
          API+AWS+BLE devices: bluetooth failed and API request failed (AWS may have worked)
          API+AWS: API request has failed (AWS may have worked)
          BLE devices: bluetooth failed
        */

      // Throw the error to show the no response in HomeKit
      throw err;
    }
  }

  receiveDeviceUpdate(accessory, params) {
    // No need to continue if the accessory doesn't have the receiver function setup
    if (!accessory.control || !accessory.control.externalUpdate) {
      return;
    }

    // Log the incoming update
    if (accessory.context.enableDebugLogging) {
      this.log(
        '[%s] [%s] %s [%s].',
        accessory.displayName,
        params.source,
        platformLang.receivingUpdate,
        JSON.stringify(params),
      );
    }

    // Standardise the object for the receiver function
    const data = {};

    /*
      ONLINE
      API gives online property with values true/false or "true"/"false" (annoying)
      => OUTPUT property online BOOL with values true or false
    */

    if (hasProperty(params, 'online')) {
      data.online = typeof params.online === 'boolean' ? params.online : params.online === 'true';
    }

    /*
      ON/OFF
      API gives powerState property with values 'on' or 'off'
      AWS gives cmd:'turn' and data.val property INT with values 1 or 0
      => OUTPUT property state STR with values 'on' or 'off
    */
    if (params.powerState) {
      data.state = params.powerState;
    } else if (params.cmd === 'turn') {
      if (params.data.val > 1) {
        data.stateDual = params.data.val;
      } else {
        data.state = params.data.val ? 'on' : 'off';
      }
    }

    /*
      BRIGHTNESS
      API gives brightness property in range [0, 100] or [0, 254] for some models
      AWS gives cmd:'brightness' and data.val property INT always in range [0, 254]
      => OUTPUT property brightness INT in range [0, 100]
    */
    if (hasProperty(params, 'brightness')) {
      data.brightness = platformConsts.apiBrightnessScale.includes(accessory.context.gvModel)
        ? Math.round(params.brightness / 2.54)
        : params.brightness;
    } else if (params.cmd === 'brightness') {
      data.brightness = platformConsts.awsBrightnessNoScale.includes(accessory.context.gvModel)
        ? params.data.val
        : Math.round(params.data.val / 2.54);
    }

    // Sometimes Govee can provide a value out of range of [0, 100]
    if (hasProperty(data, 'brightness')) {
      data.brightness = Math.max(Math.min(data.brightness, 100), 0);
    }

    /*
      COLOUR (RGB)
      API gives color property which is an object {r, g, b}
      AWS gives cmd:'color|colorwc' and data property OBJ {red, green, blue}
      => OUTPUT property color OBJ in format {r, g, b}
    */
    if (params.color) {
      data.rgb = params.color;
    } else if (params.cmd === 'color') {
      if (hasProperty(params.data, 'red')) {
        data.rgb = {
          r: params.data.red,
          g: params.data.green,
          b: params.data.blue,
        };
      } else if (hasProperty(params.data, 'r')) {
        data.rgb = {
          r: params.data.r,
          g: params.data.g,
          b: params.data.b,
        };

        // Show a message in the log saying this device supports color{r, g, b} command if not known
        if (
          !platformConsts.awsColourShort.includes(accessory.context.gvModel)
          && !hasProperty(params.data, 'red')
        ) {
          this.log.warn(
            '[%s] %s [%s].',
            accessory.displayName,
            platformLang.supportColorShort,
            accessory.context.gvModel,
          );
        }
      }
    } else if (params.cmd === 'colorwc' && hasProperty(params.data.color, 'red')) {
      data.rgb = {
        r: params.data.color.red,
        g: params.data.color.green,
        b: params.data.color.blue,
      };

      // Show a message in the log saying this device supports colorwc command if not known
      if (
        !platformConsts.awsColourWC.includes(accessory.context.gvModel)
        && !platformConsts.awsColourShort.includes(accessory.context.gvModel)
        && !platformConsts.awsColourLong.includes(accessory.context.gvModel)
        && !platformConsts.awsColourNone.includes(accessory.context.gvModel)
      ) {
        this.log.warn(
          '[%s] %s [%s].',
          accessory.displayName,
          platformLang.supportColorWC,
          accessory.context.gvModel,
        );
      }
    }

    /*
      COLOUR TEMP (KELVIN)
      API gives colorTem property normally in range [2000, 9000]
      AWS gives cmd:'colorTem' and data.colorTemInKelvin property INT
      => OUTPUT property kelvin INT in range [2000, 7143] (HomeKit range)
    */
    if (params.colorTem) {
      data.kelvin = Math.max(Math.min(params.colorTem, 7143), 2000);
    } else if (params.cmd === 'colorTem') {
      data.kelvin = Math.max(Math.min(params.data.colorTemInKelvin, 7143), 2000);
    } else if (params.cmd === 'colorwc' && params.data.colorTemInKelvin > 0) {
      data.kelvin = Math.max(Math.min(params.data.colorTemInKelvin, 7143), 2000);

      // Show a message in the log saying this device supports colorwc command if not known
      if (!platformConsts.awsColourWC.includes(accessory.context.gvModel)) {
        this.log.warn(
          '[%s] %s [%s].',
          accessory.displayName,
          platformLang.supportColorWC,
          accessory.context.gvModel,
        );
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
      data.scene = params.cmd === 'ptReal' ? params.data.command.join(',') : params.data.value.join(',');
      data.cmd = params.cmd;
      const opCode = params.data.op === 'mode' ? 'op' : 'opcode';
      data.prop = ['bulb', 'ptReal'].includes(params.cmd) ? '' : opCode;
    }

    /*
      BATTERY (leak and thermo sensors)
    */
    if (hasProperty(params, 'battery')) {
      data.battery = Math.min(Math.max(params.battery, 0), 100);
    }

    /*
      LEAK DETECTED (leak sensors)
    */
    if (hasProperty(params, 'leakDetected')) {
      data.leakDetected = params.leakDetected;
    }

    /*
      TEMPERATURE (thermo sensors)
    */
    if (hasProperty(params, 'temperature')) {
      data.temperature = params.temperature;
    }

    /*
      HUMIDITY (thermo sensors)
    */
    if (hasProperty(params, 'humidity')) {
      data.humidity = params.humidity;
    }

    // Send the update to the receiver function
    data.source = params.source;
    try {
      accessory.control.externalUpdate(data);
    } catch (err) {
      const eText = parseError(err);
      this.log.warn('[%s] %s %s.', accessory.displayName, platformLang.devNotUpdated, eText);
    }
  }

  updateAccessoryStatus(accessory, newStatus) {
    // Log the change, at a warning level if the device is reported offline
    if (accessory.context.enableLogging) {
      if (newStatus) {
        this.log('[%s] %s.', accessory.displayName, platformLang.onlineAPI);
      } else {
        this.log.warn('[%s] %s.', accessory.displayName, platformLang.offlineAPI);
      }
    }

    // Update the context item for the plugin UI
    accessory.context.isOnline = newStatus ? 'yes' : 'no';

    // Update any changes to the accessory to the platform
    this.api.updatePlatformAccessories(plugin.name, plugin.alias, [accessory]);
    devicesInHB.set(accessory.UUID, accessory);
  }
}

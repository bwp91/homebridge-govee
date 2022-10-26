import { createRequire } from 'module';
import { join } from 'path';
import storage from 'node-persist';
import PQueue from 'p-queue'; // eslint-disable-line import/no-unresolved
import apiClient from './connection/api.js';
import awsClient from './connection/aws.js';
import awsDeviceClient from './connection/awsDevice.js';
import httpClient from './connection/http.js';
import lanClient from './connection/lan.js';
import deviceTypes from './device/index.js';
import eveService from './fakegato/fakegato-history.js';
import { k2rgb } from './utils/colour.js';
import platformConsts from './utils/constants.js';
import platformChars from './utils/custom-chars.js';
import eveChars from './utils/eve-chars.js';
import {
  hasProperty,
  isGoveeError,
  parseDeviceId,
  parseError,
} from './utils/functions.js';
import platformLang from './utils/lang-en.js';

const require = createRequire(import.meta.url);
const plugin = require('../package.json');

const devicesInHB = new Map();
const apiDevices = [];
const awsDevices = [];
const httpDevices = [];
const lanDevices = [];

export default class {
  constructor(log, config, api) {
    if (!log || !api) {
      return;
    }

    // Begin plugin initialisation
    try {
      this.api = api;
      this.log = log;
      this.isBeta = plugin.version.includes('beta');

      // Configuration objects for accessories
      this.deviceConf = {};
      this.ignoredDevices = [];

      // Make sure user is running Homebridge v1.4 or above
      if (!api.versionGreaterOrEqual?.('1.4.0')) {
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
      this.lanClient = false;

      // Set up the Homebridge events
      this.api.on('didFinishLaunching', () => this.pluginSetup());
      this.api.on('shutdown', () => this.pluginShutdown());
    } catch (err) {
      // Catch any errors during initialisation
      log.warn('***** %s. *****', platformLang.disabling);
      log.warn('***** %s. *****', parseError(err, [platformLang.hbVersionFail, platformLang.pluginNotConf]));
    }
  }

  applyUserConfig(config) {
    // These shorthand functions save line space during config parsing
    const logDefault = (k, def) => {
      this.log.warn('%s [%s] %s %s.', platformLang.cfgItem, k, platformLang.cfgDef, def);
    };
    const logDuplicate = (k) => {
      this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgDup);
    };
    const logIgnore = (k) => {
      this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgIgn);
    };
    const logIgnoreItem = (k) => {
      this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgIgnItem);
    };
    const logIncrease = (k, min) => {
      this.log.warn('%s [%s] %s %s.', platformLang.cfgItem, k, platformLang.cfgLow, min);
    };
    const logQuotes = (k) => {
      this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgQts);
    };
    const logRemove = (k) => {
      this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgRmv);
    };

    // Begin applying the user's config
    Object.entries(config).forEach((entry) => {
      const [key, val] = entry;
      switch (key) {
        case 'apiBleControlInterval':
        case 'apiRefreshTime':
        case 'awsRefreshTime':
        case 'bleRefreshTime':
        case 'httpRefreshTime':
        case 'lanRefreshTime':
        case 'lanScanInterval': {
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
        case 'bleDisable':
        case 'colourSafeMode':
        case 'debug':
        case 'debugFakegato':
        case 'disableDeviceLogging':
        case 'disablePlugin':
        case 'lanDisable':
        case 'offlineAsOff':
          if (typeof val === 'string') {
            logQuotes(key);
          }
          this.config[key] = val === 'false' ? false : !!val;
          break;
        case 'dehumidifierDevices':
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
                  case 'awsDebug':
                  case 'enableBT':
                    if (typeof v === 'string') {
                      logQuotes(`${key}.${id}.${k}`);
                    }
                    this.deviceConf[id][k] = v === 'false' ? false : !!v;
                    break;
                  case 'customAddress':
                  case 'customIPAddress':
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
                    break;
                  case 'ignoreDevice':
                    if (typeof v === 'string') {
                      logQuotes(`${key}.${id}.${k}`);
                    }
                    if (!!v && v !== 'false') {
                      this.ignoredDevices.push(id);
                    }
                    break;
                  case 'label':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(`${key}.${id}.${k}`);
                    } else {
                      this.deviceConf[id][k] = v;
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

      // Sort out some logging functions
      if (this.config.debug || this.isBeta) {
        this.log.debug = this.log;
        this.log.debugWarn = this.log.warn;
      } else {
        this.log.debug = () => {};
        this.log.debugWarn = () => {};
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
        this.log.debugWarn('%s %s.', platformLang.storageSetupErr, parseError(err));
      }

      // Set up the LAN client and perform an initial scan for devices
      try {
        if (this.config.lanDisable) {
          throw new Error(platformLang.disabledInConfig);
        }
        this.lanClient = new lanClient(this);
        const devices = await this.lanClient.getDevices();
        devices.forEach((device) => lanDevices.push(device));
        this.log('[LAN] %s.', platformLang.availableWithDevices(devices.length));
      } catch (err) {
        this.log.warn('[LAN] %s %s.', platformLang.disableClient, parseError(err, [
          platformLang.disabledInConfig,
        ]));
        this.lanClient = false;
        Object.keys(this.deviceConf).forEach((id) => {
          delete this.deviceConf[id].customIPAddress;
        });
      }

      // Set up the HTTP client if Govee username and password have been provided
      try {
        if (!this.config.username || !this.config.password) {
          throw new Error(platformLang.noCreds);
        }
        this.httpClient = new httpClient(this);

        const getDevices = async () => {
          const devices = await this.httpClient.getDevices();
          devices.forEach((device) => httpDevices.push(device));

          this.awsClient = new awsClient(this);
          this.log('[HTTP] %s.', platformLang.availableWithDevices(devices.length));
          this.log('[AWS] %s.', platformLang.available);
        };

        // Try and get access token from the cache to get a device list
        try {
          const storedData = await this.storageData.getItem('Govee_All_Devices_temp');
          const splitData = storedData.split(':::');
          if (splitData[2] !== this.config.username) {
            // Username has changed so throw error to generate new token
            throw new Error(platformLang.accTokenUserChange);
          }
          [this.accountTopic, this.accountToken] = splitData;

          this.log.debug('[HTTP] %s.', platformLang.accTokenFromCache);

          this.httpClient = new httpClient(this);
          await getDevices();
        } catch (err) {
          this.log.warn('[HTTP] %s %s.', platformLang.accTokenFail, parseError(err, [
            platformLang.accTokenUserChange,
          ]));
          const data = await this.httpClient.login();
          this.accountTopic = data.topic;
          const accountToken = data.token;

          // Try and save these to the cache for future reference
          try {
            await this.storageData.setItem(
              'Govee_All_Devices_temp',
              `${this.accountTopic}:::${accountToken}:::${this.config.username}`,
            );
          } catch (e) {
            this.log.warn('[HTTP] %s %s.', platformLang.accTokenStoreErr, parseError(e));
          }
          await getDevices();
        }
      } catch (err) {
        if (err.message.includes('abnormal')) {
          err.message = platformLang.abnormalMessage;
        }
        this.log.warn('[HTTP] %s %s.', platformLang.disableClient, parseError(err, [
          platformLang.noCreds,
          platformLang.abnormalMessage,
        ]));
        this.log.warn('[AWS] %s %s.', platformLang.disableClient, platformLang.needHTTPClient);
        this.httpClient = false;
        this.awsClient = false;
      }

      // Set up the API client if Govee API token has been provided
      try {
        if (!this.config.apiKey) {
          throw new Error(platformLang.noAPIKey);
        }
        this.apiClient = new apiClient(this);
        const devices = await this.apiClient.getDevices();
        devices.forEach((device) => apiDevices.push(device));
        this.log('[API] %s.', platformLang.availableWithDevices(devices.length));
      } catch (err) {
        if (err.message.includes('401')) {
          err.message = platformLang.invalidApiKey;
        }
        this.log.warn('[API] %s %s.', platformLang.disableClient, parseError(err, [
          platformLang.noAPIKey,
          platformLang.invalidApiKey,
        ]));
        this.apiClient = false;
      }

      // Set up the BLE client, if enabled
      try {
        if (this.config.bleDisable) {
          throw new Error(platformLang.disabledInConfig);
        }

        const thisPlatform = process.platform;

        // Bluetooth not supported on Mac
        if (thisPlatform === 'darwin') {
          throw new Error(platformLang.bleMacNoSupp);
        }

        // See if the bluetooth client is available
        /*
          Noble sends the plugin into a crash loop if there is no bluetooth adapter available
          This if statement follows the logic of Noble up to the offending socket.bindRaw(device)
          Put inside a try/catch now to check for error and disable ble control for rest of plugin
        */
        if (['linux', 'freebsd', 'win32'].includes(thisPlatform)) {
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
          throw new Error(platformLang.bleNoPackage);
        }
        const { default: bleClient } = await import('./connection/ble.js');
        this.bleClient = new bleClient(this);
        this.log('[BLE] %s.', platformLang.available);
      } catch (err) {
        // This error thrown from bluetooth-hci-socket does not contain an 'err.message'
        if (err.code === 'ERR_DLOPEN_FAILED') {
          err.message = 'ERR_DLOPEN_FAILED';
        }
        this.log.warn('[BLE] %s %s.', platformLang.disableClient, parseError(err, [
          platformLang.bleNoPackage,
          platformLang.disabledInConfig,
          'ENODEV, No such device',
          'ERR_DLOPEN_FAILED',
        ]));
        this.bleClient = false;
        Object.keys(this.deviceConf).forEach((id) => {
          delete this.deviceConf[id].customAddress;
        });
      }

      // Create the queue used for sending API device commands and requests
      this.disableAPISync = false;

      // Config changed from milliseconds to seconds, so convert if needed
      this.config.apiBleControlInterval = this.config.apiBleControlInterval >= 500
        ? this.config.apiBleControlInterval / 1000
        : this.config.apiBleControlInterval;

      this.queue = new PQueue({
        concurrency: 1,
        interval: this.config.apiBleControlInterval * 1000,
        intervalCap: 1,
        timeout: 10000,
        throwOnTimeout: true,
      });
      this.queue.on('idle', () => {
        this.disableAPISync = false;
      });

      // Initialise the devices
      let bleSyncNeeded = false;
      let httpSyncNeeded = false;
      let lanDevicesWereInitialised = false;
      let httpDevicesWereInitialised = false;
      let apiDevicesWereInitialised = false;

      if (httpDevices && httpDevices.length > 0) {
        // We have some devices from HTTP client
        httpDevices.forEach((httpDevice) => {
          // It appears sometimes the device id isn't quite in the form I first expected
          if (httpDevice.device.length === 16) {
            // Eg converts abcd1234abcd1234 to AB:CD:12:34:AB:CD:12:34
            httpDevice.device = httpDevice.device.replace(/..\B/g, '$&:').toUpperCase();
          }

          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(httpDevice.device)) {
            return;
          }

          // Sets the flag to see if we need to set up the BLE/HTTP syncs
          if (platformConsts.models.leak.includes(httpDevice.sku)) {
            httpSyncNeeded = true;
          }
          if (platformConsts.models.thermoSensor.includes(httpDevice.sku)) {
            bleSyncNeeded = true;
            httpSyncNeeded = true;
          }

          // Find any matching device from the LAN and API clients
          const lanDevice = lanDevices.find((el) => el.device === httpDevice.device);
          const apiDevice = apiDevices.find((el) => el.device === httpDevice.device);

          if (lanDevice) {
            // Device exists in API data so add the http info to the API object and initialise
            this.initialiseDevice({
              ...lanDevice,
              httpInfo: httpDevice,
              model: httpDevice.sku,
              deviceName: httpDevice.deviceName,
              isLANDevice: true,
              isAPIDevice: !!apiDevice,
            });
            lanDevicesWereInitialised = true;
            lanDevice.initialised = true;
            if (apiDevice) {
              apiDevicesWereInitialised = true;
            }
          } else if (apiDevice) {
            // Device exists in API data so add the http info to the API object
            this.initialiseDevice({
              ...apiDevice,
              httpInfo: httpDevice,
              isAPIDevice: true,
            });
            apiDevicesWereInitialised = true;
          } else {
            // Device doesn't exist in API data, but try to initialise as could be other device type
            this.initialiseDevice({
              device: httpDevice.device,
              deviceName: httpDevice.deviceName,
              model: httpDevice.sku,
              httpInfo: httpDevice,
            });
          }
          httpDevicesWereInitialised = true;
        });
      } else if (apiDevices && apiDevices.length > 0) {
        // No devices from HTTP or LAN clients, but API token has been given, and devices exist there
        apiDevices.forEach((apiDevice) => {
          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(apiDevice.device)) {
            return;
          }

          // Find any matching device from the LAN clients
          const lanDevice = lanDevices.find((el) => el.device === apiDevice.device);

          // Initialise the device into Homebridge
          this.initialiseDevice({
            ...apiDevice,
            isAPIDevice: true,
            isLANDevice: !!lanDevice,
          });
          apiDevicesWereInitialised = true;
          if (lanDevice) {
            lanDevicesWereInitialised = true;
            lanDevice.initialised = true;
          }
        });
      }

      // Some LAN devices may exist outside the HTTP and API clients
      const pendingLANDevices = lanDevices.filter((el) => !el.initialised);
      if (pendingLANDevices.length > 0) {
        // No devices from HTTP client, but LAN devices exist
        pendingLANDevices.forEach((lanDevice) => {
          // Check it's not a user-ignored device
          if (this.ignoredDevices.includes(lanDevice.device)) {
            return;
          }

          // Initialise the device into Homebridge
          // Since LAN does not provide a name, we will use the configured label or device id
          // LAN does not provide a model, so we will use the placeholder model for these devices
          this.initialiseDevice({
            device: lanDevice.device,
            deviceName: this.deviceConf?.[lanDevice.device]?.label || lanDevice.device,
            model: lanDevice.sku || 'HXXXX',
            isLANDevice: true,
          });
          lanDevicesWereInitialised = true;
        });
      }

      if (!lanDevicesWereInitialised && !httpDevicesWereInitialised && !apiDevicesWereInitialised) {
        // No devices either from HTTP client, API client or LAN client
        throw new Error(platformLang.noDevs);
      }

      // Check for redundant Homebridge accessories
      devicesInHB.forEach((accessory) => {
        // If the accessory doesn't exist in Govee then remove it
        if (
          (
            !httpDevices.some((el) => el.device === accessory.context.gvDeviceId)
            && !apiDevices.some((el) => el.device === accessory.context.gvDeviceId)
            && !lanDevices.some((el) => el.device === accessory.context.gvDeviceId)
          )
          || this.ignoredDevices.includes(accessory.context.gvDeviceId)
        ) {
          this.removeAccessory(accessory);
        }
      });

      // Set up the ble client sync needed for thermo sensor devices
      if (bleSyncNeeded) {
        try {
          // Check BLE is available
          if (!this.bleClient) {
            throw new Error(platformLang.bleNoPackage);
          }
          // Import the required modules
          const {
            debug: GoveeDebug,
            startDiscovery: sensorStartDiscovery,
            stopDiscovery: sensorStopDiscovery,
          } = await import('govee-bt-client'); // eslint-disable-line import/no-extraneous-dependencies

          if (this.config.debug) {
            GoveeDebug(true);
          }

          this.sensorStartDiscovery = sensorStartDiscovery;
          this.sensorStopDiscovery = sensorStopDiscovery;

          this.refreshBLEInterval = setInterval(
            () => this.goveeBLESync(),
            this.config.bleRefreshTime * 1000,
          );
        } catch (err) {
          this.log.warn('[BLE] %s %s.', platformLang.bleScanDisabled, parseError(err, [platformLang.bleNoPackage]));
        }
      }

      // Set up the http client sync needed for leak and thermo sensor devices
      if (httpSyncNeeded) {
        this.goveeHTTPSync();
        this.refreshHTTPInterval = setInterval(
          () => this.goveeHTTPSync(),
          this.config.httpRefreshTime * 1000,
        );
      }

      // Set up the AWS client sync if there are any compatible devices
      if (awsDevices.length > 0) {
        // Set up the AWS client
        await this.awsClient.connect();

        // No need for await as catches its own errors
        this.goveeAWSSync();
        this.refreshAWSInterval = setInterval(
          () => this.goveeAWSSync(),
          this.config.awsRefreshTime * 1000,
        );
      }

      // Set up the LAN client device scanning and device status polling
      if (lanDevicesWereInitialised) {
        this.lanClient.startDevicesPolling();
        this.lanClient.startStatusPolling();
      }

      // Set up the API client sync used for API token models
      if (apiDevicesWereInitialised) {
        // Count how many API light devices there are
        if (!this.config.apiWhitelist) {
          const apiLightCount = [...devicesInHB.values()].filter((el) => el.context.isAPILight).length;
          if (apiLightCount > 0) {
            // Govee API allows one request every 7 seconds per device (based on 10000 per day)
            // Increase this to 10 to also take into account control commands
            // This needs to also take into account number of API devices
            // ie 3 API devices means polling must be every 3x10=30 seconds
            const pollingPeriod = apiLightCount * 10;
            if (pollingPeriod > this.config.apiRefreshTime) {
              this.config.refreshTime = pollingPeriod;
              this.log.warn('[API] %s %ss .', platformLang.apiPollingIncrease, this.config.refreshTime);
            }
          }
          this.goveeAPISync();
          this.refreshAPIInterval = setInterval(
            () => this.goveeAPISync(),
            this.config.apiRefreshTime * 1000,
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
      this.log.warn('***** %s. *****', platformLang.disabling);
      this.log.warn('***** %s. *****', parseError(err, [platformLang.noDevs, platformLang.disabled]));
      this.pluginShutdown();
    }
  }

  pluginShutdown() {
    // A function that is called when the plugin fails to load or Homebridge restarts
    try {
      // Stop the refresh intervals
      if (this.refreshBLEInterval) {
        clearInterval(this.refreshBLEInterval);
      }
      if (this.refreshHTTPInterval) {
        clearInterval(this.refreshHTTPInterval);

        // No need to await this since it catches its own errors
        this.httpClient.logout();
      }
      if (this.refreshAPIInterval) {
        clearInterval(this.refreshAPIInterval);
      }
      if (this.refreshAWSInterval) {
        clearInterval(this.refreshAWSInterval);
      }

      // Close the LAN client
      this.lanClient.close();
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
      let isJustBLE = false;
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
          isJustBLE = true;
          devInstance = deviceTypes.deviceLightColourBt;
          accessory = devicesInHB.get(uuid) || this.addAccessory(device);
        } else {
          // Not configured, so remove if exists, log a helpful message, and return
          if (devicesInHB.has(uuid)) {
            this.removeAccessory(devicesInHB.get(uuid));
          }
          this.log('[%s] %s.', device.deviceName, platformLang.devNoBlePackage);
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
        // Device is an AWS enabled Wi-Fi double switch
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
      } else if (platformConsts.models.switchTriple.includes(device.model)) {
        // Device is an AWS enabled Wi-Fi double switch
        switch (deviceConf.showAs || platformConsts.defaultValues.showAs) {
          case 'switch': {
            devInstance = deviceTypes.deviceSwitchTriple;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
          default: {
            devInstance = deviceTypes.deviceOutletTriple;
            accessory = devicesInHB.get(uuid) || this.addAccessory(device);
            break;
          }
        }
      } else if (platformConsts.models.leak.includes(device.model)) {
        // Device is a leak sensor
        devInstance = deviceTypes.deviceSensorLeak;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.thermoSensor.includes(device.model)) {
        // Device is a thermo-hygrometer sensor
        devInstance = deviceTypes.deviceSensorThermo;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
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

        if (device.isAPIDevice && device.model === 'H7160') {
          this.log.warn(
            '[%s] Please post the following on GitHub:\n%s\n%s',
            device.deviceName,
            device.model,
            JSON.stringify(device.properties, null, 2),
          );
        }
      } else if (platformConsts.models.dehumidifier.includes(device.model)) {
        // Device is a dehumidifier
        devInstance = deviceTypes.deviceDehumidifier;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);

        if (device.isAPIDevice && device.model === 'H7150') {
          this.log.warn(
            '[%s] Please post the following on GitHub:\n%s\n%s',
            device.deviceName,
            device.model,
            JSON.stringify(device.properties, null, 2),
          );
        }
      } else if (platformConsts.models.purifier.includes(device.model)) {
        // Device is a purifier
        devInstance = deviceTypes.devicePurifier;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);

        if (device.isAPIDevice && ['H7120', 'H7123'].includes(device.model)) {
          this.log.warn(
            '[%s] Please post the following on GitHub:\n%s\n%s',
            device.deviceName,
            device.model,
            JSON.stringify(device.properties, null, 2),
          );
        }
      } else if (platformConsts.models.kettle.includes(device.model)) {
        // Device is a kettle
        devInstance = deviceTypes.deviceKettle;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
      } else if (platformConsts.models.template.includes(device.model)) {
        // Device is a work-in-progress
        devInstance = deviceTypes.deviceTemplate;
        accessory = devicesInHB.get(uuid) || this.addAccessory(device);
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
      if (this.isBeta) {
        deviceConf.overrideLogging = 'debug';
      }
      switch (deviceConf.overrideLogging) {
        case 'standard':
          accessory.log = (msg) => this.log('[%s] %s.', accessory.displayName, msg);
          accessory.logWarn = (msg) => this.log.warn('[%s] %s.', accessory.displayName, msg);
          accessory.logDebug = () => {};
          accessory.logDebugWarn = () => {};
          break;
        case 'debug':
          accessory.log = (msg) => this.log('[%s] %s.', accessory.displayName, msg);
          accessory.logWarn = (msg) => this.log.warn('[%s] %s.', accessory.displayName, msg);
          accessory.logDebug = (msg) => this.log('[%s] %s.', accessory.displayName, msg);
          accessory.logDebugWarn = (msg) => this.log.warn('[%s] %s.', accessory.displayName, msg);
          break;
        case 'disable':
          accessory.log = () => {};
          accessory.logWarn = () => {};
          accessory.logDebug = () => {};
          accessory.logDebugWarn = () => {};
          break;
        default:
          accessory.log = this.config.disableDeviceLogging ? () => {} : (msg) => this.log('[%s] %s.', accessory.displayName, msg);
          accessory.logWarn = this.config.disableDeviceLogging ? () => {} : (msg) => this.log.warn('[%s] %s.', accessory.displayName, msg);
          accessory.logDebug = this.config.debug ? (msg) => this.log('[%s] %s.', accessory.displayName, msg) : () => {};
          accessory.logDebugWarn = this.config.debug ? (msg) => this.log.warn('[%s] %s.', accessory.displayName, msg) : () => {};
          break;
      }

      // Add the temperatureSource config to the context if exists
      if (deviceConf.temperatureSource) {
        accessory.context.temperatureSource = deviceConf.temperatureSource;
      }

      // Get a supported command list if provided, with their options
      if (device.supportCmds && Array.isArray(device.supportCmds)) {
        accessory.context.supportedCmds = device.supportCmds;
        accessory.context.supportedCmdsOpts = {};

        device.supportCmds.forEach((cmd) => {
          if (device?.properties?.[cmd]) {
            accessory.context.supportedCmdsOpts[cmd] = device.properties[cmd];
          }
        });
      }

      // Add some initial context information which is changed later
      accessory.context.hasAPIControl = device.isAPIDevice;
      accessory.context.useAPIControl = device.isAPIDevice;
      accessory.context.isAPILight = device.isAPIDevice
        && [...platformConsts.models.rgb, ...platformConsts.models.switchSingle].includes(device.model);
      accessory.context.hasAWSControl = false;
      accessory.context.useAWSControl = false;
      accessory.context.hasBLEControl = false;
      accessory.context.useBLEControl = false;
      accessory.context.extBLEControl = false;
      accessory.context.hasLANControl = device.isLANDevice;
      accessory.context.useLANControl = device.isLANDevice;
      accessory.context.firmware = false;
      accessory.context.hardware = false;
      accessory.context.image = false;

      // Overrides for when a custom IP is provided, for a light which is not BLE only
      if (deviceConf.customIPAddress && isLight && !isJustBLE) {
        accessory.context.hasLANControl = true;
        accessory.context.useLANControl = true;
      }

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

        // HTTP info lets us see if AWS/BLE connection methods are available
        if (device.httpInfo.deviceExt && device.httpInfo.deviceExt.deviceSettings) {
          const parsed = JSON.parse(device.httpInfo.deviceExt.deviceSettings);

          // Check to see if AWS is possible
          if (parsed && parsed.topic) {
            const needsClient = platformConsts.awsNeedsClient.includes(device.model);
            accessory.context.hasAWSControl = true;
            accessory.context.useAWSControl = true;
            accessory.context.awsTopic = parsed.topic;
            accessory.context.awsStatusCode = needsClient ? [0, 'y'] : [2, 'v'];
            awsDevices.push(device.device);
            if (deviceConf.awsDebug || needsClient) {
              accessory.awsClient = new awsDeviceClient(this, accessory);
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
              accessory.context.extBLEControl = isJustBLE ? 7000 : 4000;
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
      this.api.updatePlatformAccessories([accessory]);
      devicesInHB.set(accessory.UUID, accessory);
    } catch (err) {
      // Catch any errors during device initialisation
      this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotInit, parseError(err, [
        platformLang.accNotFound,
      ]));
    }
  }

  async goveeAWSSync() {
    try {
      awsDevices.forEach(async (deviceId) => {
        // Generate the UUID from which we can match our Homebridge accessory
        const accessory = devicesInHB.get(this.api.hap.uuid.generate(deviceId));
        try {
          await this.awsClient.requestUpdate(accessory);
        } catch (err) {
          accessory.logDebugWarn(`[LAN] ${platformLang.syncFail} ${parseError(err)}`);
        }
      });
    } catch (err) {
      this.log.warn('[LAN] %s %s.', platformLang.syncFail, parseError(err));
    }
  }

  async goveeBLESync() {
    try {
      await this.sensorStartDiscovery((goveeReading) => {
        const accessory = [...devicesInHB.values()].find((acc) => acc.context.bleAddress === goveeReading.address);
        if (accessory) {
          this.receiveDeviceUpdate(accessory, {
            temperature: goveeReading.tempInC * 100,
            humidity: goveeReading.humidity * 100,
            battery: goveeReading.battery,
            source: 'BLE',
          });
        } else {
          this.log.debugWarn('[BLE] %s [%s].', platformLang.bleScanUnknown, goveeReading.address);
        }
      });

      // Stop scanning after 5 seconds
      setTimeout(async () => {
        try {
          await this.sensorStopDiscovery();
        } catch (err) {
          this.log.warn('[BLE] %s %s.', platformLang.bleScanNoStop, parseError(err));
        }
      }, 5000);
    } catch (err) {
      this.log.warn('[BLE] %s %s.', platformLang.bleScanNoStart, parseError(err));
    }
  }

  async goveeHTTPSync() {
    try {
      // Obtain a refreshed device list
      const devices = await this.httpClient.getDevices(true);

      // Filter those which are leak sensors
      devices
        .filter((device) => [...platformConsts.models.leak, ...platformConsts.models.thermoSensor].includes(device.sku))
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
            if (!device.deviceExt || !device.deviceExt.deviceSettings || !device.deviceExt.lastDeviceData) {
              return;
            }

            // Parse the data received
            const parsedSettings = JSON.parse(device.deviceExt.deviceSettings);
            const parsedData = JSON.parse(device.deviceExt.lastDeviceData);

            const toReturn = { source: 'HTTP' };
            if (platformConsts.models.leak.includes(device.sku)) {
              accessory.logDebug(`raw data: ${JSON.stringify({ ...parsedData, ...parsedSettings })}`);

              // Leak Sensors - check to see of any warnings if the lastTime is above 0
              let hasUnreadLeak = false;
              if (parsedData.lastTime > 0) {
                // Obtain the leak warning messages for this device
                const msgs = await this.httpClient.getLeakDeviceWarning(device.device);

                accessory.logDebug(`raw messages: ${JSON.stringify(msgs)}`);

                // Check to see if unread messages exist
                const unreadCount = msgs.filter((msg) => !msg.read && msg.message.toLowerCase().replace(/\s+/g, '').startsWith('leakagealert'));
                if (unreadCount.length > 0) {
                  hasUnreadLeak = true;
                }
              }

              // Generate the params to return
              toReturn.battery = parsedSettings.battery;
              toReturn.leakDetected = hasUnreadLeak;
              toReturn.online = parsedData.gwonline && parsedData.online;
            } else if (platformConsts.models.thermoSensor.includes(device.sku)) {
              toReturn.battery = parsedSettings.battery;
              toReturn.temperature = parsedData.tem;
              toReturn.humidity = parsedData.hum;
              toReturn.online = parsedData.online;
            }

            // Send the information to the update receiver function
            this.receiveDeviceUpdate(accessory, toReturn);
          } catch (err) {
            this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotRef, parseError(err));
          }
        });
    } catch (err) {
      this.log.warn('[HTTP] %s %s.', platformLang.syncFail, parseError(err));
    }
  }

  async goveeAPISync() {
    devicesInHB.forEach(async (accessory) => {
      try {
        // Don't continue if the device doesn't support API retrieval
        if (!accessory.context.isAPILight) {
          return;
        }

        // Skip the sync if the client is busy sending updates to Govee
        if (this.disableAPISync) {
          this.log.debug('%s.', platformLang.clientBusy);
          return;
        }

        // Retrieve the current accessory state from Govee
        const res = await this.apiClient.getDevice(accessory.context);

        // Send the data to the receiver function
        this.receiveDeviceUpdate(accessory, {
          ...res,
          source: 'API',
        });
      } catch (err) {
        // Catch any errors during accessory state refresh
        // 400 response is normal when a device's state is not retrievable - log in debug mode
        if (err.message.includes('400')) {
          accessory.logDebug(`[API] ${platformLang.devNotRet}`);
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
        accessory.logDebugWarn(`${platformLang.devNotRef} ${eText}`);
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
      this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotAdd, parseError(err));
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
      this.log.warn('[%s] %s %s.', device.deviceName, platformLang.devNotAdd, parseError(err));
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
      this.log.warn('[%s] %s %s.', accessory.displayName, platformLang.devNotRemove, parseError(err));
    }
  }

  async sendDeviceUpdate(accessory, params) {
    const data = {};
    // Construct the params for BLE/API/AWS
    switch (params.cmd) {
      case 'state': {
        /*
          ON/OFF
          <= INPUT params.value with values 'on' or 'off'
          API needs { cmd: 'turn', data: 'on'/'off' }
          AWS needs { cmd: 'turn', data: { val: 1/0 } }
          BLE needs { cmd: 0x01, data: 0x1/0x0 }
          LAN needs { cmd: 'turn', data: { value: 'on'/'off' } }
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
        data.lanParams = {
          cmd: 'turn',
          data: { value: params.value === 'on' ? 1 : 0 },
        };
        break;
      }
      case 'stateDual': {
        data.awsParams = {
          cmd: 'turn',
          data: { val: params.value },
        };
        break;
      }
      case 'stateHumi':
      case 'statePuri': {
        data.apiParams = {
          cmd: 'turn',
          data: params.value,
        };
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
      case 'stateKett': {
        data.awsParams = {
          cmd: 'ptReal',
          data: { command: [params.value] },
        };
        break;
      }
      case 'stateHeat': {
        data.apiParams = {
          cmd: 'turn',
          data: params.value === 'MwEBAAAAAAAAAAAAAAAAAAAAADM=' ? 'on' : 'off', // TODO - refactor this
        };
        data.awsParams = {
          cmd: 'multiSync',
          data: { command: [params.value] },
        };
        break;
      }
      case 'swingHeat': {
        data.awsParams = {
          cmd: 'multiSync',
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
          LAN needs { cmd: 'brightness', data: { value: INT[0, 100] } }
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
        data.lanParams = {
          cmd: 'brightness',
          data: {
            value: params.value,
          },
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
          LAN needs { cmd: 'colorwc', data: { color: {r, g, b}, colorTemInKelvin: 0 } }
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
        data.lanParams = {
          cmd: 'colorwc',
          data: {
            color: {
              r: params.value.r,
              g: params.value.g,
              b: params.value.b,
            },
            colorTemInKelvin: 0,
          },
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
          LAN needs { cmd: 'colorwc', data: { color: {r, g, b}, colorTemInKelvin: INT[2000, 9000] } }
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
        data.lanParams = {
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
        break;
      }
      case 'scene': {
        /*
          SCENES
          <= INPUT params.value STR code
          API doesn't support this yet
          AWS needs { cmd: 'pt', data: { op: 'mode' OR opcode: 'mode', value: code STR } }
          BLE this plugin does not support this maybe a TODO
          LAN does not support this
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

    // *********************************** //
    // ********* CONNECTION: LAN ********* //
    // *********************************** //
    // Check to see if we have the option to use LAN.
    if (accessory.context.useLANControl && data.lanParams) {
      try {
        await this.lanClient.updateDevice(accessory, data.lanParams);
        return true;
      } catch (err) {
        accessory.logWarn(`${platformLang.notLANSent} ${parseError(err, [platformLang.lanDevNotFound])}`);
      }
    }

    // *********************************** //
    // ********* CONNECTION: AWS ********* //
    // *********************************** //
    // Check to see if we have the option to use AWS
    if (accessory.context.useAWSControl && data.awsParams) {
      try {
        await this.awsClient.updateDevice(accessory, data.awsParams);
        return true;
      } catch (err) {
        // Print the reason to the log if in debug mode, it's not always necessarily an error
        accessory.logWarn(`${platformLang.notAWSSent} ${parseError(err, [platformLang.notAWSConn])}`);
      }
    }

    // We can return now, if there is no option to use API or BLE
    if (!data.apiParams && !data.bleParams) {
      return true;
    }

    // We use a queue for BLE and API connections for different reasons
    // BLE: We don't want to send multiple commands at once, as it can cause issues
    // API: Too many commands within a small-time period can be ignored
    return this.queue.add(async () => {
      // *********************************** //
      // ********* CONNECTION: BLE ********* //
      // *********************************** //
      // Try bluetooth if enabled, and we have the option to use it
      if (accessory.context.useBLEControl && data.bleParams) {
        try {
          // Send the command to the bluetooth client to send
          await this.bleClient.updateDevice(accessory, data.bleParams);
          return true;
        } catch (err) {
          // Bluetooth didn't work or not enabled
          accessory.logDebugWarn(`${platformLang.notBLESent} ${parseError(err, [platformLang.bleTimeout])}`);
        }
      }

      // *********************************** //
      // ********* CONNECTION: API ********* //
      // *********************************** //
      // Check to see if we have the option to use API
      if (accessory.context.useAPIControl && data.apiParams) {
        // Set this flag true to pause the API device sync interval
        this.disableAPISync = true;

        // Send the command
        await this.apiClient.updateDevice(accessory, data.apiParams);
        return true;
      }
      throw new Error(platformLang.noConnMethod);
    });
  }

  receiveUpdateLAN(accessoryId, params, ipAddress) {
    devicesInHB.forEach(async (accessory) => {
      if (accessory.context.gvDeviceId === accessoryId) {
        this.receiveDeviceUpdate(accessory, params);

        // If we have an IP address, update the IP address
        if (accessory.context.ipAddress !== ipAddress) {
          accessory.context.ipAddress = ipAddress;
          this.api.updatePlatformAccessories([accessory]);
          devicesInHB.set(accessory.UUID, accessory);
        }
      }
    });
  }

  receiveUpdateAWS(payload) {
    const accessoryUUID = this.api.hap.uuid.generate(payload.device);
    const accessory = devicesInHB.get(accessoryUUID);
    payload.state.source = 'AWS';
    if (payload.op && Array.isArray(payload.op.command)) {
      payload.state.commands = payload.op.command;
    }
    this.receiveDeviceUpdate(accessory, payload.state);
  }

  receiveDeviceUpdate(accessory, params) {
    // No need to continue if the accessory doesn't have the receiver function setup
    if (!accessory?.control?.externalUpdate) {
      return;
    }

    // Log the incoming update
    accessory.logDebug(`[${params.source}] ${platformLang.receivingUpdate} ${JSON.stringify(params)}`);

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
      LAN gives 'onOff` property with values 1 or 0
      API gives powerState property with values 'on' or 'off'
      AWS gives cmd:'turn' and data.val property INT with values 1 or 0
      => OUTPUT property state STR with values 'on' or 'off
    */
    if (hasProperty(params, 'onOff')) {
      data.state = params.onOff === 1 ? 'on' : 'off';
    } else if (params.powerState) {
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
      LAN gives brightness property in range [0, 100]
      API gives brightness property in range [0, 100] or [0, 254] for some models
      AWS gives cmd:'brightness' and data.val property INT always in range [0, 254]
      => OUTPUT property brightness INT in range [0, 100]
    */
    if (hasProperty(params, 'brightness')) {
      if (params.source === 'LAN') {
        data.brightness = params.brightness;
      } else if (params.source === 'AWS') {
        data.brightness = platformConsts.awsBrightnessNoScale.includes(accessory.context.gvModel)
          ? params.brightness
          : Math.round(params.brightness / 2.54);
      } else {
        data.brightness = platformConsts.apiBrightnessScale.includes(accessory.context.gvModel)
          ? Math.round(params.brightness / 2.54)
          : params.brightness;
      }
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
      LAN gives color property which is an object {r, g, b}
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
    } else if (params.cmd === 'colorwc' && hasProperty(params.data.color, 'r')) {
      data.rgb = {
        r: params.data.color.r,
        g: params.data.color.g,
        b: params.data.color.b,
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
      LAN gives colorTemInKelvin property in range [2000, 9000]
      API gives colorTem property normally in range [2000, 9000]
      AWS gives cmd:'colorTem' and data.colorTemInKelvin property INT
      => OUTPUT property kelvin INT in range [2000, 7143] (HomeKit range)
    */
    if (params.colorTemInKelvin) {
      data.kelvin = params.colorTemInKelvin;
    } else if (params.colorTem) {
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
      CURRENT TEMPERATURE
    */
    if (hasProperty(params, 'temperature')) {
      data.temperature = params.temperature;
    } else if (params.sta && hasProperty(params.sta, 'curTem')) {
      data.temperature = params.sta.curTem;
    }

    /*
      SET TEMPERATURE
    */
    if (params.sta && hasProperty(params.sta, 'setTem')) {
      data.setTemperature = params.sta.setTem;
    }

    /*
      HUMIDITY (thermo sensors)
    */
    if (hasProperty(params, 'humidity')) {
      data.humidity = params.humidity;
    }

    /*
      COMMANDS
    */
    if (hasProperty(params, 'commands')) {
      data.commands = params.commands;
    }

    // Send the update to the receiver function
    data.source = params.source;
    try {
      accessory.control.externalUpdate(data);
    } catch (err) {
      this.log.warn('[%s] %s %s.', accessory.displayName, platformLang.devNotUpdated, parseError(err));
    }
  }

  updateAccessoryStatus(accessory, newStatus) {
    // Log the change, at a warning level if the device is reported offline
    if (newStatus) {
      accessory.log(platformLang.onlineAPI);
    } else {
      accessory.logWarn(platformLang.offlineAPI);
    }

    // Update the context item for the plugin UI
    accessory.context.isOnline = newStatus ? 'yes' : 'no';

    // Update any changes to the accessory to the platform
    this.api.updatePlatformAccessories([accessory]);
    devicesInHB.set(accessory.UUID, accessory);
  }
}

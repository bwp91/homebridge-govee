/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  defaultConfig: {
    name: 'Govee',
    apiKey: '',
    refreshTime: 30,
    disableDeviceLogging: false,
    debug: false,
    disablePlugin: false,
    ignoredDevices: [],
    platform: 'Govee'
  },

  defaultValues: {
    refreshTime: 30
  },

  minValues: {
    refreshTime: 30
  },

  messages: {
    accNotFound: 'accessory not found',
    alDisabled: 'adaptive lighting disabled due to significant colour change',
    apiKeyMissing: 'Govee API key missing from config',
    brand: 'Govee',
    cfgDef: 'is not a valid number so using default of',
    cfgIgn: 'is not configured correctly so ignoring',
    cfgItem: 'Config entry',
    cfgLow: 'is set too low so increasing to',
    cfgRmv: 'is unused and can be removed',
    cfgQts: 'should not have quotes around its entry',
    complete: '✓ Setup complete',
    curBright: 'current brightness',
    curColour: 'current colour',
    curCCT: 'current CCT',
    curCCTAL: 'current CCT via adaptive lighting',
    curState: 'current state',
    devAdd: 'has been added to Homebridge',
    deviceListFail: 'could not retrieve devices from Govee',
    devInit: 'initialised with id',
    devNotAdd: 'could not be added to Homebridge as',
    devNotConf: 'could not be configured as',
    devNotControl: 'device cannot currently be controlled',
    devNotInit: 'could not be initialised as',
    devNotRef: 'could not be refreshed as',
    devNotRemove: 'could not be removed from Homebridge as',
    devNotRetrievable: 'current status could not be retrieved',
    devNotUpdated: 'could not be updated as',
    devRemove: 'has been removed from Homebridge',
    disabled: 'To change this, set disablePlugin to false',
    disabling: 'Disabling plugin',
    errGetDevice: 'an unknown error occurred [getDevice()]',
    errGetDevices: 'an unknown error occurred [getDevices()]',
    errUpdateDevice: 'an unknown error occured [updateDevice()]',
    identify: 'identify button pressed',
    ignoringUpdate: 'ignoring above update as recently controlled',
    initialised: 'initialised. Syncing with Govee',
    invalidApiKey: 'Invalid Govee API key',
    notConfigured: 'Plugin has not been configured',
    notSuppBrightness: 'does not support command [brightness]',
    notSuppColour: 'does not support command [color]',
    notSuppTurn: 'does not support command [turn]',
    receivingUpdate: 'received update',
    sendingUpdate: 'sending update',
    syncFailed: 'Sync process failed as'
  },

  welcomeMessages: [
    "Don't forget to ☆ this plugin on GitHub if you're finding it useful!",
    'Have a feature request? Visit http://bit.ly/hb-govee-issues to ask!',
    'Interested in sponsoring this plugin? https://github.com/sponsors/bwp91',
    "Join the plugin's Discord community! https://discord.gg/cMGhNtZ3tW",
    'Thanks for using this plugin, I hope you find it helpful!',
    'This plugin has been made with ♥ by bwp91 from the UK!'
  ],

  modelsSwitch: [
    'H5001', 'H5081', 'H7014'
  ],

  modelsRGB: [
    'H6002', 'H6003', 'H6050', 'H6052',
    'H6054', 'H6083', 'H6085', 'H6086',
    'H6089', 'H6104', 'H6109', 'H6110',
    'H6117', 'H6135', 'H6137', 'H6141',
    'H6142', 'H6143', 'H6144', 'H6148',
    'H6159', 'H6160', 'H6163', 'H6182',
    'H6188', 'H6195', 'H6199', 'H7005',
    'H7021', 'H7022'
  ],

  noScale: [
    'H6089', 'H6104', 'H6109', 'H6110',
    'H6117', 'H6141', 'H6142', 'H6148',
    'H6159', 'H6160', 'H6163', 'H6182',
    'H6188', 'H6195', 'H6199', 'H7022'
  ]
}

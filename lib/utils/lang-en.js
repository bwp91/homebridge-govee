/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  accNotFound: 'accessory not found',
  alDisabled: 'adaptive lighting disabled due to significant colour change',
  apiKeyMissing: 'Govee API key missing from config',
  brand: 'Govee',
  cfgDef: 'is not a valid number so using default of',
  cfgIgn: 'is not configured correctly so ignoring',
  cfgIgnItem: 'has an invalid entry which will be ignored',
  cfgItem: 'Config entry',
  cfgLow: 'is set too low so increasing to',
  cfgRmv: 'is unused and can be removed',
  cfgQts: 'should not have quotes around its entry',
  clientBusy: 'Skipping sync as client is busy sending updates',
  complete: '✓ Setup complete',
  curBright: 'current brightness',
  curColour: 'current colour',
  curCCT: 'current CCT',
  curCCTAL: 'current CCT via adaptive lighting',
  curState: 'current state',
  devAdd: 'has been added to Homebridge',
  deviceListFail: 'could not retrieve devices from Govee',
  devInit: 'initialised with id',
  devInitOpts: 'initialising with options',
  devNotAdd: 'could not be added to Homebridge as',
  devNotConf: 'could not be configured as',
  devNotControl: 'device cannot currently be controlled',
  devNotInit: 'could not be initialised as',
  devNotRef: 'could not be refreshed as',
  devNotRemove: 'could not be removed from Homebridge as',
  devNotRet: 'skipping sync as device status not retrievable',
  devNotUpdated: 'could not be updated as',
  devRemove: 'has been removed from Homebridge',
  disabled: 'To change this, set disablePlugin to false',
  disabling: 'Disabling plugin',
  errGetDevice: 'an unknown error occurred [getDevice()]',
  errGetDevices: 'an unknown error occurred [getDevices()]',
  errUpdateDevice: 'an unknown error occured [updateDevice()]',
  goveeErr: 'a problem occurred with the Govee server, will try again',
  goveeInitErr: 'A problem occurred with the Govee server, will try again in 30 seconds',
  identify: 'identify button pressed',
  ignoringUpdate: 'ignoring update',
  initialised: 'initialised. Syncing with Govee',
  invalidApiKey: 'Invalid Govee API key',
  notConfigured: 'Plugin has not been configured',
  notSuppBrightness: 'does not support command [brightness]',
  notSuppColour: 'does not support command [color]',
  notSuppTurn: 'does not support command [turn]',
  receivingUpdate: 'received update',
  sendingUpdate: 'sending update',
  syncFailed: 'Sync process failed as',
  zWelcome: [
    "Don't forget to ☆ this plugin on GitHub if you're finding it useful!",
    'Have a feature request? Visit http://bit.ly/hb-govee-issues to ask!',
    'Interested in sponsoring this plugin? https://github.com/sponsors/bwp91',
    "Join the plugin's Discord community! https://discord.gg/cMGhNtZ3tW",
    'Thanks for using this plugin, I hope you find it helpful!',
    'This plugin has been made with ♥ by bwp91 from the UK!',
    'Have time to give this plugin a review? http://bit.ly/hb-govee-review',
    'Want to see this plugin in your own language? Let me know!'
  ]
}
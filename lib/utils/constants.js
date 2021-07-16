/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  defaultConfig: {
    name: 'Govee',
    username: '',
    password: '',
    apiKey: '',
    refreshTime: 15,
    controlInterval: 500,
    disableDeviceLogging: false,
    debug: false,
    debugFakegato: false,
    disablePlugin: false,
    lightDevices: [],
    switchDevices: [],
    leakDevices: [],
    platform: 'Govee'
  },

  defaultValues: {
    adaptiveLightingShift: 0,
    brightnessStep: 1,
    controlInterval: 500,
    lowBattThreshold: 20,
    overrideLogging: 'default',
    refreshTime: 15,
    showAs: 'default'
  },

  minValues: {
    adaptiveLightingShift: -1,
    brightnessStep: 1,
    lowBattThreshold: 1,
    controlInterval: 500,
    refreshTime: 15
  },

  allowed: {
    lightDevices: [
      'label',
      'deviceId',
      'ignoreDevice',
      'enableBT',
      'enableAWS',
      'adaptiveLightingShift',
      'brightnessStep',
      'scene',
      'sceneTwo',
      'musicMode',
      'musicModeTwo',
      'diyMode',
      'diyModeTwo',
      'overrideLogging'
    ],
    switchDevices: ['label', 'deviceId', 'ignoreDevice', 'enableAWS', 'showAs', 'overrideLogging'],
    leakDevices: ['label', 'deviceId', 'ignoreDevice', 'lowBattThreshold', 'overrideLogging'],
    showAs: ['default', 'switch', 'purifier'],
    overrideLogging: ['default', 'standard', 'debug', 'disable']
  },

  models: {
    rgb: [
      'H6002',
      'H6003',
      'H6050',
      'H6052',
      'H6054',
      'H6062',
      'H6072',
      'H6083',
      'H6085',
      'H6086',
      'H6089',
      'H6104',
      'H6109',
      'H6110',
      'H611A',
      'H611B',
      'H611C',
      'H611Z',
      'H6117',
      'H6121',
      'H6135',
      'H6137',
      'H614C',
      'H614D',
      'H6141',
      'H6142',
      'H6143',
      'H6144',
      'H6148',
      'H615A',
      'H615B',
      'H615C',
      'H615D',
      'H6154',
      'H6159',
      'H6160',
      'H6163',
      'H6182',
      'H6188',
      'H6195',
      'H6199',
      'H7005',
      'H7006',
      'H7007',
      'H7008',
      'H7012',
      'H7013',
      'H7020',
      'H7021',
      'H7022'
    ],
    rgbBT: ['H6181'],
    switch: ['H5001', 'H5080', 'H5081', 'H7014'],
    leak: ['H5054']
  },

  scaleBrightness: [
    'H6002',
    'H6050',
    'H6083',
    'H6085',
    'H6086',
    'H6135',
    'H6137',
    'H6144',
    'H7005',
    'H7021'
  ],
  httpRetryCodes: ['ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNABORTED']
}

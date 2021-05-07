/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  defaultConfig: {
    name: 'Govee',
    apiKey: '',
    language: 'en',
    refreshTime: 15,
    controlInterval: 500,
    forceUpdates: false,
    disableDeviceLogging: false,
    debug: false,
    debugFakegato: false,
    disablePlugin: false,
    switchDevices: [],
    lightDevices: [],
    ignoredDevices: [],
    platform: 'Govee'
  },

  defaultValues: {
    language: 'en',
    controlInterval: 500,
    refreshTime: 15,
    brightnessStep: 1,
    adaptiveLightingShift: 0
  },

  minValues: {
    controlInterval: 500,
    refreshTime: 15,
    brightnessStep: 1,
    adaptiveLightingShift: 0
  },

  allowed: {
    languages: ['en'],
    switchDevices: ['deviceId', 'label', 'overrideDisabledLogging'],
    lightDevices: [
      'deviceId', 'label', 'adaptiveLightingShift', 'brightnessStep', 'overrideDisabledLogging'
    ]
  },

  models: {
    switch: [
      'H5001', 'H5081', 'H7014'
    ],
    rgb: [
      'H6002', 'H6003', 'H6050', 'H6052', 'H6054', 'H6083', 'H6085', 'H6086', 'H6089', 'H6104',
      'H6109', 'H6110', 'H6117', 'H6135', 'H6137', 'H6141', 'H6142', 'H6143', 'H6144', 'H6148',
      'H6159', 'H6160', 'H6163', 'H6182', 'H6188', 'H6195', 'H6199', 'H7005', 'H7021', 'H7022'
    ]
  },

  noScale: [
    'H6003', 'H6089', 'H6104', 'H6052', 'H6109', 'H6110', 'H6117', 'H6141', 'H6142', 'H6143',
    'H6148', 'H6159', 'H6160', 'H6163', 'H6182', 'H6188', 'H6195', 'H6199', 'H7022'
  ]
}

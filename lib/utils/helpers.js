/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = {
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  hasProperty: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
  logMessages: [
    "Don't forget to ☆ this plugin on GitHub if you're finding it useful!"
  ],
  defaults: {
    refreshTime: 15
  },
  modelsLED: [
    'H5001', 'H5081', 'H6002', 'H6003',
    'H6050', 'H6052', 'H6054', 'H6083',
    'H6085', 'H6086', 'H6089', 'H6104',
    'H6109', 'H6110', 'H6117', 'H6135',
    'H6137', 'H6141', 'H6142', 'H6143',
    'H6144', 'H6148', 'H6159', 'H6160',
    'H6163', 'H6182', 'H6188', 'H6195',
    'H6199', 'H7005', 'H7014', 'H7021',
    'H7022'
  ],
  modelsNoScaleBrightness: [
    'H6089', 'H6104', 'H6110', 'H6117',
    'H6141', 'H6142', 'H6148', 'H6159',
    'H6160', 'H6163', 'H6182', 'H6199'
  ]
}

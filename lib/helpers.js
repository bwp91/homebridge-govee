/* jshint -W014, -W033, esversion: 9 */
'use strict'
module.exports = {
  refreshTime: 30,
  modelsLED: [
    'H6160', 'H6163', 'H6104', 'H6109',
    'H6110', 'H6117', 'H6159', 'H7021',
    'H7022', 'H6086', 'H6089', 'H6182',
    'H6085', 'H7014', 'H5081', 'H6188',
    'H6135', 'H6137', 'H6141', 'H6142',
    'H6195', 'H6196', 'H7005', 'H6083',
    'H6002', 'H6003', 'H6148'
  ],
  modelsNoScaleBrightness: [
    'H6159'
  ],
  sleep: ms => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },
  hasProperty: (obj, prop) => {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

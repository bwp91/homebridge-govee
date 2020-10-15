/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
const goveePlatform = require('./lib/govee-platform.js')
module.exports = (hb) => {
  hb.registerPlatform('homebridge-govee', 'Govee', goveePlatform, true)
}

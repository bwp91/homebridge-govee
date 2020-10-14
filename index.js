/* jshint -W014, -W033, esversion: 8 */
'use strict'
module.exports = function (homebridge) {
  const Govee = require('./lib/govee.js')(homebridge)
  homebridge.registerPlatform('homebridge-govee', 'Govee', Govee, true)
}

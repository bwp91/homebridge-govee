'use strict'
module.exports = function (homebridge) {
  const Govee = require('./lib/govee.js')(homebridge)
  homebridge.registerPlatform('homebridge-govee', 'Govee', Govee, true)
}

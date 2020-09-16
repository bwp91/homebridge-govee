/* jshint esversion: 9, -W030, node: true */
"use strict";
module.exports = function (homebridge) {
  let Govee = require("./lib/govee.js")(homebridge);
  homebridge.registerPlatform("homebridge-govee", "Govee", Govee, true);
};

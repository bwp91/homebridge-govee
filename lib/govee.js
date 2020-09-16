/* jshint esversion: 9, -W030, node: true */
"use strict";
let Accessory, Characteristic, Service, UUIDGen;
class Govee {
  constructor(log, config, api) {
    if (!log || !api || !config) return;
    return; // anyway since theres nothing to do!
    this.log = log;
    this.config = config;
    this.api = api;
    this.debug = this.config.debug || false;
    this.devicesInHB = new Map();
    this.devicesInGV = new Map();
    this.api.on("didFinishLaunching", () => {}).on("shutdown", () => {});
  }
  configureAccessory(accessory) {
    if (!this.log) return;
    try {
    } catch (err) {}
  }
}
module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  return Govee;
};

/* jshint esversion: 9, -W030, node: true */
"use strict";
let Accessory, Characteristic, Service, UUIDGen;
const goveeHTTP = require("./goveeHTTP");
class Govee {
  constructor(log, config, api) {
    if (!log || !api || !config) return;
    if (!config.apiKey) {
      log.error("********** Cannot load homebridge-govee *********");
      log.error("Govee API Key missing from the Homebridge config.");
      log.error("*************************************************");
      return;
    }
    this.log = log;
    this.config = config;
    this.api = api;
    this.debug = this.config.debug || false;
    this.devicesInHB = new Map();
    this.devicesInGV = new Map();
    this.api
      .on("didFinishLaunching", () => this.goveeSync())
      .on("shutdown", () => {});
  }
  goveeSync() {
    this.log("Plugin has finished initialising. Synching with Govee.");
    this.httpClient = new goveeHTTP(this.config, this.log);
    this.httpClient
      .getDevices()
      .then((res) => {
        this.httpDevices = res;
        this.httpDevices.forEach((device) =>
          this.devicesInGV.set(device.device, device)
        );
        this.log(this.httpDevices);
      })
      .then(() => {
        (() => {
          //*** Remove all Homebridge accessories if none found ***\\
          if (Object.keys(this.httpDevices).length === 0) {
            Array.from(this.devicesInHB.values()).forEach((a) =>
              this.removeAccessory(a)
            );
            this.devicesInHB.clear();
            this.log.warn("******* Not loading homebridge-govee *******");
            this.log.warn("No devices were found in your Govee account.");
            this.log.warn("********************************************");
            return;
          }
          //*** Logging always helps to see if everything is okay so far ***\\
          this.log(
            "[%s] Govee devices loaded from the Homebridge cache.",
            this.devicesInHB.size
          );
          this.log(
            "[%s] primary devices loaded from your Govee account.",
            this.devicesInGV.size
          );
          //*** Remove Homebridge accessories that don't appear in Govee ***\\
          this.devicesInHB.forEach((a) => {
            if (!this.devicesInGV.has(a.context.gvDeviceId)) {
              this.removeAccessory(a);
            }
          });
          //*** Synchronise devices between Govee and Homebridge and set up ws/lan listeners ***\\
          this.devicesInGV.forEach((d) => this.initialiseDevice(d));
          this.log(
            "Govee sync complete. Don't forget to ⭐️  this plugin on GitHub!"
          );
        })();
      })
      .catch((err) => {
        this.log.error(
          "************** Cannot load homebridge-govee **************"
        );
        this.log.error(err);
        this.log.error(
          "**********************************************************"
        );
      });
  }
  initialiseDevice(device) {
    let accessory;
    //*** First add the device if it isn't already in Homebridge ***\\
    if (!this.devicesInHB.has(device.device)) {
      this.addAccessory(device);
    }
    //*** Next refresh the device ***\\
    if ((accessory = this.devicesInHB.get(device.device))) {
      accessory.context.reachable = true;
      this.log("[%s] found in Govee.", accessory.displayName);
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory);
      if (!this.refreshAccessory(accessory, device)) {
        this.log.warn(
          "[%s] could not be initialised. Please try removing accessory from the Homebridge cache.",
          device.deviceName
        );
      }
    } else {
      this.log.warn(
        "[%s] could not be initialised as it wasn't found in Homebridge.",
        device.deviceName
      );
    }
  }
  addAccessory(device) {
    const accessory = new Accessory(
      device.deviceName,
      UUIDGen.generate(device.device).toString()
    );
    try {
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.SerialNumber, device.device)
        .setCharacteristic(Characteristic.Manufacturer, "Govee")
        .setCharacteristic(Characteristic.Model, device.model)
        .setCharacteristic(Characteristic.Identify, false);
      accessory.context = {
        gvDeviceId: device.device,
        gvModel: device.model,
        reachable: device.controllable,
        supportedCmds: device.supportCmds,
      };
      switch (device.model) {
        case "H6117":
          accessory.addService(Service.Lightbulb);
          break;
        default:
          throw "device is not supported by this plugin. Please create an issue on GitHub";
      }
      this.devicesInHB.set(device.device, accessory);
      this.api.registerPlatformAccessories("homebridge-govee", "Govee", [
        accessory,
      ]);
      this.configureAccessory(accessory);
      this.log("[%s] has been added to Homebridge.", device.deviceName);
    } catch (err) {
      this.log.warn("[%s] could not be added as %s.", device.deviceName, err);
    }
  }
  configureAccessory(accessory) {
    if (!this.log) return;
    try {
    } catch (err) {}
  }
  removeAccessory(accessory) {
    try {
      this.devicesInGV.delete(accessory.context.gvDeviceId);
      this.api.unregisterPlatformAccessories("homebridge-govee", "Govee", [
        accessory,
      ]);
      this.log("[%s] has been removed from Homebridge.", accessory.displayName);
    } catch (err) {
      this.log.warn(
        "[%s] needed to be removed but couldn't as %s.",
        accessory.displayName,
        err
      );
    }
  }
  refreshAccessory(accessory, newParams) {
    switch (accessory.context.gvModel) {
      case "H6117":
        return true;
      default:
        return false;
    }
  }
}
module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  return Govee;
};

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
    this.ignoreNextSync = false;
    this.api
      .on("didFinishLaunching", () => {
        this.log("Plugin has finished initialising. Synching with Govee.");
        this.httpClient = new goveeHTTP(this.config);
        this.goveeSync()
          .then(() => {
            this.log("[%s] devices loaded from the Homebridge cache.", this.devicesInHB.size);
            this.log("[%s] devices loaded from your Govee account.", this.devicesInGV.size);
            this.httpDevices.forEach(d => this.log("[%s] found in Govee.", d.deviceName));
          })
          .catch(err => this.log.warn(err))
          .finally(() => {
            this.refresh = setInterval(
              () => this.goveeSync().catch(err => this.log.warn(err)),
              30000
            );
            this.log("Govee setup complete. Don't forget to ⭐️  this plugin on GitHub!");
          });
      })
      .on("shutdown", () => {
        if (this.refresh) {
          clearInterval(this.refresh);
        }
      });
  }
  goveeSync() {
    return new Promise((resolve, reject) => {
      this.httpClient
        .getDevices()
        .then(res => {
          this.httpDevices = res;
          this.httpDevices.forEach(device => this.devicesInGV.set(device.device, device));
        })
        .then(() => {
          if (this.ignoreNextSync) {
            this.ignoreNextSync = false;
            resolve();
          }
          //*** Remove all Homebridge accessories if none found ***\\
          if (Object.keys(this.httpDevices).length === 0) {
            Array.from(this.devicesInHB.values()).forEach(a => this.removeAccessory(a));
            this.devicesInHB.clear();
          }
          //*** Remove Homebridge accessories that don't appear in Govee ***\\
          this.devicesInHB.forEach(a => {
            if (!this.devicesInGV.has(a.context.gvDeviceId)) {
              this.removeAccessory(a);
            }
          });
          //*** Synchronise devices between Govee and Homebridge ***\\
          this.devicesInGV.forEach(d => this.initialiseDevice(d));
          resolve();
        })
        .catch(err => reject(err));
    });
  }
  initialiseDevice(device) {
    let accessory;
    //*** First add the device if it isn't already in Homebridge ***\\
    if (!this.devicesInHB.has(device.device)) {
      this.addAccessory(device)
        .then(() => this.log("[%s] has been added to Homebridge.", device.deviceName))
        .catch(err =>
          this.log.warn("[%s] could not be added to Homebridge as %s", device.deviceName, err)
        );
    }
    //*** Next refresh the device ***\\
    if ((accessory = this.devicesInHB.get(device.device))) {
      accessory.context.controllable = device.controllable;
      accessory.context.supportedCmds = device.supportCmds;
      if (!["H6117", "H6159"].includes(device.model)) {
        this.log.warn(
          "[%s] is not supported by this plugin. Please create an issue on GitHub mentioning model [%s].",
          device.deviceName,
          device.model
        );
        return;
      }
      this.httpClient
        .getDevice(accessory.context.gvDeviceId, accessory.context.gvModel)
        .then(res => this.refreshAccessory(accessory, Object.assign({}, ...res)))
        .catch(err => {
          this.log.warn(
            "[%s] could not be initialised. Please try removing accessory from the Homebridge cache.",
            device.deviceName
          );
          this.log.warn(err);
          return;
        });
    } else {
      this.log.warn(
        "[%s] could not be initialised as it wasn't found in Homebridge.",
        device.deviceName
      );
    }
  }
  addAccessory(device) {
    return new Promise((resolve, reject) => {
      try {
        const accessory = new Accessory(
          device.deviceName,
          UUIDGen.generate(device.device).toString()
        );
        accessory
          .getService(Service.AccessoryInformation)
          .setCharacteristic(Characteristic.SerialNumber, device.device)
          .setCharacteristic(Characteristic.Manufacturer, "Govee")
          .setCharacteristic(Characteristic.Model, device.model)
          .setCharacteristic(Characteristic.Identify, false);
        accessory.context = {
          gvDeviceId: device.device,
          gvModel: device.model,
        };
        this.devicesInHB.set(device.device, accessory);
        this.api.registerPlatformAccessories("homebridge-govee", "Govee", [accessory]);
        this.configureAccessory(accessory);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
  configureAccessory(accessory) {
    if (!this.log) return;
    try {
      let service =
        accessory.getService(Service.Lightbulb) || accessory.addService(Service.Lightbulb);
      service.getCharacteristic(Characteristic.On).on("set", (value, callback) => {
        callback();
        this.httpClient
          .updateDevice(accessory.context.gvDeviceId, accessory.context.gvModel, {
            name: "turn",
            value: value ? "on" : "off",
          })
          .then(() => {
            if (this.debug) {
              this.log("[%s] has been turned [%s].", accessory.displayName, value ? "on" : "off");
            }
            this.ignoreNextSync = true;
          })
          .catch(err => this.log.warn("[%s] coud not be updated.\n%s", accessory.displayName, err));
      });
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory);
    } catch (err) {
      this.log.warn(err);
    }
  }
  removeAccessory(accessory) {
    try {
      this.devicesInGV.delete(accessory.context.gvDeviceId);
      this.api.unregisterPlatformAccessories("homebridge-govee", "Govee", [accessory]);
      this.log("[%s] has been removed from Homebridge.", accessory.displayName);
    } catch (err) {
      this.log.warn("[%s] needed to be removed but couldn't as %s.", accessory.displayName, err);
    }
  }
  refreshAccessory(accessory, newParams) {
    return new Promise((resolve, reject) => {
      let service;
      switch (accessory.context.gvModel) {
        case "H6117":
        case "H6159":
          service =
            accessory.getService(Service.Lightbulb) || accessory.addService(Service.Lightbulb);
          service
            .updateCharacteristic(Characteristic.On, newParams.powerState === "on")
            .updateCharacteristic(
              Characteristic.Brightness,
              Math.round((newParams.brightness / 254) * 100)
            );
          break;
        default:
          reject();
      }
      accessory.context.online = newParams.online;
      this.devicesInHB.set(accessory.context.gvDeviceId, accessory);
      resolve();
    });
  }
}
module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  return Govee;
};

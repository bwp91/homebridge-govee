/* jshint esversion: 9, -W030, node: true */
"use strict";
let Accessory, Characteristic, Service, UUIDGen;
const cConvert = require("color-convert"),
  constants = require("./constants"),
  cTemp = require("color-temp"),
  goveeHTTP = require("./goveeHTTP");
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
        this.httpClient = new goveeHTTP(this.config, this.log);
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
              constants.refreshTime
            );
            this.log("Govee setup complete. Don't forget to ⭐️  this plugin on GitHub!");
            if (this.config.debugReqRes || false) {
              this.log.warn("Note: 'Request & Response Logging' is not advised for long-term use.");
            }
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
    if (!constants.supportedModels.includes(device.model)) {
      this.log.warn(
        "[%s] is model type [%s] which is not supported by this plugin.",
        device.deviceName,
        device.model
      );
      return;
    }
    let accessory;
    //*** First add the device if it isn't already in Homebridge ***\\
    if (!this.devicesInHB.has(device.device)) {
      this.addAccessory(device);
    }
    //*** Next refresh the device ***\\
    if ((accessory = this.devicesInHB.get(device.device))) {
      accessory.context.controllable = device.controllable;
      accessory.context.supportedCmds = device.supportCmds;
      this.httpClient
        .getDevice(accessory.context)
        .then(res => this.refreshAccessory(accessory, Object.assign({}, ...res)))
        .catch(err => {
          this.log.warn("[%s] could not be initialised.", device.deviceName);
          this.log.warn(err.message || err);
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
      this.log("[%s] has been added to Homebridge.", device.deviceName);
    } catch (err) {
      this.log.warn("[%s] could not be added to Homebridge as %s.", device.deviceName, err);
    }
  }
  configureAccessory(accessory) {
    if (!this.log) return;
    try {
      let lightService =
        accessory.getService(Service.Lightbulb) || accessory.addService(Service.Lightbulb);
      lightService
        .getCharacteristic(Characteristic.On)
        .on("set", (value, callback) => this.internalOnOffUpdate(accessory, value, callback));
      lightService.getCharacteristic(Characteristic.Brightness).on("set", (value, callback) => {
        if (value > 0) {
          if (!lightService.getCharacteristic(Characteristic.On).value) {
            this.internalOnOffUpdate(accessory, true, function () {});
          }
          setTimeout(() => this.internalBrightnessUpdate(accessory, value, callback), 500);
        } else {
          this.internalOnOffUpdate(accessory, false, callback);
        }
      });
      lightService
        .getCharacteristic(Characteristic.Hue)
        .on("set", (value, callback) => this.internalColourUpdate(accessory, value, callback));
      lightService
        .getCharacteristic(Characteristic.Saturation)
        .on("set", (value, callback) => callback());
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
    let lightService = accessory.getService(Service.Lightbulb),
      rgb = {};
    if (newParams.hasOwnProperty("colorTemInKelvin")) {
      let rgbArray = cTemp.temp2rgb(newParams.colorTemInKelvin);
      rgb.r = rgbArray[0];
      rgb.b = rgbArray[1];
      rgb.g = rgbArray[2];
    } else {
      rgb.r = newParams.color.r;
      rgb.g = newParams.color.g;
      rgb.b = newParams.color.b;
    }
    let newColour = cConvert.rgb.hsv(rgb.r, rgb.g, rgb.b);
    lightService
      .updateCharacteristic(Characteristic.On, newParams.powerState === "on")
      .updateCharacteristic(
        Characteristic.Brightness,
        Math.round((newParams.brightness / 254) * 100)
      );
    lightService
      .updateCharacteristic(Characteristic.Hue, newColour[0])
      .updateCharacteristic(Characteristic.Saturation, newColour[1]);

    accessory.context.online = newParams.online;
    this.devicesInHB.set(accessory.context.gvDeviceId, accessory);
  }
  internalOnOffUpdate(accessory, value, callback) {
    callback();
    this.httpClient
      .updateDevice(accessory.context, {
        name: "turn",
        value: value ? "on" : "off",
      })
      .then(() => {
        if (this.debug) {
          this.log("[%s] has been turned [%s].", accessory.displayName, value ? "on" : "off");
        }
        this.ignoreNextSync = true;
      })
      .catch(err =>
        this.log.warn(
          "[%s] could not be updated and its status will be reverted soon. Error: %s.",
          accessory.displayName,
          err
        )
      );
  }
  internalBrightnessUpdate(accessory, value, callback) {
    callback();
    this.httpClient
      .updateDevice(accessory.context, {
        name: "brightness",
        value: value,
      })
      .then(() => {
        if (this.debug) {
          this.log("[%s] has changed brightness to [%s%].", accessory.displayName, value);
        }
        this.ignoreNextSync = true;
      })
      .catch(err =>
        this.log.warn(
          "[%s] could not be updated and its status will be reverted soon. Error: %s.",
          accessory.displayName,
          err
        )
      );
  }
  internalColourUpdate(accessory, value, callback) {
    callback();
    let lightService = accessory.getService(Service.Lightbulb),
      curSat = lightService.getCharacteristic(Characteristic.Saturation).value,
      newRGB = cConvert.hsv.rgb(value, curSat, 100),
      newColour = {
        r: newRGB[0],
        g: newRGB[1],
        b: newRGB[2],
      };
    this.httpClient
      .updateDevice(accessory.context, {
        name: "color",
        value: newColour,
      })
      .then(() => {
        if (this.debug) {
          this.log("[%s] updating hue to [%s°].", accessory.displayName, value);
        }
        this.ignoreNextSync = true;
      })
      .catch(err =>
        this.log.warn(
          "[%s] could not be updated and its status will be reverted soon. Error: %s.",
          accessory.displayName,
          err
        )
      );
  }
}
module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  return Govee;
};

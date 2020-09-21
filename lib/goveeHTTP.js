/* jshint esversion: 9, -W014, -W030, node: true */
"use strict";
const axios = require("axios");
module.exports = class goveeHTTP {
  constructor(config, log) {
    this.apiKey = config.apiKey.toString();
    this.debug = config.debug || false;
    this.debugReqRes = config.debugReqRes || false;
    this.log = log;
  }
  getDevices() {
    return new Promise((resolve, reject) => {
      axios
        .get("https://developer-api.govee.com/v1/devices", {
          headers: {
            "Govee-API-Key": this.apiKey,
          },
        })
        .then(res => {
          let body = res.data;
          if (body.code !== 200 || !body.hasOwnProperty("data")) {
            if (this.debugReqRes) {
              this.log.warn("[getDevices()] HTTP Response:\n%s", JSON.stringify(body, null, 2));
            }
            if (body.hasOwnProperty("message")) {
              throw body.message;
            } else {
              throw "An unknown error occured [getDevices()].";
            }
          }
          if (this.debugReqRes) {
            this.log("[getDevices()] HTTP Response:\n%s", JSON.stringify(body.data, null, 2));
          }
          let deviceList = [];
          if (body.data.devices && body.data.devices.length > 0) {
            body.data.devices.forEach(device => deviceList.push(device));
          }
          resolve(deviceList);
        })
        .catch(err => reject(err.message || err));
    });
  }
  getDevice(accessoryContext) {
    return new Promise((resolve, reject) => {
      axios
        .get("https://developer-api.govee.com/v1/devices/state", {
          headers: {
            "Govee-API-Key": this.apiKey,
          },
          params: {
            device: accessoryContext.gvDeviceId,
            model: accessoryContext.gvModel,
          },
        })
        .then(res => {
          let body = res.data;
          if (body.code !== 200 || !body.hasOwnProperty("data")) {
            if (this.debugReqRes) {
              this.log.warn("[getDevice()] HTTP Response:\n%s", JSON.stringify(body, null, 2));
            }
            if (body.hasOwnProperty("message")) {
              throw body.message;
            } else {
              throw "An unknown error occured [getDevice()].";
            }
          }
          if (this.debugReqRes) {
            this.log("[getDevice()] HTTP Response:\n%s", JSON.stringify(body.data, null, 2));
          }
          if (!body.data.hasOwnProperty("properties")) {
            throw "properties data not received";
          }
          resolve(body.data.properties);
        })
        .catch(err => reject(err.message || err));
    });
  }
  updateDevice(accessoryContext, cmd) {
    return new Promise((resolve, reject) => {
      if (!accessoryContext.online) {
        reject("it is currently offline");
      }
      axios({
        url: "https://developer-api.govee.com/v1/devices/control",
        method: "put",
        headers: {
          "Govee-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        data: {
          device: accessoryContext.gvDeviceId,
          model: accessoryContext.gvModel,
          cmd,
        },
      })
        .then(res => {
          let body = res.data;
          if (body.code !== 200 || !body.hasOwnProperty("data")) {
            if (this.debugReqRes) {
              this.log.warn("[updateDevice()] HTTP Response:\n%s", JSON.stringify(body, null, 2));
            }
            if (body.hasOwnProperty("message")) {
              throw body.message;
            } else {
              throw "An unknown error occured [updateDevice()].";
            }
          }
          resolve();
        })
        .catch(err => reject(err.message || err));
    });
  }
};

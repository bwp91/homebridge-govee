/* jshint esversion: 9, -W030, node: true */
"use strict";
const axios = require("axios");
module.exports = class goveeHTTP {
  constructor(config) {
    this.apiKey = config.apiKey.toString();
    this.debug = config.debug || false;
    this.debugReqRes = config.debugReqRes || false;
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
            if (body.hasOwnProperty("message")) {
              throw body.message;
            } else {
              throw "An unknown error occured [getDevices()].";
            }
          }
          let deviceList = [];
          if (body.data.devices && body.data.devices.length > 0) {
            body.data.devices.forEach(device => deviceList.push(device));
          }
          resolve(deviceList);
        })
        .catch(err => reject(err));
    });
  }

  getDevice(device, model) {
    return new Promise((resolve, reject) => {
      axios
        .get("https://developer-api.govee.com/v1/devices/state", {
          headers: {
            "Govee-API-Key": this.apiKey,
          },
          params: {
            device,
            model,
          },
        })
        .then(res => {
          let body = res.data;
          if (body.code !== 200 || !body.hasOwnProperty("data")) {
            if (body.hasOwnProperty("message")) {
              throw body.message;
            } else {
              throw "An unknown error occured [getDevice()].";
            }
          }
          if (body.data.hasOwnProperty("properties")) {
            resolve(body.data.properties);
          }
          throw "properties data not received";
        })
        .catch(err => reject(err));
    });
  }

  updateDevice(device, model, cmd) {
    return new Promise((resolve, reject) => {
      axios({
        url: "https://developer-api.govee.com/v1/devices/control",
        method: "put",
        headers: {
          "Govee-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        data: {
          device,
          model,
          cmd,
        },
      })
        .then(res => {
          let body = res.data;
          if (body.code !== 200 || !body.hasOwnProperty("data")) {
            if (body.hasOwnProperty("message")) {
              throw body.message;
            } else {
              throw "An unknown error occured [updateDevice()].";
            }
          }
          resolve();
        })
        .catch(err => reject(err));
    });
  }

  delay() {
    return new Promise(resolve => setTimeout(resolve, 30000));
  }
};

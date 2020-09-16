/* jshint esversion: 9, -W030, node: true */
"use strict";
const axios = require("axios");
module.exports = class goveeHTTP {
  constructor(config, log) {
    this.log = log;
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
        .then((res) => {
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
            body.data.devices.forEach((device) => deviceList.push(device));
          }
          resolve(deviceList);
        })
        .catch((err) => {
          if (
            err.hasOwnProperty("message") &&
            err.message.includes("status code 401")
          ) {
            reject("Govee API Key is invalid.");
          } else {
            reject(err.message || err);
          }
        });
    });
  }

  getDevice(deviceId) {
    return new Promise((resolve, reject) => {
      axios({
        url: "https://" + this.httpHost + "/v2/device/thing",
        method: "post",
        headers: {
          Authorization: "Bearer " + this.aToken,
          "Content-Type": "application/json",
          Host: this.httpHost,
          "X-CK-Appid": constants.appId,
          "X-CK-Nonce": Math.random().toString(36).substr(2, 8),
        },
        data: {
          thingList: [
            {
              itemType: 1,
              id: deviceId,
            },
          ],
        },
      })
        .then((res) => {
          let body = res.data;
          if (
            !body.hasOwnProperty("data") ||
            !body.hasOwnProperty("error") ||
            (body.hasOwnProperty("error") && body.error !== 0)
          ) {
            throw JSON.stringify(body, null, 2);
          }
          if (body.data.thingList && body.data.thingList.length === 1) {
            resolve(body.data.thingList[0].itemData);
          } else {
            throw "device not found in eWeLink";
          }
        })
        .catch((err) => {
          if (
            err.hasOwnProperty("code") &&
            ["ENOTFOUND", "ETIMEDOUT"].includes(err.code)
          ) {
            this.log.warn("Unable to reach eWeLink. Retrying in 30 seconds.");
            this.delay().then(() => resolve(this.getDevice(deviceId)));
          } else {
            reject(err.message || err);
          }
        });
    });
  }

  delay() {
    return new Promise((resolve) => setTimeout(resolve, 30000));
  }
};

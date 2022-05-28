import axios from 'axios';
import platformConsts from '../utils/constants.js';
import { sleep } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform) {
    // Create variables usable by the class
    this.debug = platform.config.debug;
    this.log = platform.log;
    this.password = platform.config.password;
    this.username = platform.config.username;

    // Create a client id generated from Govee username which should remain constant
    this.clientId = platform.api.hap.uuid
      .generate(this.username)
      .replace(/-+/g, '')
      .slice(0, 32);
  }

  async login() {
    try {
      // Perform the HTTP request
      const res = await axios({
        url: 'https://app2.govee.com/account/rest/account/v1/login',
        method: 'post',
        data: {
          email: this.username,
          password: this.password,
          client: this.clientId,
        },
        timeout: 30000,
      });

      // Check to see we got a response
      if (!res.data) {
        throw new Error(platformLang.noToken);
      }

      // Check to see we got a needed response
      if (!res.data.client || !res.data.client.token) {
        if (res.data.message && res.data.message.replace(/\s+/g, '') === 'Incorrectpassword') {
          if (this.base64Tried) {
            throw new Error(res.data.message || platformLang.noToken);
          } else {
            this.base64Tried = true;
            this.password = Buffer.from(this.password, 'base64')
              .toString('utf8')
              .replace(/(\r\n|\n|\r)/gm, '')
              .trim();
            return await this.login();
          }
        }
        throw new Error(res.data.message || platformLang.noToken);
      }

      // Make the token available in other functions
      this.token = res.data.client.token;

      // Mark this request complete if in debug mode
      if (this.debug) {
        this.log('Login successful.');
      }

      // Return the account token and topic for AWS
      return {
        token: res.data.client.token,
        topic: res.data.client.topic,
      };
    } catch (err) {
      if (err.code && platformConsts.httpRetryCodes.includes(err.code)) {
        // Retry if another attempt could be successful
        this.log.warn('%s [HTTP - login() - %s].', platformLang.httpRetry, err.code);
        await sleep(30000);
        return this.login();
      }
      throw err;
    }
  }

  async getDevices(isSync = true) {
    try {
      // Make sure we do have the account token
      if (!this.token) {
        throw new Error(platformLang.noTokenExists);
      }

      // Use the token received to get a device list
      const res = await axios({
        url: 'https://app2.govee.com/device/rest/devices/v1/list',
        method: 'post',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Appversion: '4.7.0',
          clientId: this.clientId,
          clientType: 1,
          iotVersion: 0,
        },
        timeout: 30000,
      });

      // Check to see we got a response
      if (!res.data || !res.data.devices) {
        throw new Error(platformLang.noDevices);
      }

      // Return the device list
      return res.data.devices;
    } catch (err) {
      if (!isSync && err.code && platformConsts.httpRetryCodes.includes(err.code)) {
        // Retry if another attempt could be successful (only on init, not sync)
        this.log.warn('%s [HTTP - getDevices() - %s].', platformLang.httpRetry, err.code);
        await sleep(30000);
        return this.getDevices();
      }
      throw err;
    }
  }

  async getLeakDeviceWarning(deviceId) {
    // Make sure we do have the account token
    if (!this.token) {
      throw new Error(platformLang.noTokenExists);
    }

    // Build and send the request
    const res = await axios({
      url: 'https://app2.govee.com/leak/rest/device/v1/warnMessage',
      method: 'post',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Appversion: '3.7.0',
      },
      data: {
        device: deviceId,
        limit: 5,
        sku: 'H5054',
      },
      timeout: 10000,
    });

    // Check to see we got a response
    if (!res.data || !res.data.data) {
      throw new Error(platformLang.noDevices);
    }

    return res.data.data;
  }
}

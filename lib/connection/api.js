import axios from 'axios';
import platformConsts from '../utils/constants.js';
import { sleep } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

export default class {
  constructor(platform) {
    // Create variables usable by the class
    this.apiKey = platform.config.apiKey;
    this.debug = platform.config.debug;
    this.log = platform.log;
    this.rateLimitMessageShown = false;
  }

  async getDevices() {
    try {
      // Used to get a device list from Govee (lights)
      const resLights = await axios.get('https://developer-api.govee.com/v1/devices', {
        headers: {
          'Govee-API-Key': this.apiKey,
        },
        timeout: 10000,
      });

      // Parse the response
      const bodyLights = resLights.data;

      // Check for any errors
      if (bodyLights.code !== 200 || !bodyLights.data) {
        const eText = bodyLights.message || platformLang.errGetDevices;
        throw new Error(`${eText}:\n${JSON.stringify(bodyLights)}`);
      }

      // Used to get a device list from Govee (appliances)
      const resAppliances = await axios.get('https://developer-api.govee.com/v1/appliance/devices', {
        headers: {
          'Govee-API-Key': this.apiKey,
        },
        timeout: 10000,
      });

      // Parse the response
      const bodyAppliances = resAppliances.data;

      // Check for any errors
      if (bodyAppliances.code !== 200 || !bodyAppliances.data) {
        const eText = bodyAppliances.message || platformLang.errGetDevices;
        throw new Error(`${eText}:\n${JSON.stringify(bodyAppliances)}`);
      }

      // Return the combined device list
      return [...bodyLights.data.devices || [], ...bodyAppliances.data.devices || []];
    } catch (err) {
      // Let's look for rate-limiting errors
      if (err.response?.status === 429) {
        if (this.rateLimitMessageShown) {
          this.log.warn('Still receiving 429 [rate limit exceeded], trying again in 10 minutes...');
        } else {
          this.log.warn('Govee API quota limits reached, will try again in 10 minutes...');
          this.log.warn('Unfortunately the plugin will not work until fully initialised.');
          this.rateLimitMessageShown = true;
        }
        await sleep(600000);
        return this.getDevices();
      }
      if (platformConsts.httpRetryCodes.includes(err.code)) {
        // Retry if another attempt could be successful
        this.log.warn('%s [API - getDevices() - %s].', platformLang.httpRetry, err.code);
        await sleep(30000);
        return this.getDevices();
      }
      throw err;
    }
  }

  async getDevice(accContext) {
    try {
      // Used to get the status of a specific device (only works for non-appliances)
      const res = await axios.get('https://developer-api.govee.com/v1/devices/state', {
        headers: {
          'Govee-API-Key': this.apiKey,
        },
        params: {
          device: accContext.gvDeviceId,
          model: accContext.gvModel,
        },
        timeout: 10000,
      });

      // Parse the response
      const body = res.data;

      // Check for any errors
      if (body.code !== 200 || !body.data || !body.data.properties) {
        const eText = body.message || platformLang.errGetDevice;
        throw new Error(`${eText}:\n${JSON.stringify(body)}`);
      }

      // Return the device state
      return body.data.properties;
    } catch (err) {
      if (err.response?.status === 429) {
        const availX = err.response.headers['x-ratelimit-remaining'];
        const limitX = err.response.headers['x-ratelimit-limit'];
        const resetX = new Date(err.response.headers['x-ratelimit-reset'] * 1000);
        const availA = err.response.headers['api-ratelimit-remaining'];
        const limitA = err.response.headers['api-ratelimit-limit'];
        const resetA = new Date(err.response.headers['api-ratelimit-reset'] * 1000);

        // Check which rate limit has been hit
        let errString;
        if (availX === '0') {
          errString = `Govee API total daily requests of ${limitX} has been reached. Resets on ${resetX}.`;
        } else if (availA === '0') {
          errString = `Govee API per-minute device requests of ${limitA} has been reached. Resets on ${resetA}.`;
        } else {
          errString = `Rate-limiting remaining requests: [${availX}/${limitX}] [${availA}/${limitA}].`;
        }
        this.log.warn(errString);
        throw new Error('API rate-limiting has been reached, see the Govee API docs for more info');
      }
      throw err;
    }
  }

  async updateDevice(accessory, params) {
    try {
      // Used to update the state of a specific device

      // Log the request if in debug mode
      if (accessory.context.enableDebugLogging) {
        this.log(
          '[%s] %s %s.',
          accessory.displayName,
          platformLang.sendingUpdate,
          JSON.stringify({ name: params.cmd, value: params.data }),
        );
      }

      // Perform the HTTP request, depending on the type of device
      const res = await axios({
        url: accessory.context.isAPILight
          ? 'https://developer-api.govee.com/v1/devices/control'
          : 'https://developer-api.govee.com/v1/appliance/devices/control',
        method: 'put',
        headers: {
          'Govee-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        data: {
          device: accessory.context.gvDeviceId,
          model: accessory.context.gvModel,
          cmd: {
            name: params.cmd,
            value: params.data,
          },
        },
        timeout: 9000,
      });

      // Parse the response
      const body = res.data;

      // Check for any errors
      if (body.code !== 200 || !body.data) {
        const eText = body.message || platformLang.errUpdateDevice;
        throw new Error(`${eText}:\n${JSON.stringify(body)}`);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        const availX = err.response.headers['x-ratelimit-remaining'];
        const limitX = err.response.headers['x-ratelimit-limit'];
        const resetX = new Date(err.response.headers['x-ratelimit-reset'] * 1000);
        const availA = err.response.headers['api-ratelimit-remaining'];
        const limitA = err.response.headers['api-ratelimit-limit'];
        const resetA = new Date(err.response.headers['api-ratelimit-reset'] * 1000);

        // Check which rate limit has been hit
        let errString;
        if (availX?.toString() === '0') {
          errString = `Govee API total daily requests of ${limitX} has been reached. Resets on ${resetX}.`;
        } else if (availA?.toString() === '0') {
          errString = `Govee API per-minute device requests of ${limitA} has been reached. Resets on ${resetA}.`;
        } else {
          errString = `Rate-limiting remaining requests: [${availX}/${limitX}] [${availA}/${limitA}].`;
        }
        this.log.warn(errString);
        throw new Error('API rate-limiting has been reached, see the Govee API docs for more info');
      }
      throw err;
    }
  }
}

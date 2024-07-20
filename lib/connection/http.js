import { Buffer } from 'node:buffer'

import axios from 'axios'

import platformConsts from '../utils/constants.js'
import { parseError, sleep } from '../utils/functions.js'
import platformLang from '../utils/lang-en.js'

export default class {
  constructor(platform) {
    // Create variables usable by the class
    this.log = platform.log
    this.password = platform.config.password
    this.token = platform.accountToken
    this.tokenTTR = platform.accountTokenTTR
    this.username = platform.config.username

    // May need changing from time to time
    this.appVersion = '5.6.01'
    this.userAgent = `GoveeHome/${this.appVersion} (com.ihoment.GoVeeSensor; build:2; iOS 16.5.0) Alamofire/5.6.4`

    // Create a client id generated from Govee username which should remain constant
    let clientSuffix = platform.api.hap.uuid.generate(this.username).replace(/-/g, '') // 32 chars
    clientSuffix = clientSuffix.substring(0, clientSuffix.length - 2) // 30 chars
    this.clientId = `hb${clientSuffix}` // 32 chars
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
      })

      // Check to see we got a response
      if (!res.data) {
        throw new Error(platformLang.noToken)
      }

      // Check to see we got a needed response
      if (!res.data.client || !res.data.client.token) {
        if (res.data.message && res.data.message.replace(/\s+/g, '') === 'Incorrectpassword') {
          if (this.base64Tried) {
            throw new Error(res.data.message || platformLang.noToken)
          } else {
            this.base64Tried = true
            this.password = Buffer.from(this.password, 'base64')
              .toString('utf8')
              .replace(/\r\n|\n|\r/g, '')
              .trim()
            return await this.login()
          }
        }
        throw new Error(res.data.message || platformLang.noToken)
      }

      // Also grab an access token specifically for the get tap to run endpoint
      const ttrRes = await axios({
        url: 'https://community-api.govee.com/os/v1/login',
        method: 'post',
        data: {
          email: this.username,
          password: this.password,
        },
        timeout: 30000,
      })

      // Make the token available in other functions
      this.token = res.data.client.token
      this.tokenTTR = ttrRes.data.data.token

      // Mark this request complete if in debug mode
      this.log.debug('[HTTP] %s.', platformLang.loginSuccess)

      // Also grab the iot data
      const iotRes = await axios({
        url: 'https://app2.govee.com/app/v1/account/iot/key',
        method: 'get',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'appVersion': this.appVersion,
          'clientId': this.clientId,
          'clientType': 1,
          'iotVersion': 0,
          'timestamp': Date.now(),
          'User-Agent': this.userAgent,
        },
      })

      // Return the account token and topic for AWS
      return {
        accountId: res.data.client.accountId,
        client: this.clientId,
        endpoint: iotRes.data.data.endpoint,
        iot: iotRes.data.data.p12,
        iotPass: iotRes.data.data.p12Pass,
        token: res.data.client.token,
        tokenTTR: this.tokenTTR,
        topic: res.data.client.topic,
      }
    } catch (err) {
      if (err.code && platformConsts.httpRetryCodes.includes(err.code)) {
        // Retry if another attempt could be successful
        this.log.warn('[HTTP] %s [login() - %s].', platformLang.httpRetry, err.code)
        await sleep(30000)
        return this.login()
      }
      throw err
    }
  }

  async logout() {
    try {
      await axios({
        url: 'https://app2.govee.com/account/rest/account/v1/logout',
        method: 'post',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'appVersion': this.appVersion,
          'clientId': this.clientId,
          'clientType': 1,
          'iotVersion': 0,
          'timestamp': Date.now(),
          'User-Agent': this.userAgent,
        },
      })
    } catch (err) {
      // Logout is only called on homebridge shutdown, so we can just log the error
      this.log.warn('[HTTP] %s %s.', platformLang.logoutFail, parseError(err))
    }
  }

  async getDevices(isSync = true) {
    try {
      // Make sure we do have the account token
      if (!this.token) {
        throw new Error(platformLang.noTokenExists)
      }

      // Use the token received to get a device list
      const res = await axios({
        url: 'https://app2.govee.com/device/rest/devices/v1/list',
        method: 'post',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'appVersion': this.appVersion,
          'clientId': this.clientId,
          'clientType': 1,
          'iotVersion': 0,
          'timestamp': Date.now(),
          'User-Agent': this.userAgent,
        },
        timeout: 30000,
      })

      // Check to see we got a response
      if (!res.data || !res.data.devices) {
        throw new Error(platformLang.noDevices)
      }

      // Return the device list
      return res.data.devices || []
    } catch (err) {
      if (!isSync && err.code && platformConsts.httpRetryCodes.includes(err.code)) {
        // Retry if another attempt could be successful (only on init, not sync)
        this.log.warn('[HTTP] %s [getDevices() - %s].', platformLang.httpRetry, err.code)
        await sleep(30000)
        return this.getDevices()
      }
      throw err
    }
  }

  async getTapToRuns() {
    // Build and send the request
    const res = await axios({
      url: 'https://app2.govee.com/bff-app/v1/exec-plat/home',
      method: 'get',
      headers: {
        'Authorization': `Bearer ${this.tokenTTR}`,
        'appVersion': this.appVersion,
        'clientId': this.clientId,
        'clientType': 1,
        'iotVersion': 0,
        'timestamp': Date.now(),
        'User-Agent': this.userAgent,
      },
      timeout: 10000,
    })

    // Check to see we got a response
    if (!res?.data?.data?.components) {
      throw new Error('not a valid response')
    }

    return res.data.data.components
  }

  async getLeakDeviceWarning(deviceId, deviceSku) {
    // Make sure we do have the account token
    if (!this.token) {
      throw new Error(platformLang.noTokenExists)
    }

    // Build and send the request
    const res = await axios({
      url: 'https://app2.govee.com/leak/rest/device/v1/warnMessage',
      method: 'post',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'appVersion': this.appVersion,
        'clientId': this.clientId,
        'clientType': 1,
        'iotVersion': 0,
        'timestamp': Date.now(),
        'User-Agent': this.userAgent,
      },
      data: {
        device: deviceId.replaceAll(':', ''),
        limit: 50,
        sku: deviceSku,
      },
      timeout: 10000,
    })

    // Check to see we got a response
    if (!res?.data?.data) {
      throw new Error(platformLang.noDevices)
    }

    return res.data.data
  }
}

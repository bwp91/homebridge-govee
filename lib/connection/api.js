/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

const axios = require('axios')

module.exports = class connectionAPI {
  constructor (platform) {
    // Create variables usable by the class
    this.apiKey = platform.config.apiKey
    this.consts = platform.consts
    this.debug = platform.config.debug
    this.funcs = platform.funcs
    this.lang = platform.lang
    this.log = platform.log
  }

  async getDevices () {
    try {
      // Used to get a device list from Govee
      const res = await axios.get('https://developer-api.govee.com/v1/devices', {
        headers: {
          'Govee-API-Key': this.apiKey
        },
        timeout: 10000
      })

      // Parse the response
      const body = res.data

      // Check for any errors
      if (body.code !== 200 || !body.data) {
        const eText = body.message || this.lang.errGetDevices
        throw new Error(eText + ':\n' + JSON.stringify(body))
      }

      // Return the device list
      return body.data.devices || []
    } catch (err) {
      if (err.code && this.consts.httpRetryCodes.includes(err.code)) {
        // Retry if another attempt could be successful
        this.log.warn('%s [API - getDevices() - %s].', this.lang.httpRetry, err.code)
        await this.funcs.sleep(30000)
        return await this.getDevices()
      } else {
        throw err
      }
    }
  }

  async getDevice (accContext) {
    // Used to get the status of a specific device
    const res = await axios.get('https://developer-api.govee.com/v1/devices/state', {
      headers: {
        'Govee-API-Key': this.apiKey
      },
      params: {
        device: accContext.gvDeviceId,
        model: accContext.gvModel
      },
      timeout: 10000
    })

    // Parse the response
    const body = res.data

    // Check for any errors
    if (body.code !== 200 || !body.data || !body.data.properties) {
      const eText = body.message || this.lang.errGetDevice
      throw new Error(eText + ':\n' + JSON.stringify(body))
    }

    // Return the device state
    return body.data.properties
  }

  async updateDevice (accessory, params) {
    // Used to update the state of a specific device

    // Log the request if in debug mode
    if (accessory.context.enableDebugLogging) {
      this.log(
        '[%s] %s %s.',
        accessory.displayName,
        this.lang.sendingUpdate,
        JSON.stringify({ name: params.cmd, value: params.data })
      )
    }

    // Perform the HTTP request
    const res = await axios({
      url: 'https://developer-api.govee.com/v1/devices/control',
      method: 'put',
      headers: {
        'Govee-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        device: accessory.context.gvDeviceId,
        model: accessory.context.gvModel,
        cmd: {
          name: params.cmd,
          value: params.data
        }
      },
      timeout: 9000
    })

    // Parse the response
    const body = res.data

    // Check for any errors
    if (body.code !== 200 || !body.data) {
      const eText = body.message || this.lang.errUpdateDevice
      throw new Error(eText + ':\n' + JSON.stringify(body))
    }
  }
}

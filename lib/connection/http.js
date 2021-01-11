/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class connectionHTTP {
  constructor (platform) {
    this.helpers = platform.helpers
    this.apiKey = platform.config.apiKey.toString()
    this.debug = platform.config.debug
    this.log = platform.log
    this.ignoredDevices = (platform.config.ignoredDevices || '').replace(/[\s'"]+/g, '').toUpperCase().split(',')
    this.axios = require('axios')
  }

  async getDevices () {
    const res = await this.axios.get(
      'https://developer-api.govee.com/v1/devices',
      {
        headers: {
          'Govee-API-Key': this.apiKey
        }
      }
    )
    const body = res.data
    if (body.code !== 200 || !body.data) {
      throw new Error((body.message || 'an unknown error occured [getDevices()]') + '\n' + JSON.stringify(body))
    }
    const deviceList = []
    if (body.data.devices && body.data.devices.length > 0) {
      body.data.devices.forEach(device => {
        if (!this.ignoredDevices.includes(device.device)) {
          deviceList.push(device)
        }
      })
    }
    return deviceList
  }

  async getDevice (acc) {
    const res = await this.axios.get(
      'https://developer-api.govee.com/v1/devices/state',
      {
        headers: {
          'Govee-API-Key': this.apiKey
        },
        params: {
          device: acc.gvDeviceId,
          model: acc.gvModel
        }
      }
    )
    const body = res.data
    if (body.code !== 200 || !body.data || !body.data.properties) {
      throw new Error((body.message || 'an unknown error occured [getDevice()].') + '\n' + JSON.stringify(body))
    }
    return body.data.properties
  }

  async updateDevice (name, acc, cmd) {
    if (this.debug) {
      this.log('[%s] sending update %s.', name, JSON.stringify(cmd))
    }
    const res = await this.axios({
      url: 'https://developer-api.govee.com/v1/devices/control',
      method: 'put',
      headers: {
        'Govee-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        device: acc.gvDeviceId,
        model: acc.gvModel,
        cmd
      }
    })
    const body = res.data
    if (body.code !== 200 || !body.data) {
      throw new Error((body.message || 'an unknown error occured [updateDevice()].') + '\n' + JSON.stringify(body))
    }
  }
}

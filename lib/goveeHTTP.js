'use strict'
const axios = require('axios')
module.exports = class goveeHTTP {
  constructor (config, log) {
    this.apiKey = config.apiKey.toString()
    this.debug = config.debug || false
    this.debugReqRes = config.debugReqRes || false
    this.log = log
  }

  async getDevices () {
    const res = await axios
      .get('https://developer-api.govee.com/v1/devices', {
        headers: {
          'Govee-API-Key': this.apiKey
        }
      })
    const body = res.data
    if (body.code !== 200 || !Object.prototype.hasOwnProperty.call(body, 'data')) {
      if (this.debugReqRes) {
        this.log.warn('[getDevices()] HTTP Response:\n%s', JSON.stringify(body, null, 2))
      }
      if (Object.prototype.hasOwnProperty.call(body, 'message')) {
        throw new Error(body.message)
      } else {
        throw new Error('An unknown error occured [getDevices()].')
      }
    }
    if (this.debugReqRes) {
      this.log('[getDevices()] HTTP Response:\n%s', JSON.stringify(body.data, null, 2))
    }
    const deviceList = []
    if (body.data.devices && body.data.devices.length > 0) {
      body.data.devices.forEach(device => deviceList.push(device))
    }
    return deviceList
  }

  async getDevice (accessoryContext) {
    const res = await axios
      .get('https://developer-api.govee.com/v1/devices/state', {
        headers: {
          'Govee-API-Key': this.apiKey
        },
        params: {
          device: accessoryContext.gvDeviceId,
          model: accessoryContext.gvModel
        }
      })
    const body = res.data
    if (body.code !== 200 || !Object.prototype.hasOwnProperty.call(body, 'data')) {
      if (this.debugReqRes) {
        this.log.warn('[getDevice()] HTTP Response:\n%s', JSON.stringify(body, null, 2))
      }
      if (Object.prototype.hasOwnProperty.call(body, 'message')) {
        throw new Error(body.message)
      } else {
        throw new Error('An unknown error occured [getDevice()].')
      }
    }
    if (this.debugReqRes) {
      this.log('[getDevice()] HTTP Response:\n%s', JSON.stringify(body.data, null, 2))
    }
    if (!Object.prototype.hasOwnProperty.call(body.data, 'properties')) {
      throw new Error('properties data not received')
    }
    return body.data.properties
  }

  async updateDevice (accessoryContext, cmd) {
    // if (!accessoryContext.online) {
    //   throw new Error('it is currently offline')
    // }
    const res = await axios({
      url: 'https://developer-api.govee.com/v1/devices/control',
      method: 'put',
      headers: {
        'Govee-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        device: accessoryContext.gvDeviceId,
        model: accessoryContext.gvModel,
        cmd
      }
    })
    const body = res.data
    if (body.code !== 200 || !Object.prototype.hasOwnProperty.call(body, 'data')) {
      if (this.debugReqRes) {
        this.log.warn('[updateDevice()] HTTP Response:\n%s', JSON.stringify(body, null, 2))
      }
      if (Object.prototype.hasOwnProperty.call(body, 'message')) {
        throw new Error(body.message)
      } else {
        throw new Error('An unknown error occured [updateDevice()].')
      }
    }
  }
}

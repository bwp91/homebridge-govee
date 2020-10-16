/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
const axios = require('axios')
const helpers = require('./helpers')
module.exports = class goveeHTTP {
  constructor (platform) {
    this.apiKey = platform.config.apiKey.toString()
    this.debug = helpers.hasProperty(platform.config, 'debug')
      ? platform.config.debug
      : false
    this.debugReqRes = helpers.hasProperty(platform.config, 'debugReqRes')
      ? platform.config.debugReqRes
      : false
    this.log = platform.log
  }

  async getDevices () {
    const res = await axios
      .get('https://developer-api.govee.com/v1/devices', {
        headers: { 'Govee-API-Key': this.apiKey }
      })
    const body = res.data
    if (body.code !== 200 || !helpers.hasProperty(body, 'data')) {
      if (this.debugReqRes) {
        this.log.warn('[getDevices()] HTTP Response Error:\n%s', JSON.stringify(body, null, 2))
      }
      throw new Error(
        helpers.hasProperty(body, 'message')
          ? body.message
          : 'An unknown error occured [getDevices()].'
      )
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
        headers: { 'Govee-API-Key': this.apiKey },
        params: {
          device: accessoryContext.gvDeviceId,
          model: accessoryContext.gvModel
        }
      })
    const body = res.data
    if (body.code !== 200 || !helpers.hasProperty(body, 'data')) {
      if (this.debugReqRes) {
        this.log.warn('[getDevice()] HTTP Response Error:\n%s', JSON.stringify(body, null, 2))
      }
      throw new Error(
        helpers.hasProperty(body, 'message')
          ? body.message
          : 'An unknown error occured [getDevice()].'
      )
    }
    if (this.debugReqRes) {
      this.log('[getDevice()] HTTP Response:\n%s', JSON.stringify(body.data, null, 2))
    }
    if (!helpers.hasProperty(body.data, 'properties')) {
      throw new Error('properties data not received')
    }
    return body.data.properties
  }

  async updateDevice (accessoryContext, cmd) {
    const data = {
      device: accessoryContext.gvDeviceId,
      model: accessoryContext.gvModel,
      cmd
    }
    if (this.debugReqRes) {
      this.log.warn('[updateDevice()] HTTP Request. This message is yellow for clarity:\n%s', JSON.stringify(data, null, 2))
    }
    const res = await axios({
      url: 'https://developer-api.govee.com/v1/devices/control',
      method: 'put',
      headers: {
        'Govee-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      data
    })
    const body = res.data
    if (this.debugReqRes) {
      this.log('[updateDevice()] HTTP Response:\n%s', JSON.stringify(body, null, 2))
    }
    if (body.code !== 200 || !helpers.hasProperty(body, 'data')) {
      throw new Error(
        helpers.hasProperty(body, 'message')
          ? body.message
          : 'An unknown error occured [updateDevice()].'
      )
    }
  }
}

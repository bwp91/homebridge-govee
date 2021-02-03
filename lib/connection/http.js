/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class connectionHTTP {
  constructor (platform) {
    // Create variables usable by the class
    this.log = platform.log
    this.messages = platform.messages
    this.debug = platform.config.debug
    this.apiKey = platform.config.apiKey
    this.ignoredDevices = platform.config.ignoredDevices

    // Require any libraries that the class uses
    this.axios = require('axios')
    const { default: PQueue } = require('p-queue')

    // Create the queue used for HTTP requests
    this.queue = new PQueue({
      concurrency: 1,
      timeout: 10000,
      interval: 7500,
      intervalCap: 1
    })
  }

  async getDevices () {
    // Used to get a device list from Govee
    return await this.queue.add(async () => {
      const res = await this.axios.get('https://developer-api.govee.com/v1/devices', {
        headers: {
          'Govee-API-Key': this.apiKey
        }
      })
      const body = res.data
      if (body.code !== 200 || !body.data) {
        const eText = body.message || this.messages.errGetDevices
        throw new Error(eText + +':\n' + JSON.stringify(body))
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
    }, { priority: 0 })
  }

  async getDevice (acc) {
    // Used to get the status of a specific device
    return await this.queue.add(async () => {
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
        const eText = body.message || this.messages.errGetDevice
        throw new Error(eText + ':\n' + JSON.stringify(body))
      }
      return body.data.properties
    }, { priority: 0 })
  }

  async updateDevice (name, acc, cmd) {
    // Used to update the state of a specific device
    return await this.queue.add(async () => {
      if (this.debug) {
        this.log('[%s] %s %s.', name, this.messages.sendingUpdate, JSON.stringify(cmd))
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
        const eText = body.message || this.messages.errUpdateDevice
        throw new Error(eText + ':\n' + JSON.stringify(body))
      }
    }, { priority: 1 })
  }
}

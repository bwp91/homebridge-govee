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
    this.updateInProgress = false

    // Require any libraries that the class uses
    this.axios = require('axios')
    const { default: PQueue } = require('p-queue')

    // Create the queue used for HTTP requests
    this.queue = new PQueue({
      concurrency: 1,
      interval: 7500,
      intervalCap: 1
    })

    // Let device sync continue once all outgoing device updates have cleared
    this.queue.on('idle', () => {
      this.updateInProgress = false
    })
  }

  isBusy () {
    return this.updateInProgress
  }

  async getDevices () {
    // Used to get a device list from Govee
    const res = await this.axios.get('https://developer-api.govee.com/v1/devices', {
      headers: {
        'Govee-API-Key': this.apiKey
      },
      timeout: 10000
    })

    // Parse the response
    const body = res.data

    // Check for any errors
    if (body.code !== 200 || !body.data) {
      const eText = body.message || this.messages.errGetDevices
      throw new Error(eText + ':\n' + JSON.stringify(body))
    }

    // Loop through the given device list
    const deviceList = []
    if (body.data.devices && body.data.devices.length > 0) {
      body.data.devices.forEach(device => {
        // Check the device isn't on the ignore list
        if (!this.ignoredDevices.includes(device.device)) {
          deviceList.push(device)
        }
      })
    }

    // Return the device list
    return deviceList
  }

  async getDevice (acc) {
    // Used to get the status of a specific device
    const res = await this.axios.get(
      'https://developer-api.govee.com/v1/devices/state',
      {
        headers: {
          'Govee-API-Key': this.apiKey
        },
        params: {
          device: acc.gvDeviceId,
          model: acc.gvModel
        },
        timeout: 10000
      }
    )

    // Parse the response
    const body = res.data

    // Check for any errors
    if (body.code !== 200 || !body.data || !body.data.properties) {
      const eText = body.message || this.messages.errGetDevice
      throw new Error(eText + ':\n' + JSON.stringify(body))
    }

    // Return the device state
    return body.data.properties
  }

  async updateDevice (name, acc, cmd) {
    // Used to update the state of a specific device

    // Set this flag true to pause the device sync interval
    this.updateInProgress = true

    // Add the request to the queue
    return await this.queue.add(async () => {
      // Log the request if in debug mode
      if (this.debug) {
        this.log('[%s] %s %s.', name, this.messages.sendingUpdate, JSON.stringify(cmd))
      }

      // Perform the HTTP request
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
        },
        timeout: 10000
      })

      // Parse the response
      const body = res.data

      // Check for any errors
      if (body.code !== 200 || !body.data) {
        const eText = body.message || this.messages.errUpdateDevice
        throw new Error(eText + ':\n' + JSON.stringify(body))
      }
    })
  }
}

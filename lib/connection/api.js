/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const axios = require('axios')
const { default: PQueue } = require('p-queue')

module.exports = class connectionAPI {
  constructor (platform) {
    // Create variables usable by the class
    this.apiKey = platform.config.apiKey
    this.debug = platform.config.debug
    this.ignoredDevices = platform.ignoredDevices
    this.lang = platform.lang
    this.log = platform.log
    this.updateInProgress = false

    // Create the queue used for HTTP requests
    this.queue = new PQueue({
      interval: platform.config.controlInterval,
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

  async updateDevice (accessory, cmd) {
    // Used to update the state of a specific device

    // Set this flag true to pause the device sync interval
    this.updateInProgress = true

    // Add the request to the queue
    return await this.queue.add(async () => {
      // Log the request if in debug mode
      if (accessory.context.enableDebugLogging) {
        this.log('[%s] %s %s.', accessory.displayName, this.lang.sendingUpdate, JSON.stringify(cmd))
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
          cmd
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
    })
  }
}

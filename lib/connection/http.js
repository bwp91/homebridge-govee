/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const axios = require('axios')

module.exports = class connectionHTTP {
  constructor (platform) {
    // Create variables usable by the class
    this.debug = platform.config.debug
    this.lang = platform.lang
    this.log = platform.log
    this.machineId = platform.machineId
    this.password = platform.config.password
    this.username = platform.config.username
  }

  async getDevices () {
    // Perform the HTTP request
    const res = await axios({
      url: 'https://app.govee.com/account/rest/account/v1/login',
      method: 'post',
      data: {
        email: this.username,
        password: this.password,
        client: this.machineId
      },
      timeout: 5000
    })

    // Check to see we got a response
    if (!res.data) {
      throw new Error(this.lang.noToken)
    }

    // Check to see we got a needed response
    if (!res.data.client || !res.data.client.token) {
      throw new Error(res.data.message || this.lang.noToken)
    }

    // Use the token received to get a device list
    const res2 = await axios({
      url: 'https://app2.govee.com/device/rest/devices/v1/list',
      method: 'post',
      headers: {
        Authorization: 'Bearer ' + res.data.client.token,
        Appversion: '3.7.0'
      },
      timeout: 5000
    })

    // Check to see we got a response
    if (!res2.data || !res2.data.devices) {
      throw new Error(this.lang.noDevices)
    }

    // Return the account topic and device list
    return {
      accountTopic: res.data.client.topic,
      deviceList: res2.data.devices
    }
  }
}

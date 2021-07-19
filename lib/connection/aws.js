/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const awsIot = require('aws-iot-device-sdk')
const path = require('path')

module.exports = class connectionAWS {
  constructor (platform, accessory) {
    this.accountTopic = platform.accountTopic
    this.consts = platform.consts
    this.deviceTopic = accessory.context.awsTopic
    this.enableDebugLogging = accessory.context.enableDebugLogging
    this.gvModel = accessory.context.gvModel
    this.lang = platform.lang
    this.log = platform.log
    this.name = accessory.displayName
    this.device = awsIot.device({
      keyPath: path.resolve(__dirname, './cert/testiot.cert.pkey'),
      certPath: path.resolve(__dirname, './cert/testiot.cert.pem'),
      caPath: path.resolve(__dirname, './cert/AmazonRootCA1.pem'),
      clientId: platform.machineId,
      host: 'aqm3wd1qlc3dy-ats.iot.us-east-1.amazonaws.com'
    })

    // A listener event for if the connection closes
    this.device.on('close', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] close event.', accessory.displayName)
      }
      this.connected = false
    })

    // A listener event for if the connection reconnects
    this.device.on('reconnect', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] reconnect event', accessory.displayName)
      }
      this.connected = true
    })

    // A listener event for if the device goes offline
    this.device.on('offline', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] offline event.', accessory.displayName)
      }
      this.connected = false
    })

    // A listener event for if the connection creates an error
    this.device.on('error', error => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] error event [%s].', accessory.displayName, error)
      }
    })

    // A listener event for receiving a message
    this.device.on('message', (topic, payload) => {
      // Check the message is related to this specific accessory
      if (topic !== accessory.context.awsTopic) {
        return
      }
      
      // Log the received message if debug is enabled
      if (this.enableDebugLogging) {
        this.log(
          '[%s] [AWS] message event [%s %s].',
          accessory.displayName,
          topic,
          payload.toString()
        )
      }
      
      // Parse the message to JSON
      payload = JSON.parse(payload.toString())
      
      // Don't continue if the message has a command unsupported by the plugin
      if (
        !payload.msg ||
        !payload.msg.cmd ||
        !['turn', 'brightness', 'color', 'colorTem', 'pt'].includes(payload.msg.cmd)
      ) {
        return
      }

      // Send the update to the receiver function
      payload.msg.source = 'AWS'
      platform.receiveDeviceUpdate(accessory, payload.msg)
    })

    // A listener event for when the connection is created
    this.device.on('connect', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] connected event.', accessory.displayName)
      }
      this.connected = true
    })

    // Subscribe to the device once the listeners are created to receive incoming updates
    this.device.subscribe(this.deviceTopic)
  }

  updateDevice (params) {
    // Check if we are connected before attempting an update
    if (!this.connected) {
      throw new Error('not connected to AWS')
    }
    
    // Generate the AWS payload
    const payload = {
      msg: {
        accountTopic: this.accountTopic,
        cmd: params.cmd,
        cmdVersion: 0,
        data: params.data,
        transaction: 'v_' + Date.now() + '000',
        type: 1
      }
    }
    
    // Log the update if accessory debug is enabled
    if (this.enableDebugLogging) {
      this.log('[%s] %s %s.', this.name, this.lang.sendingUpdateAWS, JSON.stringify(payload))
    }
    
    // Send the update over AWS
    this.device.publish(this.deviceTopic, JSON.stringify(payload))
  }
}

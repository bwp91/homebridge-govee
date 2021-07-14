/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const awsIot = require('aws-iot-device-sdk')
const path = require('path')

module.exports = class connectionAWS {
  constructor (platform, accessory) {
    this.accountTopic = platform.accountTopic
    this.colourUtils = platform.colourUtils
    this.consts = platform.consts
    this.deviceTopic = accessory.context.awsTopic
    this.enableDebugLogging = accessory.context.enableDebugLogging
    this.funcs = platform.funcs
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

    this.device.on('close', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] close event.', accessory.displayName)
      }
      this.connected = false
    })

    this.device.on('reconnect', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] reconnect event', accessory.displayName)
      }
      this.connected = true
    })

    this.device.on('offline', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] offline event.', accessory.displayName)
      }
      this.connected = false
    })

    this.device.on('error', error => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] error event [%s].', accessory.displayName, error)
      }
    })

    this.device.on('message', (topic, payload) => {
      if (topic !== accessory.context.awsTopic) {
        return
      }
      if (this.enableDebugLogging) {
        this.log(
          '[%s] [AWS] message event [%s %s].',
          accessory.displayName,
          topic,
          payload.toString()
        )
      }
      payload = JSON.parse(payload.toString())
      if (
        !payload.msg ||
        !payload.msg.cmd ||
        !accessory.control ||
        !accessory.control.externalUpdate
      ) {
        return
      }
      const newParams = {}
      switch (payload.msg.cmd) {
        case 'turn':
          newParams.powerState = payload.msg.data.val === 1 ? 'on' : 'off'
          break
        case 'brightness': {
          // Always given as [0, 254]
          newParams.brightness = this.consts.scaleBrightness.includes(this.gvModel)
            ? Math.round(this.cacheBrightRaw / 2.54)
            : payload.msg.data.val
          break
        }
        case 'color':
          newParams.color = {
            r: payload.msg.data.red,
            g: payload.msg.data.green,
            b: payload.msg.data.blue
          }
          break
        case 'colorTem':
          newParams.colorTem = payload.msg.data.colorTemInKelvin
          break
        default:
          return
      }
      newParams.source = 'AWS'
      accessory.control.externalUpdate(newParams)
    })

    this.device.on('connect', () => {
      if (this.enableDebugLogging) {
        this.log('[%s] [AWS] connected event.', accessory.displayName)
      }
      this.connected = true
    })

    this.device.subscribe(this.deviceTopic)
  }

  updateDevice (params) {
    if (!this.connected) {
      throw new Error('not connected to AWS')
    }
    const payload = {
      msg: {
        transaction: 'v_' + Date.now() + '000',
        accountTopic: this.accountTopic,
        type: 1,
        cmdVersion: 0
      }
    }
    switch (params.name) {
      case 'turn':
        payload.msg.cmd = 'turn'
        payload.msg.data = { val: params.value === 'on' ? 1 : 0 }
        break
      case 'brightness': {
        // We will have been passed a [0, 254] value for some models - scale back to [0, 100]
        const scaled = this.consts.scaleBrightness.includes(this.gvModel)
          ? params.value
          : Math.round(params.value * 2.54)
        payload.msg.cmd = 'brightness'
        payload.msg.data = { val: scaled }
        break
      }
      case 'color':
        payload.msg.cmd = 'color'
        payload.msg.data = {
          red: params.value.r,
          green: params.value.g,
          blue: params.value.b
        }
        break
      default:
        throw new Error(this.lang.cmdNotAWS)
    }
    if (this.enableDebugLogging) {
      this.log('[%s] %s %s.', this.name, this.lang.sendingUpdateAWS, JSON.stringify(payload))
    }
    this.device.publish(this.deviceTopic, JSON.stringify(payload))
  }
}

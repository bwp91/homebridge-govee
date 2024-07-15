import { resolve } from 'node:path'
import url from 'node:url'
import { Buffer } from 'node:buffer'
import { device as iotDevice } from 'aws-iot-device-sdk'
import platformConsts from '../utils/constants.js'
import { parseError } from '../utils/functions.js'
import platformLang from '../utils/lang-en.js'

const dirname = url.fileURLToPath(new URL('.', import.meta.url))

export default class {
  constructor(platform, iotFile) {
    this.accountTopic = platform.accountTopic

    this.device = iotDevice({
      privateKey: Buffer.from(iotFile.key, 'utf8'),
      clientCert: Buffer.from(iotFile.cert, 'utf8'),
      caPath: resolve(dirname, './cert/AmazonRootCA1.pem'),
      clientId: `AP/${platform.accountId}/${platform.clientId}`,
      host: platform.iotEndpoint,
      enableMetrics: false,
    })

    // A listener event for if the connection closes
    this.device.on('close', () => {
      platform.log.debugWarn('[AWS] %s.', platformLang.awsEventClose)
      this.connected = false
    })

    // A listener event for if the connection reconnects
    this.device.on('reconnect', () => {
      platform.log.debug('[AWS] %s.', platformLang.awsEventReconnect)
      this.connected = true
    })

    // A listener event for if the connection goes offline
    this.device.on('offline', () => {
      platform.log.debugWarn('[AWS] %s.', platformLang.awsEventOffline)
      this.connected = false
    })

    // A listener event for if the connection creates an error
    this.device.on('error', (error) => {
      platform.log.debugWarn('[AWS] %s [%s].', platformLang.awsEventError, parseError(error))
      this.connected = false
    })

    // A listener event for receiving a message
    this.device.on('message', (topic, payload) => {
      const payloadString = Buffer.from(payload).toString()

      // Parse the message to JSON
      try {
        payload = JSON.parse(payloadString)
      } catch (error) {
        platform.log.debugWarn('[AWS] %s [%s].', platformLang.invalidJson, payloadString)
        return
      }

      // Older models may have the message in a msg property
      if (payload.msg) {
        try {
          payload = JSON.parse(payload.msg)
        } catch (error) {
          platform.log.debugWarn('[AWS] %s [%s].', platformLang.invalidJson, payloadString)
          return
        }
      }

      // Also JSON parse any data property that may exist, do not throw on error
      if (payload.data && typeof payload.data === 'string') {
        try {
          payload.data = JSON.parse(payload.data)
        } catch (error) {
          // Do nothing, leave as string
        }
      }

      // Log the received message if debug is enabled
      platform.log.debug('[AWS] %s [%s].', platformLang.awsEventMessage, payloadString)

      // Don't continue if the message has a command unsupported by the plugin
      if (!platformConsts.awsValidCommands.includes(payload.cmd)) {
        return
      }

      // Send the update to the receiver function
      platform.receiveUpdateAWS(payload)
    })

    // A listener event for when the connection is created
    this.device.on('connect', () => {
      platform.log.debug('[AWS] %s.', platformLang.awsEventConnect)
      this.connected = true
    })
  }

  async connect() {
    return new Promise((res, rej) => {
      this.device.subscribe(this.accountTopic, {}, (err) => {
        if (err) {
          rej(err)
        } else {
          res()
        }
      })
    })
  }

  async requestUpdate(accessory) {
    // Check if we are connected before attempting an update
    if (!this.connected) {
      throw new Error(platformLang.notAWSConn)
    }

    // Generate the AWS payload
    const payload = {
      msg: {
        cmd: 'status',
        cmdVersion: 2,
        transaction: `v_${Date.now()}000`,
        type: 0,
      },
    }

    // Log the update if accessory debug is enabled
    accessory.logDebug(`[AWS] ${platformLang.sendingUpdate} ${JSON.stringify(payload)}`)

    // Add the account topic after logging
    payload.msg.accountTopic = this.accountTopic

    // Send the update over AWS
    return new Promise((res, rej) => {
      this.device.publish(accessory.context.awsTopic, JSON.stringify(payload), {}, (err) => {
        if (err) {
          rej(err)
        } else {
          res()
        }
      })
    })
  }

  async updateDevice(accessory, params) {
    // Check if we are connected before attempting an update
    if (!this.connected) {
      throw new Error(platformLang.notAWSConn)
    }

    // Generate the AWS payload
    const payload = {
      msg: {
        cmd: params.cmd,
        cmdVersion: 0,
        data: params.data,
        transaction: `v_${Date.now()}000`,
        type: 1,
      },
    }

    // Log the update if accessory debug is enabled
    accessory.logDebug(`[AWS] ${platformLang.sendingUpdate} ${JSON.stringify(payload)}`)

    // Add the account topic after logging
    payload.msg.accountTopic = this.accountTopic

    // Send the update over AWS
    return new Promise((res, rej) => {
      this.device.publish(accessory.context.awsTopic, JSON.stringify(payload), {}, (err) => {
        if (err) {
          rej(err)
        } else {
          res()
        }
      })
    })
  }
}

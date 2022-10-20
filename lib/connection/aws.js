import { resolve } from 'path';
import url from 'url';
import { device as iotDevice } from 'aws-iot-device-sdk';
import platformLang from '../utils/lang-en.js';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

export default class {
  constructor(platform) {
    this.accountTopic = platform.accountTopic;
    const cmdList = ['status', 'turn', 'brightness', 'color', 'colorTem', 'pt', 'ptReal', 'bulb', 'colorwc', 'multiSync'];

    this.device = iotDevice({
      keyPath: resolve(dirname, './cert/testiot.cert.pkey'),
      certPath: resolve(dirname, './cert/testiot.cert.pem'),
      caPath: resolve(dirname, './cert/AmazonRootCA1.pem'),
      clientId: `hb_${platform.api.hap.uuid.generate(platform.config.username)}`,
      host: 'aqm3wd1qlc3dy-ats.iot.us-east-1.amazonaws.com',
    });

    // A listener event for if the connection closes
    this.device.on('close', () => {
      if (platform.config.debug) {
        platform.log.warn('[AWS] close event.');
      }
      this.connected = false;
    });

    // A listener event for if the connection reconnects
    this.device.on('reconnect', () => {
      if (platform.config.debug) {
        platform.log('[AWS] close event.');
      }
      this.connected = true;
    });

    // A listener event for if the connection goes offline
    this.device.on('offline', () => {
      if (platform.config.debug) {
        platform.log.warn('[AWS] offline event.');
      }
      this.connected = false;
    });

    // A listener event for if the connection creates an error
    this.device.on('error', (error) => {
      if (platform.config.debug) {
        platform.log.warn('[AWS] [AWS] error event [%s].', error);
      }
    });

    // A listener event for receiving a message
    this.device.on('message', (topic, payload) => {
      const payloadString = Buffer.from(payload).toString();

      // Parse the message to JSON
      payload = JSON.parse(payloadString);

      // Log the received message if debug is enabled
      if (platform.config.debug) {
        platform.log(`[AWS] message event [${payloadString}]`);
      }

      // Don't continue if the message has a command unsupported by the plugin
      if (!cmdList.includes(payload.cmd)) {
        return;
      }

      // Send the update to the receiver function
      platform.receiveUpdateAWS(payload);
    });

    // A listener event for when the connection is created
    this.device.on('connect', () => {
      if (platform.config.debug) {
        platform.log('[AWS] connected event.');
      }
      this.connected = true;
    });

    // Subscribe to the device once the listeners are created to receive incoming updates
    this.device.subscribe(platform.accountTopic);
  }

  async updateDevice(accessory, params) {
    // Check if we are connected before attempting an update
    if (!this.connected) {
      throw new Error('not connected to AWS');
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
    };

    // Log the update if accessory debug is enabled
    accessory.logDebug(`${platformLang.sendingUpdateAWS} ${JSON.stringify(payload)}`);

    // Add the account topic after logging
    payload.msg.accountTopic = this.accountTopic;

    // Send the update over AWS
    return new Promise((res, rej) => {
      this.device.publish(accessory.context.awsTopic, JSON.stringify(payload), {}, (err) => {
        if (err) {
          rej(err);
        } else {
          res();
        }
      });
    });
  }
}

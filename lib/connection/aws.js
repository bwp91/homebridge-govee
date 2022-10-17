import { resolve } from 'path';
import url from 'url';
import { device as iotDevice } from 'aws-iot-device-sdk';
import platformLang from '../utils/lang-en.js';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

export default class {
  constructor(platform, accessory) {
    this.accountTopic = platform.accountTopic;
    this.deviceTopic = accessory.context.awsTopic;
    this.gvModel = accessory.context.gvModel;
    this.log = platform.log;
    this.accessoryLogDebug = accessory.logDebug;
    this.name = accessory.displayName;
    const cmdList = ['turn', 'brightness', 'color', 'colorTem', 'pt', 'ptReal', 'bulb', 'colorwc', 'multiSync'];

    // Check the topic exists
    if (!this.deviceTopic || this.deviceTopic === '') {
      return;
    }

    this.device = iotDevice({
      keyPath: resolve(dirname, './cert/testiot.cert.pkey'),
      certPath: resolve(dirname, './cert/testiot.cert.pem'),
      caPath: resolve(dirname, './cert/AmazonRootCA1.pem'),
      clientId: `hb_${accessory.UUID}`,
      host: 'aqm3wd1qlc3dy-ats.iot.us-east-1.amazonaws.com',
    });

    // A listener event for if the connection closes
    this.device.on('close', () => {
      accessory.logDebug('[AWS] close event');
      this.connected = false;
    });

    // A listener event for if the connection reconnects
    this.device.on('reconnect', () => {
      accessory.logDebug('[AWS] reconnect event');
      this.connected = true;
    });

    // A listener event for if the device goes offline
    this.device.on('offline', () => {
      accessory.logDebug('[AWS] offline event');
      this.connected = false;
    });

    // A listener event for if the connection creates an error
    this.device.on('error', (error) => {
      accessory.logDebug(`[AWS] error event [${error}]`);
    });

    // A listener event for receiving a message
    this.device.on('message', (topic, payload) => {
      // Check the message is related to this specific accessory
      if (topic !== accessory.context.awsTopic) {
        return;
      }

      // Parse the message to JSON
      payload = JSON.parse(payload.toString());
      delete payload.msg.accountTopic;

      // Log the received message if debug is enabled
      accessory.logDebug(`[AWS] message event [${JSON.stringify(payload)}]`);

      // Don't continue if the message has a command unsupported by the plugin
      if (!cmdList.includes(payload.msg?.cmd)) {
        return;
      }

      // Send the update to the receiver function
      payload.msg.source = 'AWS';
      platform.receiveDeviceUpdate(accessory, payload.msg);
    });

    // A listener event for when the connection is created
    this.device.on('connect', () => {
      accessory.logDebug('[AWS] connected event');
      this.connected = true;
    });

    // Subscribe to the device once the listeners are created to receive incoming updates
    this.device.subscribe(this.deviceTopic);
  }

  async updateDevice(params) {
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
    this.accessoryLogDebug(`${platformLang.sendingUpdateAWS} ${JSON.stringify(payload)}`);

    // Add the account topic after logging
    payload.msg.accountTopic = this.accountTopic;

    // Send the update over AWS
    return new Promise((res, rej) => {
      this.device.publish(this.deviceTopic, JSON.stringify(payload), {}, (err) => {
        if (err) {
          rej(err);
        } else {
          res();
        }
      });
    });
  }
}

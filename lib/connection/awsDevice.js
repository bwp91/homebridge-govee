import { resolve } from 'path';
import url from 'url';
import { device as iotDevice } from 'aws-iot-device-sdk';
import platformConsts from '../utils/constants.js';
import { parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

export default class {
  constructor(platform, accessory) {
    this.deviceTopic = accessory.context.awsTopic;

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
      accessory.logDebugWarn(`[AWS-D] ${platformLang.awsEventClose}`);
    });

    // A listener event for if the connection reconnects
    this.device.on('reconnect', () => {
      accessory.logDebug(`[AWS-D] ${platformLang.awsEventReconnect}`);
    });

    // A listener event for if the device goes offline
    this.device.on('offline', () => {
      accessory.logDebugWarn(`[AWS-D] ${platformLang.awsEventOffline}`);
    });

    // A listener event for if the connection creates an error
    this.device.on('error', (error) => {
      accessory.logDebugWarn(`[AWS-D] ${platformLang.awsEventError} [${parseError(error)}]`);
    });

    // A listener event for receiving a message
    this.device.on('message', (topic, payload) => {
      // Check the message is related to this specific accessory
      if (topic !== accessory.context.awsTopic) {
        return;
      }

      const payloadString = Buffer.from(payload).toString();

      // Parse the message to JSON
      try {
        payload = JSON.parse(payloadString);
      } catch (error) {
        accessory.logDebugWarn(`[AWS-D] ${platformLang.invalidJson} [${payloadString}]`);
        return;
      }
      delete payload.msg.accountTopic;

      // Log the received message if debug is enabled
      accessory.logDebug(`[AWS-D] ${platformLang.awsEventMessage} [${JSON.stringify(payload)}]`);

      // Don't continue if the message has a command unsupported by the plugin
      if (
        !payload.msg
        || !payload.msg.cmd
        || !platformConsts.awsValidCommands.includes(payload.msg.cmd)
      ) {
        return;
      }

      // Send the update to the receiver function
      payload.msg.source = 'AWS';
      platform.receiveDeviceUpdate(accessory, payload.msg);
    });

    // A listener event for when the connection is created
    this.device.on('connect', () => {
      accessory.logDebug(`[AWS-D] ${platformLang.awsEventConnect}`);
    });

    // Subscribe to the device once the listeners are created to receive incoming updates
    this.device.subscribe(accessory.context.awsTopic);
  }
}

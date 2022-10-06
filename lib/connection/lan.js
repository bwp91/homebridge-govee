import dgram from 'dgram';
import platformConsts from '../utils/constants.js';
import { parseError } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

const commands = { scan: 'scan', deviceStatus: 'devStatus' };
const multicastIp = '239.255.255.250';
const scanCommandPort = 4001;
const receiverPort = 4002;
const devicePort = 4003;
const deviceStatusDelayMs = 50;
const getDevicesScanTimeoutMs = 2000;

/*
This class handles LAN discovery and communication with Govee devices.

The documentation can be fount at https://app-h5.govee.com/user-manual/wlan-guide.

The connection is UDP based and uses multicast to discover devices on the network.
  - The discovery flow is as follows:
                                       ┌──────┐          ┌───────────┐
                                       │Client│          │GoveeDevice│
                                       └──┬───┘          └─────┬─────┘
                                          │    Request Scan    │
                                          │ ──────────────────>│
                                          │                    │ ╔═══════════════════════════════════════╗
                                          │                    │ ║Group address of 239.255.255.250:4001 ░║
                                          │                    │ ╚═══════════════════════════════════════╝
                                          │   Response Scan    │
                                          │ <─ ─ ─ ─ ─ ─ ─ ─ ─ │
                                          │                    │
    ╔════════════════════════════════════╗│                    │
    ║Response will be sent to port 4002 ░║│                    │
    ╚════════════════════════════════════╝┴───┐          ┌─────┴─────┐
                                       │Client│          │GoveeDevice│
                                       └──────┘          └───────────┘

    1. On devices that have `LAN control` turned on, the device will join the multicast address `239.255.255.250` and listen for information sent to port `4001` of the multicast.
    2. The client (sender) will send a scan request to that group address, on port 4001.
    3. Each Govee device will send to the server (receiver) on port `4002` a send response scan message.

    After the discovery process, we keep track of the devices found and keep polling for new devices every 5 seconds.

  - The communication flow is as follows:
                                       ┌──────┐                                     ┌───────────┐
                                       │Client│                                     │GoveeDevice│
                                       └──┬───┘                                     └─────┬─────┘
                                          │                Control Command                │
                                          │ ──────────────────────────────────────────────>
                                          │                                               │
                                          │                                               │  ╔════════════════════════╗
                                          │                                               │  ║Device IP on port 4003 ░║
                                          │                                               │  ╚════════════════════════╝
                                          │ Device Status (only for Device Status Command)│
                                          │ <─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
                                          │                                               │
    ╔════════════════════════════════════╗│                                               │
    ║Response will be sent to port 4002 ░║│                                               │
    ╚════════════════════════════════════╝┴───┐                                     ┌─────┴─────┐
                                       │Client│                                     │GoveeDevice│
                                       └──────┘                                     └───────────┘
   1. Once the IP of the device is known, we will send a control command to the device on port `4003`.
   2. The device will respond with the device status only if Device Status Command is sent on port `4002`.
*/
export default class {
  constructor(platform) {
    this.log = platform.log;
    this.debug = platform.config.debug;
    this.config = platform.config;

    // Keeps track of all devices that are found on the network
    this.lanDevices = [];

    // Add any devices that have a custom IP address in the config
    Object.keys(platform.deviceConf).forEach((device) => {
      if (platform.deviceConf[device].customIPAddress) {
        this.lanDevices.push({
          ip: platform.deviceConf[device].customIPAddress,
          device,
          isManual: true,
        });
      }
    });

    // Create a UDP socket to listen for messages sent by Govee devices in a multicast group
    this.receiver = dgram.createSocket('udp4');

    // Create a UDP socket to send messages to Govee devices from host
    this.sender = dgram.createSocket('udp4');

    this.latestDeviceScanTimestamp = Date.now();

    this.connectionPromise = new Promise((resolve, reject) => {
      // Handle messages received
      this.receiver.on('message', (msg, rinfo) => {
        const strMessage = msg.toString();
        try {
          const message = JSON.parse(strMessage);
          const command = message.msg.cmd;

          switch (command) {
            case commands.scan: {
              // Handle scan responses sent by devices registered in the multicast group
              this.latestDeviceScanTimestamp = Date.now();
              const deviceData = message.msg.data;

              if (this.lanDevices.findIndex((value) => value.device === deviceData.device) === -1) {
                if (this.debug) {
                  this.log('[LAN] added new device: %s : %s', msg, rinfo);
                }
                this.lanDevices.push(message.msg.data);

                if (!platformConsts.lanModels.includes(deviceData.sku)) {
                  this.log.warn(
                    '[%s] [LAN] %s [%s].',
                    deviceData.device,
                    platformLang.supportLAN,
                    deviceData.sku,
                  );
                }
              }
              break;
            }
            case commands.deviceStatus: {
              // Handle device status responses sent by devices
              const deviceAddress = rinfo.address;

              const foundDeviceId = this.lanDevices.find((value) => value.ip === deviceAddress);

              if (foundDeviceId) {
                const payload = {};
                payload.msg = message.msg.data;
                payload.msg.source = 'LAN';

                // Send the update to the receiver function
                platform.receiveDeviceUpdateForId(foundDeviceId.device, payload.msg, deviceAddress);
              }
              break;
            }
            default:
              break;
          }
        } catch (err) {
          this.log('Could not parse message %s as %s.', strMessage, parseError(err));
        }
      });

      // Handle errors
      this.receiver.on('error', (err) => {
        reject();
        const eText = parseError(err);
        this.log.warn('[LAN] server error: %s.', eText);
      });

      // Handle started listening for messages
      this.receiver.on('listening', () => {
        const address = this.receiver.address();
        resolve();

        if (this.debug) {
          this.log('[LAN] server started listening %s:%s', address.address, address.port);
        }
      });

      this.receiver.bind(receiverPort, () => {
        this.receiver.addMembership(multicastIp, '0.0.0.0');
      });

      this.sender.bind();
    });
  }

  // Send a request that asks for all devices in the multicast group
  sendScanCommand() {
    const scanCommand = JSON.stringify({ msg: { cmd: commands.scan, data: { account_topic: 'reserve' } } });
    this.sender.send(scanCommand, scanCommandPort, multicastIp);
  }

  // Get all available LAN devices
  async getDevices() {
    return new Promise((resolve) => {
      this.connectionPromise.then(() => {
        this.sendScanCommand();

        // Since there is no list of devices to be gathered, we will send a scan request and wait until
        // there are no more devices announcing themselves in the multicast group.
        const checkPeriod = setInterval(() => {
          const diff = Date.now() - this.latestDeviceScanTimestamp;
          // this.log('[LAN] checking for devices. Time passed before scan command received a device: %i', diff);
          if (diff >= getDevicesScanTimeoutMs) {
            clearInterval(checkPeriod);
            resolve(this.lanDevices);
          }
        }, 100);
      }, () => {
        resolve([]);
      });
    });
  }

  // Send a request to a device to ask for its current state
  async sendDeviceStateRequest(device) {
    const stateCommand = JSON.stringify({ msg: { cmd: commands.deviceStatus, data: {} } });
    return new Promise((resolve, reject) => {
      this.sender.send(stateCommand, devicePort, device.ip, (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  // This is called by the platform on sending a device update via LAN
  async updateDevice(accessory, params) {
    const updatedParams = { msg: params };

    if (accessory.context.enableDebugLogging) {
      this.log(
        '[%s] [LAN] starting update with params [%s].',
        accessory.displayName,
        JSON.stringify(updatedParams),
      );
    }

    const foundDeviceId = this.lanDevices.findIndex((value) => value.device === accessory.context.gvDeviceId);

    if (foundDeviceId === -1) {
      if (this.debug) {
        this.log(
          '[%s] [LAN] device not found with id [%s].',
          accessory.displayName,
          accessory.context.gvDeviceId,
        );
      }
      throw new Error('device not found in LAN device list');
    }

    const foundDevice = this.lanDevices[foundDeviceId];

    return new Promise((resolve, reject) => {
      const command = JSON.stringify(updatedParams);

      this.sender.send(command, devicePort, foundDevice.ip, async (err) => {
        if (err) {
          if (accessory.context.enableDebugLogging) {
            this.log(
              '[%s] [LAN] Failed to send command as %s.',
              accessory.displayName,
              parseError(err),
            );
          }

          // We can assume the device is offline or not available anymore, so we will remove it from the devices list
          // We should only do this if it is not a device that the user has configured manually with an IP
          if (!foundDevice.isManual) {
            this.lanDevices.splice(foundDeviceId, 1);
            if (accessory.context.enableDebugLogging) {
              this.log('[%s] [LAN] removed device due to connection error.', accessory.displayName);
            }
          }
          reject(err);
        } else {
          if (accessory.context.enableDebugLogging) {
            this.log(
              '[%s] [LAN] command sent to [%s] at [%s].',
              accessory.displayName,
              accessory.context.gvDeviceId,
              foundDevice.ip,
            );
          }

          // We will send a request to the device to get the updated state.
          // A delay is needed because the device needs some time to update its internal state.
          setTimeout(async () => {
            try {
              await this.sendDeviceStateRequest(foundDevice);
            } catch (error) {
              const eText = parseError(error);
              this.log.warn('[%s] [LAN] could not request device status as %s.', accessory.displayName, eText);
            }
          }, deviceStatusDelayMs);
          resolve();
        }
      });
    });
  }

  startDevicesPolling() {
    this.devicesPolling = setInterval(() => {
      this.sendScanCommand();
    }, this.config.lanScanInterval * 1000);
  }

  startStatusPolling() {
    this.statusPolling = setInterval(async () => {
      this.lanDevices.forEach(async (device) => {
        try {
          await this.sendDeviceStateRequest(device);
        } catch (err) {
          const eText = parseError(err);
          this.log.warn('[%s] [LAN] could not request device status as %s.', device.device, eText);
        }
      });
    }, this.config.lanStateUpdateInterval * 1000);
  }

  close() {
    clearInterval(this.devicesPolling);
    clearInterval(this.statusPolling);
    this.receiver.close();
    this.sender.close();
  }
}

import btClient from '@abandonware/noble'; // eslint-disable-line import/no-extraneous-dependencies
import { sleep } from '../utils/functions.js';
import platformLang from '../utils/lang-en.js';

/*
  The necessary commands to send and functions are taken from and credit to:
  https://www.npmjs.com/package/govee-led-client
*/

export default class {
  constructor(platform) {
    this.connectedTo = false;
    this.log = platform.log;
    this.platform = platform;
    this.stateChange = false;

    // Can only scan/connect/send if the noble stateChange is 'poweredOn'
    btClient.on('stateChange', (state) => {
      this.stateChange = state;
      if (platform.config.debug) {
        this.log('[noble] stateChange: %s.', state);
      }
    });

    // Event listener for noble scanning start
    btClient.on('scanStart', () => {
      if (platform.config.debug) {
        this.log('[noble] %s.', platformLang.btStart);
      }
    });

    // Event listener for noble scanning stop
    btClient.on('scanStop', () => {
      if (platform.config.debug) {
        this.log('[noble] %s.', platformLang.btStop);
      }
    });

    // Event and log noble warnings
    btClient.on('warning', (message) => {
      if (platform.config.debug) {
        this.log.warn('[noble] %s.', message);
      }
    });

    // Event handler for discovering bluetooth devices
    // This should only be each and every time a device update is sent
    btClient.on('discover', (device) => {
      // Log the address found can be useful for debugging what's working
      // if (platform.config.debug) {
      this.log('[noble] found device [%s] [%s].', device.address, device.advertisement.localName);
      // }

      // Look for the device to update at the time
      if (!this.accessory || this.accessory.context.bleAddress !== device.address) {
        return;
      }

      // Found the device so stop scanning
      btClient.stopScanning();

      // Make the device global as needed in other functions
      this.device = device;

      // Log that the device has been discovered
      // if (this.accessory.context.enableDebugLogging) {
      this.log('[%s] %s.', this.accessory.displayName, platformLang.onlineBT);
      // }

      // Remove previous listeners that may still be intact
      this.device.removeAllListeners();

      // Add a listener for device disconnect
      this.device.on('disconnect', (reason) => {
        // Log the disconnection
        if (this.accessory) {
          // if (this.accessory.context.enableDebugLogging) {
          this.log('[%s] %s [%s].', this.accessory.displayName, platformLang.offlineBTConn, reason);
          // }
        } else if (platform.config.debug) {
          this.log(
            '[noble] [%s] %s [%s].',
            this.device ? this.device.address : 'unknown',
            platformLang.offlineBTConn,
            reason,
          );
        }

        // Un-define the variables used within the class
        this.device = undefined;
        this.connectedTo = false;
        this.controlChar = undefined;
        this.accessory = undefined;
      });

      // Reset adapter
      btClient.reset();

      // Connect to the device
      this.log('[%s] attempting to connect.', this.accessory.displayName);
      this.device.connect((error) => {
        if (error) {
          throw error;
        }
        // Update the currently-connect-to variable
        this.connectedTo = this.accessory.context.bleAddress;

        // Log the connection
        // if (this.accessory.context.enableDebugLogging) {
        this.log('[%s] %s.', this.accessory.displayName, platformLang.onlineBTConn);
        // }

        // Find the noble characteristic we need for controlling the device
        this.log('[%s] finding device characteristics.', this.accessory.displayName);
        device.discoverAllServicesAndCharacteristics((error2, services, characteristics) => {
          if (error2) {
            throw error2;
          }
          this.log('[%s] found some device characteristics.', this.accessory.displayName);
          Object.values(characteristics).forEach((char) => {
            // Make sure we found the characteristic and make it global for the sendUpdate function
            const formattedChar = char.uuid.replace(/-/g, '');
            if (formattedChar === '000102030405060708090a0b0c0d2b11') {
              this.controlChar = char;
              this.log(
                '[%s] found correct characteristic [%s].',
                this.accessory.displayName,
                formattedChar,
              );
            } else {
              this.log(
                '[%s] found different characteristic [%s].',
                this.accessory.displayName,
                formattedChar,
              );
            }
          });
          if (!this.controlChar) {
            throw new Error(`[${this.accessory.displayName}] could not find control characteristic`);
          }
        });
      });
    });
  }

  async updateDevice(accessory, params) {
    // This is called by the platform on sending a device update via bluetooth
    this.log(
      '[%s] starting update with params [%s].',
      accessory.displayName,
      JSON.stringify(params),
    );

    // Check the noble state is ready for bluetooth action
    if (this.stateChange !== 'poweredOn') {
      throw new Error(`${platformLang.btWrongState} [${this.stateChange}]`);
    }

    // This is used to time out the request later on if it's taking too much time
    let doIt = true;
    this.log('[%s] starting timer.', accessory.displayName);
    setTimeout(() => {
      doIt = false;
    }, accessory.context.extBLEControl);

    // Check if we are already connected to a device - and disconnect
    if (this.device) {
      if (this.connectedTo && this.connectedTo !== accessory.context.bleAddress) {
        this.log(
          'Disconnecting from [%s] to connect to [%s].',
          this.connectedTo,
          accessory.context.bleAddress,
        );
        await this.device.disconnectAsync();
        this.log('Disconnect successful.');
      }
    }

    // Make global the accessory in question which we are sending an update to
    this.accessory = accessory;

    // Start the bluetooth scan to discover this accessory
    // Service UUID for future reference 000102030405060708090a0b0c0d1910
    this.log('[%s] starting scan.', accessory.displayName);
    await btClient.startScanningAsync();
    this.log('[%s] scanning started.', accessory.displayName);

    // We want to wait for the .on('discover') function to find the accessory and the characteristic
    this.log('[%s] starting loop.', accessory.displayName);
    while (true) { // eslint-disable-line no-constant-condition
      // Timeout if taking over 4 seconds for API/AWS or 7 seconds for BLE-only
      if (!doIt) {
        this.log.warn('[%s] could not find device [%s].', accessory.displayName, accessory.context.bleAddress);
        throw new Error(platformLang.btTimeout);
      }

      // Once the characteristic (this.controlChar) has been found then break the loop
      if (this.connectedTo === accessory.context.bleAddress && this.controlChar) {
        this.log('[%s] found correct characteristic so breaking loop.', accessory.displayName);
        break;
      }

      // Repeat this process every 200ms until the characteristic is available
      await sleep(200); // eslint-disable-line no-await-in-loop
    }

    // Log the request if in debug mode
    // if (this.accessory.context.enableDebugLogging) {
    this.log(
      '[%s] %s {%s: %s}.',
      this.accessory.displayName,
      platformLang.sendingUpdateBT,
      params.cmd,
      JSON.stringify(params.data),
    );
    // }

    // Create the data that is sent to the device
    params.cmd &= 0xff; // eslint-disable-line no-bitwise
    const preChecksumFrame = Buffer.concat([
      Buffer.from([0x33, params.cmd].flat()),
      Buffer.from([params.data].flat()),
    ]);
    const preChecksumPaddingFrame = Buffer.concat([
      preChecksumFrame,
      Buffer.from(new Array(19 - preChecksumFrame.length).fill(0)),
    ]);
    let checksum = 0;
    Object.values(preChecksumPaddingFrame).forEach((i) => {
      checksum ^= i; // eslint-disable-line no-bitwise
    });

    // Send the data to the device
    await this.controlChar.writeAsync(
      Buffer.concat([preChecksumPaddingFrame, Buffer.from([checksum & 0xff])]), // eslint-disable-line no-bitwise
      true,
    );

    // Maybe a slight await here helps (for an unknown reason)
    await sleep(250);

    // Disconnect from device
    await this.device.disconnectAsync();

    // Maybe a slight await here helps (for an unknown reason)
    await sleep(250);
  }
}

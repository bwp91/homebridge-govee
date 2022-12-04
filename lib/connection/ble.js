import btClient from '@abandonware/noble'; // eslint-disable-line import/no-extraneous-dependencies
import { generateCodeFromHexValues, hexToTwoItems, sleep } from '../utils/functions.js';
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
      this.log.debug('[BLE] stateChange: %s.', state);
    });

    // Event listener for noble scanning start
    btClient.on('scanStart', () => {
      this.log.debug('[BLE] %s.', platformLang.bleStart);
    });

    // Event listener for noble scanning stop
    btClient.on('scanStop', () => {
      this.log.debug('[BLE] %s.', platformLang.bleStop);
    });

    // Event and log noble warnings
    btClient.on('warning', (message) => {
      this.log.debugWarn('[BLE] %s.', message);
    });

    // Event handler for discovering bluetooth devices
    // This should only be each and every time a device update is sent
    btClient.on('discover', (device) => {
      // Log the address found can be useful for debugging what's working
      this.log.debug('[BLE] found device [%s] [%s].', device.address, device.advertisement.localName);

      // Look for the device to update at the time
      if (!this.accessory || this.accessory.context.bleAddress !== device.address) {
        return;
      }

      // Found the device so stop scanning
      btClient.stopScanning();

      // Make the device global as needed in other functions
      this.device = device;

      // Log that the device has been discovered
      this.accessory.logDebug(platformLang.onlineBT);

      // Remove previous listeners that may still be intact
      this.device.removeAllListeners();

      // Add a listener for device disconnect
      this.device.on('disconnect', (reason) => {
        // Log the disconnection
        if (this.accessory) {
          this.accessory.logDebug(`${platformLang.offlineBTConn} [${reason || 'unknown'}]`);
        } else {
          this.log.debug(
            '[BLE] [%s] %s [%s].',
            this.device ? this.device.address : 'unknown',
            platformLang.offlineBTConn,
            reason || 'unknown',
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
      this.accessory.logDebug('attempting to connect');
      this.device.connect((error) => {
        if (error) {
          this.accessory.logWarn(`could not connect as ${error}`);
          return;
        }
        // Update the currently-connect-to variable
        this.connectedTo = this.accessory.context.bleAddress;

        // Log the connection
        this.accessory.logDebug(platformLang.onlineBTConn);

        // Find the noble characteristic we need for controlling the device
        this.accessory.logDebug('finding device characteristics');
        device.discoverAllServicesAndCharacteristics((error2, services, characteristics) => {
          if (error2) {
            this.accessory.logWarn(`could not find device characteristics as ${error2}`);
            return;
          }
          this.log('[%s] found some device characteristics.', this.accessory.displayName);
          Object.values(characteristics).forEach((char) => {
            // Make sure we found the characteristic and make it global for the sendUpdate function
            const formattedChar = char.uuid.replace(/-/g, '');
            if (formattedChar === '000102030405060708090a0b0c0d2b11') {
              this.controlChar = char;
              this.accessory.logDebug(`found correct characteristic [${formattedChar}]`);
            } else {
              this.accessory.logDebug(`found different characteristic [${formattedChar}]`);
            }
          });
          if (!this.controlChar) {
            this.log.warn('[%s] could not find control characteristic.', this.accessory.displayName);
          }
        });
      });
    });
  }

  async updateDevice(accessory, params) {
    // This is called by the platform on sending a device update via bluetooth
    accessory.logDebug(`starting update with params [${JSON.stringify(params)}]`);

    // Check the noble state is ready for bluetooth action
    if (this.stateChange !== 'poweredOn') {
      throw new Error(`${platformLang.bleWrongState} [${this.stateChange}]`);
    }

    // This is used to time out the request later on if it's taking too much time
    let doIt = true;
    accessory.logDebug('starting timer');
    setTimeout(() => {
      doIt = false;
    }, accessory.context.extBLEControl);

    // Check if we are already connected to a device - and disconnect
    if (this.device) {
      if (this.connectedTo && this.connectedTo !== accessory.context.bleAddress) {
        accessory.logDebug(`disconnecting from [${this.connectedTo}] to connect to [${accessory.context.bleAddress}]`);
        await this.device.disconnectAsync();
        accessory.logDebug('disconnect successful');
      }
    }

    // Make global the accessory in question which we are sending an update to
    this.accessory = accessory;

    // Start the bluetooth scan to discover this accessory
    // Service UUID for future reference 000102030405060708090a0b0c0d1910
    accessory.logDebug('starting scan');
    await btClient.startScanningAsync();
    accessory.logDebug('scanning started');

    // We want to wait for the .on('discover') function to find the accessory and the characteristic
    accessory.logDebug('starting loop');

    while (true) { // eslint-disable-line no-constant-condition
      // Timeout if taking over 4 seconds for API/AWS or 7 seconds for BLE-only
      if (!doIt) {
        accessory.logWarn(`could not find device [${accessory.context.bleAddress}]`);
        throw new Error(platformLang.bleTimeout);
      }

      // Once the characteristic (this.controlChar) has been found then break the loop
      if (this.connectedTo === accessory.context.bleAddress && this.controlChar) {
        accessory.logDebug('found correct characteristic so breaking loop');
        break;
      }

      // Repeat this process every 200ms until the characteristic is available
      await sleep(200); // eslint-disable-line no-await-in-loop
    }

    // We can be sent either:
    // - a full 40 character string with the checksum already included (with params.cmd === 'ptReal')
    // - an array containing a varied amount of already-hex values
    const finalBuffer = params.cmd === 'ptReal'
      ? Buffer.from(hexToTwoItems(params.data).map((byte) => `0x${byte}`))
      : generateCodeFromHexValues([0x33, params.cmd, params.data], true);

    // Log the request if in debug mode
    accessory.logDebug(`[BLE] ${platformLang.sendingUpdate} [${finalBuffer.toString('hex')}]`);

    // Send the data to the device
    await this.controlChar.writeAsync(finalBuffer, true);

    // Maybe a slight await here helps (for an unknown reason)
    await sleep(100);

    // Disconnect from device
    await this.device.disconnectAsync();

    // Maybe a slight await here helps (for an unknown reason)
    await sleep(100);
  }
}

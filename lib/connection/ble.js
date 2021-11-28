/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

/*
  The necessary commands to send and functions are taken from and credit to:
  https://www.npmjs.com/package/govee-led-client
*/

const btClient = require('@abandonware/noble')

module.exports = class BluetoothLED {
  constructor (platform) {
    this.connectedTo = false
    this.consts = platform.consts
    this.funcs = platform.funcs
    this.lang = platform.lang
    this.log = platform.log
    this.platform = platform
    this.stateChange = false

    // Can only scan/connect/send if the noble stateChange is 'poweredOn'
    btClient.on('stateChange', state => {
      this.stateChange = state
      if (platform.config.debug) {
        this.log('[noble] stateChange: %s.', state)
      }
    })

    // Event listener for noble scanning start
    btClient.on('scanStart', () => {
      if (platform.config.debug) {
        this.log('[noble] %s.', this.lang.btStart)
      }
    })

    // Event listener for noble scanning stop
    btClient.on('scanStop', () => {
      if (platform.config.debug) {
        this.log('[noble] %s.', this.lang.btStop)
      }
    })

    // Event and log noble warnings
    btClient.on('warning', message => {
      if (platform.config.debug) {
        this.log.warn('[noble] %s.', message)
      }
    })

    // Event handler for discovering bluetooth devices
    // This should only be each and every time a device update is sent
    btClient.on('discover', async device => {
      try {
        // Log the address found can be useful for debugging what's working
        if (platform.config.debug) {
          this.log(
            '[noble] found device [%s] [%s].',
            device.address,
            device.advertisement.localName
          )
        }

        // Look for the device to update at the time
        if (!this.accessory || this.accessory.context.bleAddress !== device.address) {
          return
        }

        // Found the device so stop scanning
        await btClient.stopScanningAsync()

        // Make the device global as needed in other functions
        this.device = device

        // Log that the device has been discovered
        if (this.accessory.context.enableDebugLogging) {
          this.log('[%s] %s.', this.accessory.displayName, this.lang.onlineBT)
        }

        // Remove previous listeners that may still be intact
        this.device.removeAllListeners()

        // Add a listener for device disconnect
        this.device.on('disconnect', () => {
          // Log the disconnection
          if (this.accessory && this.accessory.context.enableDebugLogging) {
            this.log('[%s] %s.', this.accessory.displayName, this.lang.offlineBTConn)
          } else if (platform.config.debug) {
            this.log('[noble] unknown device %s.', this.lang.offlineBTConn)
          }

          // Un-define the variables used within the class
          this.device = undefined
          this.connectedTo = false
          this.controlChar = undefined
          this.accessory = undefined
        })

        // Connect to the device
        await this.device.connectAsync()

        // Update the currently-connect-to variable
        this.connectedTo = device.address

        // Log the connection
        if (this.accessory.context.enableDebugLogging) {
          this.log('[%s] %s.', this.accessory.displayName, this.lang.onlineBTConn)
        }

        /*
          Sometimes at this point the device disconnects - not sure why
        */

        // Find the noble characteristic we need for controlling the device
        const { characteristics } = await this.device.discoverAllServicesAndCharacteristicsAsync()

        for (const char of characteristics) {
          // Make sure we found the characteristic and make it global for the sendUpdate function
          if (char.uuid.replace(/-/g, '') === '000102030405060708090a0b0c0d2b11') {
            this.controlChar = char
          }
        }
      } catch (err) {
        const eText = this.funcs.parseError(err)
        this.log.warn('[noble] %s.', eText)
      }
    })
  }

  async updateDevice (accessory, params) {
    // This is called by the platform on sending a device update via bluetooth

    // Check the noble state is ready for bluetooth action
    if (this.stateChange !== 'poweredOn') {
      throw new Error(this.lang.btWrongState + ' [' + this.stateChange + ']')
    }

    // This is used to timeout the request later on if it's taking too much time
    let doIt = true
    setTimeout(() => (doIt = false), 3000)

    // Check if we are already connected to a device - and disconnect
    if (this.device) {
      if (this.connectedTo && this.connectedTo !== accessory.context.bleAddress) {
        await this.device.disconnectAsync()
      }
    }

    // Make global the accessory in question which we are sending an update to
    this.accessory = accessory

    // Start the bluetooth scan to discover this accessory
    try {
      await btClient.startScanningAsync()
    } catch (err) {
      // Suppress errors here
    }

    // We want to wait for the .on('discover') function to find the accessory and the characteristic
    while (true) {
      // Timeout if taking over 3 seconds
      if (!doIt) {
        throw new Error(this.lang.btTimeout)
      }

      // Once the characteristic (this.controlChar) has been found then break the loop
      if (this.connectedTo === accessory.context.bleAddress && this.controlChar) {
        break
      }

      // Repeat this process every 100ms until the characteristic is available
      await this.funcs.sleep(100)
    }

    // Log the request if in debug mode
    if (this.accessory.context.enableDebugLogging) {
      this.log(
        '[%s] %s {%s: %s}.',
        this.accessory.displayName,
        this.lang.sendingUpdateBT,
        params.cmd,
        JSON.stringify(params.data)
      )
    }

    // Create the data that is sent to the device
    params.cmd = params.cmd & 0xff
    const preChecksumFrame = Buffer.concat([
      Buffer.from([0x33, params.cmd].flat()),
      Buffer.from([params.data].flat())
    ])
    const preChecksumPaddingFrame = Buffer.concat([
      preChecksumFrame,
      Buffer.from(new Array(19 - preChecksumFrame.length).fill(0))
    ])
    let checksum = 0
    for (const i of preChecksumPaddingFrame) {
      checksum ^= i
    }

    // Send the data to the device
    await this.controlChar.writeAsync(
      Buffer.concat([preChecksumPaddingFrame, Buffer.from([checksum & 0xff])]),
      true
    )

    // This seems to improve reliability for devices responding to commands
    await this.funcs.sleep(500)
  }
}

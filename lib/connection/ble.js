/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

/*
  The necessary commands to send are taken from and credit to:
  https://www.npmjs.com/package/govee-led-client
*/

const btClient = require('@abandonware/noble')

module.exports = class BluetoothLED {
  constructor (platform) {
    this.bleDevices = platform.bleDevices
    this.connectedTo = false
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
      this.log.warn('[noble] %s.', message)
    })

    // Event handler for discovering bluetooth devices
    // This should only be each and every time a device update is sent
    btClient.on('discover', async device => {
      // Look for the device to update at the time
      if (this.accessory.context.bleAddress !== device.address) {
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
        if (this.accessory.context.enableDebugLogging) {
          this.log('[%s] %s.', this.accessory.displayName, this.lang.offlineBTConn)
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
      const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
        [],
        ['000102030405060708090a0b0c0d2b11']
      )

      // Make sure we found the characteristic and make it global for the device sendUpdate function
      if (characteristics[0]) {
        this.controlChar = characteristics[0]
      }
    })
  }

  async updateDevice (accessory, params) {
    // This is called by the platform on sending a device update via bluetooth

    // Check the noble state is ready for bluetooth action
    if (this.stateChange !== 'poweredOn') {
      throw new Error('bluetooth adapter not in correct state')
    }

    // This is used to timeout the request later on if it's taking too much time
    let doIt = true
    setTimeout(
      () => {
        doIt = false
      },
      accessory.context.isAPIDevice ? 2000 : 4000
    )

    // Check if we are already connected to a device - and disconnect
    if (this.device) {
      await this.device.disconnectAsync()
    }

    // Make global the accessory in question which we are sending an update to
    this.accessory = accessory

    // Start the bluetooth scan to discover this accessory
    process.nextTick(async () => {
      await btClient.startScanningAsync()
    })

    // We want to wait for the .on('discover') function to find the accessory and the characteristic
    while (true) {
      // Timeout if taking over 2 seconds for wifi models and 9 seconds for only bluetooth models
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

    // Discovered, connected and obtained the characteristic - so onto sending the command
    switch (params.name) {
      case 'turn':
        // Simple on/off
        await this.send(0x01, params.value === 'on' ? 0x1 : 0x0)
        break
      case 'brightness': {
        // We will have been passed a [0, 254] value for some models - scale back to [0, 100]
        const percent = this.platform.consts.scaleBrightness.includes(accessory.context.gvModel)
          ? Math.round(params.value / 2.54)
          : params.value
        await this.send(0x04, Math.floor((percent / 100) * 0xff))
        break
      }
      case 'color':
        // Simple rgb
        await this.send(0x05, [0x02, params.value.r, params.value.g, params.value.b])
        break
      case 'colorTem': {
        // We are passed the kelvin value, so convert to rgb
        const [r, g, b] = this.platform.colourUtils.k2rgb(params.value)
        await this.send(0x05, [0x02, 0xff, 0xff, 0xff, 0x01, r, g, b])
        break
      }
      default:
        // Should be a never case
        throw new Error(this.lang.cmdNotBT)
    }
  }

  async send (cmd, payload) {
    // Log the request if in debug mode
    if (this.accessory.context.enableDebugLogging) {
      this.log(
        '[%s] %s {%s: %s}.',
        this.accessory.displayName,
        this.lang.sendingUpdateBT,
        cmd,
        JSON.stringify(payload)
      )
    }

    // Create the data that is sent to the device
    cmd = cmd & 0xff
    const preChecksumFrame = Buffer.concat([
      Buffer.from([0x33, cmd].flat()),
      Buffer.from([payload].flat())
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

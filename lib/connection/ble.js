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

    btClient.on('stateChange', state => {
      this.stateChange = state
      if (platform.config.debug) {
        this.log('[noble] stateChange: %s.', state)
      }
    })
    btClient.on('scanStart', () => {
      if (platform.config.debug) {
        this.log('[noble] %s.', this.lang.btStart)
      }
    })
    btClient.on('scanStop', () => {
      if (platform.config.debug) {
        this.log('[noble] %s.', this.lang.btStop)
      }
    })
    btClient.on('warning', message => {
      this.log.warn('[noble] %s.', message)
    })
    btClient.on('discover', async device => {
      if (this.accessory.context.bleAddress !== device.address) {
        return
      }
      await btClient.stopScanningAsync()
      this.device = device
      if (this.accessory.context.enableLogging) {
        this.log('[%s] %s.', this.accessory.displayName, this.lang.onlineBT)
      }

      this.device.removeAllListeners()
      this.device.on('disconnect', () => {
        this.log('[%s] %s.', this.accessory.displayName, this.lang.offlineBTConn)
        this.device = undefined
        this.connectedTo = false
        this.controlChar = undefined
        this.accessory = undefined
      })

      await this.device.connectAsync()
      this.connectedTo = device.address
      if (this.accessory.context.enableLogging) {
        this.log('[%s] %s.', this.accessory.displayName, this.lang.onlineBTConn)
      }
      const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
        [],
        ['000102030405060708090a0b0c0d2b11']
      )
      if (characteristics[0]) {
        this.controlChar = characteristics[0]
      }
    })
  }

  async updateDevice (accessory, params) {
    if (this.stateChange !== 'poweredOn') {
      throw new Error('bluetooth adapter not in correct state')
    }

    let doIt = true
    setTimeout(
      () => {
        doIt = false
      },
      accessory.context.isAPIDevice ? 2000 : 9000
    )

    if (this.device) {
      // Already connected to a different device, should never be a case
      await this.device.disconnectAsync()
    }
    this.accessory = accessory
    process.nextTick(async () => {
      await btClient.startScanningAsync()
    })
    while (true) {
      if (!doIt) {
        throw new Error(this.lang.btTimeout)
      }
      if (this.connectedTo === accessory.context.bleAddress && this.controlChar) {
        break
      }
      await this.funcs.sleep(100)
    }
    switch (params.name) {
      case 'turn':
        await this.send(0x01, params.value === 'on' ? 0x1 : 0x0)
        break
      case 'brightness': {
        const percent = this.platform.consts.scaleBrightness.includes(accessory.context.gvModel)
          ? Math.round(params.value / 2.54)
          : params.value
        await this.send(0x04, Math.floor((percent / 100) * 0xff))
        break
      }
      case 'color':
        await this.send(0x05, [0x02, params.value.r, params.value.g, params.value.b])
        break
      case 'colorTem': {
        const [r, g, b] = this.platform.colourUtils.k2rgb(params.value)
        await this.send(0x05, [0x02, 0xff, 0xff, 0xff, 0x01, r, g, b])
        break
      }
      default:
        throw new Error('command not supported via Bluetooth')
    }
  }

  async send (cmd, payload) {
    // Log the request if in debug mode
    if (this.accessory.context.enableLogging) {
      this.log(
        '[%s] %s {%s: %s}.',
        this.accessory.displayName,
        this.lang.sendingUpdateBT,
        cmd,
        JSON.stringify(payload)
      )
    }
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
    await this.controlChar.writeAsync(
      Buffer.concat([preChecksumPaddingFrame, Buffer.from([checksum & 0xff])]),
      true
    )
    await this.funcs.sleep(500)
  }
}

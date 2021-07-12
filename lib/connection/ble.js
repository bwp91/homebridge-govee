/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

/*
  The necessary commands to send are taken from and credit to:
  https://www.npmjs.com/package/govee-led-client
*/

module.exports = class BluetoothLED {
  constructor (platform, accessory, device) {
    this.accessory = accessory
    this.device = device
    this.platform = platform

    this.device.on('disconnect', () => {
      if (this.accessory.context.enableDebugLogging) {
        this.platform.log('[%s] %s.', this.accessory.displayName, this.platform.lang.btConnNo)
      }
    })
  }

  async send (controlChar, cmd, payload) {
    // Log the request if in debug mode
    if (this.accessory.context.enableDebugLogging) {
      this.platform.log(
        '[%s] %s {%s: %s}.',
        this.accessory.displayName,
        this.platform.lang.sendingUpdateBT,
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
    await controlChar.writeAsync(
      Buffer.concat([preChecksumPaddingFrame, Buffer.from([checksum & 0xff])]),
      true
    )
    await this.device.disconnectAsync()
  }

  async updateDevice (params) {
    await this.device.connectAsync()
    if (this.accessory.context.enableDebugLogging) {
      this.platform.log('[%s] %s.', this.accessory.displayName, this.platform.lang.btConnYes)
    }
    const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
      [],
      []
    )
    let controlChar
    for (const char of characteristics) {
      if (char.uuid === '000102030405060708090a0b0c0d2b11') {
        controlChar = char
      }
    }
    if (!controlChar) {
      throw new Error('bluetooth char not found')
    }
    switch (params.name) {
      case 'turn':
        await this.send(controlChar, 0x01, params.value === 'on' ? 0x1 : 0x0)
        break
      case 'brightness': {
        const percent = this.platform.consts.scaleBrightness.includes(
          this.accessory.context.gvModel
        )
          ? Math.round(params.value / 2.54)
          : params.value
        await this.send(controlChar, 0x04, Math.floor((percent / 100) * 0xff))
        break
      }
      case 'color':
        await this.send(controlChar, 0x05, [0x02, params.value.r, params.value.g, params.value.b])
        break
      case 'colorTem': {
        const [r, g, b] = this.platform.colourUtils.k2rgb(params.value)
        await this.send(controlChar, 0x05, [0x02, 0xff, 0xff, 0xff, 0x01, r, g, b])
        break
      }
      default:
        throw new Error('command not supported via Bluetooth')
    }
  }
}

/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const noble = require('@abandonware/noble')

module.exports = class BluetoothLED extends require('events').EventEmitter {
  constructor (platform, accessory) {
    super()

    this.Ping = Buffer.from([
      0xaa,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0xab
    ])

    this.accessory = accessory
    this._addr = accessory.context.gvDeviceId.substring(6).toLowerCase()
    this.platform = platform
    this._disconect_called = false
    this._ping = this._ping.bind(this)

    noble.on('discover', device => {
      if (device.address !== this._addr) {
        return
      }
      noble.stopScanning()
      device.on('disconnect', async () => {
        platform.updateAccessoryBTStatus(accessory, false)
        this.controller = undefined
        if (!this._disconect_called) {
          await this.reconnect()
        }
      })
      device.connect(() => {
        this._dev = device
        device.discoverSomeServicesAndCharacteristics([], [], (_, service, chars) => {
          for (const char of chars) {
            if (char.uuid === '000102030405060708090a0b0c0d2b11') {
              setTimeout(() => platform.updateAccessoryBTStatus(accessory, true), 500)
              this._pingTimer = setInterval(this._ping, 2000)
              this.controller = char
            }
          }
        })
      })
    })

    process.nextTick(() => {
      noble.startScanning([], false)
    })
  }

  async reconnect () {
    this._dev.connect(() => {
      this._dev.discoverSomeServicesAndCharacteristics([], [], (_, service, chars) => {
        for (const char of chars) {
          if (char.uuid === '000102030405060708090a0b0c0d2b11') {
            setTimeout(() => this.platform.updateAccessoryBTStatus(this.accessory, true), 500)
            this.controller = char
          }
        }
      })
    })
  }

  disconnect () {
    this._disconect_called = true
    if (this._dev) {
      this._dev.disconnect(() => clearTimeout(this._pingTimer))
    }
  }

  _ping () {
    if (this.controller) {
      this.controller.write(this.Ping, true)
    }
  }

  _send (cmd, payload) {
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
    this.controller.write(
      Buffer.concat([preChecksumPaddingFrame, Buffer.from([checksum & 0xff])]),
      true
    )
  }

  async updateDevice (params) {
    if (!this.controller) {
      throw new Error('bluetooth not connected')
    }
    if (params.name === 'turn') {
      this._send(0x01, params.value === 'on' ? 0x1 : 0x0)
    } else {
      throw new Error('command not supported via Bluetooth')
    }
  }
}

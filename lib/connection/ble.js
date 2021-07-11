/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const noble = require('@abandonware/noble')

/*
  This code has been taken and refactored for specific use from:
  https://www.npmjs.com/package/govee-led-client

  MIT License

  Copyright (c) 2020 Ben Bartrim

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

*/

module.exports = class BluetoothLED extends require('events').EventEmitter {
  constructor (platform, accessory) {
    super()
    this.accessory = accessory
    this.consts = platform.consts
    this.disconnectCalled = false
    this.platform = platform

    noble.on('discover', device => {
      if (device.address !== accessory.context.gvDeviceId.substring(6).toLowerCase()) {
        return
      }
      noble.stopScanning()
      device.on('disconnect', async () => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval)
        }
        platform.updateAccessoryBTStatus(accessory, false)
        this.controller = undefined
        if (this.disconnectCalled) {
          this.disconnectCalled = false
        } else {
          await this.reconnect()
        }
      })
      device.connect(() => {
        this.device = device
        device.discoverSomeServicesAndCharacteristics([], [], (_, service, chars) => {
          for (const char of chars) {
            if (char.uuid === '000102030405060708090a0b0c0d2b11') {
              setTimeout(() => platform.updateAccessoryBTStatus(accessory, true), 500)
              this.pingInterval = setInterval(() => this.ping(), 2000)
              this.controller = char
            }
          }
        })
      })
    })

    process.nextTick(() => {
      try {
        noble.startScanning()
      } catch (err) {
        const eText = err.message.includes('ENODEV')
          ? '[ENODEV] ' + platform.lang.noBTAdaptor
          : platform.funcs.parseError(err)
        platform.log.warn('[%s] %s %s.', accessory.displayName, platform.lang.noBTClient, eText)
      }
    })
  }

  ping () {
    if (!this.controller) {
      return
    }
    this.controller.write(
      Buffer.from([
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
      ]),
      true
    )
  }

  async reconnect () {
    this.device.connect(() => {
      this.device.discoverSomeServicesAndCharacteristics([], [], (_, service, chars) => {
        for (const char of chars) {
          if (char.uuid === '000102030405060708090a0b0c0d2b11') {
            setTimeout(() => this.platform.updateAccessoryBTStatus(this.accessory, true), 500)
            this.pingInterval = setInterval(() => this.ping(), 2000)
            this.controller = char
          }
        }
      })
    })
  }

  disconnect () {
    this.disconnectCalled = true
    if (!this.device) {
      return
    }
    this.device.disconnect()
  }

  send (cmd, payload) {
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
    switch (params.name) {
      case 'turn':
        this.send(0x01, params.value === 'on' ? 0x1 : 0x0)
        break
      case 'brightness': {
        const percent = this.consts.scaleBrightness.includes(this.accessory.context.gvModel)
          ? Math.round(params.value / 2.54)
          : params.value
        this.send(0x04, Math.floor((percent / 100) * 0xff))
        break
      }
      case 'color':
        this.send(0x05, [0x02, params.value.r, params.value.g, params.value.b])
        break
      default:
        throw new Error('command not supported via Bluetooth')
    }
  }
}

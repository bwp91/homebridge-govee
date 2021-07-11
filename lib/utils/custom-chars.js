/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class customCharacteristics {
  constructor (api) {
    this.hapServ = api.hap.Service
    this.hapChar = api.hap.Characteristic
    this.uuids = {
      bluetooth: 'E964F001-079E-48FF-8F27-9C2605A29F52'
    }
    const self = this
    this.Bluetooth = function () {
      self.hapChar.call(this, 'Bluetooth', self.uuids.bluetooth)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    const inherits = require('util').inherits
    inherits(this.Bluetooth, this.hapChar)
    this.Bluetooth.UUID = this.uuids.bluetooth
  }
}

/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class customCharacteristics {
  constructor (api) {
    this.hapServ = api.hap.Service
    this.hapChar = api.hap.Characteristic
    this.uuids = {
      testScene: 'E964F001-079E-48FF-8F27-9C2605A29F52',
    }
    const self = this
    this.TestScene = function () {
      self.hapChar.call(this, 'Test Scene', self.uuids.testScene)
      this.setProps({
        format: self.hapChar.Formats.UINT8,
        unit: '',
        maxValue: 10,
        minValue: 0,
        minStep: 1,
        perms: [
          self.hapChar.Perms.READ,
          self.hapChar.Perms.WRITE,
          self.hapChar.Perms.NOTIFY
        ]
      })
      this.value = this.getDefaultValue()
    }
    const inherits = require('util').inherits
    inherits(this.TestScene, this.hapChar)
    this.TestScene.UUID = this.uuids.testScene
  }
}

/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class customCharacteristics {
  constructor (api) {
    this.hapServ = api.hap.Service
    this.hapChar = api.hap.Characteristic
    this.uuids = {
      /* deprecated
      bluetooth: 'E964F001-079E-48FF-8F27-9C2605A29F52'
      bluetoothConn: 'E964F002-079E-48FF-8F27-9C2605A29F52'
      musicMode: 'E964F003-079E-48FF-8F27-9C2605A29F52'
      */
      colourMode: 'E964F004-079E-48FF-8F27-9C2605A29F52',
      musicModeOne: 'E964F005-079E-48FF-8F27-9C2605A29F52',
      musicModeTwo: 'E964F006-079E-48FF-8F27-9C2605A29F52'
    }
    const self = this
    this.ColourMode = function () {
      self.hapChar.call(this, 'Colour Mode', self.uuids.colourMode)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.MusicModeOne = function () {
      self.hapChar.call(this, 'Music Mode 1', self.uuids.musicModeOne)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.MusicModeTwo = function () {
      self.hapChar.call(this, 'Music Mode 2', self.uuids.musicModeTwo)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    const inherits = require('util').inherits
    inherits(this.ColourMode, this.hapChar)
    inherits(this.MusicModeOne, this.hapChar)
    inherits(this.MusicModeTwo, this.hapChar)
    this.ColourMode.UUID = this.uuids.colourMode
    this.MusicModeOne.UUID = this.uuids.musicModeOne
    this.MusicModeTwo.UUID = this.uuids.musicModeTwo
  }
}

/* jshint node: true, esversion: 10, -W014, -W033 */
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
      musicMode: 'E964F005-079E-48FF-8F27-9C2605A29F52',
      musicModeTwo: 'E964F006-079E-48FF-8F27-9C2605A29F52',
      scene: 'E964F007-079E-48FF-8F27-9C2605A29F52',
      sceneTwo: 'E964F008-079E-48FF-8F27-9C2605A29F52',
      diyMode: 'E964F009-079E-48FF-8F27-9C2605A29F52',
      diyModeTwo: 'E964F010-079E-48FF-8F27-9C2605A29F52',
      sceneThree: 'E964F011-079E-48FF-8F27-9C2605A29F52',
      sceneFour: 'E964F012-079E-48FF-8F27-9C2605A29F52',
      diyModeThree: 'E964F013-079E-48FF-8F27-9C2605A29F52',
      diyModeFour: 'E964F014-079E-48FF-8F27-9C2605A29F52',
      segmented: 'E964F015-079E-48FF-8F27-9C2605A29F52',
      segmentedTwo: 'E964F016-079E-48FF-8F27-9C2605A29F52',
      segmentedThree: 'E964F017-079E-48FF-8F27-9C2605A29F52',
      segmentedFour: 'E964F018-079E-48FF-8F27-9C2605A29F52'
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
    this.MusicMode = function () {
      self.hapChar.call(this, 'Music Mode', self.uuids.musicMode)
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
    this.Scene = function () {
      self.hapChar.call(this, 'Scene', self.uuids.scene)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.SceneTwo = function () {
      self.hapChar.call(this, 'Scene 2', self.uuids.sceneTwo)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.SceneThree = function () {
      self.hapChar.call(this, 'Scene 3', self.uuids.sceneThree)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.SceneFour = function () {
      self.hapChar.call(this, 'Scene 4', self.uuids.sceneFour)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.DiyMode = function () {
      self.hapChar.call(this, 'DIY Mode', self.uuids.diyMode)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.DiyModeTwo = function () {
      self.hapChar.call(this, 'DIY Mode 2', self.uuids.diyModeTwo)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.DiyModeThree = function () {
      self.hapChar.call(this, 'DIY Mode 3', self.uuids.diyModeThree)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.DiyModeFour = function () {
      self.hapChar.call(this, 'DIY Mode 4', self.uuids.diyModeFour)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.Segmented = function () {
      self.hapChar.call(this, 'Segmented', self.uuids.segmented)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.SegmentedTwo = function () {
      self.hapChar.call(this, 'Segmented 2', self.uuids.segmentedTwo)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.SegmentedThree = function () {
      self.hapChar.call(this, 'Segmented 3', self.uuids.segmentedThree)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    this.SegmentedFour = function () {
      self.hapChar.call(this, 'Segmented 4', self.uuids.segmentedFour)
      this.setProps({
        format: self.hapChar.Formats.BOOL,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.WRITE, self.hapChar.Perms.NOTIFY]
      })
      this.value = this.getDefaultValue()
    }
    const inherits = require('util').inherits
    inherits(this.ColourMode, this.hapChar)
    inherits(this.MusicMode, this.hapChar)
    inherits(this.MusicModeTwo, this.hapChar)
    inherits(this.Scene, this.hapChar)
    inherits(this.SceneTwo, this.hapChar)
    inherits(this.SceneThree, this.hapChar)
    inherits(this.SceneFour, this.hapChar)
    inherits(this.DiyMode, this.hapChar)
    inherits(this.DiyModeTwo, this.hapChar)
    inherits(this.DiyModeThree, this.hapChar)
    inherits(this.DiyModeFour, this.hapChar)
    inherits(this.Segmented, this.hapChar)
    inherits(this.SegmentedTwo, this.hapChar)
    inherits(this.SegmentedThree, this.hapChar)
    inherits(this.SegmentedFour, this.hapChar)
    this.ColourMode.UUID = this.uuids.colourMode
    this.MusicMode.UUID = this.uuids.musicMode
    this.MusicModeTwo.UUID = this.uuids.musicModeTwo
    this.Scene.UUID = this.uuids.scene
    this.SceneTwo.UUID = this.uuids.sceneTwo
    this.SceneThree.UUID = this.uuids.sceneThree
    this.SceneFour.UUID = this.uuids.sceneFour
    this.DiyMode.UUID = this.uuids.diyMode
    this.DiyModeTwo.UUID = this.uuids.diyModeTwo
    this.DiyModeThree.UUID = this.uuids.diyModeThree
    this.DiyModeFour.UUID = this.uuids.diyModeFour
    this.Segmented.UUID = this.uuids.segmented
    this.SegmentedTwo.UUID = this.uuids.segmentedTwo
    this.SegmentedThree.UUID = this.uuids.segmentedThree
    this.SegmentedFour.UUID = this.uuids.segmentedFour
  }
}

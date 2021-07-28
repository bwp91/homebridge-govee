/* jshint node: true,esversion: 9, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

module.exports = class customServices {
  constructor (api, scenes) {
    this.hapServ = api.hap.Service
    this.hapChar = api.hap.Characteristic
    const self = this
    this.SceneService = function(deviceName, sceneKey) {
      const scene = scenes[sceneKey]
      if (!scene) {
        throw new Error("Invalid scene " + sceneKey)
      }
      return self.hapServ.call(
          this,
          deviceName + " " + scene.label,
          scene.uuid,
          scene.key
      ).addCharacteristic(self.hapChar.On)
          .addOptionalCharacteristic(self.hapChar.Name)
    }
    const inherits = require('util').inherits
    inherits(this.SceneService, this.hapServ)
  }
}

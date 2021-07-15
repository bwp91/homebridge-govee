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
    }
    const self = this
    const inherits = require('util').inherits
  }
}

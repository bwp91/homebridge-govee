/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const hostname = os.hostname().split('.')[0]
const fileSuffix = '_persist.json'

module.exports = class FakeGatoStorage {
  constructor (params) {
    if (!params) {
      params = {}
    }
    this.writers = []
    this.log = params.log || {}
    if (!this.log.debug) {
      this.log.debug = console.log
    }
    this.addingWriter = false
  }

  addWriter (service, params) {
    if (!this.addingWriter) {
      this.addingWriter = true
      if (!params) {
        params = {}
      }
      this.log.debug('** Fakegato-storage AddWriter :', service.accessoryName)
      const newWriter = {
        service: service,
        callback: params.callback,
        storage: params.storage || 'fs',
        fileName: params.filename || hostname + '_' + service.accessoryName + fileSuffix
      }
      const onReady = typeof (params.onReady) === 'function'
        ? params.onReady
        : () => {}
      newWriter.storageHandler = fs
      newWriter.path = params.path || path.join(os.homedir(), '.homebridge')
      this.writers.push(newWriter)
      this.addingWriter = false
      onReady()
    } else {
      setTimeout(() => this.addWriter(service, params), 100)
    }
  }

  getWriter (service) {
    const findServ = function (element) {
      return element.service === service
    }
    return this.writers.find(findServ)
  }

  _getWriterIndex (service) {
    const findServ = function (element) {
      return element.service === service
    }
    return this.writers.findIndex(findServ)
  }

  getWriters () {
    return this.writers
  }

  delWriter (service) {
    const index = this._getWriterIndex(service)
    this.writers.splice(index, 1)
  }

  write (params) {
    // must be asynchronous
    if (!this.writing) {
      this.writing = true
      const writer = this.getWriter(params.service)
      // use parameter callback or writer callback or empty function
      const callBack = typeof (params.callback) === 'function'
        ? params.callback
        : (typeof (writer.callback) === 'function'
          ? writer.callback
          : () => {})
      this.log.debug(
        '** Fakegato-storage write FS file:',
        path.join(writer.path, writer.fileName),
        params.data.substr(1, 80)
      )
      writer.storageHandler.writeFile(
        path.join(writer.path, writer.fileName),
        params.data, 'utf8',
        () => {
          this.writing = false
          callBack(arguments)
        }
      )
    } else {
      setTimeout(() => this.write(params), 100)
    }
  }

  read (params) {
    const writer = this.getWriter(params.service)
    // use parameter callback or writer callback or empty function
    const callBack = typeof (params.callback) === 'function'
      ? params.callback
      : (typeof (writer.callback) === 'function'
        ? writer.callback
        : () => {})
    this.log.debug(
      '** Fakegato-storage read FS file:',
      path.join(writer.path, writer.fileName)
    )
    writer.storageHandler.readFile(
      path.join(writer.path, writer.fileName),
      'utf8',
      callBack
    )
  }

  remove (params) {
    const writer = this.getWriter(params.service)
    // use parameter callback or writer callback or empty function
    const callBack = typeof (params.callback) === 'function'
      ? params.callback
      : (typeof (writer.callback) === 'function'
        ? writer.callback
        : () => {})
    this.log.debug(
      '** Fakegato-storage delete FS file:',
      path.join(writer.path, writer.fileName)
    )
    writer.storageHandler.unlink(path.join(writer.path, writer.fileName), callBack)
  }
}

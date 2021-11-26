/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const hostname = os.hostname().split('.')[0]

class FakeGatoStorage {
  constructor (params) {
    if (!params) {
      params = {}
    }
    this.writers = []
    this.log = params.log || {}
    if (!this.log) {
      this.log = () => {}
    }
    this.addingWriter = false
  }

  addWriter (service, params) {
    if (!this.addingWriter) {
      this.addingWriter = true
      if (!params) {
        params = {}
      }
      this.log('[%s] FGS addWriter().', service.accessoryName)
      const newWriter = {
        service,
        callback: params.callback,
        fileName: hostname + '_' + service.accessoryName + '_persist.json'
      }
      const onReady = typeof params.onReady === 'function' ? params.onReady : () => {}
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
    return this.writers.find(ele => ele.service === service)
  }

  _getWriterIndex (service) {
    return this.writers.findIndex(ele => ele.service === service)
  }

  getWriters () {
    return this.writers
  }

  delWriter (service) {
    const index = this._getWriterIndex(service)
    this.writers.splice(index, 1)
  }

  write (params) {
    if (!this.writing) {
      this.writing = true
      const writer = this.getWriter(params.service)
      const callBack =
        typeof params.callback === 'function'
          ? params.callback
          : typeof writer.callback === 'function'
          ? writer.callback
          : () => {}
      const fileLoc = path.join(writer.path, writer.fileName)
      this.log(
        '[%s] FGS write file [%s] [%s].',
        params.service.accessoryName,
        fileLoc,
        params.data.substr(1, 80)
      )
      writer.storageHandler.writeFile(fileLoc, params.data, 'utf8', () => {
        this.writing = false
        callBack(arguments)
      })
    } else {
      setTimeout(() => this.write(params), 100)
    }
  }

  read (params) {
    const writer = this.getWriter(params.service)
    const callBack =
      typeof params.callback === 'function'
        ? params.callback
        : typeof writer.callback === 'function'
        ? writer.callback
        : () => {}
    const fileLoc = path.join(writer.path, writer.fileName)
    this.log('[%s] FGS read file [%s].', params.service.accessoryName, fileLoc)
    writer.storageHandler.readFile(fileLoc, 'utf8', callBack)
  }

  remove (params) {
    const writer = this.getWriter(params.service)
    const callBack =
      typeof params.callback === 'function'
        ? params.callback
        : typeof writer.callback === 'function'
        ? writer.callback
        : () => {}
    const fileLoc = path.join(writer.path, writer.fileName)
    this.log('[%s] FGS delete file [%s].', params.service.accessoryName, fileLoc)
    writer.storageHandler.unlink(fileLoc, callBack)
  }
}

module.exports = { FakeGatoStorage }

/* jshint esversion: 6,node: true,-W041: false */
'use strict'

const DEBUG = true

var fs = require('fs')
var os = require('os')
var path = require('path')
var hostname = os.hostname().split('.')[0]

// var googleDrive = require('./lib/googleDrive').drive;

var fileSuffix = '_persist.json'

var thisStorage

class FakeGatoStorage {
  constructor (params) {
    if (!params) { params = {} }

    this.writers = []

    this.log = params.log || {}
    if (!this.log.debug) {
      this.log.debug = DEBUG ? console.log : function () { }
    }
    thisStorage = this
    this.addingWriter = false
  }

  addWriter (service, params) {
    if (!this.addingWriter) {
      this.addingWriter = true
      if (!params) { params = {} }

      this.log.debug('** Fakegato-storage AddWriter :', service.accessoryName)

      const newWriter = {
        service: service,
        callback: params.callback,
        storage: params.storage || 'fs',
        fileName: params.filename || hostname + '_' + service.accessoryName + fileSuffix		// Unique filename per homebridge server.  Allows test environments on other servers not to break prod.
      }
      var onReady = typeof (params.onReady) === 'function' ? params.onReady : function () { }

      switch (newWriter.storage) {
        case 'fs':
          newWriter.storageHandler = fs
          newWriter.path = params.path || path.join(os.homedir(), '.homebridge')
          this.writers.push(newWriter)
          this.addingWriter = false
          onReady()
          break
        /*
        case 'googleDrive':
          newWriter.path = params.path || 'fakegato';
          newWriter.keyPath = params.keyPath || path.join(os.homedir(), '.homebridge');
          newWriter.storageHandler = new googleDrive({
            keyPath: newWriter.keyPath, callback: function () {
              this.addingWriter = false;
              onReady(arguments);
            }.bind(this), folder: newWriter.path
          });
          this.writers.push(newWriter);
          break;
        case 'memcached' :

        break;
        */
      }
    } else {
      setTimeout(function () {
        this.addWriter(service, params)
      }.bind(this), 100)
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

  write (params) { // must be asynchronous
    if (!this.writing) {
      this.writing = true
      const writer = this.getWriter(params.service)
      const callBack = typeof (params.callback) === 'function' ? params.callback : (typeof (writer.callback) === 'function' ? writer.callback : function () { }) // use parameter callback or writer callback or empty function
      switch (writer.storage) {
        case 'fs':
          this.log.debug('** Fakegato-storage write FS file:', path.join(writer.path, writer.fileName), params.data.substr(1, 80))
          writer.storageHandler.writeFile(path.join(writer.path, writer.fileName), params.data, 'utf8', function () {
            this.writing = false
            callBack(arguments)
          }.bind(this))
          break
        /*
        case 'googleDrive':
          this.log.debug("** Fakegato-storage write googleDrive file:", writer.path, writer.fileName, params.data.substr(1, 80));
          writer.storageHandler.writeFile(writer.path, writer.fileName, params.data, function () {
            this.writing = false;
            callBack(arguments);
          }.bind(this));
          break;
        case 'memcached' :

        break;
        */
      }
    } else {
      setTimeout(function () { // retry in 100ms
        this.write(params)
      }.bind(this), 100)
    }
  }

  read (params) {
    const writer = this.getWriter(params.service)
    const callBack = typeof (params.callback) === 'function' ? params.callback : (typeof (writer.callback) === 'function' ? writer.callback : function () { }) // use parameter callback or writer callback or empty function
    switch (writer.storage) {
      case 'fs':
        this.log.debug('** Fakegato-storage read FS file:', path.join(writer.path, writer.fileName))
        writer.storageHandler.readFile(path.join(writer.path, writer.fileName), 'utf8', callBack)
        break
      /*
      case 'googleDrive':
        this.log.debug("** Fakegato-storage read googleDrive file: %s/%s", writer.path, writer.fileName);
        writer.storageHandler.readFile(writer.path, writer.fileName, callBack);
        break;
      case 'memcached' :

      break;
      */
    }
  }

  remove (params) {
    const writer = this.getWriter(params.service)
    const callBack = typeof (params.callback) === 'function' ? params.callback : (typeof (writer.callback) === 'function' ? writer.callback : function () { }) // use parameter callback or writer callback or empty function
    switch (writer.storage) {
      case 'fs':
        this.log.debug('** Fakegato-storage delete FS file:', path.join(writer.path, writer.fileName))
        writer.storageHandler.unlink(path.join(writer.path, writer.fileName), callBack)
        break
      /*
      case 'googleDrive':
        this.log.debug("** Fakegato-storage delete googleDrive file:", writer.path, writer.fileName);
        writer.storageHandler.deleteFile(writer.path, writer.fileName, callBack);
        break;
      case 'memcached' :

      break;
      */
    }
  }
}

module.exports = {
  FakeGatoStorage: FakeGatoStorage
}

/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class FakeGatoTimer {
  constructor (params) {
    if (!params) {
      params = {}
    }
    this.subscribedServices = []
    this.minutes = params.minutes || 10
    this.intervalID = null
    this.running = false
    this.log = params.log || {}
    if (!this.log.debug) {
      this.log.debug = console.log
    }
  }

  subscribe (service, callback) {
    this.log.debug('** Fakegato-timer Subscription :', service.accessoryName)
    const newService = {
      service,
      callback,
      backLog: [],
      previousBackLog: [],
      previousAvrg: {}
    }
    this.subscribedServices.push(newService)
  }

  getSubscriber (service) {
    const findServ = function (element) {
      return element.service === service
    }
    return this.subscribedServices.find(findServ)
  }

  _getSubscriberIndex (service) {
    const findServ = function (element) {
      return element.service === service
    }
    return this.subscribedServices.findIndex(findServ)
  }

  getSubscribers () {
    return this.subscribedServices
  }

  unsubscribe (service) {
    const index = this._getSubscriberIndex(service)
    this.subscribedServices.splice(index, 1)
    if (this.subscribedServices.length === 0 && this.running) {
      this.stop()
    }
  }

  start () {
    this.log.debug('**Start Global Fakegato-Timer - ' + this.minutes + 'min**')
    if (this.running) { this.stop() }
    this.running = true
    this.intervalID = setInterval(
      () => this.executeCallbacks,
      this.minutes * 60 * 1000
    )
  }

  stop () {
    this.log.debug('**Stop Global Fakegato-Timer**')
    clearInterval(this.intervalID)
    this.running = false
    this.intervalID = null
  }

  executeCallbacks () {
    this.log.debug('**Fakegato-timer: executeCallbacks**')
    if (this.subscribedServices.length !== 0) {
      for (const s in this.subscribedServices) {
        if (Object.prototype.hasOwnProperty.call(this.subscribedServices, s)) {
          const service = this.subscribedServices[s]
          if (typeof (service.callback) === 'function') {
            service.previousAvrg = service.callback({
              backLog: service.backLog,
              previousAvrg: service.previousAvrg,
              timer: this,
              immediate: false
            })
          }
        }
      }
    }
  }

  executeImmediateCallback (service) {
    this.log.debug('**Fakegato-timer: executeImmediateCallback**')
    if (typeof (service.callback) === 'function' && service.backLog.length) {
      service.callback({
        backLog: service.backLog,
        timer: this,
        immediate: true
      })
    }
  }

  addData (params) {
    const data = params.entry
    const service = params.service
    const immediateCallback = params.immediateCallback || false
    this.log.debug('**Fakegato-timer: addData ', service.accessoryName, data, ' immediate: ', immediateCallback)
    if (immediateCallback) {
      this.getSubscriber(service).backLog[0] = data
    } else {
      this.getSubscriber(service).backLog.push(data)
    }
    if (immediateCallback) {
      this.executeImmediateCallback(this.getSubscriber(service))
    }
    if (this.running === false) {
      this.start()
    }
  }

  emptyData (service) {
    this.log.debug('**Fakegato-timer: emptyData **', service.accessoryName)
    const source = this.getSubscriber(service)
    if (source.backLog.length) {
      source.previousBackLog = source.backLog
    }
    source.backLog = []
  }
}

/* jshint node: true,esversion: 9, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

class FakeGatoTimer {
  constructor (params) {
    if (!params) {
      params = {}
    }
    this.subscribedServices = []
    this.minutes = params.minutes || 10
    this.intervalID = null
    this.running = false
    this.log = params.log || {}
    if (!this.log) {
      this.log = () => {}
    }
  }

  subscribe (service, callback) {
    this.log('[%s] FG timer: new subscription.', service.accessoryName)
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
    return this.subscribedServices.find(el => el.service === service)
  }

  _getSubscriberIndex (service) {
    return this.subscribedServices.findIndex(el => el.service === service)
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
    this.log('Starting global FG timer [%s minutes].', this.minutes)
    if (this.running) {
      this.stop()
    }
    this.running = true
    this.intervalID = setInterval(this.executeCallbacks.bind(this), this.minutes * 60 * 1000)
  }

  stop () {
    this.log('Stopping global FG timer.')
    clearInterval(this.intervalID)
    this.running = false
    this.intervalID = null
  }

  executeCallbacks () {
    this.log('FG timer: executeCallbacks().')
    if (this.subscribedServices.length !== 0) {
      for (const s in this.subscribedServices) {
        if (Object.prototype.hasOwnProperty.call(this.subscribedServices, s)) {
          const service = this.subscribedServices[s]
          if (typeof service.callback === 'function') {
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
    this.log('FG timer: executeImmediateCallback().')
    if (typeof service.callback === 'function' && service.backLog.length) {
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
    this.log(
      '[%s] FG timer: addData() [%s] immediate [%s].',
      service.accessoryName,
      data,
      immediateCallback
    )
    if (immediateCallback) {
      this.getSubscriber(service).backLog[0] = data
    } else {
      this.getSubscriber(service).backLog.push(data)
    }
    if (immediateCallback) {
      this.executeImmediateCallback(this.getSubscriber(service))
    }
    if (!this.running) {
      this.start()
    }
  }

  emptyData (service) {
    this.log('[%s] FG timer: emptyData().', service.accessoryName)
    const source = this.getSubscriber(service)
    if (source.backLog.length) {
      source.previousBackLog = source.backLog
    }
    source.backLog = []
  }
}

module.exports = { FakeGatoTimer }

/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class deviceSwitch {
  constructor (platform, accessory) {
    // Create variables usable by the class
    this.httpClient = platform.httpClient
    this.debug = platform.config.debug
    this.log = platform.log
    this.messages = platform.messages
    this.funcs = platform.funcs
    this.disableDeviceLogging = platform.config.disableDeviceLogging

    // Create these variables for easy access later
    this.accessory = accessory
    this.name = accessory.displayName
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic

    // If the accessory has an lightbulb service, then remove it
    if (this.accessory.getService(this.hapServ.Lightbulb)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Lightbulb))
    }

    // Add the switch service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Switch) ||
      this.accessory.addService(this.hapServ.Switch)

    // Add the set handler to the switch on/off characteristic
    this.service.getCharacteristic(this.hapChar.On)
      .on('set', this.internalOnOffUpdate.bind(this))
  }

  async internalOnOffUpdate (value, callback) {
    try {
      callback()
      const onoff = value ? 'on' : 'off'
      if (onoff === this.cacheOnOff) {
        return
      }
      if (!this.accessory.context.supportedCmds.includes('turn')) {
        const eText = this.accessory.context.gvModel + this.messages.notSuppTurn
        throw new Error(eText)
      }
      if (!this.accessory.context.controllable) {
        throw new Error(this.messages.devNotControl)
      }
      const timerKey = Math.random().toString(36).substr(2, 8)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(this.name, this.accessory.context, {
        name: 'turn',
        value: onoff
      })
      this.cacheOnOff = onoff
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.messages.curState, this.cacheOnOff)
      }
    } catch (err) {
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', this.name, this.messages.devNotUpdated, eText)
    }
  }

  externalUpdate (newParams) {
    if (this.debug && this.firstUpdateDone) {
      const params = JSON.stringify(newParams)
      this.log('[%s] %s [%s].', this.name, this.messages.receivingUpdate, params)
      if (this.updateTimeout) {
        this.log('[%s] %s.', this.name, this.messages.ignoringUpdate)
      }
    }
    if (this.updateTimeout) {
      return
    }
    if (newParams.powerState && newParams.powerState !== this.cacheOnOff) {
      this.service.updateCharacteristic(this.hapChar.On, newParams.powerState === 'on')
      this.cacheOnOff = newParams.powerState
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.messages.curState, newParams.powerState)
      }
    }
    this.firstUpdateDone = true
  }
}

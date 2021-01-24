/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = class deviceSwitch {
  constructor (platform, accessory) {
    this.helpers = platform.helpers
    this.httpClient = platform.httpClient
    this.debug = platform.debug
    this.log = platform.log
    this.disableDeviceLogging = platform.config.disableDeviceLogging
    this.S = platform.api.hap.Service
    this.C = platform.api.hap.Characteristic
    this.dName = accessory.displayName
    this.accessory = accessory

    if (this.accessory.getService(this.S.Lightbulb)) {
      this.accessory.removeService(this.accessory.getService(this.S.Lightbulb))
    }
    this.service = this.accessory.getService(this.S.Switch) || this.accessory.addService(this.S.Switch)
    this.service.getCharacteristic(this.C.On)
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
        throw new Error('model [' + this.accessory.context.gvModel + '] does not support command [turn]')
      }
      if (!this.accessory.context.controllable) {
        throw new Error('device cannot currently be controlled')
      }
      const timerKey = Math.random().toString(36).substr(2, 8)
      this.updateTimeout = timerKey
      setTimeout(() => {
        if (this.updateTimeout === timerKey) {
          this.updateTimeout = false
        }
      }, 120000)
      await this.httpClient.updateDevice(
        this.dName,
        this.accessory.context,
        {
          name: 'turn',
          value: onoff
        }
      )
      this.cacheOnOff = onoff
      if (!this.disableDeviceLogging) {
        this.log('[%s] current state [%s].', this.dName, onoff)
      }
    } catch (err) {
      this.log.warn('[%s] could not be updated and its status will revert soon - %s.', this.dName, err.message)
    }
  }

  externalUpdate (newParams) {
    if (this.debug && this.firstUpdateDone) {
      this.log('[%s] received update [%s].', this.dName, JSON.stringify(newParams))
      if (this.updateTimeout) {
        this.log('[%s] ignoring above update as recently controlled.', this.dName)
      }
    }
    if (this.updateTimeout) {
      return
    }

    // *** ON/OFF *** \\
    if (newParams.powerState && newParams.powerState !== this.cacheOnOff) {
      this.service.updateCharacteristic(this.C.On, newParams.powerState === 'on')
      this.cacheOnOff = newParams.powerState
      if (this.firstUpdateDone && !this.disableDeviceLogging) {
        this.log('[%s] current state [%s].', this.dName, newParams.powerState)
      }
    }
    // ************** \\

    this.firstUpdateDone = true
  }
}

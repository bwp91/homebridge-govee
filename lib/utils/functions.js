/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class pluginFuncs {
  constructor (log, consts) {
    this.log = log
    this.consts = consts
    this.messages = consts.messages
  }

  hasProperty (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  parseApiKey (input) {
    if (input === '') {
      throw new Error(this.messages.apiKeyMissing)
    }
    return input.toString().toLowerCase().replace(/[^a-z0-9-]+/g, '')
  }

  parseBool (key, val) {
    if (val === 'false') {
      this.log.warn('%s [%s] %s.', this.messages.cfgItem, key, this.messages.cfgFalse)
      return false
    }
    return !!val
  }

  parseError (input) {
    let toShow = input.message
    if (input.stack && input.stack.length > 0) {
      const stack = input.stack.split('\n')
      if (stack[1]) {
        toShow += stack[1].replace('   ', '')
      }
    }
    this.log.warn(toShow)
  }

  parseNumber (key, input) {
    input = parseInt(input)
    if (isNaN(input)) {
      return this.consts.defaultValues[key]
    }
    const min = this.consts.minValues[key]
    if (input >= min) {
      return input
    }
    this.log.warn('%s [%s] %s %s.', this.messages.cfgItem, key, this.messages.cfgLow, min)
    return min
  }

  parseSerialNumber (input) {
    return input.toString().toUpperCase().replace(/[\s'"]+/g, '')
  }
}

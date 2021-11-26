/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  hasProperty: (obj, prop) => {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  },

  sleep: ms => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  isGoveeError: err => {
    return err.message.includes('502') || err.message.includes('timeout')
  },

  parseDeviceId: deviceId => {
    return deviceId
      .toString()
      .toUpperCase()
      .replace(/[^A-F0-9:]+/g, '')
  },

  parseError: (err, hideStack = []) => {
    let toReturn = err.message
    if (err.stack && err.stack.length > 0 && !hideStack.includes(err.message)) {
      const stack = err.stack.split('\n')
      if (stack[1]) {
        toReturn += stack[1].replace('   ', '')
      }
    }
    return toReturn
  },

  generateRandomString: length => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let nonce = ''
    while (nonce.length < length) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return nonce
  }
}

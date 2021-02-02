/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  hasProperty: (obj, prop) => {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  },

  sleep: ms => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  parseError: err => {
    let toShow = err.message
    if (err.stack && err.stack.length > 0) {
      const stack = err.stack.split('\n')
      if (stack[1]) {
        toShow += stack[1].replace('   ', '')
      }
    }
    this.log.warn(toShow)
  }
}

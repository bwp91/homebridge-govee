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
  parseApiKey: input => {
    return input.toString().toLowerCase().replace(/[^a-z0-9-]+/g, '')
  },
  parseError: input => {
    let toReturn = input.message
    if (input.stack && input.stack.length > 0) {
      const stack = input.stack.split('\n')
      if (stack[1]) {
        toReturn += stack[1].replace('   ', '')
      }
    }

    return toReturn
  },
  parseNumber: (input, defaultValue, minValue) => {
    const inputToInt = parseInt(input)
    return isNaN(inputToInt) || inputToInt < minValue
      ? defaultValue
      : inputToInt
  },
  parseSerialNumber: input => {
    return input.toString().toUpperCase().replace(/[\s'"]+/g, '')
  }
}

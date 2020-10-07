'use strict'
module.exports = {
  sleep: ms => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },
  hasProperty: (obj, prop) => {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

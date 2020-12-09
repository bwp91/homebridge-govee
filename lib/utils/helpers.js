/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'
module.exports = {
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  hasProperty: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
  defaults: {
    refreshTime: 15
  },
  modelsLED: [
    'H6160', 'H6163', 'H6104', 'H6109',
    'H6110', 'H6117', 'H6159', 'H7021',
    'H7022', 'H6086', 'H6089', 'H6182',
    'H6085', 'H7014', 'H5081', 'H6188',
    'H6135', 'H6137', 'H6141', 'H6142',
    'H6195', 'H6196', 'H7005', 'H6083',
    'H6002', 'H6003', 'H6148'
  ],
  modelsNoScaleBrightness: [
    'H6089', 'H6104', 'H6110', 'H6117',
    'H6141', 'H6159', 'H6160', 'H6163',
    'H6182'
  ],
  hs2rgb: hs => {
    const h = hs[0] / 360
    const s = hs[1] / 100
    const l = 0.5
    let t3
    let val
    if (s === 0) {
      val = l * 255
      return [Math.round(val), Math.round(val), Math.round(val)]
    }
    const t2 = l + s - l * s
    const t1 = 2 * l - t2
    const rgb = [0, 0, 0]
    for (let i = 0; i < 3; i++) {
      t3 = h + 1 / 3 * -(i - 1)
      if (t3 < 0) t3++
      if (t3 > 1) t3--
      if (6 * t3 < 1) {
        val = t1 + (t2 - t1) * 6 * t3
      } else if (2 * t3 < 1) {
        val = t2
      } else if (3 * t3 < 2) {
        val = t1 + (t2 - t1) * (2 / 3 - t3) * 6
      } else {
        val = t1
      }
      rgb[i] = Math.round(val * 255)
    }
    return rgb
  },
  rgb2hs: rgb => {
    const r = rgb[0] / 255
    const g = rgb[1] / 255
    const b = rgb[2] / 255
    const min = Math.min(r, g, b)
    const max = Math.max(r, g, b)
    const delta = max - min
    let h = 0
    let s = 0
    if (max === min) {
      h = 0
    } else if (r === max) {
      h = (g - b) / delta
    } else if (g === max) {
      h = 2 + (b - r) / delta
    } else if (b === max) {
      h = 4 + (r - g) / delta
    }
    h = Math.min(h * 60, 360)
    if (h < 0) h += 360
    const l = (min + max) / 2
    if (max === min) {
      s = 0
    } else if (l <= 0.5) {
      s = delta / (max + min)
    } else {
      s = delta / (2 - max - min)
    }
    return [Math.round(h), Math.round(s * 100)]
  }
}

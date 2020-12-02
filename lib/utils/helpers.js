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
  hsv2rgb: hsv => {
    /*
    Credit: https://github.com/Qix-/color-convert
    */
    const h = hsv[0] / 60
    const s = hsv[1] / 100
    let v = hsv[2] / 100
    const hi = Math.floor(h) % 6
    const f = h - Math.floor(h)
    const p = 255 * v * (1 - s)
    const q = 255 * v * (1 - (s * f))
    const t = 255 * v * (1 - (s * (1 - f)))
    v *= 255
    switch (hi) {
      case 0:
        return [v, t, p]
      case 1:
        return [q, v, p]
      case 2:
        return [p, v, t]
      case 3:
        return [p, q, v]
      case 4:
        return [t, p, v]
      case 5:
        return [v, p, q]
    }
  },
  rgb2hsv: rgb => {
    /*
    Credit: https://github.com/Qix-/color-convert
    */
    let rdif
    let gdif
    let bdif
    let h
    let s
    const r = rgb[0] / 255
    const g = rgb[1] / 255
    const b = rgb[2] / 255
    const v = Math.max(r, g, b)
    const diff = v - Math.min(r, g, b)
    const diffc = function (c) {
      return (v - c) / 6 / diff + 1 / 2
    }
    if (diff === 0) {
      h = 0
      s = 0
    } else {
      s = diff / v
      rdif = diffc(r)
      gdif = diffc(g)
      bdif = diffc(b)
      if (r === v) {
        h = bdif - gdif
      } else if (g === v) {
        h = (1 / 3) + rdif - bdif
      } else if (b === v) {
        h = (2 / 3) + gdif - rdif
      }
      if (h < 0) {
        h += 1
      } else if (h > 1) {
        h -= 1
      }
    }
    return [h * 360, s * 100, v * 100]
  },
}

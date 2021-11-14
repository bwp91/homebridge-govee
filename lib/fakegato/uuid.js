/* jshint node: true, esversion: 10, -W014, -W033 */
/* eslint-disable new-cap */
'use strict'

// https://github.com/homebridge/HAP-NodeJS/blob/master/src/lib/util/uuid.ts

function isValid (UUID) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(UUID)
}

function toLongFormUUID (uuid, base = '-0000-1000-8000-0026BB765291') {
  const shortRegex = /^[0-9a-f]{1,8}$/i
  if (isValid(uuid)) {
    return uuid.toUpperCase()
  }
  if (!shortRegex.test(uuid)) {
    throw new TypeError('uuid was not a valid UUID or short form UUID')
  }
  if (!isValid('00000000' + base)) {
    throw new TypeError('base was not a valid base UUID')
  }
  return (('00000000' + uuid).substr(-8) + base).toUpperCase()
}

function toShortFormUUID (uuid, base = '-0000-1000-8000-0026BB765291') {
  uuid = toLongFormUUID(uuid, base)
  return uuid.substr(0, 8)
}

exports.isValid = isValid
exports.toLongFormUUID = toLongFormUUID
exports.toShortFormUUID = toShortFormUUID

/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

// https://github.com/homebridge/HAP-NodeJS/blob/master/src/lib/util/uuid.ts

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_SHORT_REGEX = /^[0-9a-f]{1,8}$/i

function isValid (UUID) {
  return VALID_UUID_REGEX.test(UUID)
}

function toLongFormUUID (uuid, base = '-0000-1000-8000-0026BB765291') {
  if (isValid(uuid)) {
    return uuid.toUpperCase()
  }
  if (!VALID_SHORT_REGEX.test(uuid)) {
    throw new TypeError('uuid was not a valid UUID or short form UUID')
  }
  if (!isValid('00000000' + base)) {
    throw new TypeError('base was not a valid base UUID')
  }
  return (('00000000' + uuid).substr(-8) + base).toUpperCase()
}

function toShortFormUUID (uuid, base = '-0000-1000-8000-0026BB765291') {
  uuid = toLongFormUUID(uuid, base)
  return (uuid.substr(0, 8))
}

exports.isValid = isValid
exports.toLongFormUUID = toLongFormUUID
exports.toShortFormUUID = toShortFormUUID

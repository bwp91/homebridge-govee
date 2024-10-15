import { Buffer } from 'node:buffer'
import fs from 'node:fs'

import NodeRSA from 'node-rsa'
import pem from 'pem'

const base64ToHex = base64 => Buffer.from(base64, 'base64').toString('hex')

const hexToBase64 = hex => Buffer.from(hex, 'hex').toString('base64')

const cenToFar = temp => Math.round(((temp * 9) / 5 + 32) * 10) / 10

const farToCen = temp => Math.round(((temp - 32) * 5) / 9)

function generateCodeFromHexValues(hexValues, returnAsHexBuffer = false) {
  const cmdSection = Buffer.from(hexValues.flat())
  const padSection = Buffer.from(Array.from({ length: 19 - cmdSection.length }).fill(0))
  const noXSection = Buffer.concat([cmdSection, padSection])
  let checksum = 0
  Object.values(noXSection).forEach((i) => {
    checksum ^= i
  })
  const chkSection = Buffer.from([checksum])
  const finalBuffer = Buffer.concat([noXSection, chkSection])
  return returnAsHexBuffer
    ? finalBuffer
    : finalBuffer.toString('base64')
}

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  while (nonce.length < length) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return nonce
}

const getTwoItemPosition = (array, part) => array[part - 1]

const hasProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)

const hexToDecimal = hex => Number.parseInt(hex, 16)

const hexToTwoItems = hex => hex.match(/.{1,2}/g)

const nearestHalf = num => Math.round(num * 2) / 2

function parseDeviceId(deviceId) {
  return deviceId
    .toString()
    .toUpperCase()
    .replace(/[^A-F0-9_:]+/g, '')
}

function parseError(err, hideStack = []) {
  let toReturn = err.message
  if (err?.stack?.length > 0 && !hideStack.includes(err.message)) {
    const stack = err.stack.split('\n')
    if (stack[1]) {
      toReturn += stack[1].replace('   ', '')
    }
  }
  return toReturn
}

async function pfxToCertAndKey(pfxPath, p12Password) {
  return new Promise((resolve, reject) => {
    pem.readPkcs12(fs.readFileSync(pfxPath), { p12Password }, (err, cert) => {
      if (err) {
        reject(err)
      }
      try {
        const key = new NodeRSA(cert.key)
        resolve({
          cert: cert.cert,
          key: key.exportKey('pkcs8'),
        })
      } catch (error) {
        reject(error)
      }
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function statusToActionCode(statusCode) {
  const choppedCode = `33${statusCode.slice(2, -2)}`
  const choppedArray = hexToTwoItems(choppedCode)
  const hexValues = choppedArray.map(byte => `0x${byte}`)
  const generatedCode = generateCodeFromHexValues(hexValues)
  return Buffer.from(generatedCode, 'base64').toString('hex')
}

export {
  base64ToHex,
  cenToFar,
  farToCen,
  generateCodeFromHexValues,
  generateRandomString,
  getTwoItemPosition,
  hasProperty,
  hexToBase64,
  hexToDecimal,
  hexToTwoItems,
  nearestHalf,
  parseDeviceId,
  parseError,
  pfxToCertAndKey,
  sleep,
  statusToActionCode,
}

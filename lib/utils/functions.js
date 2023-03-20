import fs from 'fs';
import pem from '@bwp91/pem';
import NodeRSA from 'node-rsa';

const base64ToHex = (base64) => Buffer.from(base64, 'base64').toString('hex');

const hexToBase64 = (hex) => Buffer.from(hex, 'hex').toString('base64');

const cenToFar = (temp) => Math.round(((temp * 9) / 5 + 32) * 10) / 10;

const farToCen = (temp) => Math.round(((temp - 32) * 5) / 9);

const generateCodeFromHexValues = (hexValues, returnAsHexBuffer = false) => {
  const cmdSection = Buffer.from(hexValues.flat());
  const padSection = Buffer.from(new Array(19 - cmdSection.length).fill(0));
  const noXSection = Buffer.concat([cmdSection, padSection]);
  let checksum = 0;
  Object.values(noXSection).forEach((i) => {
    checksum ^= i; // eslint-disable-line no-bitwise
  });
  const chkSection = Buffer.from([checksum]);
  const finalBuffer = Buffer.concat([noXSection, chkSection]);
  return returnAsHexBuffer
    ? finalBuffer
    : finalBuffer.toString('base64');
};

const generateRandomString = (length) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  while (nonce.length < length) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
};

const getTwoItemPosition = (array, part) => array[part - 1];

const hasProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

const hexToDecimal = (hex) => parseInt(hex, 16);

const hexToTwoItems = (hex) => hex.match(/.{1,2}/g);

const nearestHalf = (num) => Math.round(num * 2) / 2;

const parseDeviceId = (deviceId) => deviceId
  .toString()
  .toUpperCase()
  .replace(/[^A-F0-9:]+/g, '');

const parseError = (err, hideStack = []) => {
  let toReturn = err.message;
  if (err?.stack?.length > 0 && !hideStack.includes(err.message)) {
    const stack = err.stack.split('\n');
    if (stack[1]) {
      toReturn += stack[1].replace('   ', '');
    }
  }
  return toReturn;
};

const pfxToCertAndKey = async (pfxPath, p12Password) => new Promise((resolve, reject) => {
  pem.readPkcs12(fs.readFileSync(pfxPath), { p12Password }, (err, cert) => {
    if (err) {
      reject(err);
    }
    try {
      const key = new NodeRSA(cert.key);
      resolve({
        cert: cert.cert,
        key: key.exportKey('pkcs8'),
      });
    } catch (error) {
      reject(error);
    }
  });
});

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const statusToActionCode = (statusCode) => {
  const choppedCode = `33${statusCode.slice(2, -2)}`;
  const choppedArray = hexToTwoItems(choppedCode);
  const hexValues = choppedArray.map((byte) => `0x${byte}`);
  const generatedCode = generateCodeFromHexValues(hexValues);
  return Buffer.from(generatedCode, 'base64').toString('hex');
};

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
};

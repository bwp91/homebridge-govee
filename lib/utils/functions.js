const base64ToHex = (base64) => Buffer.from(base64, 'base64').toString('hex');

const cenToFar = (temp) => Math.round(((temp * 9) / 5 + 32) * 10) / 10;

const farToCen = (temp) => Math.round(((temp - 32) * 5) / 9);

const generateCodeFromHexValues = (hexValues) => {
  const preChecksumFrame = Buffer.concat([Buffer.from(hexValues)]);
  const preChecksumPaddingFrame = Buffer.concat([
    preChecksumFrame,
    Buffer.from(new Array(19 - preChecksumFrame.length).fill(0)),
  ]);
  let checksum = 0;
  Object.values(preChecksumPaddingFrame).forEach((i) => {
    checksum ^= i; // eslint-disable-line no-bitwise
  });

  // eslint-disable-next-line no-bitwise
  const finalBuffer = Buffer.concat([preChecksumPaddingFrame, Buffer.from([checksum & 0xff])]);
  return finalBuffer.toString('base64');
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

const isGoveeError = (err) => err.message.includes('502') || err.message.includes('timeout');

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

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export {
  base64ToHex,
  cenToFar,
  farToCen,
  generateCodeFromHexValues,
  generateRandomString,
  getTwoItemPosition,
  hasProperty,
  hexToDecimal,
  hexToTwoItems,
  isGoveeError,
  nearestHalf,
  parseDeviceId,
  parseError,
  sleep,
};

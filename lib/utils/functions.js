const farToCen = (temp) => Math.round(((temp - 32) * 5) / 9);

const generateRandomString = (length) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  while (nonce.length < length) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
};

const hasProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

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
  farToCen,
  generateRandomString,
  hasProperty,
  isGoveeError,
  nearestHalf,
  parseDeviceId,
  parseError,
  sleep,
};

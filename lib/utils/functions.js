export default {
  hasProperty: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),

  sleep: (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  }),

  isGoveeError: (err) => err.message.includes('502') || err.message.includes('timeout'),

  parseDeviceId: (deviceId) => deviceId
    .toString()
    .toUpperCase()
    .replace(/[^A-F0-9:]+/g, ''),

  parseError: (err, hideStack = []) => {
    let toReturn = err.message;
    if (err?.stack.length > 0 && !hideStack.includes(err.message)) {
      const stack = err.stack.split('\n');
      if (stack[1]) {
        toReturn += stack[1].replace('   ', '');
      }
    }
    return toReturn;
  },

  generateRandomString: (length) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    while (nonce.length < length) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  },
};

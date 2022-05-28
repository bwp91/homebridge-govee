import platformLang from './lang-en.js';

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

const logDefault = (k, def) => {
  this.log.warn('%s [%s] %s %s.', platformLang.cfgItem, k, platformLang.cfgDef, def);
};

const logDuplicate = (k) => {
  this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgDup);
};

const logIgnore = (k) => {
  this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgIgn);
};

const logIgnoreItem = (k) => {
  this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgIgnItem);
};

const logIncrease = (k, min) => {
  this.log.warn('%s [%s] %s %s.', platformLang.cfgItem, k, platformLang.cfgLow, min);
};

const logQuotes = (k) => {
  this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgQts);
};

const logRemove = (k) => {
  this.log.warn('%s [%s] %s.', platformLang.cfgItem, k, platformLang.cfgRmv);
};

const parseDeviceId = (deviceId) => deviceId
  .toString()
  .toUpperCase()
  .replace(/[^A-F0-9:]+/g, '');

const parseError = (err, hideStack = []) => {
  let toReturn = err.message;
  if (err?.stack.length > 0 && !hideStack.includes(err.message)) {
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
  generateRandomString,
  hasProperty,
  isGoveeError,
  logDefault,
  logDuplicate,
  logIgnore,
  logIgnoreItem,
  logIncrease,
  logQuotes,
  logRemove,
  parseDeviceId,
  parseError,
  sleep,
};

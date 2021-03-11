'use strict';

var keys = require('@ndhoule/keys');
var uuid = require('uuid').v4;

var inMemoryStore = {
  _data: {},
  length: 0,
  setItem: function(key, value) {
    this._data[key] = value;
    this.length = keys(this._data).length;
    return value;
  },
  getItem: function(key) {
    if (key in this._data) {
      return this._data[key];
    }
    return null;
  },
  removeItem: function(key) {
    if (key in this._data) {
      delete this._data[key];
    }
    this.length = keys(this._data).length;
    return null;
  },
  clear: function() {
    this._data = {};
    this.length = 0;
  },
  key: function(index) {
    return keys(this._data)[index];
  }
};

var isSupportedNatively = (function() {
  try {
    if (!window.localStorage) return false;
    var key = uuid();
    window.localStorage.setItem(key, 'test_value');
    var value = window.localStorage.getItem(key);
    window.localStorage.removeItem(key);

    // handle localStorage silently failing
    return value === 'test_value';
  } catch (e) {
    // Can throw if localStorage is disabled
    return false;
  }
}());

function pickStorage() {
  if (isSupportedNatively) {
    return window.localStorage;
  }
  // fall back to in-memory
  return inMemoryStore;
}

var isReadSupportedNatively = (function() {
  try {
    if (!window.localStorage) return false;
    var key = window.localStorage.key(0);
    window.localStorage.getItem(key);

    // Ensure access of removeItem does not throw errors
    return typeof window.localStorage.removeItem === 'function';
  } catch (e) {
    // Can throw if localStorage is disabled
    return false;
  }
}());

function pickReclaimStorage() {
  if (isSupportedNatively || isReadSupportedNatively) {
    return window.localStorage;
  }
  // fall back to in-memory
  return inMemoryStore;
}

// Return a shared instance
module.exports.defaultEngine = pickStorage();
module.exports.reclaimEngine = pickReclaimStorage();
// Expose the in-memory store explicitly for testing
module.exports.inMemoryEngine = inMemoryStore;

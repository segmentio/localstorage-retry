'use strict';

var defaultEngine = require('./engine').default;
var inMemoryStore = require('./engine').inMemoryStore;
var each = require('@ndhoule/each');
var json = require('json3');

/**
* Store Implementation with dedicated
*/

function Store(name, id, keys, optionalEngine) {
  this.id = id;
  this.name = name;
  this.keys = keys;
  this.engine = optionalEngine || defaultEngine;
}

/**
* Set value by key.
*/

Store.prototype.set = function(key, value) {
  key = this.createValidKey(key);
  if (!key) return null;
  try {
    this.engine.setItem(key, json.stringify(value));
  } catch (err) {
    if (isQuotaExceeded(err)) {
      this.inMemoryFallBack();
    }
  }
};

/**
* Get by Key.
*/

Store.prototype.get = function(key) {
  key = this.createValidKey(key);
  if (!key) return null;
  try {
    var str = this.engine.getItem(key);
    if (str === null) {
      return null;
    }
    return json.parse(str);
  } catch (err) {
    return null;
  }
};

/**
* Remove by Key.
*/

Store.prototype.remove = function(key) {
  key = this.createValidKey(key);
  if (!key) return null;
  localStorage.removeItem(key);
};

/**
* Ensure the key is valid
*/

Store.prototype.createValidKey = function(key) {
  var compoundKey;
  var name = this.name;
  var id = this.id;
  each(function(value) {
    if (value === key) {
      compoundKey = [name, id, key].join('.');
    }
  }, this.keys);
  return compoundKey;
};

/**
* Switch to inMemoryStore, bringing any existing data with.
*/

Store.prototype.inMemoryFallBack = function() {
  var self = this;

  each(function(key) {
    inMemoryStore.setItem([self.name, self.id, key].join('.'), self.get(key));
    self.remove(key);
  }, this.keys);

  this.engine = inMemoryStore;
};

module.exports = Store;

function isQuotaExceeded(e) {
  var quotaExceeded = false;
  if (e.code) {
    switch (e.code) {
    case 22:
      quotaExceeded = true;
      break;
    case 1014:
      // Firefox
      if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        quotaExceeded = true;
      }
      break;
    default:
      break;
    }
  } else if (e.number === -2147024882) {
    // Internet Explorer 8
    quotaExceeded = true;
  }
  return quotaExceeded;
}

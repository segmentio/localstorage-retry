'use strict';

var localStorage = require('./localStorage').localStorage;
var json = require('json3');

function StoreItem(key) {
  this.key = key;
}

StoreItem.prototype.get = function() {
  try {
    var str = localStorage.getItem(this.key);
    if (str === null) {
      return null;
    }
    return json.parse(str);
  } catch (err) {
    return null;
  }
};

StoreItem.prototype.set = function(value) {
  localStorage.setItem(this.key, json.stringify(value));
};

StoreItem.prototype.remove = function() {
  localStorage.removeItem(this.key);
};

function createStore(name, id) {
  return {
    name: name,
    id: id,
    ack: new StoreItem([ name, id, 'ack' ].join('.')),
    reclaimStart: new StoreItem([ name, id, 'reclaimStart' ].join('.')),
    reclaimEnd: new StoreItem([ name, id, 'reclaimEnd' ].join('.')),
    inProgress: new StoreItem([ name, id, 'inProgress' ].join('.')),
    queue: new StoreItem([ name, id, 'queue' ].join('.'))
  };
}

module.exports = createStore;
module.exports.StoreItem = StoreItem;

module.exports.getAll = function(name) {
  var res = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    var parts = k.split('.');
    if (parts.length !== 3) continue;
    if (parts[0] !== name) continue;
    if (parts[2] !== 'ack') continue;
    res.push(createStore(name, parts[1]));
  }
  return res;
};

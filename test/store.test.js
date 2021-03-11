'use strict';

var Store = require('../lib/store');
var engine = require('../lib/engine').defaultEngine;
var inMemoryEngine = require('../lib/engine').inMemoryEngine;
var assert = require('proclaim');
var each = require('@ndhoule/each');

describe('Store', function() {
  var store;
  var keys = {
    IN_PROGRESS: 'inProgress',
    QUEUE: 'queue',
    ACK: 'ack',
    RECLAIM_START: 'reclaimStart',
    RECLAIM_END: 'reclaimEnd'
  };

  beforeEach(function() {
    engine.clear();
    store = new Store('name', 'id', keys);
  });

  describe('.get', function() {
    it('should default to null', function() {
      each(function(k) {
        assert.strictEqual(store.get(k), null);
      }, keys);
    });

    it('should de-serialize json', function() {
      each(function(k) {
        engine.setItem('name.id.' + k, '["a","b",{}]');
        assert.deepEqual(store.get(k), [ 'a', 'b', {} ]);
      }, keys);
    });

    it('should return null if value is not valid json', function() {
      engine.setItem('name.id.queue', '[{]}');
      assert.strictEqual(store.get(keys.QUEUE), null);
    });
  });

  describe('.set', function() {
    it('should serialize json', function() {
      each(function(k) {
        store.set(k, ['a', 'b', {}]);
        assert.strictEqual(engine.getItem('name.id.' + k), '["a","b",{}]');
      }, keys);
    });
  });

  describe('.remove', function() {
    it('should remove the item', function() {
      each(function(k) {
        store.set(k, 'a');
        store.remove(k);
        assert.strictEqual(engine.getItem('name.id.' + k), null);
      }, keys);
    });
  });

  describe('._createValidKey', function() {
    it('should return compound if no keys specd', function() {
      store = new Store('name', 'id');
      assert.strictEqual(store._createValidKey('test'), 'name.id.test');
    });

    it('should return undefined if invalid key', function() {
      store = new Store('name', 'id', { nope: 'wrongKey' });
      assert.strictEqual(store._createValidKey('test'), undefined);
    });

    it('should return compound if valid key', function() {
      assert.strictEqual(store._createValidKey('queue'), 'name.id.queue');
    });
  });

  // Skip the "swap" tests when not applicable
  var xdescribe = window.localStorage ? describe : describe.skip;

  xdescribe('._swapEngine', function() {
    it('should switch the underlying storage mechanism', function() {
      assert.strictEqual(store.engine, engine);
      store._swapEngine();
      assert.strictEqual(store.engine, inMemoryEngine);
    });

    it('should not switch the reclaim storage mechanism', function() {
      assert.strictEqual(store.getReclaimEngine(), engine);
      store._swapEngine();
      assert.strictEqual(store.getReclaimEngine(), engine);
    });

    it('should swap upon quotaExceeded on set', function() {
      var lsProxy =  {
        length: window.localStorage.length,
        setItem: function(k, v) {
          return window.localStorage.setItem(k, v);
        },
        getItem: function(k) {
          return window.localStorage.getItem(k);
        },
        removeItem: function(k) {
          return window.localStorage.removeItem(k);
        },
        clear: function() {
          return window.localStorage.clear();
        },
        key: function(i) {
          return window.localStorage.key(i);
        }
      };

      store = new Store('name', 'id', keys, lsProxy);

      each(function(v) {
        store.set(v, 'stuff');
      }, keys);
      store.engine.setItem = function() {
        // eslint-disable-next-line no-throw-literal
        throw { code: 22, number: -2147024882 };
      };
      store.set(keys.QUEUE, 'other');
      assert.strictEqual(store.get(keys.QUEUE), 'other');
    });
  });
});

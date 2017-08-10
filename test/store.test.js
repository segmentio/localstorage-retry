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
    store = new Store('name', 'id', keys, engine);
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

  describe('._swapEngine', function() {
    it('should switch to the inMem upon quotaExceeded', function() {
      each(function(v) {
        store.set(v, 'stuff');
      }, keys);
      store.engine.setItem = function() {
        var err = new Error('Bruh.');
        err.code = 22;
        throw err;
      };
      assert.strictEqual(store.engine, engine);
      store.set(keys.QUEUE, 'other');
      assert.strictEqual(store.engine, inMemoryEngine);
      assert.strictEqual(store.get(keys.QUEUE), 'other');
    });
  });
});

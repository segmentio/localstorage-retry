'use strict';

var StoreItem = require('../lib/store').StoreItem;
var localStorage = require('../lib/localStorage').localStorage;
var assert = require('proclaim');

describe('StoreItem', function() {
  var item;

  beforeEach(function() {
    localStorage.clear();
    item = new StoreItem('key');
  });

  describe('.get', function() {
    it('should default to null', function() {
      assert.strictEqual(item.get(), null);
    });

    it('should de-serialize json', function() {
      localStorage.setItem('key', '["a","b",{}]');
      assert.deepEqual(item.get(), [ 'a', 'b', {} ]);
    });

    it('should return null if value is not valid json', function() {
      localStorage.setItem('key', '[{]}');
      assert.strictEqual(item.get(), null);
    });
  });

  describe('.set', function() {
    it('should serialize json', function() {
      item.set(['a', 'b', {}]);
      assert.strictEqual(localStorage.getItem('key'), '["a","b",{}]');
    });
  });

  describe('.remove', function() {
    it('should remove the item', function() {
      localStorage.setItem('key', '"a"');
      item.remove();
      assert.strictEqual(localStorage.getItem('key'), null);
    });
  });
});

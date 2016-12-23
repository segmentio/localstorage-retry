'use strict';

var storage = require('../lib/localStorage');
var assert = require('proclaim');

// Skip the "supported" tests when its not actually supported
var xdescribe = window.localStorage ? describe : describe.skip;

describe('localStorage', function() {
  var localStorage;

  xdescribe('when supported', function() {
    beforeEach(function() {
      localStorage = storage.localStorage;
      localStorage.clear();
    });

    it('should function', function() {
      localStorage.setItem('test-key', 'abc');
      assert.strictEqual(localStorage.getItem('test-key'), 'abc');
      assert.strictEqual(localStorage.length, 1);
      assert.strictEqual(localStorage.key(0), 'test-key');

      localStorage.removeItem('test-key');
      assert.strictEqual(localStorage.getItem('test-key'), null);
      assert.strictEqual(localStorage.length, 0);

      localStorage.setItem('test-key', 'abc');
      localStorage.clear();
      assert.strictEqual(localStorage.length, 0);
    });
  });

  describe('when not supported', function() {
    beforeEach(function() {
      localStorage = storage.inMemoryStore;
      localStorage.clear();
    });

    it('should function', function() {
      localStorage.setItem('test-key', 'abc');
      assert.strictEqual(localStorage.getItem('test-key'), 'abc');
      assert.strictEqual(localStorage.length, 1);
      assert.strictEqual(localStorage.key(0), 'test-key');

      localStorage.removeItem('test-key');
      assert.strictEqual(localStorage.getItem('test-key'), null);
      assert.strictEqual(localStorage.length, 0);

      localStorage.setItem('test-key', 'abc');
      localStorage.clear();
      assert.strictEqual(localStorage.length, 0);
    });
  });
});

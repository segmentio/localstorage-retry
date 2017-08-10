'use strict';

var defaultEngine = require('../lib/engine').default;
var inMemoryStore = require('../lib/engine').inMemoryStore;
var assert = require('proclaim');

// Skip the "supported" tests when its not actually supported
var xdescribe = window.localStorage ? describe : describe.skip;

describe('localStorage', function() {
  var engine;

  xdescribe('when supported', function() {
    beforeEach(function() {
      engine = defaultEngine;
      engine.clear();
    });

    it('should function', function() {
      engine.setItem('test-key', 'abc');
      assert.strictEqual(engine.getItem('test-key'), 'abc');
      assert.strictEqual(engine.length, 1);
      assert.strictEqual(engine.key(0), 'test-key');

      engine.removeItem('test-key');
      assert.strictEqual(engine.getItem('test-key'), null);
      assert.strictEqual(engine.length, 0);

      engine.setItem('test-key', 'abc');
      engine.clear();
      assert.strictEqual(engine.length, 0);
    });
  });

  describe('when not supported', function() {
    beforeEach(function() {
      engine = inMemoryStore;
      engine.clear();
    });

    it('should function', function() {
      engine.setItem('test-key', 'abc');
      assert.strictEqual(engine.getItem('test-key'), 'abc');
      assert.strictEqual(engine.length, 1);
      assert.strictEqual(engine.key(0), 'test-key');

      engine.removeItem('test-key');
      assert.strictEqual(engine.getItem('test-key'), null);
      assert.strictEqual(engine.length, 0);

      engine.setItem('test-key', 'abc');
      engine.clear();
      assert.strictEqual(engine.length, 0);
    });
  });
});

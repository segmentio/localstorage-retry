'use strict';

var assert = require('proclaim');
var lolex = require('lolex');

var Queue = require('..');
var Schedule = require('../lib/schedule');

describe('Queue Lifecycle', function() {
  it('should not reattempt to publish an expired item', function() {
    var attempts = 8;
    var options = { maxAttempts: attempts };

    openTab(options, function(tab) {
      tab.queue.addItem('test item');
      tab.queue.start();

      assert(tab.queue.wait(attempts) !== -1);
      assert(tab.queue.wait(1) === -1);

      assert(tab.forkAndConsume(1) === -1);
    });
  });

  it('should respect attempts when reclaiming a queue', function() {
    var options = { maxAttempts: 10 };

    openTab(options, function(tab) {
      tab.queue.addItem('test');
      tab.queue.start();

      assert(tab.forkAndConsume(3) !== -1);
      assert(tab.forkAndConsume(4) !== -1);
      assert(tab.forkAndConsume(3) !== -1);

      // Now check that no attempts are made in a new tab
      assert(tab.forkAndConsume(1) === -1);
    });
  });

  it('should increment in-progress items attempts when reclaiming a queue', function() {
    var options = { maxAttempts: 6 };

    openTab(options, function(tab) {
      tab.queue.addItem('test');
      tab.queue.start();

      assert(tab.forkAndConsume(3) !== -1);

      // Make this attempt timeout by not calling the done callback
      // This will put the item in the inProgress queue
      tab.queue.ignore = true;
      assert(tab.queue.wait(1) !== -1);
      tab.queue.ignore = false;

      // Check that we only consume the two remaining attempts
      assert(tab.forkAndConsume(2) !== -1);
      assert(tab.forkAndConsume(1) === -1);
    });
  });
});

// Utilities

function createTestQueue(tab, options) {
  var waiting = 0;
  var queue = new Queue('segment::multi_queue_test', options, function(item, done) {
    waiting--;
    queue.calls++;

    if (!queue.ignore) {
      done(new Error(item));
    }
  });

  queue.calls = 0;
  queue.wait = function(condition) {
    waiting = condition;

    return tab.wait(function() {
      return waiting === 0;
    });
  };

  queue.waitFirstAttempt = function() {
    return queue.wait(1);
  };

  return queue;
}

var ONE_SECOND = 1000;
var ONE_MINUTE = 60 * ONE_SECOND;
var ONE_HOUR = 60 * ONE_MINUTE;

// Mocks a browser tab with its own clock
function openTab(options, fn) {
  var tab = {
    clock: lolex.createClock(),

    // Waits for a condition to be true by immediatly executing all timers
    wait: function(condition) {
      var clock = tab.clock;
      var start = clock.now;
      var timeout = 3 * ONE_HOUR;

      while (!condition()) {
        if (clock.now - start > timeout || !clock.timers) {
          return -1;
        }

        clock.next();
      }

      return clock.now - start;
    },

    // Simulates a event-loop freeze, like a browser would do with a background tab
    freeze: function() {
      tab.clock.reset();
      tab.clock.setTimeout = tab.clock.clearTimeout = function noop() {};
    },

    // Opens a new tab and waits for $attempts to be made, returns -1 otherwise
    forkAndConsume: function(attempts) {
      // Freeze the current tab so the next tab can reclaim the queue
      tab.freeze();

      return openTab(options, function(newTab) {
        tab.queue = newTab.queue;
        tab = newTab;
        tab.queue.start();

        return tab.queue.wait(attempts);
      });
    }
  };

  tab.queue = createTestQueue(tab, options);
  Schedule.setClock(tab.clock);

  return fn(tab);
}

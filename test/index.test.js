'use strict';

var Queue = require('../');
var store = require('../lib/store');
var localStorage = require('../lib/localStorage').localStorage;
var sinon = require('sinon');
var lolex = require('lolex');
var assert = require('proclaim');
var Schedule = require('../lib/schedule');

describe('Queue', function() {
  var queue;
  var clock;

  beforeEach(function() {
    localStorage.clear();
    clock = lolex.createClock(0);
    Schedule.setClock(clock);

    // Have the default function be a spied success
    queue = new Queue('test', sinon.spy(function(_, cb) {
      return cb();
    }));
  });

  afterEach(function() {
    queue.stop();
    Schedule.resetClock();
  });

  it('should run a task', function() {
    queue.start();

    queue.addItem('a');

    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('a'));
  });

  it('should retry a task if it fails', function() {
    queue.start();

    // Fail the first time
    queue.fn = sinon.spy(function(_, cb) {
      return cb(new Error('no'));
    });
    queue.addItem('a');
    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('a'));

    // Succeed the second time
    queue.fn = sinon.spy(function(_, cb) {
      return cb();
    });

    // Delay for the first retry
    clock.tick(queue.getDelay(1));
    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('a'));
  });

  it('should delay retries', function() {
    queue.start();

    queue.requeue('b', 1);
    queue.addItem('a');

    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('a'));

    queue.fn.reset();

    // delay for the retry
    clock.tick(queue.getDelay(1));

    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('b'));
  });

  it('should respect shouldRetry', function() {
    queue.shouldRetry = function(_, attemptNumber) {
      if (attemptNumber > 2) return false;
      return true;
    };
    // Fail
    queue.fn = sinon.spy(function(_, cb) {
      return cb(new Error('no'));
    });
    queue.start();

    // over maxattempts
    queue.requeue('a', 3);
    clock.tick(queue.getDelay(3));
    assert(queue.fn.notCalled);

    queue.fn.reset();

    queue.requeue('a', 2);
    clock.tick(queue.getDelay(2));
    assert(queue.fn.calledOnce);

    // logic based on item state (eg. could be msg timestamp field)
    queue.shouldRetry = function(item) {
      if (item.shouldRetry === false) return false;
      return true;
    };

    queue.fn.reset();
    queue.requeue({ shouldRetry: false }, 1);
    clock.tick(queue.getDelay(1));
    assert(queue.fn.notCalled);
  });

  it('should take over a queued task if a queue is abandoned', function() {
    // set up a fake queue
    var fakeQueue = store('test', 'fake-id');
    fakeQueue.ack.set(0); // fake timers starts at time 0
    fakeQueue.queue.set([{
      item: 'a',
      time: 0,
      attemptNumber: 0
    }]);

    // wait for the queue to expire
    clock.tick(queue.timeouts.RECLAIM_TIMEOUT);

    queue.start();

    // wait long enough for the other queue to expire and be reclaimed
    clock.tick(
      queue.timeouts.RECLAIM_TIMER
      + queue.timeouts.RECLAIM_WAIT * 2
    );

    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('a'));
  });

  it('should take over an in-progress task if a queue is abandoned', function() {
    // set up a fake queue
    var fakeQueue = store('test', 'fake-id');
    fakeQueue.ack.set(-15000);
    fakeQueue.inProgress.set({
      'task-id': {
        item: 'a',
        time: 0,
        attemptNumber: 0
      }
    });

    // wait for the queue to expire
    clock.tick(queue.timeouts.RECLAIM_TIMEOUT);

    queue.start();

    // wait long enough for the other queue to expire and be reclaimed
    clock.tick(
      queue.timeouts.RECLAIM_TIMER
      + queue.timeouts.RECLAIM_WAIT * 2
    );

    assert(queue.fn.calledOnce);
    assert(queue.fn.calledWith('a'));
  });

  it('should take over multiple tasks if a queue is abandoned', function() {
    // set up a fake queue
    var fakeQueue = store('test', 'fake-id');
    fakeQueue.ack.set(-15000);
    fakeQueue.queue.set([{
      item: 'a',
      time: 0,
      attemptNumber: 0
    }]);
    fakeQueue.inProgress.set({
      'task-id': {
        item: 'b',
        time: 1,
        attemptNumber: 0
      }
    });

    // wait for the queue to expire
    clock.tick(queue.timeouts.RECLAIM_TIMEOUT);

    queue.start();

    // wait long enough for the other queue to expire and be reclaimed
    clock.tick(
      queue.timeouts.RECLAIM_TIMER
      + queue.timeouts.RECLAIM_WAIT * 2
    );

    assert(queue.fn.calledTwice);
    assert(queue.fn.calledWith('a'));
    assert(queue.fn.calledWith('b'));
  });
});

describe('events', function() {
  var queue;
  beforeEach(function() {
    queue = new Queue('events', function(_, cb) {
      cb();
    });
  });

  afterEach(function() {
    queue.stop();
  });

  it('should emit item and res in success events', function(done) {
    queue.fn = function(item, cb) {
      cb(null, { text: 'ok' });
    };
    queue.on('success', function(item, res) {
      assert(item.a === 'b');
      assert(res.text === 'ok');
      done();
    });
    queue.start();
    queue.addItem({ a: 'b' });
  });

  it('should emit error events with item and error', function(done) {
    queue.fn = function(item, cb) {
      cb(new Error('fail'));
    };
    queue.on('error', function(item, error) {
      try {
        assert(item.a === 'c');
        assert(error.message === 'fail');
        done();
      } catch (e) {
        done(e);
      }
    });
    queue.start();
    queue.addItem({ a: 'c' });
  });

  it('should emit discard if the message fails shouldRetry', function(done) {
    queue.fn = function(item, cb) {
      cb(new Error('no'));
    };
    queue.shouldRetry = function(item, attemptNumber) {
      return attemptNumber < 2;
    };
    queue.on('discard', function(item, attempts) {
      assert(item.a === 'b');
      assert(attempts === 2);
      done();
    });
    queue.start();
    queue.addItem({ a: 'b' });
  });
});

describe('end-to-end', function() {
  var queue;
  beforeEach(function() {
    queue = new Queue('e2e_test', function(_, cb) { cb(); });
  });

  afterEach(function() {
    queue.stop();
  });

  it('should run end-to-end', function(done) {
    queue.fn = function(item, cb) {
      cb();
      done();
    };
    queue.start();
    queue.addItem({ a: 'b' });
  });

  it('should run end-to-end async', function(done) {
    queue.fn = function(item, cb) {
      setTimeout(function() {
        cb();
      }, 1000);
    };
    queue.on('success', function() {
      done();
    });

    queue.start();
    queue.addItem({ a: 'b' });
  });
});


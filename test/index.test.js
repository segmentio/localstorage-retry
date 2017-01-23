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
});

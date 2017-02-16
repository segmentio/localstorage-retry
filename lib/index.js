'use strict';

var uuid = require('uuid').v4;
var store = require('./store');
var each = require('@ndhoule/each');
var Schedule = require('./schedule');
var debug = require('debug')('localstorage-retry');
var Emitter = require('component-emitter');

// Some browsers don't support Function.prototype.bind, so just including a simplified version here
function bind(func, obj) {
  return function() {
    return func.apply(obj, arguments);
  };
}

/**
 * @callback processFunc
 * @param {Mixed} item The item added to the queue to process
 * @param {Function} done A function to call when processing is completed.
 *   @param {Error} Optional error parameter if the processing failed
 *   @param {Response} Optional response parameter to emit for async handling
 */

/**
 * Constructs a Queue backed by localStorage
 *
 * @constructor
 * @param {String} name The name of the queue. Will be used to find abandoned queues and retry their items
 * @param {processFunc} fn The function to call in order to process an item added to the queue
 */
function Queue(name, fn) {
  this.name = name;
  this.id = uuid();
  this.fn = fn;

  this.timeouts = {
    ACK_TIMER: 1000,
    RECLAIM_TIMER: 3000,
    RECLAIM_TIMEOUT: 10000,
    RECLAIM_WAIT: 500,
    MAX_QUEUE_DELAY: 30000
  };

  this._schedule = new Schedule();
  this._processId = 0;

  // Set up our empty queues
  this._store = store(this.name, this.id);
  this._store.inProgress.set({});
  this._store.queue.set([]);

  // bind recurring tasks for ease of use
  this._ack = bind(this._ack, this);
  this._checkReclaim = bind(this._checkReclaim, this);
  this._processHead = bind(this._processHead, this);

  this._running = false;
}

/**
 * Mix in event emitter
 */

Emitter(Queue.prototype);

/**
 * Starts processing the queue
 */
Queue.prototype.start = function() {
  if (this._running) {
    this.stop();
  }
  this._running = true;
  this._ack();
  this._checkReclaim();
  this._processHead();
};

/**
 * Stops processing the queue
 */
Queue.prototype.stop = function() {
  this._schedule.cancelAll();
  this._running = false;
};

/**
 * Decides whether to retry. Overridable.
 *
 * @param {Object} item The item being processed
 * @param {Number} attemptNumber The attemptNumber (1 for first retry)
 * @param {Error} error The error from previous attempt, if there was one
 * @return {Boolean} Whether to requeue the message
 */
Queue.prototype.shouldRetry = function() {
  return true;
};

/**
 * Calculates the delay (in ms) for a retry attempt
 *
 * @param {Number} attemptNumber The attemptNumber (1 for first retry)
 * @return {Number} The delay in milliseconds to wait before attempting a retry
 */
Queue.prototype.getDelay = function(attemptNumber) {
  return 1000 * Math.pow(attemptNumber, 2);
};

/**
 * Adds an item to the queue
 *
 * @param {Mixed} item The item to process
 */
Queue.prototype.addItem = function(item) {
  this._enqueue({
    item: item,
    attemptNumber: 0,
    time: this._schedule.now()
  });
};

/**
 * Adds an item to the retry queue
 *
 * @param {Mixed} item The item to retry
 * @param {Number} attemptNumber The attempt number (1 for first retry)
 * @param {Error} [error] The error from previous attempt, if there was one
 */
Queue.prototype.requeue = function(item, attemptNumber, error) {
  var delay = Math.min(this.getDelay(attemptNumber), this.timeouts.MAX_QUEUE_DELAY);
  if (this.shouldRetry(item, attemptNumber, error)) {
    this._enqueue({
      item: item,
      attemptNumber: attemptNumber,
      time: this._schedule.now() + delay
    });
  } else {
    this.emit('discard', item, attemptNumber);
  }
};

Queue.prototype._enqueue = function(entry) {
  var queue = this._store.queue.get();
  queue.push(entry);
  queue = queue.sort(function(a,b) {
    return a.time - b.time;
  });
  this._store.queue.set(queue);

  if (this._running) {
    this._processHead();
  }
};

Queue.prototype._processHead = function() {
  var self = this;
  var store = this._store;

  // cancel the scheduled task if it exists
  this._schedule.cancel(this._processId);

  // Pop the head off the queue
  var queue = store.queue.get();
  var inProgress = store.inProgress.get();
  var now = this._schedule.now();
  var toRun = [];

  while (queue.length && queue[0].time <= now) {
    var el = queue.shift();

    var id = uuid();

    // Save this to the in progress map
    inProgress[id] = {
      item: el.item,
      attemptNumber: el.attemptNumber,
      time: this._schedule.now()
    };

    toRun.push({
      item: el.item,
      done: function handle(err, res) {
        var inProgress = store.inProgress.get();
        delete inProgress[id];
        store.inProgress.set(inProgress);
        self.emit('processed', err, res, el.item);
        debug('processing AF', err, res, el.item);
        if (err) {
          self.requeue(el.item, el.attemptNumber + 1, err);
        }
      }
    });
  }
  store.queue.set(queue);
  store.inProgress.set(inProgress);

  each(function(el) {
    // TODO: handle fn timeout
    try {
      self.fn(el.item, el.done);
    } catch (err) {
      debug('Process function threw error: ' + err);
    }
  }, toRun);

  // re-read the queue in case the process function finished immediately or added another item
  queue = store.queue.get();
  this._schedule.cancel(this._processId);
  if (queue.length > 0) {
    this._processId = this._schedule.run(this._processHead, queue[0].time - now);
  }
};

// Ack continuously to prevent other tabs from claiming our queue
Queue.prototype._ack = function() {
  this._store.ack.set(this._schedule.now());
  this._store.reclaimStart.set(null);
  this._store.reclaimEnd.set(null);
  this._schedule.run(this._ack, this.timeouts.ACK_TIMER);
};

Queue.prototype._checkReclaim = function() {
  var self = this;

  function tryReclaim(store) {
    store.reclaimStart.set(self.id);
    store.ack.set(self._schedule.now());

    self._schedule.run(function() {
      if (store.reclaimStart.get() !== self.id) return;
      store.reclaimEnd.set(self.id);
      self._schedule.run(function() {
        if (store.reclaimEnd.get() !== self.id) return;
        if (store.reclaimStart.get() !== self.id) return;
        self._reclaim(store.id);
      }, self.timeouts.RECLAIM_WAIT);
    }, self.timeouts.RECLAIM_WAIT);
  }

  each(function(store) {
    if (store.id === self.id) return;
    if (self._schedule.now() - store.ack.get() < self.timeouts.RECLAIM_TIMEOUT) return;
    tryReclaim(store);
  }, store.getAll(this.name));

  this._schedule.run(this._checkReclaim, this.timeouts.RECLAIM_TIMER);
};

Queue.prototype._reclaim = function(id) {
  var self = this;
  var other = store(this.name, id);

  var our = {
    queue: this._store.queue.get() || []
  };
  var their = {
    inProgress: other.inProgress.get() || {},
    queue: other.queue.get() || []
  };

  // add their queue to ours, resetting run-time to immediate and attempt# to 0
  each(function(el) {
    our.queue.push({
      item: el.item,
      attemptNumber: 0,
      time: self._schedule.now()
    });
  }, their.queue);

  // if the queue is abandoned, all the in-progress are failed. retry them immediately and reset the attempt#
  each(function(el) {
    our.queue.push({
      item: el.item,
      attemptNumber: 0,
      time: self._schedule.now()
    });
  }, their.inProgress);

  our.queue = our.queue.sort(function(a,b) {
    return a.time - b.time;
  });

  this._store.queue.set(our.queue);

  // remove all keys
  other.ack.remove();
  other.reclaimStart.remove();
  other.reclaimEnd.remove();
  other.inProgress.remove();
  other.queue.remove();

  // process the new items we claimed
  this._processHead();
};

module.exports = Queue;

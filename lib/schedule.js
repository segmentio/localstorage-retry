'use strict';

var each = require('@ndhoule/each');

var CLOCK_LATE_FACTOR = 2;

var defaultClock = {
  setTimeout: function(fn, ms) {
    return window.setTimeout(fn, ms);
  },
  clearTimeout: function(id) {
    return window.clearTimeout(id);
  },
  Date: window.Date
};

var clock = defaultClock;

function Schedule() {
  this.tasks = {};
  this.nextId = 1;
}

Schedule.prototype.now = function() {
  return +new clock.Date();
};

Schedule.prototype.run = function(task, timeout, dontExecuteIfLate, rescheduleIfLate) {
  var id = this.nextId++;
  this.tasks[id] = clock.setTimeout(this._handle(id, task, timeout, dontExecuteIfLate, rescheduleIfLate), timeout);
  return id;
};

Schedule.prototype.cancel = function(id) {
  if (this.tasks[id]) {
    clock.clearTimeout(this.tasks[id]);
    delete this.tasks[id];
  }
};

Schedule.prototype.cancelAll = function() {
  each(clock.clearTimeout, this.tasks);
  this.tasks = {};
};

Schedule.prototype._handle = function(id, callback, timeout, dontExecuteIfLate, rescheduleIfLate) {
  var self = this;
  var start = self.now();
  return function() {
    delete self.tasks[id];
    if (dontExecuteIfLate && start + timeout * CLOCK_LATE_FACTOR < self.now()) {
      if (rescheduleIfLate) {
        self.run(callback, timeout, dontExecuteIfLate, rescheduleIfLate);
      }
      return;
    }
    return callback();
  };
};

Schedule.setClock = function(newClock) {
  clock = newClock;
};

Schedule.resetClock = function() {
  clock = defaultClock;
};

module.exports = Schedule;

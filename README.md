
# localstorage-retry
[![Circle CI](https://circleci.com/gh/segmentio/localstorage-retry.svg?style=shield&circle-token=26daea4c3c8e5645f15841fdda51f14386bc5302)](https://circleci.com/gh/segmentio/localstorage-retry)

Provides durable retries with a queue held in `localStorage`

## How It Works

Each page maintains its own list of queued and in-progress tasks, while constantly refreshing its ack time. If a queue goes more than 10s without updating its ack, another page will remove it, claim all queued tasks, and retry all in-progress tasks.

## API

### new Queue(name, [opts], processFunc(item, done(err, res)))

You can omit the `opts` argument to initialize the queue with defaults:

```javascript
var Queue = require('@segment/localstorage-retry');

var queue = new Queue('my_queue_name', function process(item, done) {
  sendAsync(item, function(err, res) {
    if (err) return done(err);
    done(null, res);
  });
});

queue.on('processed', function(err, res, item) {
  if (err) return console.warn('processing %O failed with error %O', item, err);
  console.log('successfully sent %O with response %O', item, res);
});

queue.start();
```

### Options

The queue can be initialized with the following options (*defaults shown*):

```js
var options = {
  ackTimer: 1000,        // ack interval in ms
  reclaimTimer: 3000,    // (3s)
  reclaimTimeout: 10000, // (10s)
  reclaimWait: 500,      // (.5s)
  minRetryDelay: 1000,   // min retry delay in ms (used in exp. backoff calcs)
  maxRetryDelay: 30000,  // max retry delay in ms (used in exp. backoff calcs)
  backoffFactor: 2,      // exponential backoff factor (^2)
  backoffJitter: 0,      // jitter factor for backoff calcs
  maxItems: 100          // queue high water mark
};

var queue = new Queue('my_queue_name', opts, (item, done) => {
  sendAsync(item, (err, res) => {
    if (err) return done(err);
    done(null, res);
  });
});

queue.start();
```

### .addItem(item)

Adds an item to the queue

```javascript
queue.addItem({ a: 'b' });
```

### .getDelay `(attemptNumber) -> ms`

Can be overridden to provide a custom retry delay in ms.

Default:

```javascript
queue.getDelay = function(attemptNumber) {
  var ms = this.backoff.MIN_RETRY_DELAY * Math.pow(this.backoff.FACTOR, attemptNumber);
  if (this.backoff.JITTER) {
    var rand =  Math.random();
    var deviation = Math.floor(rand * this.backoff.JITTER * ms);
    ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
  }
  return Math.min(ms, this.backoff.MAX_RETRY_DELAY) | 0;
};
```

### .shouldRetry `(item, attemptNumber, error) -> boolean`

Can be overridden to provide custom logic for whether to requeue the item. (Defaults to `true`.)

```javascript
queue.shouldRetry = function(item, attemptNumber, error) {
  // based on something in the item itself
  if (new Date(item.timestamp) - new Date() > 86400000) return false;

  // max attempts
  if (attemptNumber > 3) return false;

  // selective error handling
  if (error.code === '429') return false;

  return true;
}
```

### .start

Starts the queue processing items. Anything added before calling `.start` will be queued until `.start` is called.

```javascript
queue.start();
```

### .stop

Stops the queue from processing. Any retries queued may be picked claimed by another queue after a timeout.

```javascript
queue.stop();
```

## Emitter

You can listen for `processed` events, which are emitted with each invocation of the `processFunc` and passed any error or response provided along with the item itself.

If a message is discarded entirely because it does not pass your `shouldRetry` logic upon attempted re-enqueuing, the queue will emit a `discard` event.

### `processed`

```javascript
queue.on('processed', function(err, res, item) {
  if (err) return console.warn('processing %O failed with error %O', item, err);
  console.log('successfully sent %O with response %O', item, res);
});
```

### `discard`

```javascript
queue.on('discard', function(item, attempts) {
  console.error('discarding message %O after %d attempts', item, attempts);
})
```

## License

Released under the [MIT License](LICENSE)

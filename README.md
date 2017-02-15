
# localstorage-retry
[![Circle CI](https://circleci.com/gh/segmentio/localstorage-retry.svg?style=shield&circle-token=26daea4c3c8e5645f15841fdda51f14386bc5302)](https://circleci.com/gh/segmentio/localstorage-retry)

Provides durable retries with a queue held in `localStorage`

## How It Works

Each page maintains its own list of queued and in-progress tasks, while constantly refreshing its ack time. If a queue goes more than 10s without updating its ack, another page will remove it, claim all queued tasks, and retry all in-progress tasks.

## API

### new Queue(name, processFunc(item, done(err, res)))

```javascript
var Queue = require('@segment/localstorage-retry');

var queue = new Queue('my_queue_name', function process(item, done) {
  sendAsync(item, function(err, res) {
    if (err) return done(err);
    done(null, res);
  });
});

queue.on('success', function(item, res) {
  console.log('successfully sent %O with response %O', item, res);
});

queue.start();
```

### .addItem(item)

Adds an item to the queue

```javascript
queue.addItem({ a: 'b' });
```

### .getDelay

Can be overridden to provide a custom retry delay in ms. (Defaults to `1000 * attemptNumber^2`)

```javascript
queue.getDelay = function(attemptNumber) {
  return 1000 * attemptNumber;
}
```

### .shouldRetry `(item, attemptNumber, error) -> boolean`

Can be overridden to provide custom logic for whether to requeue the item. (Defaults to `true`.)

```javascript
// based on something in the item
queue.shouldRetry = function(item, attemptNumber, error)) {
  return new Date(item.timestamp) - new Date() < 86400000;
}

// max attempts
queue.shouldRetry = function(item, attemptNumber, error)) {
  if (attemptNumber <= 2) return true;
  return false;
}

// selective error handling
queue.shouldRetry = function(item, attemptNumber, error)) {
  return error.code !== '429';
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

You can listen for `processed` events, of which is emitted with each invocation of the `processFunc` and passed any error, response provided along with the item itself. 

If a message is discarded entirely because it does not pass your `shouldRetry` logic upon attempted re-enqueuing, the queue will emit a `discard` event.

### `processed` (processed )

```javascript
queue.on('processed', function(err, res, item) {
  if (err) {
    console.warn('error processing %O: %O... will retry', item, err);
  } 
  console.log('successfully flushed %O: %O', item, res);
})
```

### `discard` (item abandoned)

```javascript
queue.on('discard', function(item, attempts) {
  // eek
  console.error('discarding message %O after %d attempts', item, attempts);
})
```

###

## License

Released under the [MIT License](LICENSE)


# localstorage-retry
[![Circle CI](https://circleci.com/gh/segmentio/localstorage-retry.svg?style=shield&circle-token=26daea4c3c8e5645f15841fdda51f14386bc5302)](https://circleci.com/gh/segmentio/localstorage-retry)

Provides durable retries with a queue held in `localStorage`

## How It Works

Each page maintains its own list of queued and in-progress tasks, while constantly refreshing its ack time. If a queue goes more than 10s without updating its ack, another page will remove it, claim all queued tasks, and retry all in-progress tasks.

## API

### new Queue(name, processFunc(item, done(err)))

```javascript
var Queue = require('@segment/localstorage-retry');

var queue = new Queue('my_queue_name', function process(item, done) {
  try {
    console.log(item);
    done();
  } catch (e) {
    done(e);
  }
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

###

## License

Released under the [MIT License](LICENSE)

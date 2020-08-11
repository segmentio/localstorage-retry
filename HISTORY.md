# 1.2.4 / 2020-08-11

- [Fix](https://github.com/segmentio/localstorage-retry/pull/21): Modified reclaim to run on original engine with tests 

# 1.2.3 / 2020-05-10

- [Fix](https://github.com/segmentio/localstorage-retry/pull/17): Re order keys to delete ack last

# 1.2.2 / 2018-07-19

- [Fix](https://github.com/segmentio/localstorage-retry/pull/13): Respect attempts when reclaiming queue
- [Fix](https://github.com/segmentio/localstorage-retry/pull/11): Limit inProgress using maxItems

# 1.2.1 / 2018-07-11

- [Fix](https://github.com/segmentio/localstorage-retry/pull/10): Fix object loss when adding multiple items to the queue.

# 1.2.0 / 2017-08-23

- add support for configurable retry backoffs
- add maxItems option to constrain max queue size
- add maxAttempts option to constrain number of attempts
- update default shouldretry and getdelay logic to take advantage of HWM and exp. backoff with jitter

# 1.1.0 / 2017-08-11

- Minor Refactor
- Fallback to in-memory storage engine in the event of exceeding localStorage quota

# 1.0.3 / 2017-08-02

- Default _all_ localstorage queue retrievals to empty data structures

# 1.0.2 / 2017-08-02

- Default to empty queue

# 1.0.1 / 2017-07-12

- Bump package.json

# 1.0.0 / 2017-07-12

- Retry Logic and Events (#3)

# 0.0.2 / 2017-01-23

- Fix setTimeout invocation

# 0.0.1 / 2017-01-09

- Initial Implementation


1.2.1 / 2018-07-11
==================

 * [Fix](https://github.com/segmentio/localstorage-retry/pull/10): Fix object loss when adding multiple items to the queue.


1.2.0 / 2017-08-23
==================

 * add support for configurable retry backoffs
 * add maxItems option to constrain max queue size
 * add maxAttempts option to constrain number of attempts
 * update default shouldretry and getdelay logic to take advantage of HWM and exp. backoff with jitter

1.1.0 / 2017-08-11
==================

 * Minor Refactor
 * Fallback to in-memory storage engine in the event of exceeding localStorage quota

1.0.3 / 2017-08-02
==================

 * Default *all* localstorage queue retrievals to empty data structures

1.0.2 / 2017-08-02
==================

 * Default to empty queue

1.0.1 / 2017-07-12
==================

 * Bump package.json

1.0.0 / 2017-07-12
==================

  * Retry Logic and Events (#3)

0.0.2 / 2017-01-23
==================

  * Fix setTimeout invocation

0.0.1 / 2017-01-09
===================

 * Initial Implementation

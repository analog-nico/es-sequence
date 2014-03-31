# Elasticsearch Sequence

[![Build Status](https://travis-ci.org/analog-nico/es-sequence.svg?branch=master)](https://travis-ci.org/analog-nico/es-sequence) [![Dependencies up to date](https://david-dm.org/analog-nico/es-sequence.png)](https://david-dm.org/analog-nico/es-sequence)

`es-sequence` is a Node.js module for Elasticsearch that provides sequences of auto-incrementing integers that can be used to set the id of new documents.

The sequences are persisted by the Elasticsearch cluster which makes them the last missing feature that maybe prevented you from using Elasticsearch as the sole database in your server stack.

Inspired by the Perl library [ElasticSearchX-Sequence](https://github.com/clintongormley/ElasticSearchX-Sequence) by borrowing its [approach](http://blogs.perl.org/users/clinton_gormley/2011/10/elasticsearchsequence---a-blazing-fast-ticket-server.html).

---

2014-03-30, **Note on the failing build**: Travis CI currently provides Elasticsearch v0.90.10 which is incompatible with the latest Elasticsearch client. I could use an earlier version of the client but then also some checks in the unit tests need to be changed. So I will wait until Travis CI upgrades to Elasticsearch v1.1.

I currently use Elasticsearch v1.1.0 and the client v2.1.0 for development. All unit tests pass.

## Installation

[![NPM Stats](https://nodei.co/npm/es-sequence.png?downloads=true)](https://npmjs.org/package/es-sequence)

This module is installed via npm:

``` bash
$ npm install es-sequence
```

`es-sequence` communicates with the Elasticsearch cluster via the [official client library](https://github.com/elasticsearch/elasticsearch-js). Since this dependency is injected during runtime you need to install it yourself:

``` bash
$ npm install elasticsearch
```

## Usage

``` js
var sequence = require('es-sequence');
var esClient = require('elasticsearch').Client();

// Initialize es-sequence during server startup
sequence.init(esClient);

// Call get from anywhere
sequence.get('post_id').then(function (id) {

  // Use the id here, e.g. to set the id of a new document:
  esClient.index({
    index: 'blog',
    type: 'post',
    id: id,        // <--
    body: {
      title: 'JavaScript Everywhere!',
      content: 'It all started when...',
      date: '2013-12-17'
    }
  });

});
```

## API

### sequence.init(client, [options])

Initialization should be called **once** during server startup.

`client` must be a client instance of the [official Elasticsearch client library](https://github.com/elasticsearch/elasticsearch-js). It is used to set up sequences the first time they are requested through `get` and to retrieve new ids.

`options` default to:
``` js
{
  esIndex: 'sequences',
  esType: 'sequence'
}
```

Pass the options accordingly to overwrite the defaults. These parameters are used to store and update documents that represent a sequence in the index `esIndex` of document type `esType`.

The index is configured by `init` for optimal performance. Thus you must use this index for sequences only!

#### Error Handling

`init` returns a [promise](http://promisesaplus.com) (implemented by [Bluebird](https://github.com/petkaantonov/bluebird)) which resolves all asynchronous initialization steps. You can use it to handle any errors:
``` js
// Promises/A+ compliant use
sequence.init(esClient)
  .then(null, function (error) {
    // Add your error handling code here.
  });

// More expressive alternative provided by Bluebird
sequence.init(esClient)
  .catch(function (error) {
    // Add your error handling code here.
  });
```

You may catch specific [errors originating from Elasticsearch](http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current/errors.html) using:
``` js
var sequence = require('es-sequence');
var elasticsearch = require('elasticsearch');
var esClient = elasticsearch.Client();

// Promises/A+ compliant use
sequence.init(esClient)
  .then(null, function (error) {
    if (error instanceof elasticsearch.errors.RequestTimeout) {
      // Handle RequestTimeout errors here.
    } else {
      // Handle any other errors here.
    }
  });

// More expressive alternative provided by Bluebird
sequence.init(esClient)
  .catch(elasticsearch.errors.RequestTimeout, function (error) {
    // Handle RequestTimeout errors here.
  })
  .catch(function (error) {
    // Handle any other errors here.
  });
```

You can choose to ignore the promise. Any early `get` call will be deferred until the initialization finishes and will fail itself if the initialization had failed.

### sequence.get(sequenceName) -> Promise

Retrieves the next integer of the sequence with the name `sequenceName`. A new sequence starts with `1`. In two consecutive calls the latter will always get a value higher than the former call. However, both values may differ by more than `1` if a node.js server restart occurred in between.

`sequenceName` can be any string.

Returns a [promise](http://promisesaplus.com) (implemented by [Bluebird](https://github.com/petkaantonov/bluebird)). Call `then(...)` to pass a callback that will get the retrieved integer as the first parameter:
``` js
sequence.get(sequenceName).then(function (id) {
  // Use the id here
});
```

#### Error Handling

The promise returned by `get` will be rejected if retrieving the integer fails for any reason. To handle any error use:
```js
// Promises/A+ compliant use
sequence.get(sequenceName).then(
  function (id) {
    // Called on successful id retrieval
  },
  function (error) {
    // Add your error handling code here.
  }
);

// More expressive alternative provided by Bluebird
sequence.get(sequenceName)
  .then(function (id) {
    // Called on successful id retrieval
  })
  .catch(function (error) {
    // Add your error handling code here.
  });
```

You may also catch specific [errors originating from Elasticsearch](http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current/errors.html) as described in the error handling section for `init`.

## Production Readiness

WARNING: I did not use this module in production yet. However, the [approach](http://blogs.perl.org/users/clinton_gormley/2011/10/elasticsearchsequence---a-blazing-fast-ticket-server.html) is not too risky.

[Travis CI](https://travis-ci.org/analog-nico/es-sequence) does linting and unit testing for all commits. For unit testing it always uses the latest version of the official client library and a recent if not latest version of Elasticsearch (the database). The current build status is displayed at the top of this document.

You can execute the unit tests for your specific environment:
  1. Make Elasticsearch available on `http://localhost:9200` (default port).
  2. Get a local copy of this repo.
  3. Go via the command line to the main folder and execute:

``` bash
$ npm install
$ npm uninstall elasticsearch
$ npm install elasticsearch@<your version of choice>
$ grunt ci
```

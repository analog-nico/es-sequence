# Elasticsearch Sequence

[![Build Status](https://travis-ci.org/analog-nico/es-sequence.svg?branch=master)](https://travis-ci.org/analog-nico/es-sequence)

`es-sequence` is a Node.js module for Elasticsearch that provides sequences of auto-incrementing integers that can be used to set the id of new documents.

The sequences are persisted by the Elasticsearch cluster which makes them the last missing feature that maybe prevented you from using Elasticsearch as the sole database in your server stack.

Inspired by the Perl library [ElasticSearchX-Sequence](https://github.com/clintongormley/ElasticSearchX-Sequence) by borrowing its [approach](http://blogs.perl.org/users/clinton_gormley/2011/10/elasticsearchsequence---a-blazing-fast-ticket-server.html).

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
var elasticsearch = require('elasticsearch');

sequence.init(elasticsearch.Client(), function () {

  sequence.get('userid', function (id) {
    // Use id
  });

});
```

### sequence.get(sequenceName, callback)

Retrieves the next integer of the sequence with the name `sequenceName`. A new sequence starts with `1`. In two consecutive calls the latter will always get a value higher than the former call. However, both values may differ by more than `1` if a node.js server restart occurred in between.

`sequenceName` can be any string.

`callback` is called to return the retrieved integer as the first parameter:
``` js
function myCallback(id) {
  // Use the id here
}
```

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

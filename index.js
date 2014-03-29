'use strict';

var _ = require('lodash');


var _client,
    _cache = {},
    _options = { esIndex: 'sequences', esType: 'sequence' },
    _internalOptions = {
      esIndexConfig: {
        settings: {
          number_of_shards     : 1,
          auto_expand_replicas : '0-all'
        },
        mappings: {}
      },
      esTypeMapping: {
        _source : { enabled : false },
        _all    : { enabled : false },
        _type   : { index : 'no' },
        enabled : false
      }
    };


function ensureEsIndexContainsMapping(done) {

  var mapping = {};
  mapping[_options.esType] = _internalOptions.esTypeMapping;

  _client.indices.putMapping({
    index: _options.esIndex,
    type: _options.esType,
    ignore_conflicts: true,
    body: mapping
  }, function (err, response, status) {
    if (err) {
      throw err;
    }
    done();
  });
}

function ensureEsIndexIsInitialized(done) {

  _client.indices.exists({
    index: _options.esIndex
  }, function (err, response, status) {
    if (err) {
      throw err;
    }

    if (response === true) {
      ensureEsIndexContainsMapping(done);
      return;
    }

    var config = _.cloneDeep(_internalOptions.esIndexConfig);
    config.mappings[_options.esType] = _internalOptions.esTypeMapping;

    _client.indices.create({
      index: _options.esIndex,
      body: config
    }, function (err, response, status) {
      if (err) {
        throw err;
      }
      done();
    });
  });
}

function init(client, options, done) {
  _client = client;
  _cache = {}; // In case init is called multiple times.

  if (_.isObject(options)) {
    _.merge(_options, options);
  }

  var _done = done;
  if (_.isUndefined(_done)) {
    if (_.isFunction(options)) {
      _done = options;
    } else {
      throw new Error('Please provide a callback.');
    }
  }

  ensureEsIndexIsInitialized(_done);
}

function fillCache(name, callback) {
  if (_cache[name] === undefined) {
    _cache[name] = [];
  }

  var bulkParams = { body: [] };
  for ( var i = 0; i < 100; i+=1 ) {
    bulkParams.body.push({ index: { _index: _options.esIndex, _type: _options.esType, _id: name } });
    bulkParams.body.push({});
  }

  _client.bulk(bulkParams, function (err, response, status) {
    if (err) {
      throw err;
    }

    for ( var k = 0; k < response.items.length; k+=1 ) {
      _cache[name].push(response.items[k].index._version);
    }

    callback();
  });
}

function get(name, callback) {
  if (_.isUndefined(_client)) {
    throw new Error('Please run init(...) first to provide an elasticsearch client.');
  }

  if (_cache[name] !== undefined && _cache[name].length > 0) {
    // Even though the callback could be called synchronously
    // calling it asynchronously in all cases confuses less developers.
    var id = _cache[name].shift();
    process.nextTick(function () {
      callback(id);
    });
    return;
  }

  fillCache(name, function () {
    callback(_cache[name].shift());
  });
}

module.exports = {
  init: init,
  get: get
};

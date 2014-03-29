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
  if (_.isUndefined(client)) {
    throw new Error('The parameter value for client is invalid.');
  }

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

function fillCache(sequenceName, done) {
  if (_.isArray(_cache[sequenceName]) === false) {
    _cache[sequenceName] = [];
  }

  var bulkParams = { body: [] };
  for ( var i = 0; i < 100; i+=1 ) {
    // Action
    bulkParams.body.push({ index: { _index: _options.esIndex, _type: _options.esType, _id: sequenceName } });
    // Empty document
    bulkParams.body.push({});
  }

  _client.bulk(bulkParams, function (err, response, status) {
    if (err) {
      throw err;
    }

    for ( var k = 0; k < response.items.length; k+=1 ) {
      // This is the core trick: The document's version is an auto-incrementing integer.
      _cache[sequenceName].push(response.items[k].index._version);
    }

    done();
  });
}

function get(sequenceName, callback) {
  if (_.isUndefined(_client)) {
    throw new Error('Please run init(...) first to provide an elasticsearch client.');
  }

  if (_.isString(sequenceName) === false || sequenceName.length === 0) {
    throw new Error('The parameter value for sequenceName is invalid.');
  }

  if (_.isFunction(callback) === false) {
    throw new Error('The parameter value for callback is invalid.');
  }

  if (_.isArray(_cache[sequenceName]) && _cache[sequenceName].length > 0) {
    // Even though the callback could be called synchronously, calling it
    // asynchronously in all cases creates less confusion / bug hunting.
    var id = _cache[sequenceName].shift();
    process.nextTick(function () {
      callback(id);
    });
    return;
  }

  // FIXME: Between the fillCache call and the execution of the callback another get invocation may take place.
  fillCache(sequenceName, function () {
    callback(_cache[sequenceName].shift());
  });
}

module.exports = {
  init: init,
  get: get
};

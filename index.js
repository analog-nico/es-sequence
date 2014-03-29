'use strict';

var _ = require('lodash');


var _client,
    _cache = {},
    _cacheFillPromise = null,
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


function isInjectedClientValid(client) {

  if (_.isUndefined(client) ||
      _.isUndefined(client.indices) ||
      _.isFunction(client.indices.create) === false ||
      _.isFunction(client.indices.exists) === false ||
      _.isFunction(client.indices.putMapping) === false ||
      _.isFunction(client.bulk) === false) {
    return false;
  }

  return true;
}

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
  if (isInjectedClientValid(client) === false) {
    throw new Error('The parameter value for client is invalid.');
  }

  if (_cacheFillPromise !== null) {
    throw new Error('You cannot call init while get requests are pending.');
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

function fillCache(sequenceName) {
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

  return _client.bulk(bulkParams).then(function (response) {
    for ( var k = 0; k < response.items.length; k+=1 ) {
      // This is the core trick: The document's version is an auto-incrementing integer.
      _cache[sequenceName].push(response.items[k].index._version);
    }
  });
}

function get(sequenceName, callback) {
  if (_.isArray(_cache[sequenceName]) && _cache[sequenceName].length > 0) {
    // Even though the callback could be called synchronously, calling it
    // asynchronously in all cases creates less confusion / bug hunting.
    // Also limits an hopefully never occurring endless loop through recursion.
    var id = _cache[sequenceName].shift();
    process.nextTick(function () {
      callback(id);
    });
    return;
  }

  function returnValue() {
    get(sequenceName, callback);
  }

  if (_cacheFillPromise !== null) {
    _cacheFillPromise.then(returnValue);
  } else {
    _cacheFillPromise = fillCache(sequenceName).then(returnValue).then(function () {
      _cacheFillPromise = null;
    });
  }
}

function getWithParamCheck(sequenceName, callback) {
  if (_.isUndefined(_client)) {
    throw new Error('Please run init(...) first to provide an elasticsearch client.');
  }

  if (_.isString(sequenceName) === false || sequenceName.length === 0) {
    throw new Error('The parameter value for sequenceName is invalid.');
  }

  if (_.isFunction(callback) === false) {
    throw new Error('The parameter value for callback is invalid.');
  }

  get(sequenceName, callback);
}

function getCacheSize(sequenceName) {
  if (_.isArray(_cache[sequenceName]) === false) {
    return 0;
  } else {
    return _cache[sequenceName].length;
  }
}

module.exports = {
  init: init,
  get: getWithParamCheck,
  _internal: {
    getCacheSize: getCacheSize
  }
};

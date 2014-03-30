'use strict';

var _ = require('lodash');
var Promise = require('bluebird');


var _client,
    _initPromise = null,
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

function ensureEsIndexContainsMapping() {

  var mapping = {};
  mapping[_options.esType] = _internalOptions.esTypeMapping;

  return _client.indices.putMapping({
    index: _options.esIndex,
    type: _options.esType,
    ignore_conflicts: true,
    body: mapping
  });
}

function ensureEsIndexIsInitialized() {

  _initPromise = _client.indices.exists({
    index: _options.esIndex
  }).then(function (response) {
    if (response === true) {
      return ensureEsIndexContainsMapping();
    }

    var config = _.cloneDeep(_internalOptions.esIndexConfig);
    config.mappings[_options.esType] = _internalOptions.esTypeMapping;

    return _client.indices.create({
      index: _options.esIndex,
      body: config
    });
  }).then(function () {
    _initPromise = null;
  });

  return _initPromise;
}

function init(client, options) {
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

  return ensureEsIndexIsInitialized();
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

  _cacheFillPromise = _client.bulk(bulkParams)
    .then(function (response) {
      for ( var k = 0; k < response.items.length; k+=1 ) {
        // This is the core trick: The document's version is an auto-incrementing integer.
        _cache[sequenceName].push(response.items[k].index._version);
      }
    })
    .then(function () {
      _cacheFillPromise = null;
    });

  return _cacheFillPromise;
}

function get(sequenceName) {
  if (_.isArray(_cache[sequenceName]) && _cache[sequenceName].length > 0) {
    return Promise.resolve(_cache[sequenceName].shift());
  }

  function returnValue() {
    return get(sequenceName);
  }

  if (_cacheFillPromise !== null) {
    return _cacheFillPromise.then(returnValue);
  } else {
    return fillCache(sequenceName).then(returnValue);
  }
}

function getWithParamCheck(sequenceName) {
  if (_.isUndefined(_client)) {
    throw new Error('Please run init(...) first to provide an elasticsearch client.');
  }

  if (_.isString(sequenceName) === false || sequenceName.length === 0) {
    throw new Error('The parameter value for sequenceName is invalid.');
  }

  if (_initPromise !== null) {
    // Defer until init is done
    return _initPromise.then(function () {
      return get(sequenceName);
    });
  }

  return get(sequenceName);
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

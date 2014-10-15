'use strict';

var _ = require('lodash');
var BPromise = require('bluebird');


var _client,
    _initPromise = null,
    _initError = null,
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

  if ((_.isObject(client) === false && _.isFunction(client) === false) ||
      (_.isObject(client.indices) === false && _.isFunction(client.indices) === false) ||
      _.isFunction(client.indices.create) === false ||
      _.isFunction(client.indices.exists) === false ||
      _.isFunction(client.indices.putMapping) === false ||
      _.isFunction(client.bulk) === false) {
    return false;
  }

  return true;
}

function addMappingToEsIndexIfMissing() {

  var mapping = {};
  mapping[_options.esType] = _internalOptions.esTypeMapping;

  return _client.indices.putMapping({
    index: _options.esIndex,
    type: _options.esType,
    ignore_conflicts: true,
    body: mapping
  });

}

function initEsIndexIfNeeded() {

  return _client.indices.exists({
    index: _options.esIndex
  }).then(function (response) {

    if (response === true) {
      return addMappingToEsIndexIfMissing();
    }

    var config = _.cloneDeep(_internalOptions.esIndexConfig);
    config.mappings[_options.esType] = _internalOptions.esTypeMapping;

    return _client.indices.create({
      index: _options.esIndex,
      body: config
    });

  });

}

function init(client, options) {

  // The following checks are done before the init promise is created
  // because errors thrown in the init promise are stored in _initError.
  // If a check fails it should look as if init was not called.

  if (isInjectedClientValid(client) === false) {
    return BPromise.reject(new Error('Init was called with an invalid client parameter value.'));
  }

  if (_initPromise !== null) {
    return BPromise.reject(new Error('Init was called while a previous init is pending.'));
  }
  if (_cacheFillPromise !== null) {
    return BPromise.reject(new Error('Init was called while get requests are pending.'));
  }

  _initPromise = new BPromise(function (resolve) {

    _client = client;
    _cache = {}; // In case init is called multiple times.
    _initError = null;

    if (_.isObject(options)) {
      _.merge(_options, options);
    }

    resolve(initEsIndexIfNeeded());

  })
  .catch(function (e) {
    _initError = e;
    throw e;
  })
  .finally(function () {
    _initPromise = null;
  });

  return _initPromise;

}

function fillCache(sequenceName) {

  _cacheFillPromise = new BPromise(function (resolve) {

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

    resolve(
      _client.bulk(bulkParams)
        .then(function (response) {
          for ( var k = 0; k < response.items.length; k+=1 ) {
            // This is the core trick: The document's version is an auto-incrementing integer.
            _cache[sequenceName].push(response.items[k].index._version);
          }
        })
    );

  })
  .finally(function () {
    _cacheFillPromise = null;
  });

  return _cacheFillPromise;

}

function get(sequenceName) {
  if (_initError !== null) {
    return BPromise.reject(_initError);
  }

  if (_.isArray(_cache[sequenceName]) && _cache[sequenceName].length > 0) {
    return BPromise.resolve(_cache[sequenceName].shift());
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

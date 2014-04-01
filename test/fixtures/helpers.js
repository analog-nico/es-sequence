'use strict';

var util = require('util');


exports.expectError = function (promise, done) {
  promise
    .then(function () {
      done(new Error('The get promise was not rejected.'));
    })
    .catch(function (e) {
      done();
    });
};

exports.expectIndexToExist = function (esClient, name, expectedToExist, done) {
  esClient.indices.exists({
    index: name
  }, function (err, response, status) {
    expect(err).toBeUndefined();
    expect(response).toBe(expectedToExist);
    done();
  });
};

exports.expectIndexToHaveCorrectSettings = function(esClient, name, done) {
  esClient.indices.getSettings({
    index: name
  }, function (err, response, status) {
    expect(err).toBeUndefined();
    console.log(util.inspect(response, { showHidden: true, depth: null }));
    expect(response).toBeDefined();
    expect(response[name]).toBeDefined();
    expect(response[name].settings).toBeDefined();
    expect(response[name].settings.index).toBeDefined();
    expect(response[name].settings.index.auto_expand_replicas).toEqual("0-all");
    expect(response[name].settings.index.number_of_shards).toEqual("1");
    done();
  });
};

exports.expectIndexToHaveCorrectMappingForType = function (esClient, nameIndex, nameType, done) {
  esClient.indices.getMapping({
    index: nameIndex,
    type: nameType
  }, function (err, response, status) {
    expect(err).toBeUndefined();
    console.log(util.inspect(response, { showHidden: true, depth: null }));
    expect(response).toBeDefined();
    expect(response[nameIndex]).toBeDefined();
    expect(response[nameIndex].mappings).toBeDefined();
    expect(response[nameIndex].mappings[nameType]).toBeDefined();
    expect(response[nameIndex].mappings[nameType]._source).toBeDefined();
    expect(response[nameIndex].mappings[nameType]._source.enabled).toBe(false);
    expect(response[nameIndex].mappings[nameType]._all).toBeDefined();
    expect(response[nameIndex].mappings[nameType]._all.enabled).toBe(false);
    expect(response[nameIndex].mappings[nameType]._type).toBeDefined();
    expect(response[nameIndex].mappings[nameType]._type.index).toEqual('no');
    expect(response[nameIndex].mappings[nameType].enabled).toBe(false);
    done();
  });
};

'use strict';

describe('es-sequence', function() {

  var util = require('util');

  var esClient = require('elasticsearch').Client();
  var sequence = require('..');


  function expectIndexToExist(name, expectedToExist, done) {
    esClient.indices.exists({
      index: name
    }, function (err, response, status) {
      expect(err).toBeUndefined();
      expect(response).toBe(expectedToExist);
      done();
    });
  }

  function expectIndexToHaveCorrectSettings(name, done) {
    esClient.indices.getSettings({
      index: name
    }, function (err, response, status) {
      expect(err).toBeUndefined();
      console.log(util.inspect(response, { showHidden: true, depth: null }));
      expect(response[name].settings.index.auto_expand_replicas).toEqual("0-all");
      expect(response[name].settings.index.number_of_shards).toEqual("1");
      done();
    });
  }

  function expectIndexToHaveCorrectMappingForType(nameIndex, nameType, done) {
    esClient.indices.getMapping({
      index: nameIndex,
      type: nameType
    }, function (err, response, status) {
      expect(err).toBeUndefined();
      console.log(util.inspect(response, { showHidden: true, depth: null }));
      expect(response[nameIndex].mappings[nameType]._source.enabled).toBe(false);
      expect(response[nameIndex].mappings[nameType]._all.enabled).toBe(false);
      expect(response[nameIndex].mappings[nameType]._type.index).toEqual('no');
      expect(response[nameIndex].mappings[nameType].enabled).toBe(false);
      done();
    });
  }


  it('should throw missing init', function (done) {
    expect(function () {
      sequence.get("userId");
    }).toThrow();
    done();
  });

  it('should throw missing callback for init', function (done) {
    expect(function () {
      sequence.init(esClient);
    }).toThrow();
    done();
  });

  it('should init without options', function (done) {
    // I do not expect the default "sequences" index not to be existing to be able to execute the tests on my test db.
    sequence.init(esClient, function () {
      expectIndexToExist('sequences', true, done);
    });
  });

  it('should init with options for a new index', function (done) {
    expectIndexToExist('testsequences', false, function () {

      sequence.init(esClient, {
        esIndex: 'testsequences'
      }, function () {

        expectIndexToExist('testsequences', true, function () {
          expectIndexToHaveCorrectSettings('testsequences', function () {
            expectIndexToHaveCorrectMappingForType('testsequences', 'sequence', done);
          });
        });
      });
    });
  });

  it('should retrieve the value for a new sequence', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(1);
      done();
    });
  });

  it('should retrieve the value for an existing sequence', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(2);
      done();
    });
  });

  it('should retrieve the value for another new sequence', function (done) {
    sequence.get("anotherId", function (id) {
      expect(id).toBe(1);
      done();
    });
  });

  it('should keep different sequences separate', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(3);
      done();
    });
  });

  it('should retrieve a thousand ids from a sequence', function (done) {

    function getNextId(lastId, i, done) {
      sequence.get("userId", function (id) {
        expect(id).toBe(lastId+1);
        if (i < 1000) {
          getNextId(id, i+1, done);
        } else {
          done();
        }
      });
    }

    getNextId(3, 0, done);
  });

  it('should keep different sequences separate even after cache refreshes', function (done) {

    function getNextId(lastId, i, done) {
      sequence.get("anotherId", function (id) {
        expect(id).toBe(lastId+1);
        if (i < 1000) {
          getNextId(id, i+1, done);
        } else {
          done();
        }
      });
    }

    getNextId(1, 0, done);
  });

  it('should reinit with same options', function (done) {
    sequence.init(esClient, function () {
      sequence.get("anotherId", function (id) {
        expect(id).toBeGreaterThan(1);
        done();
      });
    });
  });

  it('should reinit with same index but different type', function (done) {
    sequence.init(esClient, {
      esType: 'sequence2'
    }, function () {
      expectIndexToHaveCorrectMappingForType('testsequences', 'sequence2', done);
    });
  });

  it('should count a sequence with the same name but other type from 1', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(1);
      done();
    });
  });


  it('cleanup', function (done) {

    function deleteIndex(name, done) {
      esClient.indices.delete({
        index: name
      }, function (err, response, status) {
        expect(err).toBeUndefined();
        done();
      });
    }

    deleteIndex('testsequences', done);

  });

});

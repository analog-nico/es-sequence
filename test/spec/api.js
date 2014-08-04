'use strict';

describe('The es-sequence API', function() {

  var util = require('util');
  var Promise = require('bluebird');
  var helpers = require('./../fixtures/helpers.js');

  var esClient = require('elasticsearch').Client();
  var sequence = require('../../index.js');


  beforeEach(function () {
    console.log('Running: The es-sequence API ' + jasmine.getEnv().currentSpec.description);
  });


  it('should throw invalid parameters for init', function (done) {

    var count = 5;
    function countdown(error) {
      if (error) {
        done(error);
      }
      count -= 1;
      if (count === 0) {
        done();
      }
    }

    helpers.expectError(sequence.init(), countdown);
    helpers.expectError(sequence.init(undefined), countdown);
    helpers.expectError(sequence.init(null), countdown);
    helpers.expectError(sequence.init({}), countdown);
    helpers.expectError(sequence.init({ indices: null }), countdown);
    helpers.expectError(sequence.init(function () {}), countdown);

  });

  it('should throw missing init', function (done) {
    expect(function () { sequence.get("userId");        }).toThrow();
    done();
  });

  it('should init without options', function (done) {
    // I do not expect the default "sequences" index not to be existing to be able to execute the tests on my test db.
    sequence.init(esClient)
      .then(function () {
          helpers.expectIndexToExist(esClient, 'sequences', true, done);
      });
  });

  it('should init with options for a new index', function (done) {
    helpers.expectIndexToExist(esClient, 'testsequences', false, function () {

      sequence.init(esClient, { esIndex: 'testsequences' })
        .then(function () {
          helpers.expectIndexToExist(esClient, 'testsequences', true, function () {
            helpers.expectIndexToHaveCorrectSettings(esClient, 'testsequences', function () {
              helpers.expectIndexToHaveCorrectMappingForType(esClient, 'testsequences', 'sequence', done);
            });
          });
        });
    });
  });

  it ('should throw invalid parameters for get', function (done) {
    expect(function () { sequence.get();      }).toThrow();
    expect(function () { sequence.get(null);  }).toThrow();
    expect(function () { sequence.get(false); }).toThrow();
    expect(function () { sequence.get("");    }).toThrow();
    done();
  });

  it('should retrieve the value for a new sequence', function (done) {
    sequence.get("userId")
      .then(function (id) {
        expect(id).toBe(1);
        done();
      });
  });

  it('should retrieve the value for an existing sequence', function (done) {
    sequence.get("userId")
      .then(function (id) {
        expect(id).toBe(2);
        done();
      });
  });

  it('should retrieve the value for another new sequence', function (done) {
    sequence.get("anotherId")
      .then(function (id) {
        expect(id).toBe(1);
        done();
      });
  });

  it('should keep different sequences separate', function (done) {
    sequence.get("userId")
      .then(function (id) {
        expect(id).toBe(3);
        done();
      });
  });

  it('should be able to retrieve a thousand ids from a sequence', function (done) {

    var count = 1000;
    function countdown() {
      count -= 1;
      if (count === 0) {
        done();
      }
    }

    function executeGet(expectedValue) {
      sequence.get("userId")
          .then(function (id) {
            expect(id).toBe(expectedValue);
            countdown();
          });
    }

    for ( var i = 0; i < 1000; i+=1 ) {
      executeGet(i+1+3);
    }

  });

  it('should keep different sequences separate even after cache refreshes', function (done) {

    var count = 300;
    function countdown() {
      count -= 1;
      if (count === 0) {
        done();
      }
    }

    function executeGet(expectedValue) {
      sequence.get("anotherId")
          .then(function (id) {
            expect(id).toBe(expectedValue);
            countdown();
          });
    }

    for ( var i = 0; i < 300; i+=1 ) {
      executeGet(i+1+1);
    }

  });

  it('should reinit with same options', function (done) {

    sequence.init(esClient);

    sequence.get("anotherId")
      .then(function (id) {
        // 301 retrieved ids + 99 discarded ids in cache
        expect(id).toBeGreaterThan(1 + 300 + 99);
        done();
      });
  });

  it('should reinit with same index but different type', function (done) {

    sequence.init(esClient, { esType: 'sequence2' })
      .then(function () {
        helpers.expectIndexToHaveCorrectMappingForType(esClient, 'testsequences', 'sequence2', done);
      });
  });

  it('should count a sequence with the same name but other type from 1', function (done) {
    sequence.get("userId")
      .then(function (id) {
        expect(id).toBe(1);
        done();
      });
  });

  it('should allow sequences names with special characters', function (done) {

    function getNextId(lastId, i, done) {
    sequence.get("^°!\"§$%&/()=?*+'#-_.:,;<>|\\…÷∞˛~›˘∫‹√◊≈‡≤≥‘’@ﬂ∆ˆºıªƒ∂‚•π∏⁄Ω†€‰∑¿˙≠{}·˜][ﬁ“”„“ ¡¢£¤¥¦§¨©ª«¬®¯°±²³´`µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖŒ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøœùúûüýþÿ™")
      .then(function (id) {
        expect(id).toBe(lastId+1);
        if (i < 300) {
          getNextId(id, i+1, done);
        } else {
          done();
        }
      });
    }

    getNextId(0, 0, done);
  });

  it('should keep order while cache is filled', function (done) {

    // Intercept the bulk method which is used to get new ids so it takes longer
    var bulkOrig = esClient.bulk;
    esClient.bulk = function() {
      return bulkOrig.apply(this, arguments).delay(50);
    };

    var count = 3;
    function countdown() {
      count -= 1;
      if (count === 0) {
        expect(sequence._internal.getCacheSize("cachefilltest")).toBe(100-3);
        esClient.bulk = bulkOrig;
        done();
      }
    }

    // First call that triggers filling the cache
    sequence.get("cachefilltest")
      .then(function (id) {
        expect(id).toBe(1);
        countdown();
      });

    sequence.get("cachefilltest")
      .then(function (id) {
        expect(id).toBe(2);
        countdown();
      });

    sequence.get("cachefilltest")
      .then(function (id) {
        expect(id).toBe(3);
        countdown();
      });

  });

  it('should handle queueing gets with multiple cache fills required', function (done) {

    // Intercept the bulk method which is used to get new ids so it takes longer
    var bulkOrig = esClient.bulk;
    var firstBulk = true;
    esClient.bulk = function() {
      var ret = bulkOrig.apply(this, arguments);
      if (firstBulk === 0) {
        ret = ret.delay(50);
        firstBulk = false;
      }
      return ret;
    };

    var count = 1000;
    function countdown() {
      count -= 1;
      if (count === 0) {
        expect(sequence._internal.getCacheSize("cachefilltest2")).toBe(10*100 - 1000);
        esClient.bulk = bulkOrig;
        done();
      }
    }

    function executeGet(expectedValue) {
      sequence.get("cachefilltest2")
        .then(function (id) {
          expect(id).toBe(expectedValue);
          countdown();
        });
    }

    for ( var i = 0; i < 1000; i+=1 ) {
      executeGet(i+1);
    }

  });

  it('should throw reinit on pending cache fill', function (done) {

    // Intercept the bulk method which is used to get new ids so it takes longer
    var bulkOrig = esClient.bulk;
    esClient.bulk = function() {
      return bulkOrig.apply(this, arguments).delay(50);
    };

    var count = 2;
    function countdown(error) {
      if (error) {
        done(error);
      }
      count -= 1;
      if (count === 0) {
        esClient.bulk = bulkOrig;
        done();
      }
    }

    sequence.get("cachefilltest3")
      .then(function (id) {
        expect(id).toBe(1);
        expect(count).toBe(1); // Finished last
        countdown();
      })
      .catch(function (e) {
        countdown(new Error('Get should not have failed: ' + e.message));
      });

    helpers.expectError(sequence.init(esClient), countdown);

  });

  it('should defer get request while init creates the index', function (done) {

    // Intercept the method to create an index so it takes longer
    var createOrig = esClient.indices.create;
    esClient.indices.create = function() {
      var _arguments = arguments;
      return Promise.delay(50).then(function () {
        return createOrig.apply(esClient.indices, _arguments);
      });
    };

    var count = 3;
    function countdown() {
      count -= 1;
      if (count === 0) {
        esClient.indices.create = createOrig;
        done();
      }
    }

    sequence.init(esClient, { esIndex: 'testsequences2', esType: 'sequence' })
      .then(function () {
        countdown();
        helpers.expectIndexToExist(esClient, 'testsequences2', true, function () {
          helpers.expectIndexToHaveCorrectSettings(esClient, 'testsequences2', function () {
            helpers.expectIndexToHaveCorrectMappingForType(esClient, 'testsequences2', 'sequence', countdown);
          });
        });
      });

    sequence.get("defertest")
      .then(function (id) {
        expect(id).toBe(1);
        expect(count).toBeLessThan(3); // Finished last
        countdown();
      });

  });

  it('should defer get request while init creates new mapping', function (done) {

    // Intercept the method to create an index so it takes longer
    var putMappingOrig = esClient.indices.putMapping;
    esClient.indices.putMapping = function() {
      var _arguments = arguments;
      return Promise.delay(50).then(function () {
        return putMappingOrig.apply(esClient.indices, _arguments);
      });
    };

    var count = 3;
    function countdown() {
      count -= 1;
      if (count === 0) {
        esClient.indices.putMapping = putMappingOrig;
        done();
      }
    }

    sequence.init(esClient, { esIndex: 'testsequences2', esType: 'sequence2' })
      .then(function () {
        countdown();
        helpers.expectIndexToExist(esClient, 'testsequences2', true, function () {
          helpers.expectIndexToHaveCorrectSettings(esClient, 'testsequences2', function () {
            helpers.expectIndexToHaveCorrectMappingForType(esClient, 'testsequences2', 'sequence2', countdown);
          });
        });
      });

    sequence.get("defertest")
      .then(function (id) {
        expect(id).toBe(1);
        expect(count).toBeLessThan(3); // Finished last
        countdown();
      });

  });


  it('cleanup index testsequences', function (done) {
    esClient.indices.delete({ index: 'testsequences' }, done);
  });

  it('cleanup index testsequences2', function (done) {
    esClient.indices.delete({ index: 'testsequences2' }, done);
  });

});

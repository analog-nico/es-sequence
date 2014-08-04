'use strict';

describe('Regarding connectivity, es-sequence', function() {

  var util = require('util');
  var Promise = require('bluebird');
  var helpers = require('./../fixtures/helpers.js');

  var sequence = require('../../index.js');
  var elasticsearch = require('elasticsearch');
  var esClientOnline = elasticsearch.Client();
  var esClientOffline = elasticsearch.Client({ host: 'localhost:1234' }); // Wrong port == offline
  var esClientSim = require('./../fixtures/es-client.js');

  function takeClientOffline() {

    function throwOffline() {
      return Promise.resolve().then(function () {
        throw new elasticsearch.errors.NoConnections();
      });
    }

    esClientOnline.indices.existsOrig = esClientOnline.indices.exists;
    esClientOnline.indices.exists = throwOffline;

    esClientOnline.bulkOrig = esClientOnline.bulk;
    esClientOnline.bulk = throwOffline;
  }

  function takeClientOnline() {
    esClientOnline.indices.exists = esClientOnline.indices.existsOrig;
    esClientOnline.bulk = esClientOnline.bulkOrig;
  }


  beforeEach(function () {
    console.log('Running: Regarding connectivity, es-sequence ' + jasmine.getEnv().currentSpec.description);
  });


  it('should handle that Elasticsearch is offline', function (done) {
    sequence.init(esClientOffline)
      .then(function () {
        done(new Error('The init promise was not rejected.'));
      })
      .catch(elasticsearch.errors.NoConnections, function (e) {
        // Just to double check both approaches to check for a specific error type.
        expect(e instanceof elasticsearch.errors.NoConnections).toBe(true);
        done();
      })
      .catch(function (e) {
        done(new Error('Init threw an error of an unexpected type: ' + e.message));
      });
  });

  it('should forward any initialization error to get', function (done) {
    var initError;
    sequence.init(esClientOffline)
      .catch(function (e) {
        initError = e;
      })
      .then(function () {

        return sequence.get('test')
          .then(function () {
            done(new Error('The get promise was not rejected.'));
          })
          .catch(function (e) {
            expect(e).toBe(initError);
            done();
          });
      });
  });

  it('should forward any initialization error to deferred get', function (done) {

    // Intercept the method to check the existence if an index so it takes longer
    var existsOrig = esClientOffline.indices.exists;
    esClientOffline.indices.exists = function() {
      var _arguments = arguments;
      return Promise.delay(50).then(function () {
        return existsOrig.apply(esClientOffline.indices, _arguments);
      });
    };

    var initError, getError;

    var count = 2;
    function countdown() {
      count -= 1;
      if (count === 0) {
        expect(getError).toBe(initError);
        done();
      }
    }

    sequence.init(esClientOffline)
      .catch(function (e) {
        initError = e;
        countdown();
      });

    sequence.get('test')
      .then(function () {
        done(new Error('The get promise was not rejected.'));
      })
      .catch(function (e) {
        getError = e;
        expect(count).toBe(1); // Finished last
        countdown();
      });
  });

  it('should allow reinit after first failed init', function (done) {
    takeClientOffline();
    sequence.init(esClientOnline, { esIndex: 'testsequences3' })
        .catch(function () {
          takeClientOnline();
          return sequence.init(esClientOnline);
        })
        .then(function () {
          return new Promise(function (resolve) {
            // Second init should use options of previous call since no options were passed to it.
            helpers.expectIndexToExist(esClientOnline, 'testsequences3', true, resolve);
          });
        })
        .then(function () {
          return sequence.get('firstId');
        })
        .then(function (id) {
          expect(id).toBe(1);
          done();
        });
  });

  it('should handle Elasticsearch getting offline after init and before first get', function (done) {
    var err;
    sequence.init(esClientOnline)
        .catch(function (e) {
          done(new Error('Init should not have failed.'));
        })
        .then(takeClientOffline)
        .then(function () {
          return sequence.get('test')
              .then(function () {
                done(new Error('The get promise was not rejected.'));
              })
              .catch(function (e) {
                err = e;
              });
        })
        .finally(function () {
          expect(err).toBeDefined();
          takeClientOnline();
          done();
        });
  });

  it('should handle Elasticsearch getting offline after first get and before second get', function (done) {
    var err;
    sequence.init(esClientOnline)
      .catch(function (e) {
        done(new Error('Init should not have failed.'));
      })
      .then(function () {
        return sequence.get('test')
          .catch(function (e) {
            done(new Error('The first get should not have failed.'));
          });
      })
      .then(takeClientOffline)
      .then(function () {
        expect(sequence._internal.getCacheSize('test2')).toBe(0);
        return sequence.get('test2')
          .then(function () {
            done(new Error('The get promise was not rejected.'));
          })
          .catch(function (e) {
            err = e;
          });
      })
      .finally(function () {
        expect(err).toBeDefined();
        takeClientOnline();
        done();
      });
  });

  it('should handle Elasticsearch getting offline after init and before first deferred get', function (done) {

    var count = 2;
    function countdown() {
      count -= 1;
      if (count === 0) {
        done();
      }
    }

    sequence.init(esClientOnline)
      .then(function () {
        takeClientOffline();
        countdown();
      });

    sequence.get('test')
      .then(function () {
        done(new Error('The get promise was not rejected.'));
      })
      .catch(function (e) {
        expect(count).toBe(1); // Finished last
        takeClientOnline();
        countdown();
      });

  });

  xit('should accept the elasticsearch client simulator', function (done) {
    expect(function () {
      sequence.init(esClientSim);
    }).not.toThrow();
    done();
  });

  it('cleanup index testsequences3', function (done) {
    esClientOnline.indices.delete({ index: 'testsequences3' }, done);
  });

});
'use strict';

describe('Regarding connectivity, es-sequence', function() {

  var Promise = require('bluebird');

  var elasticsearch = require('elasticsearch');
  var esClientOffline = elasticsearch.Client({ host: 'localhost:1234' }); // Wrong port == offline
  var esClientSim = require('./fixtures/es-client.js');
  var sequence = require('..');

  it('should handle that Elasticsearch is offline', function (done) {
    sequence.init(esClientOffline)
      .then(function () {
        done(new Error('The init promise was not rejected.'));
      })
      .catch(function (e) {
        done();
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

  it('should accept the elasticsearch client simulator', function (done) {
    expect(function () {
      sequence.init(esClientSim);
    }).not.toThrow();
    done();
  });

});
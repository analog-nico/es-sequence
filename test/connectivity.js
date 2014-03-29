'use strict';

describe('Regarding connectivity, es-sequence', function() {

  var esClient = require('./fixtures/es-client.js');
  var sequence = require('..');

  it('should accept the elasticsearch client simulator', function (done) {
    expect(function () {
      sequence.init(esClient);
    }).not.toThrow();
    done();
  });

});
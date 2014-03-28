var expect = require('expect.js'),
    esSequence = require('..');

describe('es-sequence', function() {
  it('should say hello', function(done) {
    expect(esSequence()).to.equal('Hello, world');
    done();
  });
});

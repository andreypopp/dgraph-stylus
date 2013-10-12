var path        = require('path'),
    css         = require('css'),
    assert      = require('assert'),
    dgraph      = require('dgraph'),
    aggregate   = require('stream-aggregate'),
    transform   = require('./index');

function fixture(filename) {
  return path.join(__dirname, 'fixtures', filename);
}

function getGraph() {
  return dgraph(fixture('a.styl'), {transform: transform})
}

describe('dgraph-stylus', function() {

  it('produces graph', function(done) {
    aggregate(getGraph(), function(err, g) {
      if (err) return done(err);
      try {
        assert.ok(g.length === 3);
        g.forEach(function(m) {
          assert.ok(m.id);
          assert.ok(css.parse(m.source));
          assert.ok(m.deps);
        });
        done();
      } catch(err) {
        done(err);
      }
    });
  });
});

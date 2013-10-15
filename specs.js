var path        = require('path'),
    css         = require('css'),
    assert      = require('assert'),
    dgraph      = require('dgraph'),
    aggregate   = require('stream-aggregate-promise'),
    transform   = require('./index');

function fixture(filename) {
  return path.join(__dirname, 'fixtures', filename);
}

function getGraph(filename) {
  return dgraph(fixture(filename), {transform: transform})
}

describe('dgraph-stylus', function() {

  it('produces graph', function(done) {
    aggregate(getGraph('a.styl')).then(function(g) {
      assert.equal(g.length, 3);
      g.forEach(function(m) {
        assert.ok(m.id);
        assert.ok(css.parse(m.source));
        assert.ok(m.deps);
      });
      done();
    }).fail(done);
  });

  it('process .css imports', function(done) {
    aggregate(getGraph('has_css.styl')).then(function(g) {
      var mod = g[0];
      assert.ok(mod);
      assert.equal(g.length, 2);
      assert.equal(Object.keys(mod.deps).length, 1);
      done();
    }).fail(done);
  });

  it('processes built-ins', function(done) {
    aggregate(getGraph('has_builtin.styl')).then(function(g) {
      var mod = g[0];
      assert.ok(mod);
      assert.equal(g.length, 1);
      assert.equal(mod.source, 'body {\n  background: #c00;\n}\n');
      done();
    }).fail(done);
  });

  it('processes built-ins in deps', function(done) {
    aggregate(getGraph('has_builtin_in_dep.styl')).then(function(g) {
      var mod = g[1];
      assert.ok(mod);
      assert.equal(g.length, 2);
      assert.equal(mod.source, 'body {\n  background: #c00;\n}\n');
      done();
    }).fail(done);
  });

  it('ignores url(...)', function(done) {
    aggregate(getGraph('has_url.styl')).then(function(g) {
      var mod = g[0];
      assert.ok(mod);
      assert.equal(g.length, 1);
      assert.equal(mod.source, '@import url("some webfont");\nbody {\n  color: #f00;\n}\n');
      done();
    }).fail(done);
  });

});

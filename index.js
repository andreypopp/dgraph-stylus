"use strict";

var Renderer  = require('./renderer'),
    q         = require('kew');

module.exports = function(mod, graph) {
  var renderer = new Renderer(mod.source.toString(), {
    filename: mod.id,
    resolve: graph.resolve.bind(graph)
  });
  var promise = q.defer();
  renderer.render(function(err, source) {
    if (err) {
      promise.reject(err)
    } else {
      var deps = {};
      for (var id in renderer.imports)
        deps[id] = id;
      promise.resolve({source: source, deps: deps});
    }
  });
  return promise;
}

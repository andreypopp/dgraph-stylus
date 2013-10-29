"use strict";

var Renderer  = require('./renderer'),
    q         = require('kew');

module.exports = function(mod, graph) {
  if (!mod.id.match(/\.styl$/)) return;

  graph.__stylus_cache = graph.__stylus_cache || {};

  var renderer = new Renderer(mod.source.toString(), {
    map: graph.__stylus_map,
    cachedAST: graph.__stylus_cache[mod.id],
    filename: mod.id,
    resolve: graph.resolve.bind(graph)
  });
  var promise = q.defer();
  renderer.render(function(err, source) {
    if (err) {
      promise.reject(err)
    } else {
      var deps = {};
      for (var id in renderer.imports) {
        deps[id] = id;
        graph.__stylus_cache[id] = renderer.imports[id].evaluatedBlock;
      }
      graph.__stylus_map = renderer.map;
      promise.resolve({source: source, deps: deps});
    }
  });
  return promise;
}

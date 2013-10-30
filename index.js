"use strict";

var Renderer  = require('./renderer'),
    clone     = require('lodash').clone,
    q         = require('kew');

module.exports = function(mod, graph) {
  if (!mod.id.match(/\.styl$/)) return;

  graph.__stylus = graph.__stylus || {map: {}, cache: {}};

  mod = clone(mod);
  if (graph.__stylus.cache[mod.id]) {
    mod.deps = graph.__stylus.cache[mod.id].deps;
    mod.block = graph.__stylus.cache[mod.id].block;
  }

  var renderer = new Renderer(mod, {
    map: graph.__stylus.map,
    resolve: graph.resolve.bind(graph)
  });

  var promise = q.defer();
  renderer.render(function(err, mod) {
    if (err) return promise.reject(err);
    graph.__stylus.map = renderer.map;

    for (var id in renderer.imports)
      graph.__stylus.cache[id] = renderer.imports[id];

    promise.resolve({source: mod.source, deps: mod.deps});
  });

  return promise;
}

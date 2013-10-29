"use strict";

/**
 * Stylus AST visitor which resolves imports to AST asynchronously.
 */
var Visitor = require('stylus/lib/visitor'),
    Parser  = require('stylus/lib/parser'),
    q       = require('kew'),
    fs      = require('fs-promise'),
    util    = require('util'),
    assign  = require('lodash').assign,
    flatten = require('lodash').flatten;

function readModule(mod) {
  var p = fs.readFile(mod.id, 'utf8').then(function(source) {
    mod._source = source;
    return mod;
  });
  return p
}

function asLocal(id) {
  return './' + id.replace(/\.styl$/, '') + '.styl';
}

function Importer(root, options, imports) {
  Visitor.call(this, root);
  this.options = options;
  this.imports = {};
}
util.inherits(Importer, Visitor);

Importer.prototype.import = function() {
  return this.resolve(this.visit(this.root))
    .then(function() { return this.imports; }.bind(this));
}

Importer.prototype.resolve = function(imports, parent) {
  if (imports.length === 0)
    return q.resolve([]);

  parent = parent || {id: this.options.filename};

  var self = this;
  var promises = imports.map(function(imp) {
    var id = imp.id;

    if (!id) return;

    if (id.match(/^\.|\//) && !id.match(/\.(css|styl)/))
      id = id + '.styl';

    return self.options.resolve(asLocal(id), parent)
      .fail(function() { return self.options.resolve(id, parent); })
      .then(readModule)
      .then(function(mod) {
        if (imp.node)
          imp.node.path.nodes[0].val = mod.id;
        var block = self.parseModule(mod);
        return {id: mod.id, block: block, package: mod.package};
      });

  });

  return q.all(promises.filter(Boolean)).then(function(imports) {
    var promises = imports.map(function(imp) {
          self.imports[imp.id] = imp;
          var parent = {id: imp.id, package: imp.package};
          return self.resolve(self.visit(imp.block), parent);
        });
    return q.all(flatten(promises));
  });
}

Importer.prototype.parseModule = function(mod) {
  var options = assign({}, this.options, {filename: mod.id}),
      parser = new Parser(mod._source, options);
  return parser.parse();
}

Importer.prototype.visitRoot = function(node) {
  return node.nodes
    .filter(function(node) { return node.constructor.name === 'Import'; })
    .map(this.visit.bind(this));
}

Importer.prototype.visitImport = function(node) {
  return {node: node, id: node.path.nodes[0].val};
}

module.exports = Importer;

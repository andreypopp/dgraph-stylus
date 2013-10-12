"use strict";

/**
 * Stylus AST visitor which resolves imports to AST asynchronously.
 */
var Visitor = require('stylus/lib/visitor'),
    Parser  = require('stylus/lib/parser'),
    q       = require('kew'),
    fs      = require('fs-promise'),
    util    = require('util'),
    assign  = require('lodash').assign;

function readModule(mod) {
  var p = fs.readFile(mod.id, 'utf8').then(function(source) {
    mod._source = source;
    return mod;
  });
  return p
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

Importer.prototype.resolve = function(imports) {
  var self = this;
  var promises = imports.map(function(imp) {

    var id = imp.id || imp;

    if (id[0].match(/^\.|\//) && !id.match(/\.(css|styl)/))
      id = id + '.styl';

    return self.options.resolve(id, {id: self.options.filename})
      .then(readModule)
      .then(function(mod) {
        if (imp.node)
          imp.node.path.nodes[0].val = mod.id;
        var block = self.parseModule(mod);
        return {id: mod.id, block: block}
      }).end();

  });

  return q.all(promises).then(function(imports) {
    var newImports = [];
    imports.forEach(function(imp) {
      self.imports[imp.id] = imp;
      newImports = newImports.concat(self.visit(imp.block));
    });
    newImports = newImports.filter(function(id) {
      return self.imports[id] === undefined
    });
    if (newImports.length > 0)
      return self.resolve(newImports);
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

function flattenArray(arr) {
  return arr.reduceRight(function(a, b) { return a.concat(b); }, []);
}

module.exports = Importer;

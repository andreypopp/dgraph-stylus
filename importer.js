"use strict";

/**
 * Stylus AST visitor which resolves imports to AST asynchronously.
 */
var Visitor  = require('stylus/lib/visitor'),
    Parser   = require('stylus/lib/parser'),
    nodes    = require('stylus/lib/nodes'),
    q        = require('kew'),
    all      = q.all,
    fs       = require('fs-promise'),
    util     = require('util'),
    assign   = require('lodash').assign,
    isString = require('lodash').isString;

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

function parse(mod, options) {
  nodes.filename = mod.id;
  options = assign({}, options, {filename: mod.id});
  var parser = new Parser(mod.source && mod.source.toString() || mod._source, options);
  return parser.parse();
}

function resolve(mod, options) {
  mod.block = parse(mod, options);
  mod.deps = {};
  var ids = findImports(mod.block, options);

  if (ids.length === 0)
    return q.resolve({});

  var parent = assign({extensions: ['.styl']}, mod);

  var promises = ids.map(function(imp) {
    var id = imp.id, node = imp.node;
    return options.resolve(asLocal(id), parent)
      .fail(function() { return options.resolve(id, parent); })
      .then(function(m) { return {id: m.id}; })
      .then(readModule)
      .then(function(m) {
        mod.deps[m.id] = m.id;
        node.path.nodes[0].val = m.id;
        return m;
      });
  });

  return all(promises).then(function(mods) {
    var result = {};
    var promises = mods.map(function(mod) {
      if (result[mod.id])
        return;
      result[mod.id] = mod;
      return resolve(mod, options).then(function(mods) {
        assign(result, mods);
      });
    });
    return all(promises).then(function() { return result; });
  });
}

function findImports(root, options) {
  var importer = new Importer(root, options);
  importer.find();
  return importer.imports;
}

function Importer(root, options) {
  Visitor.call(this, root);
  this.options = options;
  this.imports = [];
}
util.inherits(Importer, Visitor);

Importer.prototype.find = function() {
  this.visit(this.root);
}

Importer.prototype.visitGroup = function(node) {
  for (var i = 0, len = node.nodes.length; i < len; i++)
    this.visit(node.nodes[i]);
}

Importer.prototype.visitFunction = function(node) {
  this.visit(node.block);
}

Importer.prototype.visitBlock = function(node) {
  for (var i = 0, len = node.nodes.length; i < len; i++)
    this.visit(node.nodes[i]);
}

Importer.prototype.visitIdent = function(node) {
  if (node.val) this.visit(node.val);
}

Importer.prototype.visitRoot = function(node) {
  for (var i = 0, len = node.nodes.length; i < len; i++)
    this.visit(node.nodes[i]);
}

Importer.prototype.visitImport = function(node) {
  if (node.path &&
      node.path.nodes &&
      node.path.nodes.length > 0 &&
      isString(node.path.nodes[0].val))
    this.imports.push({node: node, id: node.path.nodes[0].val});
}

module.exports = resolve;

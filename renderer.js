"use strict";

/**
 * Renderer which resolves @import via dgraph API.
 */

var fs            = require('fs'),
    q             = require('kew'),
    path          = require('path'),
    Parser        = require('stylus/lib/parser'),
    Compiler      = require('stylus/lib/visitor/compiler'),
    Normalizer    = require('stylus/lib/visitor/normalizer'),
    nodes         = require('stylus/lib/nodes'),
    utils         = require('stylus/lib/utils'),
    buildMap      = require('./map-builder'),
    Evaluator     = require('./evaluator'),
    resolve       = require('./importer');

var FUNCTIONS_FILENAME = path.join(
    __dirname,
    'node_modules/stylus/lib/functions/index.styl');

function readFile(filename, options) {
  var promise = q.defer();
  fs.readFile(filename, options, promise.makeNodeResolver());
  return promise;
}

function getBuiltins() {
  return readFile(FUNCTIONS_FILENAME, 'utf8').then(function(src) {
    var parser = new Parser(src);
    var block = parser.parse();
    return [{id: FUNCTIONS_FILENAME, block: block}];
  });
}

function Renderer(mod, options) {
  options = options || {};
  options.globals = {};
  options.functions = {};
  options.imports = [];
  options.paths = options.paths || [];
  options.filename = mod.id;

  this.mod = mod;
  this.options = options;
  this.imports = undefined;
  this.parser = new Parser(mod.source.toString(), this.options);
  this.map = options.map || {};
}

Renderer.prototype.updateMap = function(ast) {
  var map = buildMap(ast);
  for (var k in map)
    if (this.map[k])
      this.map[k] = this.map[k].concat(map[k])
    else
      this.map[k] = map[k];
}

Renderer.prototype.evaluate = function() {
  this.evaluator = new Evaluator(this.mod.block, this.options, this.imports, this.builtins);
  this.nodes = nodes;
  this.evaluator.renderer = this;
  return this.evaluator.evaluate();
}

/**
 * Parse and evaluate AST, then callback `cb(err, css, js)`.
 *
 * @param {Function} cb
 * @api public
 */
Renderer.prototype.render = function(cb) {
  var self = this;

  return q.resolve()
    .then(function() {
      if (self.mod.block) {
        self.mod.source = self.compile(self.mod.block);
        return cb(null, self.mod);
      }
      return resolve(self.mod, self.options);
    })
    .then(function(imports) {
      return getBuiltins().then(function(builtins) {
        self.builtins = builtins;
        self.imports = imports;
        self.mod.block = self.evaluate();
        for (var k in imports)
          self.updateMap(imports[k].block);
        self.mod.source = self.compile(self.mod.block);
        cb(null, self.mod);
      });
    })
    .fail(function(err) {
      var options = {
        input: err.input || self.str,
        filename: err.filename || self.options.filename,
        lineno: err.lineno || self.parser.lexer.lineno
      };
      cb(utils.formatException(err, options));
    });
};

Renderer.prototype.compile = function(ast) {
  var normalizer = new Normalizer(ast, this.options);
  normalizer.map = this.map;
  ast = normalizer.normalize();
  return new Compiler(ast, this.options).compile();
}

module.exports = Renderer;

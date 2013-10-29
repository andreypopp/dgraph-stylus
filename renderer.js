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
    Evaluator     = require('./evaluator'),
    Importer      = require('./importer');

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

/**
 * Initialize a new `Renderer` with the given `str` and `options`.
 *
 * @param {String} str
 * @param {Object} options
 * @api public
 */
function Renderer(str, options) {
  options = options || {};
  options.globals = {};
  options.functions = {};
  options.imports = [];
  options.paths = options.paths || [];
  options.filename = options.filename || 'stylus';

  this.options = options;
  this.str = str;
  this.imports = undefined;
  this.parser = new Parser(this.str, this.options);
  this.ast = undefined;
}

Renderer.prototype.evaluate = function() {
  this.evaluator = new Evaluator(this.ast, this.options, this.imports, this.builtins);
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
      if (self.options.cachedAST) {
        var css = self.compile(self.options.cachedAST);
        return cb(null, css);
      }
      nodes.filename = self.options.filename;
      self.ast = self.parser.parse();
      return new Importer(self.ast, self.options).import();
    })
    .then(function(imports) {
      return getBuiltins().then(function(builtins) {
        self.builtins = builtins;
        self.imports = imports;
        self.ast = self.evaluate();
        cb(null, self.compile(self.ast));
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
  ast = new Normalizer(ast, this.options).normalize();
  return new Compiler(ast, this.options).compile();
}

module.exports = Renderer;

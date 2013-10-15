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

function getBuiltins() {
  return [
    {
      id: FUNCTIONS_FILENAME,
      block: parseSync(FUNCTIONS_FILENAME)
    }
  ];
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
}

/**
 * Parse and evaluate AST, then callback `cb(err, css, js)`.
 *
 * @param {Function} cb
 * @api public
 */
Renderer.prototype.render = function(cb) {
  q.resolve()
    .then(function() {
      nodes.filename = this.options.filename;
      this.parser = new Parser(this.str, this.options);
      this.ast = this.parser.parse();
      this.importer = new Importer(this.ast, this.options);
      return this.importer.import()
    }.bind(this))
    .then(function(imports) {
      this.imports = imports;
      this.evaluator = new Evaluator(this.ast, this.options, imports, getBuiltins());
      this.nodes = nodes;
      this.evaluator.renderer = this;
      this.ast = this.evaluator.evaluate();
      this.normalizer = new Normalizer(this.ast, this.options);
      this.ast = this.normalizer.normalize();
      this.compiler = new Compiler(this.ast, this.options);
      cb(null, this.compiler.compile());
    }.bind(this))
    .fail(function(err) {
      var options = {
        input: err.input || this.str,
        filename: err.filename || this.options.filename,
        lineno: err.lineno || this.parser.lexer.lineno
      };
      cb(utils.formatException(err, options));
    }.bind(this));
};

function parseSync(filename) {
  var parser = new Parser(fs.readFileSync(filename, 'utf8'));
  return parser.parse();
}

module.exports = Renderer;

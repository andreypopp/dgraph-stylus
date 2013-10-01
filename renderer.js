"use strict";

/**
 * Renderer which resolves @import via dgraph API.
 */

var Parser        = require('stylus/lib/parser'),
    EventEmitter  = require('events').EventEmitter,
    Compiler      = require('stylus/lib/visitor/compiler'),
    Normalizer    = require('stylus/lib/visitor/normalizer'),
    events        = new EventEmitter,
    nodes         = require('stylus/lib/nodes'),
    path          = require('path'),
    join          = path.join,
    utils         = require('stylus/lib/utils'),
    util          = require('util'),
    Evaluator     = require('./evaluator'),
    Importer      = require('./importer');


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
  options.imports = [join(__dirname, 'node_modules/stylus/lib/functions/index.styl')];
  options.paths = options.paths || [];
  options.filename = options.filename || 'stylus';
  this.options = options;
  this.str = str;
  this.events = events;
  this.imports = undefined;
};

Renderer.prototype.__proto__ = EventEmitter.prototype;

/**
 * Parse and evaluate AST, then callback `fn(err, css, js)`.
 *
 * @param {Function} fn
 * @api public
 */
Renderer.prototype.render = function(fn) {
  var parser = this.parser = new Parser(this.str, this.options);
  try {
    nodes.filename = this.options.filename;
    // parse
    var ast = parser.parse();

    this.importer = new Importer(ast, this.options);
    this.importer.import().then(function(imports) {
      this.imports = imports;
      try {
        // evaluate
        this.evaluator = new Evaluator(ast, this.options, imports);
        this.nodes = nodes;
        this.evaluator.renderer = this;
        ast = this.evaluator.evaluate();

        // normalize
        var normalizer = new Normalizer(ast, this.options);
        ast = normalizer.normalize();

        // compile
        var compiler = new Compiler(ast, this.options)
          , css = compiler.compile();

        if (!fn) {
          this.emit('end', css);
          return css;
        } else {
          if (!this.listeners('end').length) {
            return fn(null, css);
          }
          this.emit('end', css, function(err, css) {
            fn(err, css);
          });
        }
      } catch (err) {
        var options = {};
        options.input = err.input || this.str;
        options.filename = err.filename || this.options.filename;
        options.lineno = err.lineno || parser.lexer.lineno;
        if (!fn) throw utils.formatException(err, options);
        fn(utils.formatException(err, options));
      }
    }.bind(this));

  } catch (err) {
    var options = {};
    options.input = err.input || this.str;
    options.filename = err.filename || this.options.filename;
    options.lineno = err.lineno || parser.lexer.lineno;
    if (!fn) throw utils.formatException(err, options);
    fn(utils.formatException(err, options));
  }
};

module.exports = Renderer;

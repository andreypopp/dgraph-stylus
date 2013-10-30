"use strict";

var BaseEvaluator = require('stylus/lib/visitor/evaluator'),
    nodes         = require('stylus/lib/nodes'),
    util          = require('util');

function Evaluator(root, options, resolved, builtins) {
  BaseEvaluator.call(this, root, options);
  this.resolved = resolved;
  this.builtins = builtins;
  this.seenBuiltins = false;
}
util.inherits(Evaluator, BaseEvaluator);

Evaluator.prototype.visit = function() {
  if (!this.seenBuiltins && this.builtins) {
    this.seenBuiltins = true;
    this.builtins.forEach(function(imp) {
      this.evaluateImport(imp);
    }.bind(this));
  }
  return BaseEvaluator.prototype.visit.apply(this, arguments);
}

Evaluator.prototype.visitImport = function(imported) {
  var id = imported.path.nodes[0].val;
  var imp = this.resolved[id];
  if (!imp) return imported;
  this.evaluateImport(imp);
  return imported;
}

Evaluator.prototype.evaluateImport = function(imp) {
  var block = imp.block,
      id = imp.id;

  this.importStack.push(id);
  nodes.filename = id;
  block.parent = this.root;
  block.scope = false;
  imp.block = this.visit(block);
  this.importStack.pop();
  if (this.importStack.length) this.paths.pop();
}

module.exports = Evaluator;

"use strict";

var BaseEvaluator = require('stylus/lib/visitor/evaluator'),
    nodes         = require('stylus/lib/nodes'),
    util          = require('util');

function Evaluator(root, options, resolvedImports) {
  BaseEvaluator.call(this, root, options);
  this.resolvedImports = resolvedImports;
}
util.inherits(Evaluator, BaseEvaluator);

Evaluator.prototype.visitImport = function(imported){
  var id = imported.path.nodes[0].val;
  var block = this.resolvedImports[id];
  if (!block) return imported;
  block = block.block;

  // Parse the file
  this.importStack.push(id);
  nodes.filename = id;

  // Evaluate imported "root"
  block.parent = this.root;
  block.scope = false;
  this.visit(block);
  this.importStack.pop();
  if (this.importStack.length) this.paths.pop();

  return imported;
};

module.exports = Evaluator;

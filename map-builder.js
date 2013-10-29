var Visitor  = require('stylus/lib/visitor'),
    util     = require('util');

function MapBuilder(root) {
  Visitor.call(this, root);
  this.stack = [];
  this.map = {};
}
util.inherits(MapBuilder, Visitor);

MapBuilder.prototype.build = function() {
  this.visit(this.root);
  return this.map;
}

MapBuilder.prototype.visitRoot = function(block){
  for (var i = 0, len = block.nodes.length; i < len; ++i) {
    var node = block.nodes[i];
    switch (node.nodeName) {
      case 'null':
      case 'expression':
      case 'function':
      case 'jsliteral':
      case 'unit':
        continue;
      default:
        this.visit(node);
    }
  }

  return block
};

MapBuilder.prototype.visitBlock = function(block){
  if (block.hasProperties) {
    for (var i = 0, len = block.nodes.length; i < len; ++i) {
      this.last = len - 1 == i;
      var node = block.nodes[i];
      switch (node.nodeName) {
        case 'null':
        case 'expression':
        case 'function':
        case 'jsliteral':
        case 'group':
        case 'unit':
          continue;
        default:
          this.visit(node);
      }
    }
  }

  // nesting
  for (var i = 0, len = block.nodes.length; i < len; ++i) {
    node = block.nodes[i];
    this.visit(node);
  }

  return block;
};

MapBuilder.prototype.visitGroup = function(group){
  var stack = this.stack,
      map = this.map,
      self = this;

  stack.push(group.nodes);

  var selectors = this.compileSelectors(stack);

  // map for extension lookup
  selectors.forEach(function(selector){
    map[selector] = map[selector] || [];
    map[selector].push(group);
  });

  this.visit(group.block);
  stack.pop();
  return group;
};

MapBuilder.prototype.compileSelectors = function(arr){
  var stack = this.stack,
      self = this,
      selectors = [],
      buf = [];

  function compile(arr, i) {
    if (i) {
      arr[i].forEach(function(selector){
        buf.unshift(selector.val);
        compile(arr, i - 1);
        buf.shift();
      });
    } else {
      arr[0].forEach(function(selector){
        var str = selector.val.trim();
        if (buf.length) {
          for (var i = 0, len = buf.length; i < len; ++i) {
            if (~buf[i].indexOf('&')) {
              str = buf[i].replace(/&/g, str).trim();
            } else {
              str += ' ' + buf[i].trim();
            }
          }
        }
        selectors.push(str.trimRight());
      });
    }
  }

  compile(arr, arr.length - 1);

  return selectors;
};

module.exports = function(ast) {
  var builder = new MapBuilder(ast);
  return builder.build();
}

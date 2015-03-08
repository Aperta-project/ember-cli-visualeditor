/* globals ve:true */

// This proxy mimics a ve.ui.Tool instance (as much as needed)
// so that we can use it as 'this' instance for calling ve.ui.Tool.prototype functions on it.
var VeToolProxy = function(tool, veTool) {

  this.tool = tool;
  this.veTool = veTool;
  this.veCommand = ve.ui.commandRegistry.lookup(tool.get('command'));
  this.toolbar = {
    getSurface: function() {
      return tool.getSurface();
    }
  };
  this.constructor = veTool;
};

VeToolProxy.prototype.toggle = function(val) {
  var needToggle = this.tool.get('isVisible') !== val;
  if (needToggle) {
    this.tool.set('isVisible', val);
  }
};

VeToolProxy.prototype.setActive = function(val) {
  this.tool.set('isActive', val);
};

VeToolProxy.prototype.isDisabled = function() {
  return !this.tool.get('isEnabled');
};

VeToolProxy.prototype.setDisabled = function(val) {
  this.tool.set('isEnabled', !val);
};

VeToolProxy.prototype.getCommand = function() {
  return this.veCommand;
};

VeToolProxy.prototype.updateState = function(veState) {
  if (this.veTool) {
    this.veTool.prototype.onUpdateState.call(this, veState.fragment);
  }
};

VeToolProxy.prototype.execute = function() {
  if (this.veTool) {
    this.veTool.prototype.onSelect.call(this);
  }
};

export default VeToolProxy;

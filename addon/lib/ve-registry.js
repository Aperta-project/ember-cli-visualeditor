/* global OO, ve */

var VeRegistry = function (modelRegistry, nodeFactory, annotationFactory, metaItemFactory,
    nodeViewFactory, windowFactory, actionFactory, commandRegistry, toolFactory) {

  this.modelRegistry = modelRegistry;
  this.nodeFactory = nodeFactory;
  this.annotationFactory = annotationFactory;
  this.metaItemFactory = metaItemFactory;
  this.nodeViewFactory = nodeViewFactory;
  this.windowFactory = windowFactory;
  this.actionFactory = actionFactory;
  this.commandRegistry = commandRegistry;
  this.toolFactory = toolFactory;

  var self = this;
  this.extensions = Object.create({
    forEach: function(fn, ctx) {
      for (var name in self.extensions) {
        fn.call(ctx, self.extensions[name], name);
      }
    }
  });
};

function isSubclassOf(B, A) {
  return B.prototype instanceof A || B === A;
}

VeRegistry.prototype.register = function(clazzOrInstance) {
  if (isSubclassOf(clazzOrInstance, ve.dm.Model)) {
    this.registerModel(clazzOrInstance);
  } else if (isSubclassOf(clazzOrInstance, ve.ce.Node)) {
    this.registerNodeView(clazzOrInstance);
  } else if (isSubclassOf(clazzOrInstance, OO.ui.Window)) {
    this.registerWindow(clazzOrInstance);
  } else if (isSubclassOf(clazzOrInstance, ve.ui.Action)) {
    this.registerAction(clazzOrInstance);
  } else if (clazzOrInstance instanceof ve.ui.Command) {
    this.registerCommand(clazzOrInstance);
  } else if (isSubclassOf(clazzOrInstance, ve.ui.Tool)) {
    this.registerTool(clazzOrInstance);
  } else {
    throw new Error("Don't know how to register a class of type" + clazz);
  }
};

VeRegistry.prototype.registerModel = function(modelClass) {
  this.modelRegistry.register(modelClass);
};

VeRegistry.prototype.registerNodeView = function(viewClass) {
  this.nodeViewFactory.register(viewClass);
};

VeRegistry.prototype.registerWindow = function(windowClass) {
  this.windowFactory.register(windowClass);
};

VeRegistry.prototype.registerAction = function(actionClass) {
  this.actionFactory.register(actionClass);
};

VeRegistry.prototype.registerCommand = function(commandClass) {
  this.commandRegistry.register(commandClass);
};

VeRegistry.prototype.registerTool = function(toolClass) {
  this.toolFactory.register(toolClass);
};

VeRegistry.prototype.registerExtension = function(extension) {
  this.extensions[extension.name] = extension;
  extension.register(this);
};

export default VeRegistry;

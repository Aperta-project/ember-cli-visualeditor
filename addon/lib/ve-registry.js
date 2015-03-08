
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

VeRegistry.prototype.register = function(clazz) {
  if (clazz instanceof ve.dm.Model) {
    this.registerModel(clazz);
  } else if (clazz instanceof ve.ce.Node) {
    this.registerNodeView(clazz);
  } else if (clazz instanceof OO.ui.Window) {
    this.registerWindow(clazz)
  } else if (clazz instanceof ve.ui.Action) {
    this.registerAction(clazz)
  } else if (clazz instanceof ve.ui.Command) {
    this.registerCommand(clazz)
  } else if (clazz instanceof ve.ui.Tool) {
    this.registerTool(clazz)
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
};

export default VeRegistry;

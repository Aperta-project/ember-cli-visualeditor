
import VeRegistry from './ve-registry';
import VeState from './ve-state';

function VisualEditor() {
  OO.EventEmitter.call(this);

  // TODO: it would be good to provide the registry in visual-editor core
  // and get rid of the singletons.
  // For now we just use it as if it was so.
  this.registry = new VeRegistry(ve.dm.modelRegistry, ve.dm.nodeFactory, ve.dm.annotationFactory, ve.dm.metaItemFactory,
    ve.ce.nodeFactory, ve.ui.windowFactory, ve.ui.actionFactory, ve.ui.commandRegistry, ve.ui.toolFactory);

  this.document = null;
  this.surface = null;
  this.surfaceUI = null;
  this.state = new VeState();

  this.element = window.document.createElement('div');
  this.$element = $(this.element);

  this.isAttached = false;
  this.inDOM = false;
};

OO.mixinClass( VisualEditor, OO.EventEmitter );

VisualEditor.prototype.registerExtensions = function(extensions) {
  var registry = this.registry;
  extensions.forEach(function(extension) {
    registry.registerExtension(extension);
  });
};

VisualEditor.prototype.dispose = function() {
  if (this.surfaceUI) {
    this._disposeView();
  }
  if (this.surface) {
    this._disposeSurface();
  }
  if (this.docment) {
    this._disposeDocument();
  }
  this.isAttached = false;
  this.inDOM = false;
};

VisualEditor.prototype.disposeView = function() {
  this.__disposeView();
  this.isAttached = false;
  this.inDOM = false;
};

VisualEditor.prototype.fromHtml = function(html) {
  html = html || "";
  var oldHtml = this.toHtml();
  if (oldHtml === html) {
    return;
  }
  // Note: at the moment we can not reuse VisualEditor's surface for different content, i.e., the whole thing needs
  // to be created from scratch. To avoid this unnecessarily to happen we compare the current html with the one provided.
  if (this.document) {
    this._disposeView();
    this._disposeSurface();
    this._disposeDocument();
  }

  var htmlDoc = window.document.implementation.createHTMLDocument();
  var body = htmlDoc.body || htmlDoc.getElementsByTagName('body')[0];
  try {
    body.innerHTML = html;
  } catch (error) {
    // TODO: discuss what to do if the html is corrupted
    body.innerHTML = "<pre>Invalid Document</pre>";
  }
  // Create a dm.Document instance from the input html in the #sample element
  // Note: from the interface we would expect that dm.Converter does not use singletons -- but unfortunately it still does
  var converter = this._createConverter();
  this.document = converter.getModelFromDom(htmlDoc, window.document);
  // Notify extensions before building the node tree
  // so that extensions can hook in things that might be required in the node implmenetations
  this._notifyExtensions('afterDocumentCreated', this.document);
  // Note: this triggers the creation of node instances
  this.document.buildNodeTree();

  // if the surface has been attached already, re-initialize the view automatically
  if (this.isAttached) {
    var surfaceUI = this.getSurfaceView();
    if (this.inDOM) {
      surfaceUI.initialize();
    }
  }
};

VisualEditor.prototype.toHtml = function() {
  if (this.document) {
    var converter = this._createConverter();
    var doc = converter.getDomFromModel(this.document);
    var html = $(doc).find('body').html();
    return html;
  }
};

VisualEditor.prototype.toText =function() {
  if (this.document) {
    var converter = this._createConverter();
    var doc = converter.getDomFromModel(this.document);
    var text = $(doc).find('body').text();
    return text;
  } else {
    return null;
  }
};

VisualEditor.prototype.setCursor = function(charPosition, offset) {
  if (this.surface) {
    var documentNode = this.document.getDocumentNode();
    offset = offset || documentNode.getRange().start;
    var newOffset = documentModel.data.getRelativeContentOffset(offset, charPosition);
    this.surface.setLinearSelection(new ve.Range(newOffset));
  } else {
    console.error('No surface.');
  }
};

VisualEditor.prototype.write = function(string) {
  if (this.surface) {
    var fragment = this.surface.getFragment();
    fragment.insertContent(string);
  } else {
    console.error('No surface.');
  }
};

VisualEditor.prototype.getDocument = function() {
  if (!this.document) {
    this.document = new ve.dm.Document([]);
    this._notifyExtensions('afterDocumentCreated', this.document);
  }
  return this.document;
};

VisualEditor.prototype.getSurface = function() {
  if (!this.surface) {
    var document = this.getDocument();
    // Create a surface model
    this.surface = new ve.dm.Surface(document);
    this.surface.connect(this, {
      'select': this._onSelectionChange,
      'contextChange': this._onContextChange
    });
    this._notifyExtensions('afterSurfaceCreated', this.surface);
  }
  return this.surface;
};

VisualEditor.prototype.getSurfaceView = function() {
  if (!this.surfaceUI) {
    var surface = this.getSurface();
    this.surfaceUI = new ve.ui.DesktopSurface(surface, {
      $element: this.$element
    });
    this._notifyExtensions('afterSurfaceUICreated', this.surface);
  }
  return this.surfaceUI;
};

VisualEditor.prototype.appendTo = function($parent) {
  var surfaceUI = this.getSurfaceView();
  $parent.append(this.$element);
  this.isAttached = true;
};

VisualEditor.prototype.afterInserted = function() {
  var surfaceUI = this.getSurfaceView();
  surfaceUI.initialize();
  this.inDOM = true;
};

VisualEditor.prototype.enable = function() {
  var surfaceUI = this.getSurfaceView();
  surfaceUI.enable();
};

VisualEditor.prototype.disable = function() {
  var surface = this.getSurface();
  var surfaceUI = this.getSurfaceView();
  surface.setNullSelection();
  surfaceUI.disable();
};

VisualEditor.prototype.focus = function() {
  var surfaceUI = this.getSurfaceView();
  surfaceUI.getView().focus();
};


VisualEditor.prototype._notifyExtensions = function(method) {
  var args = Array.prototype.slice.call(arguments, 1);
  this.registry.extensions.forEach(function(extension) {
    if (extension[method]) {
      extension[method].apply(extension, args);
    }
  });
};

VisualEditor.prototype._disposeDocument = function() {
  this._notifyExtensions('beforeDocumentDisposed', this.document);
  this.document.disconnect(this);
  this.document = null;
};

VisualEditor.prototype._disposeSurface = function() {
  this._notifyExtensions('beforeSurfaceDisposed', this.surface);
  this.surface.disconnect(this);
  this.surface = null;
};

VisualEditor.prototype._disposeView = function() {
  this._notifyExtensions('beforeViewDisposed', this.surfaceUI);
  this.surfaceUI.disconnect(this);
  this.surfaceUI.destroy();
  this.surfaceUI = null;
};

VisualEditor.prototype._createConverter = function() {
  var converter = new ve.dm.Converter(this.registry.modelRegistry,
    this.registry.nodeFactory, this.registry.annotationFactory, this.registry.metaItemFactory);
  return converter;
};

VisualEditor.prototype._onSelectionChange = function() {
  this._updateState();
};

VisualEditor.prototype._onContextChange = function() {
  this._updateState();
};

VisualEditor.prototype._updateState = function() {
  if (this.state) {
    this.state.update(this.surface);
  }
  this.emit('state-changed', this.state);
};

export default VisualEditor;

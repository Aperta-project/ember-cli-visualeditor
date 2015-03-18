/* global OO, ve, $ */

import VeRegistry from './ve-registry';
import VeState from './ve-state';

function VisualEditor() {
  OO.EventEmitter.call(this);

  // TODO: it would be good to provide the registry in visual-editor core
  // and get rid of the singletons.
  // For now we just use it as if it was so.
  this.registry = new VeRegistry(ve.dm.modelRegistry, ve.dm.nodeFactory, ve.dm.annotationFactory,
    ve.dm.metaItemFactory, ve.ce.nodeFactory, ve.ui.windowFactory, ve.ui.actionFactory,
    ve.ui.commandRegistry, ve.ui.toolFactory);

  this.document = null;
  this.surface = null;
  this.surfaceUI = null;
  this.state = new VeState(this);

  this.element = window.document.createElement('div');
  this.$element = $(this.element);

  this.isAttached = false;
  this.inDOM = false;

  this.converter = new ve.dm.Converter(this.registry.modelRegistry,
    this.registry.nodeFactory, this.registry.annotationFactory, this.registry.metaItemFactory);
}

OO.mixinClass( VisualEditor, OO.EventEmitter );

VisualEditor.prototype.registerExtensions = function(extensions) {
  var registry = this.registry;
  var doc = this.document;
  var surface = this.surface;
  var surfaceUI = this.surfaceUI;
  extensions.forEach(function(extension) {
    registry.registerExtension(extension);
    if (doc && extension.afterDocumentCreated) {
      extension.afterDocumentCreated.call(extension, doc);
    }
    if (surface && extension.afterSurfaceCreated) {
      extension.afterSurfaceCreated.call(extension, surface);
    }
    if (surfaceUI && extension.afterSurfaceUICreated) {
      extension.afterSurfaceUICreated.call(extension, surfaceUI);
    }
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

VisualEditor.prototype.newDocumentFromHtml = function(html) {
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
  var converter = this.getConverter();
  var doc = converter.getModelFromDom(htmlDoc, window.document);
  // Notify extensions before building the node tree
  // so that extensions can hook in things that might be required in the node implmenetations
  this._notifyExtensions('afterDocumentCreated', doc);
  // Note: this triggers the creation of node instances
  doc.buildNodeTree();
  return doc;
};

VisualEditor.prototype.fromHtml = function(html) {
  html = html || "";
  var oldHtml = this.toHtml();
  if (oldHtml === html) {
    return;
  }
  var surface = this.getSurface();
  var doc = surface.getDocument();
  var all = new ve.dm.LinearSelection(doc, doc.getDocumentNode().getRange());
  var fragment = new ve.dm.SurfaceFragment(surface, all);
  // create a new document and insert it into the fragment
  // Note: we can't use ve.dm.Document.newFromHtml() as we need to
  //   notify the extensions before doc.buildNodeTree() is called
  var newDoc = this.newDocumentFromHtml(html);
  // add a flag to indicate that we are loading now
  doc.isLoading = true;
  fragment.insertDocument(newDoc);
  doc.isLoading = false;
  // let extensions do things after loading
  this._notifyExtensions('afterDocumentLoaded', doc);
  // eliminate undo history
  // Note: tried surface.truncateUndoHistory but didn't work
  doc.completeHistory = [];
  surface.undoStack = [];
  surface.undoIndex = 0;
  surface.newTransactions = [];
};

VisualEditor.prototype.toHtml = function() {
  if (this.document) {
    var converter = this.getConverter();
    var doc = converter.getDomFromModel(this.document);
    var html = $(doc).find('body').html();
    return html;
  }
};

VisualEditor.prototype.toText =function() {
  if (this.document) {
    var converter = this.getConverter();
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
    var newOffset = this.document.data.getRelativeContentOffset(offset, charPosition);
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
    // TODO: there should be a factory in VE to create a proper empty document
    // still this does not work perfectly -- the initial slug is not handled well, and select-all
    // does behave strangely
    var doc = new ve.dm.Document([
      { type: 'paragraph', internal: { generated: 'empty' } },
      { type: '/paragraph' },
      { type: 'internalList' },
      { type: '/internalList' }
    ]);
    doc.connect(this, {
      transact: this._onDocumentTransaction
    });
    // call extensions so that they can initialize the document instance
    this._notifyExtensions('afterDocumentCreated', doc);
    this.document = doc;
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
    this.emit('surface', this.surface);
  }
  return this.surface;
};

VisualEditor.prototype.getSurfaceView = function() {
  if (!this.surfaceUI) {
    var surface = this.getSurface();
    this.surfaceUI = new ve.ui.DesktopSurface(surface, {
      $element: this.$element
    });
    this.$element.append($('<input type="file" id="ve-file-upload">'));
    this._notifyExtensions('afterSurfaceUICreated', this.surface);
    this.emit('view', this.surfaceUI);
  }
  return this.surfaceUI;
};

VisualEditor.prototype.appendTo = function($parent) {
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

// HACK: need to override as ui.Surface,destroy removes the element (which it didn't insert.. grrr)
function _uiSurfaceDestroy() {
  this.model.stopHistoryTracking();
  this.view.destroy();
  this.context.destroy();
  this.dialogs.destroy();
  this.toolbarDialogs.destroy();
  this.globalOverlay.$element.remove();
}

VisualEditor.prototype._disposeView = function() {
  this._notifyExtensions('beforeViewDisposed', this.surfaceUI);
  this.surfaceUI.disconnect(this);
  // HACK: need to use a cusom destroy implementation :(
  _uiSurfaceDestroy.call(this.surfaceUI);
  this.surfaceUI = null;
  this.$element.empty();
};

VisualEditor.prototype.getConverter = function() {
  // HACK: make sure this converter produces compatible data
  // Note: annotated text created by a converter is coupled to a certain
  // store instance where the annotation types get registered during conversion
  if (this.document) {
    this.converter.store = this.document.store;
    this.converter.internalList = this.document.internalList;
  }
  return this.converter;
};

VisualEditor.prototype._onSelectionChange = function() {
  this._updateState();
};

VisualEditor.prototype._onContextChange = function() {
  this._updateState();
};

VisualEditor.prototype._updateState = function() {
  if (this.state.update(this.surface)) {
    this.emit('state-changed', this.state);
  }
};

VisualEditor.prototype._onDocumentTransaction = function() {
  this.state.isDirty = true;
  this.emit('document-change');
};

export default VisualEditor;

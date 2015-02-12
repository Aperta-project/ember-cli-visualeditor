/* globals ve:true, $:true */

import Ember from 'ember';
import SurfaceState from 'ember-cli-visualeditor/lib/surface-state';

var VisualEditorModel = Ember.Object.extend(Ember.Evented, {

  // ve.dm.Surface instance
  surface: null,

  surfaceState: SurfaceState.create(),

  init: function() {
    this._super();
    // initialize with an empty model
    var documentModel = new ve.dm.Document([]);
    var surface = new ve.dm.Surface(documentModel);
    this.set('surface', surface);
  },

  fromHtml: function(html) {
    // Note: at the moment we can not reuse VisualEditor's surface for different content, i.e., the whole thing needs
    // to be created from scratch. To avoid this unnecessarily to happen we compare the current html with the one provided.
    // VE-TODO: see if we can improve VE's API to allow switching the document-model
    var oldHtml = this.toHtml();
    if (!oldHtml || oldHtml !== html) {
      var documentModel;
      if (!html || html.length === 0) {
        documentModel = new ve.dm.Document([
          { type: 'paragraph', internal: { generated: 'wrapper' } },
          { type: '/paragraph' },
        ]);
      } else {
        var htmlDoc = window.document.implementation.createHTMLDocument();
        var body = htmlDoc.body || htmlDoc.getElementsByTagName('body')[0];
        try {
          body.innerHTML = html;
        } catch (error) {
          // TODO: discuss what to do if the html is corrupted
          body.innerHTML = "<pre>Invalid Document</pre>";
        }
        var converter = new ve.dm.Converter(ve.dm.modelRegistry, ve.dm.nodeFactory, ve.dm.annotationFactory, ve.dm.metaItemFactory);
        documentModel = converter.getModelFromDom(htmlDoc, window.document);
      }
      var surface = new ve.dm.Surface(documentModel);
      this.set('surface', surface);
    }
  },

  // A minimalistic version to convert a pieve of HTML to VE linear data
  _convertHtmlToData: function(html) {
    var converter = new ve.dm.Converter(ve.dm.modelRegistry, ve.dm.nodeFactory, ve.dm.annotationFactory, ve.dm.metaItemFactory);
    converter.contextStack = [];
    var el = window.document.createElement('div');
    el.innerHTML = html;
    return converter.getDataFromDomSubtree(el);
  },

  // The collection as array of html strings
  addCollection: function(collectionId, collection) {
    var surface = this.get('surface');
    if (surface) {
      var documentModel = surface.getDocument();
      var internalList = documentModel.getInternalList();
      _.each(collection, function(itemHtml, itemId) {
        try {
          // First insert an InternalItemNode into the InternalList via transaction.
          // This way, the data ownership is given to InternalList and we can
          // apply changes/transactions later
          var linearData = this._convertHtmlToData(itemHtml);
          var insertion = internalList.getItemInsertion(collectionId, itemId, linearData);
          documentModel.commit(insertion.transaction);
          // To be able to retrieve the collection more conveniently
          // the node needs to be registered as a keyed node
          var node = internalList.getItemNode(insertion.index);
          internalList.addNode(collectionId, itemId, internalList.keys.length, node);
        } catch (error) {
          console.error(error);
        }
      }, this);
    } else {
      console.error('No surface.');
    }
  },

  toHtml: function() {
    var surface = this.get('surface');
    if (surface) {
      var documentModel = ve.dm.converter.getDomFromModel(surface.getDocument());
      var html = $(documentModel).find('body').html();
      return html;
    } else {
      return null;
    }
  },

  // getCollection: function(collectionId) {

  // },

  toText: function() {
    var surface = this.get('surface');
    if (surface) {
      var documentModel = ve.dm.converter.getDomFromModel(surface.getDocument());
      var text = $(documentModel).find('body').text();
      return text;
    } else {
      return null;
    }
  },

  setCursor: function(charPosition, offset) {
    var surface = this.get('surface');
    if (surface) {
      var documentModel = surface.getDocument();
      var documentNode = documentModel.getDocumentNode();
      offset = offset || documentNode.getRange().start;
      // TODO: Don't know if this really computes an offset representing
      // the cursor relative to the given offset in terms of plain-text characters
      var newOffset = documentModel.data.getRelativeContentOffset(offset, charPosition);
      surface.setLinearSelection(new ve.Range(newOffset));
    } else {
      console.error('No surface.');
    }
  },

  write: function(string) {
    var surface = this.get('surface');
    if (surface) {
      var fragment = surface.getFragment();
      fragment.insertContent(string);
    } else {
      console.error('No surface.');
    }
  },

  diconnectSurface: function() {
    var surface = this.get('surface');
    if (surface) {
      surface.disconnect(this, {
        'select': 'onSelectionChange',
        'contextChange': 'onContextChange'
      });
    }
  }.observesBefore('surface'),

  connectSurface: function() {
    var surface = this.get('surface');
    if (surface) {
      surface.connect(this, {
        'select': 'onSelectionChange',
        'contextChange': 'onContextChange'
      });
    }
  }.observes('surface'),

  onSelectionChange: function() {
    this.updateState();
  },

  onContextChange: function() {
    this.updateState();
  },

  updateState: function() {
    var surface = this.get('surface');
    var surfaceState = this.get('surfaceState');
    surfaceState.set('fragment', surface.getFragment());
    surfaceState.set('selection', surface.getSelection());
    this.trigger('state-changed', surfaceState);
  },

});

export default VisualEditorModel;

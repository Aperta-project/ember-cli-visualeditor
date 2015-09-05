/* global $ */

import Ember from 'ember';

import VisualEditor from 'ember-cli-visualeditor/lib/visual-editor';

var VisualEditorComponent = Ember.Component.extend({

  isEnabled: false,
  isFocused: false,

  classNameBindings: ['isEnabled:enabled:disabled'],

  // a VisualEditor instance
  visualEditor: null,

  onInit: Ember.on('init', function() {
    var visualEditor = this.get('visualEditor');
    if (!visualEditor) {
      visualEditor = new VisualEditor();
      this.set('visualEditor', visualEditor);
    }
    var initializerContext = this.get('initializerContext');
    var initializer = this.get('initializer');
    initializer.call(initializerContext, this, this.get('data'));

    visualEditor.connect(this, {
      'state-change': this._onStateChange,
      'document-change': this._onDocumentChange,
      'focus-change': this._onFocusChange
    });
  }),

  _beforeInsertElement: Ember.on('willInsertElement', function() {
    var $element = $(this.element);
    if(this.get('editorSelector')) {
      $element = $element.find(this.get('editorSelector'));
    }
    $element.empty();
    this.get('visualEditor').appendTo($element);
  }),

  _afterInsertElement: Ember.on('didInsertElement', function() {
    this.get('visualEditor').afterInserted();
  }),

  _beforeDestroyElement: Ember.on('willDestroyElement', function() {
    this.get('visualEditor').disconnect(this);
    this.get('visualEditor').dispose();
  }),

  enable: function() {
    this.set('isEnabled', true);
    this.get('visualEditor').enable();
  },

  disable: function() {
    this.set('isEnabled', false);
    this.get('visualEditor').disable();
  },

  connect: function() {
    return this.get('visualEditor').connect();
  },

  disconnect: function() {
    return this.get('visualEditor').disconnect();
  },

  freeze: function() {
    return this.get('visualEditor').freeze();
  },

  unfreeze: function() {
    return this.get('visualEditor').unfreeze();
  },

  focus: function() {
    this.get('visualEditor').focus();
    this.set('isFocused', true);
  },

  blur: function() {
    this.get('visualEditor').blur();
    this.set('isFocused', false);
  },

  focusAndSelect: function() {
    // HACK: this brutal hack is necessary, as VE's API for setting
    // a selection programmatically does not work.
    // Though, we observed that the selection can be done via mouse.
    // This hack is simulating such a click by setting the DOM selection directly.
    // What does that mean? VE seems to be able to map DOM selection to model in such
    // cases, but not model to DOM.

    var self = this;
    this.focus();
    if (this.isEmpty()) {
      Ember.run(function() {
        var domSelection = window.getSelection();
        var domRange = document.createRange();
        // when we use the mouse to set the cursor
        // the DOM selection will be in the slug-node of the paragraph, at offset 0.
        var $slug = $(self.element).find('.ve-ce-surface .ve-ce-documentNode > .ve-ce-paragraphNode .ve-ce-branchNode-slug');
        // console.log($slug[0]);
        domRange.setStart($slug[0], 0);
        domSelection.removeAllRanges();
        domSelection.addRange(domRange);
      });
    } else {
      Ember.run(function() {
        var domSelection = window.getSelection();
        var domRange = document.createRange();
        // when we use the mouse to set the cursor
        // the DOM selection will be in the first text-node of the paragraph, at offset 0.
        var $p = $(self.element).find('.ve-ce-surface .ve-ce-documentNode > .ve-ce-paragraphNode');
        // console.log($slug[0]);
        domRange.setStart($p[0].firstChild, 0);
        domSelection.removeAllRanges();
        domSelection.addRange(domRange);
      });
    }
  },

  /* VisualEditor API delegation */

  registerExtension: function(extension) {
    this.get('visualEditor').registerExtension(extension);
  },

  registerExtensions: function(extensions) {
    this.get('visualEditor').registerExtensions(extensions);
  },

  getDocument: function() {
    return this.get('visualEditor').getDocument();
  },

  getSurface: function() {
    return this.get('visualEditor').getSurface();
  },

  getSurfaceView: function() {
    return this.get('visualEditor').getSurfaceView();
  },

  fromHtml: function(html) {
    this.get('visualEditor').fromHtml(html);
  },

  toHtml: function() {
    return this.get('visualEditor').toHtml();
  },

  isEmpty: function() {
    return this.get('visualEditor').isEmpty();
  },

  breakpoint: function() {
    return this.get('visualEditor').breakpoint();
  },

  toText: function() {
    return this.get('visualEditor').toText();
  },

  setCursor: function(charPosition, offset) {
    this.get('visualEditor').setCursor(charPosition, offset);
  },

  selectAll: function() {
    this.get('visualEditor').selectAll();
  },

  write: function(text) {
    this.get('visualEditor').write(text);
  },

  // TODO: instead of asking the low-level editor for its state
  // we should use an Ember property which we update _onStateChange.
  getState: function() {
    return this.get('visualEditor').getState();
  },

  _onStateChange: function(veState) {
    /* jshint unused: false */
    this.trigger('state-change', veState);
  },

  _onDocumentChange: function(veTransaction) {
    this.trigger('document-change', veTransaction);
  },

  _onFocusChange: function(focused) {
    this.set('isFocused', focused);
  }

});

export default VisualEditorComponent;

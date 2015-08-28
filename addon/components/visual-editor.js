/* global $ */

import Ember from 'ember';

import VisualEditor from 'ember-cli-visualeditor/lib/visual-editor';

var VisualEditorComponent = Ember.Component.extend({

  isEnabled: false,
  isFocused: false,

  classNameBindings: ['isEnabled:enabled:disabled'],

  // A VisualEditor instance
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
      'state-changed': this.onStateChange,
      'document-change': this.onDocumentChange
    });
  }),

  beforeInsertElement: Ember.on('willInsertElement', function() {
    var $element = $(this.element).empty();
    this.visualEditor.appendTo($element);
  }),

  afterInsertElement: Ember.on('didInsertElement', function() {
    this.visualEditor.afterInserted();
  }),

  beforeDestroyElement: Ember.on('willDestroyElement', function() {
    this.visualEditor.disconnect(this);
    this.visualEditor.dispose();
  }),

  enable: function() {
    this.set('isEnabled', true);
  },

  disable: function() {
    this.set('isEnabled', false);
  },

  onEnabled: Ember.observer('isEnabled', function() {
    if (this.get('isEnabled')) {
      this.visualEditor.enable();
    } else {
      this.visualEditor.disable();
    }
  }),

  focus: function() {
    this.visualEditor.focus();
    this.set('isFocused', true);
  },

  /* VisualEditor API delegation */

  registerExtensions: function(extensions) {
    this.visualEditor.registerExtensions(extensions);
  },

  getDocument: function() {
    return this.visualEditor.getDocument();
  },

  getSurface: function() {
    return this.visualEditor.getSurface();
  },

  getSurfaceView: function() {
    return this.visualEditor.getSurfaceView();
  },

  fromHtml: function(html) {
    this.visualEditor.fromHtml(html);
  },

  toHtml: function() {
    return this.visualEditor.toHtml();
  },

  breakpoint: function() {
    return this.visualEditor.breakpoint();
  },

  toText: function() {
    return this.visualEditor.toText();
  },

  setCursor: function(charPosition, offset) {
    this.visualEditor.setCursor(charPosition, offset);
  },

  write: function(text) {
    this.visualEditor.write(text);
  },

  onStateChange: function(veState) {
    /* jshint unused: false */
    this.trigger('state-change', veState);
  },

  onDocumentChange: function(veTransaction) {
    this.trigger('document-change', veTransaction)
  },

});

export default VisualEditorComponent;

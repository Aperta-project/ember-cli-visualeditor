/* global $ */

import Ember from 'ember';

import VisualEditor from 'ember-cli-visualeditor/lib/visual-editor';

var VisualEditorComponent = Ember.Component.extend({

  isEnabled: false,
  isFocused: false,

  classNameBindings: ['isEnabled:enabled:disabled'],

  // a VisualEditor instance
  visualEditor: null,

  init: function() {
    this._super();

    var visualEditor = this.get('visualEditor');
    if (!visualEditor) {
      visualEditor = new VisualEditor();
      this.set('visualEditor', visualEditor);
    }
    this.set('visualEditor', visualEditor);

    if (this.setupEditor) {
      this.setupEditor();
      this.start();
    }
  },

  start: function() {
    this.get('visualEditor').connect(this, {
      'state-changed': this.onStateChange,
      'document-change': this.onDocumentChange
    });
  },

  stop: function() {
    this.get('visualEditor').disconnect(this);
  },

  beforeInsertElement: Ember.on('willInsertElement', function() {
    var $element = $(this.element).empty();
    this.get('visualEditor').appendTo($element);
  }),

  afterInsertElement: Ember.on('didInsertElement', function() {
    this.get('visualEditor').afterInserted();
  }),

  beforeDestroyElement: Ember.on('willDestroyElement', function() {
    this.stop();
    this.get('visualEditor').dispose();
  }),

  enable: function() {
    this.set('isEnabled', true);
  },

  disable: function() {
    this.set('isEnabled', false);
  },

  onEnabled: Ember.observer('isEnabled', function() {
    if (this.get('isEnabled')) {
      this.get('visualEditor').enable();
    } else {
      this.get('visualEditor').disable();
    }
  }),

  focus: function() {
    this.get('visualEditor').focus();
    this.set('isFocused', true);
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

  breakpoint: function() {
    return this.get('visualEditor').breakpoint();
  },

  toText: function() {
    return this.get('visualEditor').toText();
  },

  setCursor: function(charPosition, offset) {
    this.get('visualEditor').setCursor(charPosition, offset);
  },

  write: function(text) {
    this.get('visualEditor').write(text);
  },

  onStateChange: function(veState) {
    /* jshint unused: false */
    this.trigger('state-change', veState);
  },

  onDocumentChange: function(veTransaction) {
    this.trigger('document-change', veTransaction);
  },

});

export default VisualEditorComponent;

/* global $ */

import Ember from 'ember';

import VisualEditor from 'ember-cli-visualeditor/lib/visual-editor';

var VisualEditorComponent = Ember.Component.extend({

  isEnabled: false,
  isFocused: false,

  classNameBindings: ['isEnabled:enabled:disabled'],

  model: null,

  // initialized via template
  initializerContext: null,

  initializer: function(model, data) {
    // jshint unused:false
  },

  onInit: Ember.on('init', function() {
    var model = this.get('model');
    if (!model) {
      model = new VisualEditor();
      this.set('model', model);
    }
    var initializerContext = this.get('initializerContext');
    var initializer = this.get('initializer');
    initializer.call(initializerContext, model, this.get('data'));

    model.connect(this, { 'state-changed': this.onStateChanged });
  }),

  beforeInsertElement: Ember.on('willInsertElement', function() {
    var $element = $(this.element).empty();
    this.model.appendTo($element);
  }),

  afterInsertElement: Ember.on('didInsertElement', function() {
    this.model.afterInserted();
  }),

  beforeDestroyElement: Ember.on('willDestroyElement', function() {
    this.model.disconnect(this);
    this.model.dispose();
  }),

  enable: function() {
    this.set('isEnabled', true);
  },

  disable: function() {
    this.set('isEnabled', false);
  },

  onEnabled: Ember.observer('isEnabled', function() {
    if (this.get('isEnabled')) {
      this.model.enable();
    } else {
      this.model.disable();
    }
  }),

  focus: function() {
    this.model.focus();
    this.set('isFocused', true);
  },

  /* VisualEditor API delegation */

  registerExtensions: function(extensions) {
    this.model.registerExtensions(extensions);
  },

  getDocument: function() {
    return this.model.getDocument();
  },

  getSurface: function() {
    return this.model.getSurface();
  },

  getSurfaceView: function() {
    return this.model.getSurfaceView();
  },

  fromHtml: function(html) {
    this.model.fromHtml(html);
  },

  toHtml: function() {
    return this.model.toHtml();
  },

  toText: function() {
    return this.model.toText();
  },

  setCursor: function(charPosition, offset) {
    this.model.setCursor(charPosition, offset);
  },

  write: function(text) {
    this.model.write(text);
  },

  onStateChanged: function(veState) {
    this.trigger('state-changed', veState);
  },

});

export default VisualEditorComponent;

/* global $ */

import Ember from 'ember';

import VisualEditor from 'ember-cli-visualeditor/lib/visual-editor';

var VisualEditorComponent = Ember.Component.extend({

  isEnabled: false,
  isFocused: false,

  classNameBindings: ['isEnabled:enabled:disabled'],

  onInit: function() {
    this.set('model', new VisualEditor());
  }.on('init'),

  beforeInsertElement: function() {
    var $element = $(this.element).empty();
    this.model.appendTo($element);
  }.on('willInsertElement'),

  afterInsertElement: function() {
    this.model.afterInserted();
  }.on('didInsertElement'),

  beforeDestroyElement: function() {
    this.model.disposeView();
  }.on('willDestroyElement'),

  enable: function() {
    this.set('isEnabled', true);
  },

  disable: function() {
    this.set('isEnabled', false);
  },

  onEnabled: function() {
    if (this.get('isEnabled')) {
      this.model.enable();
    } else {
      this.model.disable();
    }
  }.observes('isEnabled'),

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

});

export default VisualEditorComponent;

/* global $ */

import Ember from 'ember';

var Toolbar = Ember.Component.extend({

  // disable per default
  classNames: ["ve-toolbar", "disabled"],

  editorState: null,

  onDestroy: function() {
    var visualEditor = this.get('visualEditor');
    if(visualEditor) {
      visualEditor.off('state-changed', this, this.onVeStateChanged);
    }
  }.on('willDestroyElement'),

  // recursive function to collect all Tool instances from this view tree
  extractTools: function() {
    var tools = [];
    var toolbar = this;
    var _extractTools = function(view) {
      // HACK: ducktyping check if the view is an Ember.Component
      if (!view.get) {
        return;
      }
      if (view.get('needsToolbar')) {
        view.set('toolbar', toolbar);
      }
      if (view.get('needsSurfaceUpdate')) {
        tools.push(view);
      }
      var childViews = view.get('childViews');
      if (childViews) {
        childViews.forEach(function(childView) {
          _extractTools(childView);
        });
      }
    };
    _extractTools(this);
    return tools;
  },

  tools: function() {
    return this.extractTools(this);
  }.property('childViews.@each'),

  updateState: function(newState, selectedTools) {
    this.set('editorState', newState);
    if (newState.selection.isNull()) {
      $(this.element).addClass('disabled');
    } else {
      $(this.element).removeClass('disabled');
    }
    var toolMask = null;
    if (selectedTools) {
      toolMask = {};
      for (var i = 0; i < selectedTools.length; i++) {
        toolMask[selectedTools[i]] = true;
      }
    }
    var tools = this.get('tools');
    window.setTimeout(function() {
      tools.forEach(function(tool) {
        // when a tool mask is given only update specified tools
        // and disable the others
        if (!toolMask || toolMask[tool.get('command')]) {
          tool.updateState(newState);
        } else {
          tool.set('isEnabled', false);
        }
      });
    }, 0);
  },

  getEditor: function() {
    return this.get('editorState').getEditor();
  },

});

export default Toolbar;

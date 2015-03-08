/* global $ */

import Ember from 'ember';

var Toolbar = Ember.Component.extend({

  // disable per default
  classNames: ["ve-toolbar", "disabled"],

  visualEditor: null,

  tools: null,

  initVisualEditor: function() {
    var visualEditor = this.get('visualEditor');
    if(visualEditor) {
      visualEditor.on('state-changed', this, this.onVeStateChanged);
    } else {
      console.error('Could not connect to VisualEditor.');
    }
  }.observes('visualEditor'),

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

  // Lazy getter for the array of tools contained in this toolbar.
  // The first time all tools are extracted, and cached afterwards (no invalidation)
  getTools: function() {
    var tools = this.get('tools');
    if (!tools) {
      tools = this.extractTools(this);
      this.set('tools', tools);
    }
    return tools;
  },

  onVeStateChanged: function(veState) {
    if (veState.selection.isNull()) {
      $(this.element).addClass('disabled');
    } else {
      $(this.element).removeClass('disabled');
    }
    var tools = this.getTools();
    tools.forEach(function(tool) {
      tool.updateState(veState);
    });
  },

});

export default Toolbar;

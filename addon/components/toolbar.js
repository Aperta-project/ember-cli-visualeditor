/* global $ */

import Ember from 'ember';

var Toolbar = Ember.Component.extend({

  // disable per default
  classNames: ["ve-toolbar", "disabled"],

  editorState: null,

  onDestroy: Ember.on('willDestroyElement', function() {
    var visualEditor = this.get('visualEditor');
    if(visualEditor) {
      visualEditor.off('state-changed', this, this.onVeStateChanged);
    }
  }),

  // recursive function to collect all Tool and ToolGroup instances from this view tree
  extractToolbarComponents: function() {
    var tools = [];
    var toolGroups = [];
    var toolbar = this;
    var _extractToolbarComponents = function(view) {
      // HACK: duck-typed check if the view is an Ember.Component
      if (!view.get) {
        return;
      }
      if (view.get('needsToolbar')) {
        view.set('toolbar', toolbar);
      }
      if (view.get('needsSurfaceUpdate')) {
        if (view.get('isTool')) {
          tools.push(view);
        } else if (view.get('isToolGroup')) {
          toolGroups.push(view);
        }
      }
      var childViews = view.get('childViews');
      if (childViews) {
        childViews.forEach(function(childView) {
          _extractToolbarComponents(childView);
        });
      }
    };
    _extractToolbarComponents(this);
    return {
      tools: tools,
      toolGroups: toolGroups
    };
  },

  toolbarComponents: Ember.computed('childViews.@each', function() {
    return this.extractToolbarComponents(this);
  }),

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
    var toolbarComponents = this.get('toolbarComponents');
    toolbarComponents.tools.forEach(function(tool) {
      // when a tool mask is given only update specified tools
      // and disable the others
      if (!toolMask || toolMask[tool.get('command')]) {
        tool.updateState(newState);
      } else {
        tool.set('isEnabled', false);
      }
    });
    toolbarComponents.toolGroups.forEach(function(toolGroup) {
      toolGroup.updateState(newState);
    });
  },

  getEditor: function() {
    return this.get('editorState').getEditor();
  },

});

export default Toolbar;

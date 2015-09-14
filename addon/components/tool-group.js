import Ember from 'ember';

var ToolGroup = Ember.Component.extend({
  isToolGroup: true,
  name: null,
  classNames: ['ve-tool-group'],

  init: function() {
    this._super();
    var name = this.get('name');
    if (name) {
      // HACK: since deactivating prototype extensions
      // classNames are not provided as strings anymore
      var classNames = this.get('classNames');
      if (!Ember.isArray(classNames)) {
        this.set('classNames', classNames + " " + name);
      } else {
        this.get('classNames').push(name);
      }
    }
  },

  updateState: function(surfaceState) {
    this._super(surfaceState);

    var children = this.get('childViews');
    var isDisabled = true;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.get('isEnabled')) {
        isDisabled = false;
        break;
      }
    }
    this.set('isDisabled', isDisabled);
  },

});

export default ToolGroup;

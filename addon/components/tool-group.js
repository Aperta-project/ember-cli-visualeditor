import Ember from 'ember';

var ToolGroup = Ember.Component.extend({
  isToolGroup: true,
  name: null,
  classNames: ['ve-tool-group'],
  classNameBindings: ['_classNames', 'name'],

  init: function() {
    this._super();
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

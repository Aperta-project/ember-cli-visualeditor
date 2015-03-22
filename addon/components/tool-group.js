import Ember from 'ember';

var ToolGroup = Ember.Component.extend({
  name: null,
  classNames: ['ve-tool-group'],

  init: function() {
    this._super();
    var name = this.get('name');
    if (name) {
      this.get('classNames').push(name);
    }
  },

  updateState: function(surfaceState) {
    this._super(surfaceState);

    var self = this;
    var children = this.get('childViews');
    window.setTimeout(function() {
      var isDisabled = true;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.get('isEnabled')) {
          isDisabled = false;
          break;
        }
      }
      self.set('isDisabled', isDisabled);
    }, 0);
  },

});

export default ToolGroup;

/* globals $:true */

import ToolGroup from './tool-group';

export default ToolGroup.extend({

  tagName: ["select"],
  classNames: ['ve-select'],

  isDisabled: true,
  disabledBinding: 'isDisabled',

  needsSurfaceUpdate: true,

  _options: {},

  didInsertElement: function() {
    this._super();

    var _options = this.get('_options');
    var options = this.get('childViews');
    options.forEach(function(option) {
      var commandName = option.get('command');
      _options[commandName] = option;
    });

    this.element.value = " ";
    this.element.disabled = true;

    var self = this;
    $(this.element).change(function(e) {
      self.onChange(e);
    });
  },

  onDisabled: Ember.observer('isDisabled', function() {
    if (this.get('isDisabled')) {
      this.element.disabled = true;
      this.element.value = " ";
    } else {
      this.element.disabled = false;
    }
  }),

  onChange: function(ev) {
    var options = this.get('_options');
    var option = options[ev.target.value];
    if (option) {
      option.executeCommand();
    }
  },

});

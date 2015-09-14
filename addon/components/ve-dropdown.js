/* global $ */

import ToolGroup from 'ember-cli-visualeditor/components/tool-group';

var VeDropdownComponent = ToolGroup.extend({
  classNames: ["ve-tool-group", "dropdown"],

  isDisabled: true,
  disabledBinding: 'isDisabled',
  classNameBindings: ['isDisabled:disabled:enabled'],

  needsSurfaceUpdate: true,

  // Note: this is important to prevent the event default which would blur VisualEditor
  mouseDown: function() {
    return false;
  },

  onDisabledChange: Ember.observer('isDisabled', function() {
    var isDisabled = this.get('isDisabled');
    var $toggle = $(this.element).find('*[data-toggle=dropdown]');
    if (isDisabled) {
      $toggle.addClass('disabled');
    } else {
      $toggle.removeClass('disabled');
    }
  }),

});

export default VeDropdownComponent;

/* global $ */

import ToolGroup from './tool-group';
import layout from '../templates/components/ve-dropdown';

var VeDropdownComponent = ToolGroup.extend({
  layout: layout,
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

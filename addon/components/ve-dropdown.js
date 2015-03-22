/* global $ */

import ToolGroup from 'ember-cli-visualeditor/components/tool-group';

var VeDropdownComponent = ToolGroup.extend({
  classNames: ["dropdown", "ve-tool-group"],

  isDisabled: true,
  disabledBinding: 'isDisabled',
  classNameBindings: ['isDisabled:disabled:enabled'],

  needsSurfaceUpdate: true,

  updateState: function(surfaceState) {
    this._super(surfaceState);

    var options = this.get('childViews');
    var isDisabled = true;
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      if (option.get('isEnabled')) {
        isDisabled = false;
        break;
      }
    }
    this.set('isDisabled', isDisabled);
  },

  // Note: this is important to prevent the event default which would blur VisualEditor
  mouseDown: function() {
    return false;
  },

  onDisabledChange: function() {
    var isDisabled = this.get('isDisabled');
    var $toggle = $(this.element).find('*[data-toggle=dropdown]');
    if (isDisabled) {
      $toggle.addClass('disabled');
    } else {
      $toggle.removeClass('disabled');
    }
  }.observes('isDisabled'),

});

export default VeDropdownComponent;

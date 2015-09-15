/* global $ */

import Tool from 'ember-cli-visualeditor/components/tool';
import layout from '../templates/components/ve-item';

var VeItemComponent = Tool.extend({
  layout: layout,
  tagName: 'li',
  classNames: ["dropdown-item"],
  attributeBindings: ['role'],
  role: 'presentation',
  classNameBindings: ['isEnabled:enabled:disabled'],

  command: null,

  willInsertElement: function() {
    var self = this;
    $(this.element).find('*[role=menuitem]')
      .click(function(e) {
        e.preventDefault();
        self.onClickItem();
      });
  },

  onClickItem: function() {
    if (this.get('isEnabled')) {
      this.executeCommand();
    }
  },

});

export default VeItemComponent;

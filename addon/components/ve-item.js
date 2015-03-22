/* global $ */

import Tool from 'ember-cli-visualeditor/components/tool';

var VeItemComponent = Tool.extend({

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

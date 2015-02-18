/* global $ */

import Tool from './tool';

var Button = Tool.extend({
  classNames: ["ve-button"],

  willInsertElement: function() {
    var self = this;
    // HACK: Ember seems to catch the events first and binding on 'click' doesn't work,
    // but it works when preventing mousedown.
    $(this.element).on('mousedown', function(ev) {
      ev.stopPropagation();
      ev.preventDefault();
    });
    $(this.element).on('click', function(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      if (self.get('isEnabled')) {
        self.executeCommand();
      }
    });
  },

});

export default Button;

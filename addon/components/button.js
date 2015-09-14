import Tool from './tool';

var Button = Tool.extend({

  classNames: ["ve-button btn"],

  tagName: 'a',

  href: '#',

  click: function() {
    if (this.get('isEnabled')) {
      this.executeCommand();
    }
    return false;
  },
});

export default Button;

import CustomTool from './custom-tool';
import layout from '../templates/components/ve-item';

var VeCustomItemComponent = CustomTool.extend({
  layout: layout,
  tagName: 'li',
  classNames: ["dropdown-item"],

  mouseDown: function(e) {
    return false;
  },

  click: function(e) {
    this.sendAction('handleClick');
    e.preventDefault();
    e.stopPropagation();
  },

});

export default VeCustomItemComponent;

import Tool from './tool';

var SelectOption = Tool.extend({
  tagName: 'option',
  classNames: ["ve-option"],

  willInsertElement: function() {
    this._super();
    this.element.value = this.get('command');
  },

  onIsActive: Ember.observer('isActive', function() {
    if (this.get('isActive')) {
      this.element.selected = true;
    } else {
      this.element.selected = false;
    }
  }),
});

export default SelectOption;

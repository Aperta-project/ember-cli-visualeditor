import Ember from 'ember';

var CustomTool = Ember.Component.extend(Ember.Evented, {
  classNames: ["ve-tool"],

  isTool: true,
  toolbar: null,
  needsToolbar: true,

  isVisible: true,
  isEnabled: true,
  isActive: false,

  classNameBindings: ['_classNames', 'isVisible::hidden', 'isEnabled:enabled:disabled', 'isActive:active:', 'command'],
});


export default CustomTool;

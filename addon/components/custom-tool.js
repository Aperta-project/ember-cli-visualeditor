import Ember from 'ember';

var CustomTool = Ember.Component.extend(Ember.Evented, {
  isTool: true,
  classNames: ["ve-tool"],

  isVisible: true,
  isEnabled: true,
  isActive: false,

  classNameBindings: ['isVisible::hidden', 'isEnabled:enabled:disabled', 'isActive:active:', 'command'],

  toolbar: null,
  proxy: null,

  needsToolbar: true

});


export default CustomTool;

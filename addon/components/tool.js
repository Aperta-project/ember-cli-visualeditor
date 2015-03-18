/* globals ve:true */

import Ember from 'ember';
import VeToolProxy from '../lib/ve-tool-proxy';

var Tool = Ember.Component.extend(Ember.Evented, {

  classNames: ["ve-tool"],
  command: null,

  isVisible: true,
  isEnabled: false,
  isActive: false,

  classNameBindings: ['isVisible::hidden', 'isEnabled:enabled:disabled', 'isActive:active:'],

  toolbar: null,
  proxy: null,

  needsToolbar: true,
  needsSurfaceUpdate: true,

  // Instantiates a ve.ui.Tool and monkey-patches it to bind it to this ember object.
  init: function() {
    this._super();
    var commandName = this.get('command');
    var veTool = ve.ui.toolFactory.lookup(commandName);
    this.set('proxy', new VeToolProxy(this, veTool));
  },

  updateState: function(veState) {
    this.get('proxy').updateState(veState);
  },

  executeCommand: function() {
    // Note: this is a bit twisted. To work on the current surface instance,
    // the proxy calls this.getSurface
    this.get('proxy').execute();
  },

  getSurface: function() {
    return this.get('toolbar').getEditor().getSurfaceView();
  },

});


export default Tool;

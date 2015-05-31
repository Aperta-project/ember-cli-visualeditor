/* jshint node: true */
'use strict';

var merge = require('merge');

module.exports = {
  name: 'ember-cli-visualeditor',

  getOptions: function(app) {
    // Precedence:
    // 1. app/config/environment.js
    // 2. app/Brocfile.js (EmberApp options)
    // 3. addon/configuration/environment.js
    return merge(this.config(app.env)[this.name],
        this.options,
        this.project.config(app.env)[this.name]);
  },

  included: function included(app) {
    var fingerprint = app.options.fingerprint;
    if (fingerprint) {
      fingerprint.exclude = fingerprint.exclude || [];
      fingerprint.exclude.push(this.name);
    }
  },

};

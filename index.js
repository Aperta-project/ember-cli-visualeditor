/* jshint node: true */
'use strict';

var merge = require('merge');

module.exports = {
  name: 'ember-cli-visualeditor',

  treeForPublic: function() {
    return this.mergeTrees([
      this.pickFiles('node_modules/' + this.name + '/vendor/i18n/', {
        srcDir: '/',
        destDir: 'assets/' + this.name + '/i18n/'
      }),
      this.pickFiles('node_modules/' + this.name + '/vendor/styles/', {
        srcDir: '/',
        destDir: 'assets/' + this.name + '/styles/'
      }),
      this.pickFiles('node_modules/' + this.name + '/vendor/', {
        srcDir: '/',
        destDir: 'assets/' + this.name + '/',
        files: [
          'visualEditor-base.js',
          'visualEditor-model.js',
          'visualEditor-ui.js'
        ]
      })
    ]);
  },

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

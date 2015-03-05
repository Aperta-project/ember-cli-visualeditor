/* globals ve: true, $: true */

import veMock from '../lib/ve-mock';

var _loadedScripts = {};

var _scripts = [
  'visualEditor-base.js',
  'visualEditor-model.js',
  'visualEditor-ui.js'
];

// This version injects a script instead of using global.eval
// which eases debugging (e.g., stacktraces make sense)
var injectScript = function(src, cb) {
  console.log('#### Load script %s', src);
  if (_loadedScripts[src]) {
    return cb();
  }
  var headEl = document.head || document.getElementsByTagName("head")[0];
  var scriptEl = window.document.createElement('script');
  scriptEl.type = "text\/javascript";
  scriptEl.src = src;
  scriptEl.onload = function() {
    _loadedScripts[src] = true;
    cb();
  };
  scriptEl.onerror = function (error) {
    var err = new URIError("The script " + error.target.src + " is not accessible.");
    console.error('Could not load', src);
    cb(err);
  };
  headEl.appendChild(scriptEl);
};

var initializeVisualEditor = function(env) {
  // TODO: is there a way to get the addon name programmatically
  // so that we do not have 'ember-cli-visualeditor' as literal here
  var options = env["ember-cli-visualeditor"] || {};

  if (options.useMock) {
    window.ve = veMock;
    return;
  }

  var assetsRoot = options.assetsRoot || "";
  // append a trailing "/" to the assets route
  if (assetsRoot[assetsRoot.length-1] !== "/") {
    assetsRoot += "/";
  }

  function _initPlatform() {
    // HACK: this produces a failing request with fallback to 'en'
    // so we use 'en' right away
    if ($.i18n().locale.toLowerCase() === "en-us") {
      $.i18n().locale = "en";
    }
    // TODO: make this configurable
    ve.init.platform.addMessagePath(assetsRoot + 'ember-cli-visualeditor/i18n/oojs-ui/');
    ve.init.platform.addMessagePath(assetsRoot + 'ember-cli-visualeditor/i18n/ve/');
    return ve.init.platform.initialize();
  }

  // if assets are included in the bundle, then just initialize the platform
  var promise = window.jQuery.Deferred();

  var i = 0;
  var loadScript = function(err) {
    if (err) {
      promise.reject(err);
    } else if (i >= _scripts.length) {
      promise.resolve();
    } else {
      var scriptUrl = assetsRoot + "ember-cli-visualeditor/"+_scripts[i++];
      injectScript(scriptUrl, loadScript);
    }
  };

  promise.done(function() {
    var stylesheet = assetsRoot + "ember-cli-visualeditor/styles/visualEditor.css";
    if (!_loadedScripts[stylesheet]) {
      $('<link/>', {
         rel: 'stylesheet',
         type: 'text/css',
         href: stylesheet
      }).appendTo('head');
      _loadedScripts[stylesheet] = true;
    }

    return _initPlatform();
  }).fail(function() {
    console.error('Failed to load assets for ember-cli-visualeditor', arguments);
  });

  // start the loading sequence
  loadScript();

  return promise;
};

export default initializeVisualEditor;

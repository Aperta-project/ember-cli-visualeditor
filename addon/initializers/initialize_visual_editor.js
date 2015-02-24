/* globals ve: true, $: true */

import veMock from '../lib/ve-mock';


var _loadedScripts = {};

// This version injects a script instead of using global.eval
// which eases debugging (e.g., stacktraces make sense)
var injectScript = function(src) {
  var promise = window.jQuery.Deferred();

  if (_loadedScripts[src]) {
    return promise.resolve();
  }

  var headEl = document.head || document.getElementsByTagName("head")[0];
  var scriptEl = window.document.createElement('script');
  scriptEl.type = "text\/javascript";
  scriptEl.src = src;
  scriptEl.onload = function() {
    promise.resolve();
    _loadedScripts[src] = true;
  };
  scriptEl.onerror = function (error) {
    console.error('Could not load', src);
    promise.reject(new URIError("The script " + error.target.src + " is not accessible."));
  };
  headEl.appendChild(scriptEl);
  return promise;
};

var loadScriptWithEval = function(src) {
  var promise = window.jQuery.Deferred();
  if (_loadedScripts[src]) {
    return promise.resolve();
  }

  $.ajax(src, {
    method: "GET",
    cache: false,
    error: function(xhr, status, msg) {
      promise.reject(msg);
    },
    success: function(data) {
      try {
        window.jQuery.globalEval(data);
        _loadedScripts[src] = true;
        promise.resolve();
      } catch (err) {
        console.error('Could not evaluate loaded script', err.stack);
        promise.reject(err);
      }
    }
  });

  return promise;
};

var initializeVisualEditor = function(env) {
  // TODO: is there a way to get the addon name programmatically
  // so that we do not have 'ember-cli-visualeditor' as literal here
  var options = env["ember-cli-visualeditor"] || {};

  if (options.useMock) {
    window.ve = veMock;
    return;
  }

  var assetsRoot = env["baseURL"] + (options.assetsRoot || "");
  // append a trailing "/" to the assets route
  if (assetsRoot[assetsRoot.length-1] !== "/") {
    assetsRoot += "/";
  }

  // if option 'includeAssets' is used, scripts and stylesheets are
  // imported via ember-cli-visualeditor/index.js
  var scriptsAlreadyImported = options.includeAssets;
  var useEval = options.useEval;

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
  if (scriptsAlreadyImported || options.manual) {
    return _initPlatform();
  } else {
    var promise;
    var scriptSrc;

    // throw if VE has already been loaded
    if (window.ve && window.ve.dm && window.ve.dm.Surface) {
      throw new Error('ember-cli-visualeditor: Invalid configuration. ' + JSON.stringify(options));
    }

    if (env.environment === "production" && !options.forceUnminified) {
      scriptSrc = assetsRoot + "ember-cli-visualeditor/visualEditor.min.js";
    } else {
      scriptSrc = assetsRoot + "ember-cli-visualeditor/visualEditor.js";
    }

    if (useEval) {
      promise = loadScriptWithEval(scriptSrc);
    } else {
      promise = injectScript(scriptSrc);
    }

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

    return promise;
  }
};

export default initializeVisualEditor;

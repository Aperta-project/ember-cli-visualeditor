/* globals ve, $*/

import LazyLoader from 'ember-cli-lazyloader/lib/lazy-loader';

var _scripts = [
  'visualEditor-base.js',
  'visualEditor-model.js',
  'visualEditor-ui.js'
];

function initPlatform(assetsRoot) {
  // HACK: For now we only serve assets for the British locale
  $.i18n().locale = "en";
  // TODO: make this configurable
  ve.init.platform.addMessagePath(assetsRoot + 'i18n/oojs-ui/');
  ve.init.platform.addMessagePath(assetsRoot + 'i18n/ve/');
  return ve.init.platform.initialize();
}

var loadVeAssets = function(env) {
  // TODO: is there a way to get the addon name programmatically
  // so that we do not have 'ember-cli-visualeditor' as literal here
  var options = env["ember-cli-visualeditor"] || {};

  var assetsRoot = options.assetsRoot || "";
  // append a trailing "/" to the assets route
  if (assetsRoot[assetsRoot.length-1] !== "/") {
    assetsRoot += "/";
  }
  assetsRoot += "ember-cli-visualeditor/";

  var scripts = _scripts.map(function(uri) {
    return assetsRoot +  uri;
  });

  var promise = LazyLoader.loadScripts(scripts);

  promise.then(function() {
    var stylesheet = assetsRoot + "styles/visualEditor.css";
    LazyLoader.loadCSS(stylesheet);
    return initPlatform(assetsRoot);
  }).catch(function() {
    console.error('Failed to load assets for ember-cli-visualeditor', arguments);
  });

  return promise;
};

export default loadVeAssets;

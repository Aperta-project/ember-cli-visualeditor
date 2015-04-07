
var _ = require('lodash');
var path = require('path');

var veModules = require('visualeditor/build/modules.json');

function getVeFileList(key, re) {
  var srcDir = 'node_modules/visualeditor';
  var files = veModules[key].scripts;
  var result = [];
  _.each(files, function(f) {
    if (_.isString(f)) {
      if (!re || re.exec(f)) {
        result.push(path.join(srcDir, f));
      }
    }
  });
  console.log("## VisualEditor files for (%s, %s): %s", key, (re && re.toString()), JSON.stringify(result, null, 2));
  return result;
}

/*jshint node:true */
module.exports = function ( grunt ) {
  grunt.loadNpmTasks('grunt-subgrunt');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.initConfig({
    clean: {
      vendor: [ 'vendor/*' ]
    },
    subgrunt: {
      visualeditor: {
        projects: {
          'node_modules/visualeditor': [ 'build' ]
        }
      }
    },
    copy: {
      "ve-i18n": {
        expand: true,
        cwd: 'node_modules/visualeditor/i18n/',
        src: '*',
        dest: 'vendor/i18n/ve/'
      },
      "oojs-i18n": {
        expand: true,
        cwd: 'node_modules/visualeditor/lib/oojs-ui/i18n/',
        src: '*',
        dest: 'vendor/i18n/oojs-ui/'
      },
      "oojs": {
        files: [
          { src: 'node_modules/visualeditor/lib/oojs/oojs.jquery.js', dest: 'vendor/lib/oojs.js' }
        ]
      },
      "oojs-ui": {
        files: [
          { expand: true, cwd: 'node_modules/visualeditor/lib/oojs-ui/', src: 'themes/apex/**', dest: 'vendor/styles/' },
          { src: 'node_modules/visualeditor/lib/oojs-ui/oojs-ui-apex.vector.css', dest: 'tmp/oojs-ui.css' }
        ]
      }
    },
    concat: {
      "visualEditor-base": {
        dest: 'vendor/visualEditor-base.js',
        src:  []
              .concat(getVeFileList('jquery.i18n'))
              .concat(getVeFileList('jquery.uls.data'))
              .concat(getVeFileList('jquery.client'))
              .concat(getVeFileList('oojs'))
              .concat(getVeFileList('oojs-ui'))
              .concat(getVeFileList('oojs-ui-apex'))
              .concat(getVeFileList('unicodejs'))
              .concat(getVeFileList('rangefix'))
              .concat(getVeFileList('visualEditor.base.build'))
              .concat(getVeFileList('visualEditor.core.build', /^src\/ve\./))
              .concat(getVeFileList('visualEditor.standalone.build'))
      },
      "visualEditor-model": {
        dest: 'vendor/visualEditor-model.js',
        src: getVeFileList('visualEditor.core.build', /^src\/dm/)
      },
      "visualEditor-ui": {
        dest: 'vendor/visualEditor-ui.js',
        src: []
              .concat(getVeFileList('visualEditor.core.build', /^src\/ce/))
              .concat(getVeFileList('visualEditor.core.build', /^src\/ui/))
              .concat(getVeFileList('visualEditor.desktop.build'))
      },
      "one-css-file": {
        dest: 'vendor/styles/visualEditor.css',
        src: [
          'tmp/oojs-ui.css',
          'node_modules/visualeditor/dist/visualEditor.css',
        ]
      }
    }
  });

  grunt.registerTask( 'build', [ 'clean', 'subgrunt', 'copy', 'concat' ] );
  grunt.registerTask( 'default', [ 'build' ] );
};

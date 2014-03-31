'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    run: {
      // 'jasmine-node' needs to run in a separate task because the coverage report is created when grunt exits.
      // When we use watch grunt keeps running and no report would be generated if 'jasmine-node' would be executed directly.
      jasmine_node: {
        cmd: 'node_modules/.bin/grunt',
        args: ['jasmine_node']
      }
    },
    clean: {
      all: 'coverage'
    },
    jshint: {
      all: [
        'Gruntfile.js',
        'test/**/*.js',
        'index.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    jasmine_node: {
      coverage: {
        excludes: ['test/**', 'coverage/**', 'Gruntfile.js']
      },
      options: {
        matchall: true,
        specFolders: ['test/']
      }
    },
    watch: {
      js: {
        files: ['**/*.js', '!node_modules/**/*.js'],
        tasks: ['default'],
        options: {
          spawn: true // Since livereload seems not to be working we spawn to require the latest index.js
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jasmine-node-coverage');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('test', ['clean', 'jshint', 'run:jasmine_node', 'watch']);
  grunt.registerTask('ci', ['clean', 'jshint', 'jasmine_node']);
  grunt.registerTask('default', ['test']);
};

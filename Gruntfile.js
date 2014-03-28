'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
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
      options: {
        matchall: true
      },
      all: ['test/']
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

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jasmine-node');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('test', ['jshint', 'jasmine_node', 'watch']);
  grunt.registerTask('ci', ['jshint', 'jasmine_node']);
  grunt.registerTask('default', ['test']);
};

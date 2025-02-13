module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-bake');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-nodemon');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.initConfig({
    browserify: {
      dist: {
        files: {
          'app/js/bundle.js': ['app/js/app.js', 'app/js/router.js', 'app/js/db.js', 'app/js/sst.js']
        }
      }
    },
    nodemon: {
      dev: {
        script: 'server.js',
        options: {
          watch: ['server.js'],
          ignore: ['app/**/*', 'node_modules/**/*', '!app/js/vendor/**/*.js'],
          nodeArgs: ['--inspect'],
          env: {
            PORT: '3000'
          }
        }
      }
    },
    watch: {
      options: {
        spawn: false
      },
      js: {
        files: ['app/js/**/*.js', '!app/js/bundle.js', '!app/js/vendor/**/*.js'],
        tasks: ['browserify']
      },
      bake: {
        files: ['app/main.html', 'app/views/*.html'],
        tasks: ['bake']
      }
    },
    bake: {
      build: {
        options: {
          preprocessTemplate: true,
          preservePipes: true,
          process: false,
          content: null
        },       
        files: {
          "app/app.html": "app/main.html"
        }
      }
    },
    concurrent: {
      dev: {
        tasks: ['nodemon', 'watch'],
        options: {
          logConcurrentOutput: true
        }
      }
    }
  });

  grunt.registerTask('default', ['browserify', 'bake', 'concurrent:dev']);
};
module.exports = function(grunt) {
  // Load the plugins
  grunt.loadNpmTasks('grunt-bake');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-nodemon');

  grunt.initConfig({
    bake: {
      build: {
        files: {
          "app/gindex.html": "app/gbase.html"
        }
      }
    },
    watch: {
      bake: {
        files: ['app/gbase.html', 'app/views/*.html'],
        tasks: ['bake']
      }
    },
    nodemon: {
      dev: {
        script: 'server.js',
        options: {
          nodeArgs: ['--inspect'],
          env: {
            PORT: '3000'
          }
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

  // Default task
  grunt.registerTask('default', ['concurrent:dev']);
};
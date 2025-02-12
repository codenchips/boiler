$(document).ready(function() {
    const Mustache = require('mustache');

    // Get current path
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    
    // Router function
    function router(path) {
        switch(path) {
            case 'foo':
                // Load foo template
                $.get('views/foo.html', function(template) {
                    const rendered = Mustache.render(template, { 
                        title: 'Foo Page',
                        content: 'This is the foo page content'
                    });
                    $('#page').html(rendered);
                });
                break;
            case 'bar':
                // Load bar template
                $.get('views/bar.html', function(template) {
                    const rendered = Mustache.render(template, { 
                        title: 'Bar Page',
                        content: 'This is the bar page content'
                    });
                    $('#page').html(rendered);
                });
                break;
            default:
                // Load home template
                $.get('views/home.html', function(template) {                                    
                    const rendered = Mustache.render(template, { 
                        title: 'Home Page',
                        content: 'Welcome to the home page'
                    });
                    $('#page').html(rendered);
                    sstEvents('home');
                
                });
        }
    }
    router(pathParts[0] || 'home');
    
    function sstEvents(template_name) {
        console.log('bind events for template', template_name);
        if (template_name == 'home') {            
            $('.clickme').click(function() {
                alert('Hello from '+template_name);
            });


        }

    }



});
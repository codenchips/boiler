$(document).ready(function() {
    const Mustache = require('mustache');
    const { openDB } =require('idb');

    // Custom function to generate UUIDs
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }    

    // Get current path
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    
    // Router function
    function router(path) {
        switch(path) {
            case 'tables':
                // Load Tables template
                $.get('views/tables.html', function(template) {
                    const rendered = Mustache.render(template, { 
                        title: 'Tables Page',
                        content: 'This is the tables page content'
                    });
                    $('#page').html(rendered);
                });
                break;
            case 'schedule':
                // Load Schedule template
                $.get('views/schedule.html', function(template) {
                    const rendered = Mustache.render(template, { 
                        title: 'Schedule Page',
                        content: 'This is the schedule page content'
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
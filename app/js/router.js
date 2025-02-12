const Mustache = require('mustache');


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
            });
    }
}

module.exports = router;

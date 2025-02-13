const Mustache = require('mustache');
const db = require('./db'); // Import the db module
const sst = require('./sst'); // Import the sst module


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
            $.get('views/home.html', async function(template) {    
                
                const rendered = Mustache.render(template, { 
                    title: 'Dashboard',
                    content: 'Your projects are listed below'
                });
                $('#page').html(rendered);                

                sst.homeFunctions();

            });
    }
}

module.exports = router;

const Mustache = require('mustache');
const db = require('./db');
const sst = require('./sst');

async function loadTemplate(path) {
    try {
        const response = await fetch(`/views/${path}.html`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.text();
    } catch (error) {
        console.warn('Fetching from cache:', error);
        const cache = await caches.open('sst-cache-v1');
        const cachedResponse = await cache.match(`/views/${path}.html`);
        if (cachedResponse) {
            return await cachedResponse.text();
        }
        throw error;
    }
}

async function router(path, project_id) {
    // Update browser URL without reload
    window.history.pushState({}, '', `/${path}`);
    
    try {
        let template;
        switch(path) {
            case 'tables':
                template = await loadTemplate('tables');
                const rendered = Mustache.render(template, { 
                    title: 'Tables Page',
                    content: 'This is the tables page content'
                });
                $('#page').html(rendered);
                await sst.tablesFunctions();
                break;
            case 'schedule':
                template = await loadTemplate('schedule');
                const renderedSchedule = Mustache.render(template, { 
                    title: 'Schedule Page',
                    content: 'This is the schedule page content'
                });
                $('#page').html(renderedSchedule);
                break;
            default:
                template = await loadTemplate('home');
                const renderedHome = Mustache.render(template, { 
                    title: 'Dashboard',
                    content: 'Your projects are listed below'
                });
                $('#page').html(renderedHome);
                await sst.homeFunctions();
        }
    } catch (error) {
        console.error('Routing error:', error);
        $('#page').html('<div class="error">Unable to load page content</div>');
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    router(pathParts[0] || 'home', pathParts[1]);
});

module.exports = router;

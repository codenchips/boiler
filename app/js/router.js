const Mustache = require('mustache');
const sst = require('./sst');
const utils = require('./modules/utils');
const CONFIG = require('./config');

async function loadTemplate(path) {
    try {
        const response = await fetch(`/views/${path}.html`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.text();
    } catch (error) {
        console.warn('Fetching from cache:', error);
        const cache = await caches.open(CONFIG.CACHE_NAME); // Use CONFIG.CACHE_NAME in your cache operations
        
        const cachedResponse = await cache.match(`/views/${path}.html`);
        if (cachedResponse) {
            return await cachedResponse.text();
            isRouting = false;
        }
        throw error;
    }
}

let isRouting = false;

async function router(path, project_id) {
    if (isRouting) return;
    isRouting = true;
    
    await utils.checkLogin();

    // Update browser URL without reload
    window.history.pushState({}, '', `/${path}`);
    
    try {
        let template;
        switch(path) {
            case 'tables':                
                template = await loadTemplate('tables');
                // Get stored project data
                const projectData = JSON.parse(localStorage.getItem('currentProject') || '{}');
                
                const rendered = Mustache.render(template, { 
                    title: 'Tables Page',
                    project: projectData,
                    project_id: project_id
                });
                $('#page').html(rendered);
                sst.globalBinds();
                sst.tablesFunctions(project_id);
                break;
            case 'schedule':
                template = await loadTemplate('schedule');
                const renderedSchedule = Mustache.render(template, { 
                    title: 'Schedule Page',
                    content: 'This is the schedule page content'
                });
                $('#page').html(renderedSchedule);
                sst.globalBinds();
                sst.scheduleFunctions();
                break;
            case 'account':
                template = await loadTemplate('account');
                const renderedAccount = Mustache.render(template, { 
                    title: 'Account Page',
                    content: 'This is the account page content'
                });
                $('#page').html(renderedAccount);
                setTimeout(function() {
                    sst.globalBinds();
                    sst.accountFunctions();
                }, 500);
                break;                
            default:
                template = await loadTemplate('home');
                const renderedHome = Mustache.render(template, { 
                    title: 'Dashboard',
                    content: 'Your projects are listed below'
                });
                $('#page').html(renderedHome);
                sst.globalBinds();
                sst.homeFunctions();
        }
    } catch (error) {
        console.error('Routing error:', error);
        window.location.reload();        
    } finally {
        isRouting = false;
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    router(pathParts[0] || 'home', pathParts[1]);
});

//module.exports = router;
window.router = router;

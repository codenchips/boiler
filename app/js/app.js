$(document).ready(function() {
    const Mustache = require('mustache');
    const db = require('./db'); // Import the db module
    const router = require('./router'); // Import the router module
    const sst = require('./sst'); // Import the db module
    
    

    console.log("Mounted App...");

    $('a[href^="/"]').on('click', function(e) {
        e.preventDefault();
        const path = $(this).attr('href').substring(1);
        console.log('link intercepted:', path);
        router(path);
    });
    

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed:', err);
            });
    }
        

    // Handle online/offline status
    window.addEventListener('online', function() {
        console.log('App is online');
        db.fetchAndStoreProducts();
        db.syncData(8);
    });

    window.addEventListener('offline', function() {
        console.log('App is offline - using cached data');
    });

    // Initialize app
    async function initApp() {
        await db.initDB();
        
        if (navigator.onLine) {    
            await db.fetchAndStoreProducts(); 
            await db.syncData(8);
        }

        // Get current path and route
        const pathParts = window.location.pathname
            .split('/')
            .filter(part => part.length > 0);
        
        const projectId = pathParts[1] || '';
        router(pathParts[0] || 'home', projectId);

        // Set the project id in the hidden input
        if (projectId) {
            $('#m_project_id').val(projectId);
        }
    }

    initApp();
});
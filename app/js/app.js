$(document).ready(function() {
    const Mustache = require('mustache');
    const db = require('./db'); // Import the db module    
    const sst = require('./sst'); // Import the db module
    const utils = require('./modules/utils');
        
    console.log("Mounted App...");
    //const user_id = utils.getUserID();

    $('a[href^="/"]').on('click', function(e) {
        e.preventDefault();
        const path = $(this).attr('href').substring(1);        
        window.router(path);
    });
    

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                //console.log('ServiceWorker registration successful');
                
                // Check for updates
                let updateBarShown = false;
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller && !updateBarShown) {
                            updateBarShown = true;
                            showUpdateBar();
                        }
                    });
                });
            })
            .catch(err => {
                //console.log('ServiceWorker registration failed:', err);
            });
    }
        

    // Handle online/offline status
    window.addEventListener('online', function() {
        //console.log('App is online');
        db.fetchAndStoreProducts();
        //db.fetchAndStoreUsers();
        //db.syncData(utils.getUserID());
    });

    window.addEventListener('offline', function() {
        console.log('App is offline - using cached data');
    });

    // Initialize app
    async function initApp() {
        await db.initDB();
        
        if (navigator.onLine) {    
            await db.fetchAndStoreProducts(); 
            await db.fetchAndStoreUsers();
            //await db.syncData(await utils.getUserID());
        }

        // Get current path and route
        const pathParts = window.location.pathname
            .split('/')
            .filter(part => part.length > 0);
        
        const projectId = pathParts[1] || '';
        window.router(pathParts[0] || 'home', projectId);

        // Set the project id in the hidden input
        if (projectId) {
            $('#m_project_id').val(projectId);
        }
    }


    initApp();
});

function showUpdateBar() {
    const updateNotification = UIkit.notification({
        message: 'A new version is available.<br>Click here to update.',
        status: 'primary',
        pos: 'bottom-center',
        timeout: 0,
        onclick: () => {
            updateNotification.close();
            
            // Show loading notification
            const loadingNotification = UIkit.notification({
                message: 'Updating...',
                status: 'warning',
                pos: 'bottom-center',
                timeout: 0
            });
            
            // Trigger update
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg.waiting) {
                    // Add listener before triggering skipWaiting
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data.type === 'UPDATE_READY') {
                            loadingNotification.close();
                            UIkit.notification({
                                message: 'Update complete.<br>Please close and restart the app to apply changes.',
                                status: 'success',
                                pos: 'bottom-center',
                                timeout: 0,
                                onclick: () => {
                                    if (navigator.app) {
                                        navigator.app.exitApp();
                                    } else if (navigator.device) {
                                        navigator.device.exitApp();
                                    } else {
                                        window.location.reload();
                                    }
                                }
                            });
                        }
                    }, { once: true }); // Only listen once

                    reg.waiting.postMessage('skipWaiting');
                }
            });
        }
    });
}

// Handle reload after update
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
        refreshing = true;
        window.location.reload();
    }
});
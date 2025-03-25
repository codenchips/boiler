let registration;

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registration successful');
            checkForUpdates();
        } catch (err) {
            console.log('ServiceWorker registration failed:', err);
        }
    }
}

// Periodic update checker
function checkForUpdates() {
    // Check immediately on page load
    if (registration) {
        registration.update();
    }

    // Then check every 30 minutes
    setInterval(() => {
        if (registration) {
            registration.update();
        }
    }, 30 * 60 * 1000);
}

// Store update state in localStorage
function setUpdateAvailable(value) {
    localStorage.setItem('updateAvailable', value);
}

function isUpdateAvailable() {
    return localStorage.getItem('updateAvailable') === 'true';
}

// Modified showUpdateBar function
function showUpdateBar() {
    // Only show if we haven't already shown it
    if (!isUpdateAvailable()) {
        setUpdateAvailable(true);
        const updateNotification = UIkit.notification({
            message: 'A new version is available.<br>Click here to update.',
            status: 'primary',
            pos: 'bottom-center',
            timeout: 0,
            onclick: () => {
                updateNotification.close();
                
                const loadingNotification = UIkit.notification({
                    message: 'Updating...',
                    status: 'warning',
                    pos: 'bottom-center',
                    timeout: 0
                });
                
                if (registration?.waiting) {
                    registration.waiting.postMessage('skipWaiting');
                }
            }
        });
    }
}

// Check for stored update state on page load
function checkStoredUpdateState() {
    if (isUpdateAvailable()) {
        showUpdateBar();
    }
}

// Initialize
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
    
    registerServiceWorker();
    checkStoredUpdateState();

    // Clear update flag after successful update
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(false);
    });

    // Listen for update events
    if (registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBar();
                }
            });
        });
    }

    // Handle online/offline status
    window.addEventListener('online', function() {
        //console.log('App is online');
        db.fetchAndStoreProducts();
        //db.fetchAndStoreUsers();
        //db.syncData(utils.getUserID());
        $('#generate_datasheets_button').prop("disabled", false);
        $('#btn_update_account').prop("disabled", false);
        $('#btn_push_user_data').prop("disabled", false);
        $('#btn_pull_user_data').prop("disabled", false);
        $('#btn_clear_local_storage').prop("disabled", false);
        $('#btn_logout').prop("disabled", false);
        $('#btn_logout').prop("disabled", false);
        $('.syncicon').css({'opacity': '100%'});
    });
    window.addEventListener('offline', function() {
        console.log('App is offline - using cached data');        
        $('#generate_datasheets_button').prop("disabled", true);
        $('#btn_update_account').prop("disabled", true);
        $('#btn_push_user_data').prop("disabled", true);
        $('#btn_pull_user_data').prop("disabled", true);
        $('#btn_clear_local_storage').prop("disabled", true);        
        $('#btn_logout').prop("disabled", true);
        $('#btn_logout').prop("disabled", true);
        $('.syncicon').removeClass('active').css({'opacity': '20%'});
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

// Handle reload after update
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
        refreshing = true;
        window.location.reload();
    }
});
$(document).ready(function() {
    const Mustache = require('mustache');
    const db = require('./db'); // Import the db module
    const router = require('./router'); // Import the router module
    const sst = require('./sst'); // Import the db module

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

    // Use the generateUUID function from the db module
    let uuid = db.generateUUID();
    console.log("uuid: ", uuid);
    
    console.log("Mounted ...");
    db.initDB();

    if (navigator.onLine) {    
        db.fetchAndStoreProducts(); 
        db.syncData(8);
    }

    // Get current path
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    

// todo: manage url parts with server.js         
    // Use the router function from the router module
    const projectId = pathParts[1] || '';
    router(pathParts[0] || 'home', projectId);

    // Set the project id in the hidden input
    if (projectId) {
        $('#m_project_id').val(projectId);
    }



});
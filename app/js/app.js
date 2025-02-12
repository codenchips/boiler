$(document).ready(function() {
    const Mustache = require('mustache');
    
    const db = require('./db'); // Import the db module
    const router = require('./router'); // Import the router module

    // Use the generateUUID function from the db module
    let uuid = db.generateUUID();
    console.log("uuid: ", uuid);

    // Get current path
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    
    // Use the router function from the router module
    router(pathParts[0] || 'home');   

});
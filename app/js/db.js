const { openDB } = require('idb');

// Custom function to generate UUIDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


// Export the functions
module.exports = {
    generateUUID,
    // Add other database-related functions here
};

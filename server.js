const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from app directory
app.use(express.static('app'));

// Route for index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'app', 'app.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
const Mustache = require('mustache');
const db = require('./db'); // Import the db module

async function homeFunctions() {
    if ($('#product-list').length) {
        console.log('Product list page');
        db.getProducts().then(products => {
            console.log('Products:', products);
            const template = $('#product-list').html();
            const rendered = Mustache.render(template, { products });
        });
    }
}

module.exports = {
    homeFunctions
};
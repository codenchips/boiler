const db = require('../db');
const Mustache = require('mustache');

class TablesModule {
    constructor() {
        Mustache.tags = ["[[", "]]"];
    }


    async updateTypesDropdown(brand) {
        console.log('updateTypesDropdown', brand);  
        const types = await this.getTypesForBrand(brand);
        this.renderTypesDropdown(types);
    }

    async getTypesForBrand(brand) {
        const products = await db.getProducts();
        return products
            .filter(product => product.site === brand)
            .reduce((acc, product) => {
                if (!acc.some(item => item.type_slug === product.type_slug)) {
                    acc.push({ 
                        type_slug: product.type_slug, 
                        type_name: product.type_name 
                    });
                }
                return acc;
            }, [])
            .sort((a, b) => a.type_name.localeCompare(b.type_name));
    }

    renderTypesDropdown(types) {
        console.log('renderTypesDropdown', types);
        Mustache.tags = ["[[", "]]"];
        const template = $('#types_options').html();
        Mustache.parse(template);
        console.log('template', template);
        const rendered = Mustache.render(template, { types });    
        $('#form_type').html(rendered);
    }
}

module.exports = new TablesModule();
const db = require('../db');
const Mustache = require('mustache');

class TablesModule {
    constructor() {
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        Mustache.tags = ["[[", "]]"];
        this.isInitialized = true;
        console.log('TablesModule initialized with tags:', Mustache.tags);
    }

    async updateTypesDropdown(brand) {
        this.init();
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
        if (!types || !types.length) {
            console.error('No types data provided');
            return;
        }

        const template = $('#types_options');
        const templateContent = template.html();
        const rendered = Mustache.render(templateContent, { types });    
        $('#form_type').html(rendered);
    }
}

module.exports = new TablesModule();
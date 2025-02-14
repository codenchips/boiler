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
    }
    
    async updateProductsDropdown(type) {
        this.init();
        const products = await this.getProductsForType(type);        
        this.renderProductsDropdown(products);
    }

    async renderProductsDropdown(products) {
        if (!products || !products.length) {
            console.error('No products data provided');
            return;
        }

        const template = $('#products_options');
        const templateContent = template.html();
        const rendered = Mustache.render(templateContent, { products });    
        $('#form_product').html(rendered);
    }

    async getProductsForType(type) {
        const products = await db.getProducts();
        
        return products
            .filter(product => product.type_slug === type)
            .reduce((acc, product) => {
                if (!acc.some(item => item.product_slug === product.product_slug)) {
                    acc.push({ 
                        product_slug: product.product_slug, 
                        product_name: product.product_name 
                    });
                }
                return acc;
            }, [])            
            .sort((a, b) => a.product_name.localeCompare(b.product_name));
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
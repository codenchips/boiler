const db = require('../db');
const Mustache = require('mustache');
const utils = require('./utils');

class TablesModule {
    constructor() {
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        Mustache.tags = ["[[", "]]"];        
        this.isInitialized = true;        
    }

    async updateSkusDropdown(product) {
        this.init();
        const skus = await this.getSkusForProduct(product);        
        this.renderSkusDropdown(skus);
    }

    async renderSkusDropdown(skus) {
        if (!skus || !skus.length) {
            console.error('No sku data provided');
            return;
        }

        const template = $('#options');
        const templateContent = template.html();
        const rendered = Mustache.render(templateContent, { options: skus, title: 'Select SKU' });    
        $('#form_sku').html(rendered);
    }

    async getSkusForProduct(user_product) {
        const products = await db.getProducts();
        
        return products
            .filter(product => product.product_slug === user_product)
            .reduce((acc, product) => {
                if (!acc.some(item => item.slug === product.product_slug)) {
                    acc.push({ 
                        slug: product.product_code, 
                        name: product.product_code 
                    });
                }
                return acc;
            }, [])            
            .sort((a, b) => a.name.localeCompare(b.name));
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

        const template = $('#options');
        const templateContent = template.html();
        const rendered = Mustache.render(templateContent, { options: products, title: 'Select Product' });    
        $('#form_product').html(rendered);
    }

    async getProductsForType(type) {
        const products = await db.getProducts();
        
        return products
            .filter(product => product.type_slug === type)
            .reduce((acc, product) => {
                if (!acc.some(item => item.slug === product.product_slug)) {
                    acc.push({ 
                        slug: product.product_slug, 
                        name: product.product_name 
                    });
                }
                return acc;
            }, [])            
            .sort((a, b) => a.name.localeCompare(b.name));
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
                if (!acc.some(item => item.slug === product.type_slug)) {
                    acc.push({ 
                        slug: product.type_slug, 
                        name: product.type_name 
                    });
                }
                return acc;
            }, [])
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    renderTypesDropdown(types) {
        if (!types || !types.length) {
            console.error('No types data provided');
            return;
        }

        const template = $('#options');
        const templateContent = template.html();
        const rendered = Mustache.render(templateContent, { options: types, title: 'Select Type' });    
        $('#form_type').html(rendered);
    }


    async addProductToRoomClick() {

        const productData = {
            brand: $('#form_brand').val(),
            type: $('#form_type').val(),
            product_slug: $('#form_product').val(),
            product_name: $('#form_product option:selected').text(),
            sku: $('#form_sku').val(),            
            room_id_fk: $('#m_room_id').val(),
            owner_id: '8', // Hardcoded for now
            custom: 0,
            ref: "",
            created_on: await utils.formatDateTime(new Date()),
            last_updated: await utils.formatDateTime(new Date()),
            order: null,
            range: null
        };

        console.log('Add product, data:', productData);

        if ( !productData.sku ) {
            UIkit.notification({
                message: 'All fields are required',
                status: 'danger',
                pos: 'top-center',
                timeout: 5000
            });
            return;
        }

        utils.showSpin();

        try {
            await db.saveProductToRoom(productData);
            UIkit.notification({
                message: 'Product added to room',
                status: 'success',
                pos: 'top-center',
                timeout: 5000
            });
            utils.hideSpin();
        } catch (err) {
            console.error('Error saving product to room:', err);
            UIkit.notification({
                message: 'Error saving product to room',
                status: 'danger',
                pos: 'top-center',
                timeout: 5000
            });
            utils.hideSpin();
        }
    }


}

module.exports = new TablesModule();
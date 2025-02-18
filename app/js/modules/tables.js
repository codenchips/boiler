const db = require('../db');
const Mustache = require('mustache');
const utils = require('./utils');

class TablesModule {
    constructor() {
        this.isInitialized = false;
        this.pTable = null;
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

            this.refreshTableData();

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


    // Group products by SKU and count occurrences
    async groupProductsBySKU(products) {
        const groupedProducts = products.reduce((acc, product) => {
            if (!acc[product.sku]) {
                acc[product.sku] = { ...product, qty: 0 };
            }
            acc[product.sku].qty += 1;
            return acc;
        }, {});

        return Object.values(groupedProducts);
    }    



    async removeSkuDialog(sku) {
        // open the del-sku modal and pass the sku to be deleted
        $('span.place_sku').html(sku);
        $('input#del_sku').val(sku);

        UIkit.modal('#del-sku').show();
        console.log('Remove SKU: ', sku);

        $('#form-submit-del-sku').off('submit').on('submit', async (e) => {
            e.preventDefault();
            const sku = $('#del_sku').val();
            const room_id = $('#m_room_id').val();
            
            console.log('Delete SKU:', sku);
            await db.deleteProductFromRoom(sku, room_id);
            this.refreshTableData();
            UIkit.modal('#del-sku').hide();
            
        });      
    }

    async setQtyDialog(sku, qty) {
        // open the del-sku modal and pass the sku to be deleted
        $('span.place_sku').html(sku);
        $('input#set_qty_sku').val(sku);
        $('input#set_qty_qty').val(qty);

        UIkit.modal('#set-qty').show();
        console.log('Set qty for SKU: ', sku);

        $('#form-submit-set-qty').off('submit').on('submit', async (e) => {
            e.preventDefault();
            const qty = $('#set_qty_qty').val();
            const sku = $('#set_qty_sku').val();
            const room_id = $('#m_room_id').val();
            
            console.log('setqty for  SKU:', sku);
            await db.setSkuQtyForRoom(qty, sku, room_id);
            this.refreshTableData();
            UIkit.modal('#set-qty').hide();
            
        });      
    }


    async refreshTableData(roomID) {
        console.log('Refreshing table data for room:', roomID);
        let roomIDToUse = roomID || $('#m_room_id').val();
        console.log('Room ID to use:', roomIDToUse);
        const allProductsInRoom = await db.getProductsForRoom(roomIDToUse);
        console.log('All products in room:', allProductsInRoom);
        const groupedProducts = await this.groupProductsBySKU(allProductsInRoom);
        this.pTable.setData(groupedProducts);
    }

    async renderProdctsTable(roomID) {

        let roomIDToUse = roomID || $('#m_room_id').val();
        const allProductsInRoom = await db.getProductsForRoom(roomIDToUse);
        const groupedProducts = await this.groupProductsBySKU(allProductsInRoom);

        this.pTable = new Tabulator("#ptable", {
            data: groupedProducts,            
            loader: false,
            layout: "fitColumns",
            dataLoaderError: "There was an error loading the data",
            initialSort:[
                {column:"product_slug", dir:"asc"}, //sort by this first
            ],
            columns: [{
                    title: "product_id",
                    field: "uuid",
                    visible: false
                },
                {
                    title: "product_slug",
                    field: "product_slug",
                    visible: false
                },
                {
                    title: "SKU",
                    field: "sku",                    
                    sorter:"string",
                    visible: true
                },
                {
                    title: "Product",
                    field: "product_name",
                    visible: true
                },
                {
                    title: "Ref",
                    field: "ref",                    
                    visible: true,
                    editor: "input",
                    editorParams: {
                        search: true,
                        mask: "",
                        selectContents: true,
                        elementAttributes: {
                            maxlength: "7",
                        }
                    }                    
                },
                {
                    title: "Qty",
                    field: "qty",                    
                    visible: true,
                    cellClick: (e, cell) => {
                        this.setQtyDialog(cell.getRow().getData().sku, cell.getRow().getData().qty);
                    }                    
                },
                {                    
                    visible: true,
                    headerSort: false,
                    formatter: utils.iconX,
                    width: 80,
                    hozAlign: "center",
                    cellClick: (e, cell) => {
                        this.removeSkuDialog(cell.getRow().getData().sku);
                    }
                },
            ],
        });
        this.pTable.on("cellEdited", function (cell) {            
            const sku = cell.getRow().getData().sku;
            const room_id = $('#m_room_id').val();
            const ref = cell.getRow().getData().ref            
            db.updateProductRef(room_id, sku, ref);         
        });        

    }
    


}

module.exports = new TablesModule();
const Mustache = require('mustache');
const db = require('./db'); // Import the db module

UIkit.modal('#add-special', { stack : true });

function showSpin() {
    $('#spinner').fadeIn('fast');
}
function hideSpin() {
    $('#spinner').fadeOut('fast');
}

var iconPlus = function(cell, formatterParams, onRendered) {
    return '<i class="fa-solid fa-circle-plus"></i>';
};
var iconMinus = function(cell, formatterParams, onRendered) {
    return '<i class="fa-solid fa-circle-minus"></i>';
};
var iconX = function(cell, formatterParams, onRendered) {
    return '<span class="icon red" uk-icon="icon: trash; ratio: 1.3" title="Delete this project"></span>';
};    

/*
* Tables page functions
*/
async function tablesFunctions() {
    console.log('Running tables functions');
    let productList = [];
    const selectedBrand = "1";

    $('#form_brand').on('change', function() {
        console.log('Brand changed:', $(this).val());
        getTypesForBrand($(this).val());
    });

    typesForBrand = await db.getProducts().then(products => {        
        // Filter products by selected brand (1 or 2)
        const filteredTypes = products
            .filter(product => product.site === selectedBrand)
            .reduce((acc, product) => {
            if (!acc.some(item => item.type_slug === product.type_slug)) {
                acc.push({ type_slug: product.type_slug, type_name: product.type_name });
            }
            return acc;
            }, [])
        .sort((a, b) => a.type_name.localeCompare(b.type_name));        
        
        return filteredTypes; // Assign filtered products to allProducts
    });

    console.log('typesForBrand:', typesForBrand);

    // const template = $('#product-list').html();
    // const rendered = Mustache.render(template, { products });

}
/* // END tablesFunctions */

function getTypesForBrand(brand) {
}



/*
* Home page functions
*/
async function homeFunctions() {
    console.log('Running home functions');

    if ($('#product-list').length) {
        db.getProducts().then(products => {
            console.log('Products:', products);
            const template = $('#product-list').html();
            const rendered = Mustache.render(template, { products });
        });


        db.getProjects().then(projects => {
            console.log('Projects:', projects);
            // const template = $('#project-list').html();
            // const rendered = Mustache.render(template, { projects });
        });
    }


    if ($('#dashboard_projects').length) {

        const tabledata = [
            {
                project_name: "My Project",
                project_slug: "my-project",
                version: "1",
                project_id: "23",
                created: "27/1/25",
                products: "10"
            }
        ];

        var dashTable = new Tabulator("#dashboard_projects", {
            data: tabledata,            
            loader: false,
            layout: "fitColumns",
            dataLoaderError: "There was an error loading the data",
            initialSort:[
                {column:"project_name", dir:"asc"}, //sort by this first
            ],
            columns: [{
                    title: "project_id",
                    field: "id",
                    visible: false
                },
                {
                    title: "project_slug",
                    field: "project_slug",
                    visible: false
                },
                {
                    title: "Project Name",
                    field: "project_name",
                    formatter: "link",
                    sorter:"string",
                    visible: true,
                    headerSortStartingDir:"desc",
                    formatterParams:{
                        labelField: "project_name",
                        target: "_self",
                        url: "#",
                    },
                    cellClick: function(e, cell) {
                        location = "/tables/"+cell.getRow().getData().project_id;
                    }
                },
                {
                    title: "Products",
                    field: "products",
                    width: 120
                },
                {
                    title: "Rev",
                    field: "version",
                    width: 80,
                    visible: false
                },
                {
                    title: "Created",
                    field: "created",
                    width: 110,
                    visible: false
                },
                {                    
                    visible: true,
                    headerSort: false,
                    formatter: iconX,
                    width: 80,
                    hozAlign: "center",
                    cellClick: function (e, cell) {
                        deleteProject(cell.getRow().getData().project_id);
                    }
                },
            ],
        });
        //dashTable.setData(data);

    }

}
/* // END homeFunctions */


module.exports = {
    homeFunctions,
    tablesFunctions
};
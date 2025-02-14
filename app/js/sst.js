const Mustache = require('mustache');
const db = require('./db'); // Import the db module
const tables = require('./modules/tables');

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
// async function tablesFunctions() {
//     console.log('Running tables functions');
    
//     // Initial load of types for default brand
//     await updateTypesDropdown('1');

//     // Handle brand changes
//     $('#form_brand').on('change', async function() {
//         await updateTypesDropdown($(this).val());
//     });
// }

// async function updateTypesDropdown(brand) {
//     const types = await getTypesForBrand(brand);
//     renderTypesDropdown(types);
// }

// async function getTypesForBrand(brand) {
//     const products = await db.getProducts();
//     return products
//         .filter(product => product.site === brand)
//         .reduce((acc, product) => {
//             if (!acc.some(item => item.type_slug === product.type_slug)) {
//                 acc.push({ 
//                     type_slug: product.type_slug, 
//                     type_name: product.type_name 
//                 });
//             }
//             return acc;
//         }, [])
//         .sort((a, b) => a.type_name.localeCompare(b.type_name));
// }

// function renderTypesDropdown(types) {
//     Mustache.tags = ["[[", "]]"];
//     const template = $('#types_options').html();
//     const rendered = Mustache.render(template, { types });    
//     $('#form_type').html(rendered);
// }

// /* // END tablesFunctions */





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

async function tablesFunctions() {

    // Initial load with default brand
    tables.updateTypesDropdown('1');
    
    // Handle brand changes
    $('#form_brand').on('change', function() {
        const selectedBrand = $(this).val();
        console.log('Selected brand:', selectedBrand);
        tables.updateTypesDropdown(selectedBrand);
    });

}

module.exports = {
    homeFunctions,
    tablesFunctions    
};

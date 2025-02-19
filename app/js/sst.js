const Mustache = require('mustache');
const db = require('./db'); // Import the db module
const tables = require('./modules/tables');
const utils = require('./modules/utils');
const sidebar = require('./modules/sidebar');

UIkit.modal('#add-special', { stack : true });


/*
*   Tables page functions
*/
async function tablesFunctions() {
    tables.init();        
    console.log('Running tables functions');

    // Initial load with default brand
    await tables.updateTypesDropdown('1');
    
    // Handle brand changes
    $('#form_brand').on('change', async function() {
        await tables.updateTypesDropdown($(this).val());
    });
    // Handle type changes
    $('#form_type').on('change', async function() {
        await tables.updateProductsDropdown($(this).val());
    });
    // Handle product changes
    $('#form_product').on('change', async function() {
        await tables.updateSkusDropdown($(this).val());
    });    

    // add prodcut to room
    $('#btn_add_product').on('click', async function() {
        await tables.addProductToRoomClick();       
    });



    await tables.renderProdctsTable();

    await renderSidebar('26'); // project_id

    // loadRoomData for the first mentioned room id in the sidebar
    const firstRoomId = $('#locations .room-link').first().data('id');    
    await loadRoomData(firstRoomId);

    
    $('span.name').on('click', function() {
        console.log('Name clicked:', $(this).data('id'));    
        const store = $(this).data('tbl');
        const uuid = $(this).data('id');
        const name = $(this).text();
        const that = this;
        // call the modal to update the name
        UIkit.modal.prompt('New name:', name).then(async function(newName) {
            if (newName) {                
                await db.updateName(store, uuid, newName);
                $(that).text(newName);
                
                await renderSidebar('26'); // project_id           
            }
        });
    });

    async function renderSidebar(project_id) {
        
        const projectStructure = await db.getProjectStructure('26'); // project_id            
        const sidemenuHtml = await sidebar.generateNavMenu(projectStructure);   
    
        $('#locations').html(sidemenuHtml);

        /* Room Click - load room data */
        $('a.room-link').off('click').on('click', async function(e) {
            e.preventDefault();
            await loadRoomData($(this).data('id'));
        });    

        /* Add Room Click - add a new room */
        $('span.add-room a').off('click').on('click', async function(e) {
            e.preventDefault();
            const floorUuid = $(this).data('id');   
            const roomName = await UIkit.modal.prompt('<h4>Enter the room name</h4>');
            if (roomName) {
                const roomUuid = await db.addRoom(floorUuid, roomName);
                UIkit.notification('Room added', {status:'success'});
                await renderSidebar('26'); // project_id
            }   
        });

        /* Add FLoor Click - add a new floor */
        $('span.add-floor a').off('click').on('click', async function(e) {
            e.preventDefault();
            const buildingUuid = $(this).data('id');   
            const floorName = await UIkit.modal.prompt('<h4>Enter the floor name</h4>');
            if (floorName) {
                const floorUuid = await db.addFloor(buildingUuid, floorName);
                UIkit.notification('Floor added', {status:'success'});
                await renderSidebar('26'); // project_id
            }   
        });

        /* Add building Click - add a new building */
        $('span.add-building a').off('click').on('click', async function(e) {
            e.preventDefault();
           
            const locationUuid = $(this).data('id');   
            const buildingName = await UIkit.modal.prompt('<h4>Enter the building name</h4>');
            if (buildingName) {
                const buildingUuid = await db.addBuilding(locationUuid, buildingName);                                
                UIkit.notification('building added', {status:'success'});
                await renderSidebar('26'); // project_id
            }   
        });     
        
        $('li.room-item span.action-icon.room').off('click').on('click', async function(e) {
            e.preventDefault();            
            const that = this;
            const msg = '<h4 class="red">Warning</h4><p>This will remove the room and <b>ALL products</b> in the room!</p';
            UIkit.modal.confirm(msg).then( async function() {
                const roomUuid = $(that).data('id');   
                const roomName = await db.removeRoom(roomUuid);                                
                UIkit.notification('Room removed', {status:'success'});
                await renderSidebar('26'); // project_id                    
            }, function () {
                console.log('Cancelled.')
            });        
        });   
        
        $('li.floor-item span.action-icon.floor').off('click').on('click', async function(e) {
            e.preventDefault();            
            const that = this;
            const msg = '<h4 class="red">Warning</h4><p>This will remove the floor, rooms and <b>ALL products</b> in those rooms!</p';
            UIkit.modal.confirm(msg).then( async function() {
                const floorUuid = $(that).data('id');   
                const floorName = await db.removeFloor(floorUuid);                                
                UIkit.notification('Floor and rooms removed', {status:'success'});
                await renderSidebar('26'); // project_id                    
            }, function () {
                console.log('Cancelled.')
            });        
        });          

        $('li.building-item span.action-icon.building').off('click').on('click', async function(e) {
            e.preventDefault();            
            const that = this;
            const msg = '<h4 class="red">Warning</h4><p>This will remove the building, all floor, rooms and <b>ALL products</b> in those rooms!</p';
            UIkit.modal.confirm(msg).then( async function() {
                const buildingUuid = $(that).data('id');   
                const buildingName = await db.removeBuilding(buildingUuid);                                
                UIkit.notification('building, floors and rooms removed', {status:'success'});
                await renderSidebar('26'); // project_id                    
            }, function () {
                console.log('Cancelled.')
            });        
        });  

        // add special to room
        $('#form-submit-special').submit(async function(e) {
            e.preventDefault();
            await tables.addSpecialToRoomClick();      
            UIkit.modal('#add-special').hide(); 
        });        

    }
    // 
    // End renderSidebar
    // 

    async function loadRoomData(roomId) {
        $('#m_room_id').val(roomId);        
        roomId = roomId.toString();
        // get the names for the location, building, floor and room based on this roomId.
        const roomMeta = await db.getRoomMeta(roomId);        
        $('.name.location_name').html(roomMeta.location.name).attr('data-id', roomMeta.location.uuid);
        $('.name.building_name').html(roomMeta.building.name).attr('data-id', roomMeta.building.uuid);
        $('.name.floor_name').html(roomMeta.floor.name).attr('data-id', roomMeta.floor.uuid);
        $('.name.room_name').html(roomMeta.room.name).attr('data-id', roomMeta.room.uuid);

        await tables.refreshTableData(roomId);
    }



}
/* 
    // End tablesFunctions 
*/



/*
*   Home page functions
*/
async function homeFunctions() {
    console.log('Running home functions');


    let deferredPrompt;
    const installButton = $('#installButton');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();        
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show the install button
        console.log('beforeinstallprompt fired');
        installButton.show();
    });

    installButton.on('click', async () => {
        if (!deferredPrompt) {
            return;
        }
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, discard it
        deferredPrompt = null;
        // Hide the install button
        installButton.hide();
    });

    window.addEventListener('appinstalled', (evt) => {
        console.log('Application installed');
        installButton.hide();
    });


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
                    formatter: utils.iconX,
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
/* 
    // END homeFunctions 
*/



module.exports = {
    homeFunctions,
    tablesFunctions    
};

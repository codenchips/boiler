const Mustache = require('mustache');
const db = require('./db'); 
const sst = require('./sst'); 
const tables = require('./modules/tables');
const utils = require('./modules/utils');
const sidebar = require('./modules/sidebar');


/*
*   Tables page functions
*/
async function tablesFunctions(project_id) {
    tables.init();        
    const user_id = await utils.getCookie('user_id');
    
    const currentProject = JSON.parse(localStorage.getItem('currentProject') || '{}');
    if (currentProject.project_id) {
        project_id = currentProject.project_id;
    }        

    console.log('Running tables functions for project:', project_id);

    

    //$('#debug').html(currentProject.project_name);
    $('.tables_link').show();
    UIkit.offcanvas('.tables-side').show();

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

    // Add Special to room
    $('#btn_add_special').off('click').on('click', async function() {
        //UIkit.modal('#add-special').remove();
        UIkit.modal('#add-special', { stack : true }).show();
    });



    await tables.renderProdctsTable();

    await renderSidebar(project_id); 
    await sidebar.renderFavourites(user_id);


    // loadRoomData for the first mentioned room id in the sidebar
    const firstRoomId = $('#locations .room-link').first().data('id');    
    await loadRoomData(firstRoomId);
    await loadRoomNotes(firstRoomId);
    await loadRoomImages(firstRoomId);

    // name labels (rename)
    $('span.name').on('click', function() {
        console.log('Name clicked:', $(this).data('id'));    
        const store = $(this).data('tbl');
        const uuid = $(this).data('id');
        const name = $(this).text();
        const that = this;
        // call the modal to update the name
        UIkit.modal.prompt('<h4>New name</h4>', name).then(async function(newName) {
            if (newName) {                
                await db.updateName(store, uuid, newName);
                $(that).text(newName);
                
                await renderSidebar(project_id); // project_id           
            }
        });
    });


    // room dimension fields
    $('.roomdim').off('blur').on('blur', async function(e) {
        const roomUuid = $('#m_room_id').val();
        const field = $(this).data('field');
        const value = $(this).val();
        await db.updateRoomDimension(roomUuid, field, value);
    });

    // add special to room
    $('#form-add-special').off('submit').on('submit', async function(e) {
        e.preventDefault();
        await tables.addSpecialToRoomClick();         
        $('#form-add-special').trigger("reset");
        UIkit.modal('#add-special').hide(); 
    });     

    // open copy room modal
    $('#copy_room').off('click').on('click', async function(e) {
        e.preventDefault();    
        const floors = await db.getFloors(project_id);
        let floorOptions = floors.map(floor => `<option value="${floor.uuid}">${floor.name}</option>`).join('');
        $('#copy-room-modal select#modal_form_floor').html(floorOptions);

        UIkit.modal('#copy-room-modal', { stack : true }).show();       
    });

    // copy room modal submitted
    $('#form-copy-room').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const roomUuid = $('#m_room_id').val();        
        const newRoomName = $('#modal_form_new_name').val();
        const newFloorUuid = $('#modal_form_floor').find(":selected").val();

        const newRoomUuid = await db.copyRoom(roomUuid, newRoomName, newFloorUuid);
        await renderSidebar(project_id); // project_id
        await loadRoomData(newRoomUuid);
        UIkit.modal('#copy-room-modal').hide(); 
    });    

    // add note button click
    $('#add-note').off('click').on('click', async function(e) {
        e.preventDefault();
        $('#edit_note_uuid').val('');
        $('#modal_form_note').val('');
        UIkit.modal('#add-note-modal', { stack : true }).show();
    });

    // add note modal submitted
    $('#form-add-note').off('submit').on('submit', async function(e) {
        e.preventDefault();
        const editNoteUuid = $('#edit_note_uuid').val();        
        const roomUuid = $('#m_room_id').val();        
        const note = $('#modal_form_note').val();        

        // editing, just delete the old one and recreate (does mean the created date will also be updated)
        if (editNoteUuid != "") {
            await db.removeNoteByUUID(editNoteUuid);
        }

        await db.addNote(roomUuid, note);
        await loadRoomData(roomUuid);
        await loadRoomNotes(roomUuid);
        UIkit.modal('#add-note-modal').hide(); 
    });    

}
/* 
    // End tablesFunctions 
*/


/*
*   Home page functions
*/
const homeFunctions = async () => {
    console.log('Running home functions v2');

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

    UIkit.offcanvas('.tables-side').hide();


    var dashTable = renderProjectsTable();
    //dashTable.setData(data);

    $('#btn-create-project').off('click').on('click', async function(e) {
        e.preventDefault();
        $('#form-create-project').trigger("reset");        
        UIkit.modal('#create-project', { stack : true }).show();
        $('#form_project_name').focus();
    });    

    /* Add project related binds */
    $('#form_project_name').off('focus').on('focus', function(e) {
        $('#form_location').attr({'disabled':'disabled'});
        $('#form_building').attr({'disabled':'disabled'});
    });
    $('#form_project_name').off('blur').on('blur', function(e) {
        if ($(this).val() != "") {
            $('#form_location').removeAttr('disabled').focus();
        }
    });
    $('#form_location').off('blur').on('blur', function(e) {
        if ($(this).val() != "") {
            $('#form_building').removeAttr('disabled').focus();
        }
    });
    $('#form_building').off('blur').on('blur', function(e) {
        if ($(this).val() != "") {
            $('#form_floor').removeAttr('disabled').focus();
        }
    });   
    $('#form_floor').off('blur').on('blur', function(e) {
        if ($(this).val() != "") {
            $('#form_room').removeAttr('disabled').focus();
        }
    });     
    
    $('#form-create-project').off('submit').on('submit', function(e) {
        e.preventDefault();
        createProject();              
    });        


};
/* 
    // END homeFunctions 
*/


/*
*   Schedule functions
*/
const scheduleFunctions = async () => {
    console.log('Running schedule functions v2');
    UIkit.offcanvas('.tables-side').hide();

    let projectId = $('#m_project_id').val();
    if (projectId == "") {
        // get from local storage
        const currentProject = JSON.parse(localStorage.getItem('currentProject') || '{}');
        if (currentProject.project_id) {
            projectId = currentProject.project_id;
        } else {
            console.error('No project id found');
            return;
        }
    }

    const pdata = await db.getProjectByUUID(projectId);

    $('#m_project_slug').val(pdata.slug);
    $('#m_project_version').val(pdata.version);

    $('#info_project_name').html(pdata.name);
    $('#info_project_id').html(pdata.project_id);    
    $('#info_engineer').html(pdata.engineer);
    $('#info_date').html(new Date(pdata.last_updated).toLocaleDateString('en-GB'));

    const sdata = await db.getProductsForProject(projectId);

    let tabledata = sdata.map(product => ({
        uuid: product.uuid,
        product_slug: product.product_slug,
        product_name: product.product_name,                
        ref: product.ref,
        qty: product.qty,
        sku: product.sku        
    }));       

    var sTable = new Tabulator("#stable", {
        data: tabledata,
        layout: "fitColumns",
        loader: false,
        dataLoaderError: "There was an error loading the data",
        downloadEncoder: function(fileContents, mimeType){
            generateDataSheets(fileContents);
        },
        columns: [{
                title: "id",
                field: "uuid",
                visible: false
            },
            {
                title: "Product",
                field: "product_name",
                hozAlign: "left",
                visible: false
            },
            {
                title: "Qty",
                field: "qty",                
                hozAlign: "left",
            },
            {
                title: "SKU",
                field: "sku",
                width: "50%"
            },
            {
                title: "Ref",
                field: "ref",
                visible: true,                
            }

        ],
    });


    $('#gen_datasheets,#gen_schedules_confirm').off('click').on('click', function(e) {
        e.preventDefault();
        if ($('#include_schedule').is(':checked') == false &&
            $('#include_datasheets').is(':checked') == false) {
                alert('Nothing to generate, please select an option');
                return(false);
        }

        // trigger the   download, which is intercepted and triggers
        // generateDataSheets()
        sTable.download("json", "data.json", {}, "visible");
    });
    
    $('#form-submit-folio-progress').off('submit').on('submit', function(e) {
        e.preventDefault();        
        const filename = pdata.slug;
        if (pdata.version > 1) {
            filename = filename+"-v" + pdata.version;
        }        
        const buster = utils.makeid(10);
        UIkit.modal($('#folio-progress')).hide();
        window.open("https://staging.tamlite.co.uk/pdfmerge/"+filename+".pdf?t="+buster, '_blank');
    });    


}
/*
* // End Schedule functions
*/


/*
* Account Page functions
*/
const accountFunctions = async () => {
    console.log('Running account functions v2');
    // get this user details from the store
    const user = await db.getUser(8);
    
    $('#name').val(user.name);
    $('#email').val(user.email);
    $('#password').val(user.password);
    $('#code').val(user.code);


    $('#form-update-account').off('submit').on('submit', async function(e) {
        e.preventDefault();
        console.log('Update account clicked');
        // build the user object from submitted form fields
        const formdata = {            
            name: $('#name').val(),
            email: $('#email').val(),
            password: $('#password').val(),
            code: $('#code').val()
        }        

        await db.updateUser(formdata, 8);
        UIkit.notification('Account updated', {status:'success',pos: 'bottom-center',timeout: 1500});
    });

}
/*
* // End account page functions
*/



/*
* Generate Data Sheets related functions
*/
async function generateDataSheets(data) {
    UIkit.modal($('#folio-progress')).show();
    const schedule_type = $('input[name=schedule_type]:checked').val();
    const project_id = $('input#m_project_id').val();
    if (schedule_type == "by_project") {
        jsonData = data; // the schedule table data for a full project schedule
        callGenSheets(schedule_type);
    } else {
        try {            
            jsonData = await db.getSchedulePerRoom(project_id); // Wait for the data
            callGenSheets(schedule_type); // Call with the resolved data
        } catch (error) {
            console.error("Error fetching schedule per room:", error);
            alert("Failed to fetch schedule data. Please try again.");
        }
    }
}

async function callGenSheets(schedule_type) {
    $('.uk-progress').val(10);
    $('#download_datasheets').prop("disabled", true);
    $('#progress-text').text("Gathering Data ...");

    $.ajax({
        url: "https://staging.tamlite.co.uk/ci_index.php/download_schedule",
        type: "POST",
        data: {
            project_slug: $('#m_project_slug').val(),
            project_version: $('#m_project_version').val(),
            info_project_name: $('#info_project_name').text(),
            info_project_id: $('#info_project_id').text(),
            info_engineer: $('#info_engineer').text(),
            info_date: $('#info_date').text(),
            include_schedule: $('#include_schedule').is(':checked'),
            include_datasheets: $('#include_datasheets').is(':checked'),
            schedule_type: schedule_type,
            skus: jsonData,
        },
        xhr: function () {
            const xhr = new window.XMLHttpRequest();
            let lastProcessedIndex = 0;
            xhr.onprogress = function () {
                const responseText = xhr.responseText.trim();
                const lines = responseText.split('\n');

                for (let i = lastProcessedIndex; i < lines.length; i++) {
                    const line = lines[i].trim();

                    //console.log(line);
                    if (!line) {
                        continue;
                    }
                    try {
                        const update = JSON.parse(line);
                        if (update.step && update.total) {
                            const percentage = (update.step / (update.total - 1)) * 100;
                            $('#progress-text').text(update.message);
                            $('.uk-progress').val(percentage);
                        }
                        if (update.complete) {
                            console.log('Processing complete:', update);
                            $('.uk-progress').val(100);
                            $('#progress-text').text(update.message);
                            $('#download_datasheets').prop("disabled", false);
                        }
                    } catch (e) {
                        console.warn("Skipping invalid JSON line:", line, e);
                    }
                }
                lastProcessedIndex = lines.length;
            };
            return xhr;
        },
        success: function () {
        },
        error: function (xhr, status, error) {
            if (status === "timeout") {
                alert("The request timed out. Please try again later.");
            } else {
                // todo: this is actually firing but all works ok, debug
                //console.error("An error occurred:", status, error);
            }
        },
        timeout: 310000, // 310 seconds (5 minutes + buffer)
    });
}
/*
* // end Generate Data Sheets
*/



/*
* Get all projects (for this user) and render the table
*/
async function renderProjectsTable() {

    const projects = await db.getProjects();
    let tabledata = projects.map(project => ({
        project_name: project.name,
        project_slug: project.slug,
        version: project.version,
        project_id: project.uuid,
        project_ref: project.project_id,
        created: new Date(project.created_on).toLocaleDateString('en-GB'),
        products: project.products_count
    }));     

    var dashTable = new Tabulator("#dashboard_projects", {
        data: tabledata,            
        loader: false,
        layout: "fitColumns",
        dataLoaderError: "There was an error loading the data",
        initialSort:[
            {column:"project_name", dir:"asc"}, 
        ],
        columns: [{
                title: "project_id",
                field: "project_id",
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
                    const projectData = cell.getRow().getData();                    
                    localStorage.setItem('currentProject', JSON.stringify(projectData));
                    $('#m_project_id').val(projectData.project_id);
                    window.router('tables', projectData.project_id);                    
                }
            },
            {
                title: "Project ID",
                field: "project_ref",
                width: 200,
                visible: true
            },
            {
                title: "Products",
                field: "products",
                width: 120,
                visible: false
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
                visible: true
            },
            {                    
                visible: true,
                headerSort: false,
                formatter: utils.iconCopy,
                width: 80,
                hozAlign: "center",
                cellClick: function (e, cell) {
                    copyProject(cell.getRow().getData().project_id);
                }
            },
            {                    
                visible: false,
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
}






// 
// renderSidebar
// 
async function renderSidebar(project_id) {
    project_id.toString();
    console.log('Rendering sidebar for project:', project_id);

    const projectStructure = await db.getProjectStructure(project_id); // project_id              
    const sidemenuHtml = await sidebar.generateNavMenu(projectStructure);   

    $('.locations').html(sidemenuHtml);

    /* Project Click - load project data */
    $('a.edit-project-link').off('click').on('click', async function(e) {
        e.preventDefault();
        await loadProjectData(project_id);
    });    



    /* Room Click - load room data */
    $('a.room-link').off('click').on('click', async function(e) {
        e.preventDefault();
        await loadRoomData($(this).data('id'));
        await loadRoomNotes($(this).data('id'));
        await loadRoomImages($(this).data('id'));
    });    

    /* Add Room Click - add a new room */
    $('span.add-room a').off('click').on('click', async function(e) {
        e.preventDefault();
        const floorUuid = $(this).data('id');   
        const roomName = await UIkit.modal.prompt('<h4>Enter the room name</h4>');
        if (roomName) {
            const roomUuid = await db.addRoom(floorUuid, roomName);
            UIkit.notification('Room added', {status:'success',pos: 'bottom-center',timeout: 1500});
            await renderSidebar(project_id); // project_id
        }   
    });

    /* Add FLoor Click - add a new floor */
    $('span.add-floor a').off('click').on('click', async function(e) {
        e.preventDefault();
        const buildingUuid = $(this).data('id');   
        const floorName = await UIkit.modal.prompt('<h4>Enter the floor name</h4>');
        if (floorName) {
            const floorUuid = await db.addFloor(buildingUuid, floorName);
            UIkit.notification('Floor added', {status:'success',pos: 'bottom-center',timeout: 1500});
            await renderSidebar(project_id); // project_id
        }   
    });

    /* Add building Click - add a new building */
    $('span.add-building a').off('click').on('click', async function(e) {
        e.preventDefault();
       
        const locationUuid = $(this).data('id');   
        const buildingName = await UIkit.modal.prompt('<h4>Enter the building name</h4>');
        if (buildingName) {
            const buildingUuid = await db.addBuilding(locationUuid, buildingName);                                
            UIkit.notification('building added', {status:'success',pos: 'bottom-center',timeout: 1500});
            await renderSidebar(project_id); // project_id
        }   
    });     
    
    $('li.room-item span.action-icon.room').off('click').on('click', async function(e) {
        e.preventDefault();            
        const that = this;
        const msg = '<h4 class="red">Warning</h4><p>This will remove the room and <b>ALL products</b> in the room!</p';
        UIkit.modal.confirm(msg).then( async function() {
            const roomUuid = $(that).data('id');   
            console.log('Removing room:', roomUuid);
            const roomName = await db.removeRoom(roomUuid);                                
            console.log('Removed room:', roomName);
            UIkit.notification('Room removed', {status:'success',pos: 'bottom-center',timeout: 1500});
            await renderSidebar(project_id); // project_id                    
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
            UIkit.notification('Floor and rooms removed', {status:'success',pos: 'bottom-center',timeout: 1500});
            await renderSidebar(project_id); // project_id                    
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
            UIkit.notification('building, floors and rooms removed', {status:'success',pos: 'bottom-center',timeout: 1500});
            await renderSidebar(project_id); // project_id                    
        }, function () {
            console.log('Cancelled.')
        });        
    });  
      

    // update project details
    $('#form-update-project').off('submit').on('submit', async function(e) {
        e.preventDefault();        
        const project_id = $('#m_project_id').val();
        await tables.updateProjectClick(project_id);
        await renderSidebar(project_id);
        UIkit.modal('#edit-project-modal').hide(); 
    });     

}
// 
// End renderSidebar
// 


/* 
* Create Project
*/
async function createProject() {
    const project_name = $('#form_project_name').val();
    const location = $('#form_location').val();
    const building = $('#form_building').val();
    const floor = $('#form_floor').val();
    const room = $('#form_room').val();
    const project_id = await db.createProject(project_name, location, building, floor, room);    
    await renderSidebar(project_id); 
    await renderProjectsTable();
    UIkit.modal('#create-project').hide();
}

/* 
* Copy Project
*/
async function copyProject(project_id) {
    const projectData = await db.getProjectByUUID(project_id);
    const projectName = await UIkit.modal.prompt('<h4>Enter the new project name</h4>', projectData.name + ' - Copy');
    if (projectName) {
        const newProjectId = await db.copyProject(project_id, projectName);
        await renderProjectsTable();
        UIkit.notification('Project copied', {status:'success',pos: 'bottom-center',timeout: 1500});
    }
}

async function loadProjectData(projectId) {    
    $('#m_project_id').val(projectId);
    if (!projectId) return;
    projectId = projectId.toString();
    const projectData = await db.getProjectByUUID(projectId);
    localStorage.setItem('currentProject', JSON.stringify(projectData));

    $('#form_edit_project_name').val(projectData.name);
    $('#form_edit_project_id').val(projectData.project_id);
    $('#form_edit_project_engineer').val(projectData.engineer);    
    $('#form_edit_project_version').val(projectData.version);

    UIkit.modal('#edit-project-modal', { stack : true }).show();
}    


async function loadRoomData(roomId) {
    $('#m_room_id').val(roomId);   
    if (!roomId) return;     
    roomId = roomId.toString();
    roomId = "" + roomId;
    // get the names for the location, building, floor and room based on this roomId.
    const roomMeta = await db.getRoomMeta(roomId);        
    $('.name.location_name').html(roomMeta.location.name).attr('data-id', roomMeta.location.uuid);
    $('.name.building_name').html(roomMeta.building.name).attr('data-id', roomMeta.building.uuid);
    $('.name.floor_name').html(roomMeta.floor.name).attr('data-id', roomMeta.floor.uuid);
    $('.name.room_name').html(roomMeta.room.name).attr('data-id', roomMeta.room.uuid);

    $('#room_height').val(roomMeta.room.height);
    $('#room_width').val(roomMeta.room.width);
    $('#room_length').val(roomMeta.room.length);

    await tables.refreshTableData(roomId);
}

async function loadRoomNotes(roomId) {
    $('#m_room_id').val(roomId);   
    if (!roomId) return;         
    roomId = "" + roomId;
    
    const roomNotes = await db.getRoomNotes(roomId);  
    // iterate the notes and build html to display them as a list. also add a delete icon to each note and shot the date created in dd-mm-yyy format
    let notesHtml = roomNotes.map(note => 
        `<li class="note">
        <p class="note-date">${new Date(note.created_on).toLocaleDateString('en-GB')}</p>
        <div class="note-actions">
            <span data-uuid="${note.uuid}" class="icon edit_note" uk-icon="icon: file-edit; ratio: 1" title="Edit"></span>    
            <span data-uuid="${note.uuid}" class="icon red delete_note" uk-icon="icon: trash; ratio: 1" title="Delete"></span>            
        </div>

        <p class="note-text ${note.uuid}">${note.note}</p>
        </li>`).join('');
    $('#room_notes').html(notesHtml);


    $('.note-actions .edit_note').off('click').on('click', async function(e) {
        e.preventDefault();
        const noteUuid = $(this).data('uuid');
        const noteText = $(`.note-text.${noteUuid}`).text();
        $('#edit_note_uuid').val(noteUuid);
        $('#modal_form_note').val(noteText);
        UIkit.modal('#add-note-modal', { stack : true }).show();       
    });      


    $('.note-actions .delete_note').off('click').on('click', async function(e) {
        e.preventDefault();
        const noteUuid = $(this).data('uuid');
        UIkit.modal.confirm('Are you sure you want to delete this note?').then(async function() {
            await db.removeNoteByUUID(noteUuid);
            await loadRoomNotes($('#m_room_id').val());
            UIkit.notification('Note Deleted', {status:'success',pos: 'bottom-center',timeout: 1500});
        }, function () {
            console.log('Delete note cancelled.');
        });
    });    
    
}

async function loadRoomImages(roomId) {
    $('#m_room_id').val(roomId);   
    if (!roomId) return;         
    roomId = "" + roomId;
    
    const roomImages = await db.getRoomImages(roomId);        

    console.log('Room images:', roomImages);
}



module.exports = {
    homeFunctions,
    tablesFunctions,
    scheduleFunctions,
    accountFunctions 
};

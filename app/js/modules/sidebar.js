const Mustache = require('mustache');
const db = require('../db');
const tables = require('./tables');



class SidebarModule {
    constructor() {
        this.menuHtml = '';
        this.isInitialized = false;           
    }

    init() {
        if (this.isInitialized) return;
        Mustache.tags = ["[[", "]]"];
        this.isInitialized = true;        
    }

    async generateFavourites(data)  {
        if (!data) return '<div>No favourites available</div>';                
        let html = '';

        // sort favourites by product_name and add all sku's with the same product_name to a child object. 
        // This will allow us to display the product_name once and all sku's under it.
        let sorted = data.reduce((acc, item) => {
            if (!acc[item.product_name]) {  
                acc[item.product_name] = [];
            }
            acc[item.product_name].push(item);
            return acc; 
        }, {});

        // loop through the sorted object and generate the html as a list with product_name and sku's
        Object.keys(sorted).forEach(key => {    
            html += `<li class="product-item">
                    <span class="product-name" uk-icon="icon: folder;"></span> 
                    <span class="product-name"><a data-product="${key}" href="#">${key}</a></span>
                <ul class="sku-list">`;
            sorted[key].forEach(item => {   
                html += `
                    <li class="sku-item">
                        <span class="sku-name"><a class="add-fav-to-room" data-sku="${item.sku}" href="#">${item.sku}</a></span>
                        <span uk-icon="minus-circle" class="action-icon remove-product-from-favs" data-uuid="${item.uuid}" data-action="remove"></span>
                    </li>`;
            });
            html += `</ul></li>`;
        });  

        return html;
    }

    
    // 
    // renderFavourites
    //     
    async renderFavourites(user_id) {        
        user_id.toString();        
        const favourites =  await db.getFavourites(user_id);        
        const sidemenuHtml = await this.generateFavourites(favourites);           

        $('.favourites').html(sidemenuHtml);

        $('.add-fav-to-room').off('click').on('click', async function(e) {
            e.preventDefault();
            const sku = $(this).data('sku');
            const room_id = $('#m_room_id').val();          
            await db.addFavouriteToRoom(sku, room_id);
            UIkit.notification('Favourite added to room', {status:'success',pos: 'bottom-center',timeout: 1500});
            tables.renderProdctsTable(room_id);
        });

        $('.action-icon.remove-product-from-favs').off('click').on('click', async (e) => {  //arrow function preserves the context of this
            e.preventDefault();
            const uuid = $(e.currentTarget).data('uuid');
            await db.removeFavourite(uuid);
            UIkit.notification('Favourite removed', {status:'success',pos: 'bottom-center',timeout: 1500});            
            await this.renderFavourites(user_id);
        });
    }    


    async generateNavMenu(data) {
        if (!data) return '<div>No project structure available</div>';                
        let html = '';

        // Manage project link
        html += `
        <li class="project-item">
            <a href="#" class="edit-project-link" data-id="${data.project_id}">
                <span class="project-name" uk-icon="icon: folder;"></span> ${data.project_name}
            </a>
        </li>`;

        // Process locations
        Object.keys(data).forEach(key => {
            if (key !== 'project_name' && key !== 'project_slug' && key !== 'project_id') {
                const location = data[key];
                html += this.processLocation(key, location, data.project_id);
            }
        });

        return html;
    }

    processLocation(slug, location, projectId) {
        let html = `
        <li class="location-item">
            <div class="location-header">
                <span class="location-name">
                    <span uk-icon="icon: location;"></span> ${location.location_name}
                </span>
                <div class="action-icons location">                    
                    <span uk-icon="minus-circle" class="action-icon" data-id="${location.location_id}" data-action="remove"></span>
                </div>
            </div>
            <ul class="building-list">`;

        // Process buildings
        Object.keys(location).forEach(key => {
            if (key !== 'location_name' && key !== 'location_slug' && key !== 'location_id') {
                const building = location[key];
                html += this.processBuilding(key, building, projectId);
            }
        });

        // Add "Add Building" option
        html += `
                <li class="building-item">
                    <span class="add-building">
                        <a href="#" data-id="${location.location_id}" data-action="add">Add Building</a>
                    </span>
                </li>
            </ul>
        </li>`;

        return html;
    }

    processBuilding(slug, building, projectId) {
        let html = `
        <li class="building-item">
            <h4 class="building-header">
                <span class="building-name">
                    <span uk-icon="icon: home;"></span> ${building.building_name}
                </span>
                <div class="action-icons building">
                    <span uk-icon="minus-circle" class="action-icon building" data-id="${building.building_id}" data-action="remove"></span>
                </div>
            </h4>
            <ul class="floor-list">`;

        // Process floors
        Object.keys(building).forEach(key => {
            if (key !== 'building_name' && key !== 'building_slug' && key !== 'building_id') {
                const floor = building[key];
                html += this.processFloor(key, floor, projectId);
            }
        });

        // Add "Add Floor" option
        html += `
                <li class="floor-item">
                    <span class="add-floor">
                        <a href="#" data-id="${building.building_id}" data-action="add">Add Floor</a>
                    </span>
                </li>
            </ul>
        </li>`;

        return html;
    }

    processFloor(slug, floor, projectId) {
        let html = `
        <li class="floor-item">
            <div class="floor-header">
                <a href="#" data-id="${floor.floor_id}">
                    <span class="floor-name">
                        <span uk-icon="icon: table;"></span> ${floor.floor_name}
                    </span>
                </a>
                <div class="action-icons floor">
                    <span uk-icon="minus-circle" class="action-icon floor" data-id="${floor.floor_id}" data-action="remove"></span>
                </div>
            </div>
            <ul class="room-list">`;

        // Process rooms
        Object.keys(floor).forEach(key => {
            if (key !== 'floor_name' && key !== 'floor_slug' && key !== 'floor_id') {
                const room = floor[key];
                html += this.processRoom(key, room, projectId);
            }
        });

        // Add "Add Room" option
        html += `
                <li class="room-item add-room">
                    <span class="add-room">
                        <a href="#" data-action="add" data-id="${floor.floor_id}">Add Room</a>
                    </span>
                </li>
            </ul>
        </li>`;

        return html;
    }

    processRoom(slug, room, projectId) {
        return `
        <li class="room-item view-room">
            <span class="room-name">
                <a href="#" class="room-link" data-id="${room.room_id}">
                    <span uk-icon="icon: move;"></span> ${room.room_name}
                </a>
            </span>
            <span uk-icon="minus-circle" class="action-icon room" data-id="${room.room_id}" data-action="remove"></span>
        </li>`;
    }
}

module.exports = new SidebarModule();
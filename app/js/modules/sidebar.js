const Mustache = require('mustache');

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

    async generateNavMenu(data) {
        if (!data) return '<div>No project structure available</div>';
        
        console.log('Received project structure:', data);
        let html = '';

        // Process locations
        Object.keys(data).forEach(key => {
            if (key !== 'project_name' && key !== 'project_slug' && key !== 'project_id') {
                const location = data[key];
                html += this.processLocation(key, location, data.project_id);
            }
        });

        // Add "Add Location" at the end
        html += `
        <ul class="building-list">
            <li class="building-item">
                <p><a class="add-location" href="#" data-id="${data.project_id}" data-action="add">Add Location</a></p>
            </li>
        </ul>`;

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
                    <i class="fa-solid fa-circle-minus" data-id="${location.location_id}" data-action="remove"></i>
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
                    <p><a href="#" data-id="${location.location_id}" data-action="add">Add Building</a></p>
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
                    <i class="fa-solid fa-circle-minus" data-id="${building.building_id}" data-action="remove"></i>
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
                    <span class="floor-name">
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
                <a href="/plan/${projectId}/${floor.floor_id}" data-id="${floor.floor_id}">
                    <span class="floor-name">
                        <span uk-icon="icon: table;"></span> ${floor.floor_name}
                    </span>
                </a>
                <div class="action-icons floor">
                    <i class="fa-solid fa-circle-minus" data-id="${floor.floor_id}" data-action="remove"></i>
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
                    <span class="room-name">
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
                <a href="/tables/${projectId}/${room.room_id}" data-id="${room.room_id}">
                    <span uk-icon="icon: move;"></span> ${room.room_name}
                </a>
            </span>
            <i class="fa-solid fa-circle-minus action-icon" data-id="${room.room_id}" data-action="remove"></i>
        </li>`;
    }
}

module.exports = new SidebarModule();
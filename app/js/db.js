const { openDB } = require('idb');
const utils = require('./modules/utils');


const DB_NAME = 'sst_database';
const DB_VERSION = 18;
const STORE_NAME = 'product_data';

// Custom function to generate UUIDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


async function initDB() {    
    return await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Check and create existing store for products
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                console.log('Creating object store for products...');
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'product_code' });
                store.createIndex('site', 'site', { unique: false });                
            }
            if (!db.objectStoreNames.contains("projects")) {
                const store = db.createObjectStore("projects", { keyPath: "uuid" });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }
            if (!db.objectStoreNames.contains("locations")) {
                const store = db.createObjectStore("locations", { keyPath: "uuid" });
                store.createIndex("project_id_fk", "project_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }
            if (!db.objectStoreNames.contains("buildings")) {
                const store = db.createObjectStore("buildings", { keyPath: "uuid" });
                store.createIndex("location_id_fk", "location_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }
            if (!db.objectStoreNames.contains("floors")) {
                const store = db.createObjectStore("floors", { keyPath: "uuid" });
                store.createIndex("building_id_fk", "building_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false }); 
            }
            if (!db.objectStoreNames.contains("rooms")) {
                const store = db.createObjectStore("rooms", { keyPath: "uuid" });
                store.createIndex("floor_id_fk", "floor_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false }); 
                store.createIndex('room_id_fk', 'room_id_fk', { unique: false });
            }
            if (!db.objectStoreNames.contains("products")) {
                const store = db.createObjectStore("products", { keyPath: "uuid" });
                store.createIndex("room_id_fk", "room_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }
            if (!db.objectStoreNames.contains("favourites")) {
                const store = db.createObjectStore("favourites", { keyPath: "uuid" });
                store.createIndex("sku_owner", ["sku", "owner_id"], { unique: true });
                store.createIndex('owner_id', 'owner_id', { unique: false }); 
            }            
            if (!db.objectStoreNames.contains("notes")) {
                const store = db.createObjectStore("notes", { keyPath: "uuid" });
                store.createIndex("room_id_fk", "room_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }            
            if (!db.objectStoreNames.contains("images")) {
                const store = db.createObjectStore("images", { keyPath: "uuid" });
                store.createIndex("room_id_fk", "room_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }   
            if (!db.objectStoreNames.contains("users")) {
                const store = db.createObjectStore("users", { keyPath: "uuid" });                
                store.createIndex('email', 'email', { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false });
            }            


            console.log("IndexedDB initialized with UUIDs and owner_id indexes.");
        },
    });
}

async function fetchAndStoreProducts() {
    const isEmpty = await isProductsTableEmpty();
    if (isEmpty) {
        try {
            console.log('Fetching products from API...');
            const response = await fetch('https://sst.tamlite.co.uk/api/get_all_products_neat');

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const products = await response.json();
            await saveProducts(products);
            console.log('Products fetched and saved to IndexedDB');
        } catch (error) {
            console.error('Error fetching product data:', error);
        }
    } else {
        console.log('Product data is present in indexedDB, skipping fetch.');
    }
}

async function fetchAndStoreUsers() {
    const isEmpty = await isUsersTableEmpty();
    if (isEmpty) {
        try {
            console.log('Fetching products from API...');
            const response = await fetch('https://sst.tamlite.co.uk/api/get_all_users_neat');

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const users = await response.json();
            await saveUsers(users);
                console.log('Auth saved to IndexedDB');
        } catch (error) {
            console.error('Error fetching auth data:', error);
        }
    } else {
        console.log('Auth data is present in indexedDB, skipping fetch.');
    }
}


async function pullUserData(owner_id) {
    if (!owner_id) {
        console.error('No owner_id provided for data sync');
        return false;
    }    
    owner_id = owner_id+""; // ensure it's a string
    const userData = {"user_id": owner_id}; // Use the owner_id variable

    // user has projects, offer to pull from and show the pushed date on the user table for information
    try {
        const response = await fetch("https://sst.tamlite.co.uk/api/get_last_pushed", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });    
        if (!response.ok) { throw new Error(`Server error: ${response.status}`); }
        const data = await response.json(); 
        console.log("pushed: ", data.pushed); 
        const lastPushed = new Date(data.pushed);
        const lastPushedStr = lastPushed.toLocaleString();
        const lastPushedEpoch = lastPushed.getTime();
        const lastPushedEpochStr = lastPushedEpoch.toString();
        // offer a uikit confirm dialog to pulll data, showing the last pushed date and time
        const str = `<h4>Your last push to the server was <br><b>${lastPushedStr}</b></h4> <p>Would you like to pull this data?</p>`
        +`<p style="color: red; font-weight: bold"><small>Clicking OK will overwrite any local changes since this date.</small>`;
        UIkit.modal.confirm(str).then(function() {
            console.log('Confirmed.')
            syncData(owner_id, true);      
        }, function () {
            console.log('Rejected.')
            return false;
        });
        
        
    } catch (error) { console.error("Data sync failed:", error); }        
        
    return true;
}


async function syncData(owner_id, force = false) {
    if (!owner_id) {
        console.error('No owner_id provided for data sync');
        return false;
    }    
    owner_id = owner_id+""; // ensure it's a string
    const userData = {"user_id": owner_id}; // Use the owner_id variable

    if (!navigator.onLine) {
        console.log('Wont sync as offline');
        return false;
    }
    //const isEmpty = await isDatabaseEmpty();  // nah I think we'll grab JUST the user data IF theer is none already
    const hasProjects = await getProjects(owner_id);    

    // user has projects, offer to pull from and show the pushed date on the user table for information
    if (hasProjects.length > 0 && !force) {
        console.log('Local Projects exist. Not forcing. Dont sync.');        
        return false;
    }

    if (force) {
        console.log('forcing userdata PULL');
    }
        
    try {
        const response = await fetch("https://sst.tamlite.co.uk/api/get_all_user_data", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();        
        const dbRequest = indexedDB.open(DB_NAME, DB_VERSION);
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(
                ["projects", "locations", "buildings", "floors", "rooms", "products", "favourites", "notes", "images"],
                "readwrite" );

                ["projects", "locations", "buildings", "floors", "rooms", "products", "favourites", "notes", "images"].forEach(
                (storeName) => {
                    const store = transaction.objectStore(storeName);
                    store.clear();  // Clear existing data

                    // Convert single object to array if needed
                    const items = Array.isArray(data[storeName]) ? data[storeName] : [data[storeName]];
                    items.forEach(item => {
                        if (!item || !item.id) {
                            console.error(`Missing ID in ${storeName}:`, item);
                        } else {
                            item.uuid = item.id;  // Map 'id' to 'uuid' for IndexedDB
                            item.owner_id = owner_id + ""; // Add owner_id
                            item.room_id_fk = item.room_id_fk || item.uuid; // todo: check if this is correct (different for products, notes, images)
                            delete item.id;        // Remove the original 'id' field to avoid conflicts
                            store.put(item);
                        }
                    });
                }
            );
            // update the users table "pulled" column with durrent datetime
            setPulled(owner_id);
            UIkit.notification({message: 'Data Fetch Complete ...', status: 'success', pos: 'bottom-center', timeout: 1500 });
            console.log("Data synced to IndexedDB successfully.");
            return(true);            
        };
    } catch (error) {
        console.error("Data sync failed:", error);
    }
}

async function setPulled(owner_id) {
    const db = await initDB();
    const tx = db.transaction("users", "readwrite");
    const store = tx.objectStore("users");
    const user = await store.get(owner_id);        
    user.pulled = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await store.put(user);
    await tx.done;
}

async function isDatabaseEmpty() {
    const db = await initDB();
    const projectCount = await db.count('projects');
    const locationCount = await db.count('locations');
    const buildingCount = await db.count('buildings');
    const floorCount = await db.count('floors');
    const roomCount = await db.count('rooms');
    const productCount = await db.count('products');

    return projectCount === 0 && locationCount === 0 && buildingCount === 0 && floorCount === 0 && roomCount === 0 && productCount === 0;
}

async function isProductsTableEmpty() {
    const db = await initDB();
    const count = await db.count(STORE_NAME);
    return count === 0;
}

async function isUsersTableEmpty() {
    const db = await initDB();
    const count = await db.count('users');
    return count === 0;
}

async function saveProducts(data) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const product of data) {
        await store.put(product);
    }

    await tx.done;
    console.log('Products stored in IndexedDB');
}

async function saveUsers(data) {
    const db = await initDB();
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');

    for (const user of data) {
        await store.put(user);
    }

    await tx.done;
    console.log('Auth stored in IndexedDB');
}

async function getProducts() {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);    
    return await store.getAll();
}


async function createProject(project_name, location, building, floor, room) {
    const db = await initDB();
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    const newProjectID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const projectSlug = await utils.slugify(project_name);
    const project = {
        created_on: now,
        last_updated: now,
        name: project_name,
        owner_id: await utils.getUserID(), 
        project_id_fk: newProjectID,
        slug: projectSlug,
        uuid: newProjectID,
        version: "1"
    };

    await store.add(project);
    await tx.done;

    const locationID = await addLocation(newProjectID, location);
    const buildingID = await addBuilding(locationID, building);
    const floorID = await addFloor(buildingID, floor);
    const roomID = await addRoom(floorID, room);

    return project.uuid;
}

async function getProjects(user_id) {
    const db = await initDB();
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const index = store.index('owner_id');
    user_id = user_id + "";
    return await index.getAll(user_id);    
}

async function getProjectHierarchy(owner_id, project_id) {
    console.log("Fetching from IndexedDB for project_id:", project_id);
    const db = await initDB();
    owner_id = String(owner_id);

    let projects = await db.getAllFromIndex('projects', 'owner_id', owner_id);

    // Filter projects by project_id
    if (project_id) {
        projects = projects.filter(project => project.uuid === project_id);
        console.log("Filtered Projects:", projects);
    } else {
        console.log('No project ID, getting all projects');
    }

    return {
        projects: projects || [],
        locations: await db.getAllFromIndex('locations', 'owner_id', owner_id) || [],
        buildings: await db.getAllFromIndex('buildings', 'owner_id', owner_id) || [],
        floors: await db.getAllFromIndex('floors', 'owner_id', owner_id) || [],
        rooms: await db.getAllFromIndex('rooms', 'owner_id', owner_id) || []
    };
}

async function getProductsForRoom(roomId) {
    const db = await initDB();
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    const index = store.index("room_id_fk");     
    roomId = String(roomId);
    return await index.getAll(roomId);
}

async function getProductsForProject(projectId) {
    const db = await initDB();
    projectId = String(projectId);   

    const tx = db.transaction(["products", "rooms", "floors", "buildings", "locations", "projects"], "readonly");

    const productStore = tx.objectStore("products");
    const roomStore = tx.objectStore("rooms");
    const floorStore = tx.objectStore("floors");
    const buildingStore = tx.objectStore("buildings");
    const locationStore = tx.objectStore("locations");
    const projectStore = tx.objectStore("projects");

    const products = await productStore.getAll();
    const rooms = await roomStore.getAll();
    const floors = await floorStore.getAll();
    const buildings = await buildingStore.getAll();
    const locations = await locationStore.getAll();
    const projects = await projectStore.getAll();

    const projectProducts = products.filter(product => {
        const room = rooms.find(room => room.uuid === product.room_id_fk);
        if (!room) return false;
        const floor = floors.find(floor => floor.uuid === room.floor_id_fk);
        if (!floor) return false;
        const building = buildings.find(building => building.uuid === floor.building_id_fk);
        if (!building) return false;
        const location = locations.find(location => location.uuid === building.location_id_fk);
        if (!location) return false;
        const project = projects.find(project => project.uuid === location.project_id_fk);
        return project && project.uuid === projectId;
    });

    const result = projectProducts.reduce((acc, product) => {
        const existingProduct = acc.find(p => p.sku === product.sku);
        if (existingProduct) {
            existingProduct.qty += 1;
        } else {
            const room = rooms.find(room => room.uuid === product.room_id_fk);
            const floor = floors.find(floor => floor.uuid === room.floor_id_fk);
            const building = buildings.find(building => building.uuid === floor.building_id_fk);
            const location = locations.find(location => location.uuid === building.location_id_fk);
            const project = projects.find(project => project.uuid === location.project_id_fk);

            acc.push({
                ref: product.ref,
                product_name: product.product_name,
                product_slug: product.product_slug,
                sku: product.sku,
                custom: product.custom,
                owner_id: product.owner_id,
                project_id_fk: project.uuid,
                project_slug: project.slug,
                project_version: project.version,
                qty: 1
            });
        }
        return acc;
    }, []);

    return result;

}

const saveProductToRoom = async (product) => {
    const db = await initDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    // Ensure the product has a uuid and room_id_fk
    if (!product.uuid) {
        product.uuid = generateUUID();
    }
    if (!product.room_id_fk) {
        throw new Error("room_id_fk is required");
    }

    await store.add(product);
    await tx.done;
    console.log('Product added to room:', product);
};

const deleteProductFromRoom = async (sku, room_id) => {
    const db = await initDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    const index = store.index("room_id_fk");

    const products = await index.getAll(room_id);

    for (const product of products) {
        if (product.sku === sku) {
            await store.delete(product.uuid);
            console.log('Product deleted from room:', product);
        }
    }
}

const setSkuQtyForRoom = async (qty, sku, room_id) => {
    const db = await initDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    const index = store.index("room_id_fk");

    const products = await index.getAll(room_id);
    const product = products.find(p => p.sku === sku);

    // Remove all existing products with the given SKU in the specified room
    for (const product of products) {
        if (product.sku === sku) {
            console.warn('Deleting product:', product);
            await store.delete(product.uuid);
        }
    }

    // Re-add the products with the specified quantity
    for (let i = 0; i < qty; i++) {
        const newProduct = { ...product, uuid: generateUUID() };
        await store.add(newProduct);
    }
}


const updateProductRef = async (room_id, sku, ref) => {
    const db = await initDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    const index = store.index("room_id_fk");

    const products = await index.getAll(room_id);
    const product = products.find(p => p.sku === sku);    

    if (product) {
        product.ref = ref;
        await store.put(product);
    } else {
        console.error('Product not found for SKU:', sku);
    }
}

const getRoomMeta = async (roomId) => {
    roomId = String(roomId);

    const db = await initDB();
    const tx = db.transaction("rooms", "readonly");
    const store = tx.objectStore("rooms");
    const index = store.index("room_id_fk");
    const room = await index.get(roomId);    
    if (!room) {
        throw new Error(`Room with id ${roomId} not found`);
    }

    const floorStore = db.transaction("floors", "readonly").objectStore("floors");
    const floor = await floorStore.get(room.floor_id_fk);
    const buildingStore = db.transaction("buildings", "readonly").objectStore("buildings");
    const building = await buildingStore.get(floor.building_id_fk);
    const locationStore = db.transaction("locations", "readonly").objectStore("locations");
    const location = await locationStore.get(building.location_id_fk);
    return {
        location: { name: location.name, uuid: location.uuid },
        building: { name: building.name, uuid: building.uuid },
        floor: { name: floor.name, uuid: floor.uuid },
        room: { name: room.name, uuid: room.uuid, height: room.height, width: room.width, length: room.length }
    };
};

async function getRoomNotes(roomId) {
    roomId = String(roomId);

    const db = await initDB();
    const tx = db.transaction("notes", "readonly");
    const store = tx.objectStore("notes");
    const index = store.index("room_id_fk");
    const notes = await index.getAll(roomId);
    notes.sort((a, b) => new Date(b.created_on) - new Date(a.created_on));
    return notes;
}


async function addRoom(floorUuid, roomName) {
    const db = await initDB();
    const tx = db.transaction("rooms", "readwrite");
    const store = tx.objectStore("rooms");
    const newRoomID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const roomSlug = await utils.slugify(roomName);
    const room = {
        created_on: now,
        floor_id_fk: String(floorUuid),
        last_updated: now,
        name: roomName,
        owner_id: await utils.getUserID(), 
        room_id_fk: newRoomID,
        slug: roomSlug,
        uuid: newRoomID,
        version: "1"
    };

    await store.add(room);
    await tx.done;
    return room.uuid;
}

async function addFloor(buildingUuid, floorName) {
    const db = await initDB();
    const tx = db.transaction("floors", "readwrite");
    const store = tx.objectStore("floors");
    const newFloorID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const floorSlug = await utils.slugify(floorName);
    const floor = {
        created_on: now,
        building_id_fk: String(buildingUuid),
        last_updated: now,
        name: floorName,
        owner_id: await utils.getUserID(), 
        floor_id_fk: newFloorID,
        slug: floorSlug,
        uuid: newFloorID,
        version: "1"
    };

    await store.add(floor);
    await tx.done;
    return floor.uuid;
}

async function addLocation(projectUuid, locationName) {
    const db = await initDB();
    const tx = db.transaction("locations", "readwrite");
    const store = tx.objectStore("locations");
    const newLocationID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const locationSlug = await utils.slugify(locationName);
    const location = {
        created_on: now,
        last_updated: now,
        name: locationName,
        owner_id: await utils.getUserID(), 
        location_id_fk: newLocationID,
        project_id_fk: projectUuid,
        slug: locationSlug,
        uuid: newLocationID,
        version: "1"
    };

    await store.add(location);
    await tx.done;
    return location.uuid;
}

async function addBuilding(locationUuid, buildingName) {
    const db = await initDB();
    const tx = db.transaction("buildings", "readwrite");
    const store = tx.objectStore("buildings");
    const newBuildingID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const buildingSlug = await utils.slugify(buildingName);
    const building = {
        created_on: now,
        location_id_fk: String(locationUuid),
        last_updated: now,
        name: buildingName,
        owner_id: await utils.getUserID(), 
        building_id_fk: newBuildingID,
        slug: buildingSlug,
        uuid: newBuildingID,
        version: "1"
    };

    await store.add(building);
    await tx.done;
    return building.uuid;
}


async function removeRoom(roomUuid) {    
    roomUuid = "" + roomUuid;
    const db = await initDB();
    const tx = db.transaction(["rooms", "products"], "readwrite");

    // Remove the room
    console.log('removing room uuid: ', roomUuid);
    const roomStore = tx.objectStore("rooms");
    roomUuid.toString();
    console.log('typeof: ',typeof roomUuid);
    await roomStore.delete(roomUuid);

    // Remove all products associated with this room
    const productsStore = tx.objectStore("products");
    const index = productsStore.index("room_id_fk");
    const products = await index.getAll(roomUuid);
    for (const product of products) {
        await productsStore.delete(product.uuid);
    }

    await tx.done;
}

async function removeFloor(floorUuid) {    
    floorUuid = "" + floorUuid;
    const db = await initDB();
    const tx = db.transaction(["floors", "rooms", "products"], "readwrite");

    // Remove the floor
    console.log('removing floor uuid: ' + floorUuid);
    const floorStore = tx.objectStore("floors");
    await floorStore.delete(floorUuid);

    // remove all products associated with all rooms within this floor first
    const productsStore = tx.objectStore("products");
    const roomStore = tx.objectStore("rooms");
    const roomIndex = productsStore.index("room_id_fk");
    const index = roomStore.index("floor_id_fk");
    const rooms = await index.getAll(floorUuid);

    for (const room of rooms) {
        const products = await roomIndex.getAll(room.uuid);
        for (const product of products) {
            await productsStore.delete(product.uuid);
        }
    }

    // remove all rooms associated with this floor
    for (const room of rooms) {
        await roomStore.delete(room.uuid);
    }

    await tx.done;
}


async function removeBuilding(buildingUuid) {
    buildingUuid = String(buildingUuid);
    const db = await initDB();
    const tx = db.transaction(["buildings", "floors", "rooms", "products"], "readwrite");

    // Remove the building
    console.log('removing building uuid: ' + buildingUuid);
    const buildingStore = tx.objectStore("buildings");
    await buildingStore.delete(buildingUuid);

    // remove all floors associated with this building
    const floorStore = tx.objectStore("floors");
    const floors = await floorStore.getAll();
    const buildingFloors = floors.filter(floor => floor.building_id_fk === buildingUuid);

    for (const floor of buildingFloors) {
        // remove all products associated with all rooms within this floor first
        const productsStore = tx.objectStore("products");
        const roomStore = tx.objectStore("rooms");
        const roomIndex = productsStore.index("room_id_fk");
        const index = roomStore.index("floor_id_fk");
        const rooms = await index.getAll(floor.uuid);

        for (const room of rooms) {
            const products = await roomIndex.getAll(room.uuid);
            for (const product of products) {
                await productsStore.delete(product.uuid);
            }
        }

        // remove all rooms associated with this floor
        for (const room of rooms) {
            await roomStore.delete(room.uuid);
        }

        // remove the floor itself
        await floorStore.delete(floor.uuid);
    }

    await tx.done;
}


async function updateName(store, uuid, newName) {
    const db = await initDB();
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    uuid = String(uuid);
    const record = await objectStore.get(uuid);
    record.name = newName;
    record.slug = await utils.slugify(newName);
    await objectStore.put(record);
    await tx.done;    
}

async function getProjectStructure(projectId) {
    owner_id = await utils.getUserID(), 
    owner_id = String(owner_id);

    const hierarchy = await getProjectHierarchy(owner_id, projectId); 
    let result = {};

    // Get the project details
    const project = hierarchy.projects[0];
    if (!project) return null;

    // Initialize project level
    result = {
        project_name: project.name,
        project_slug: project.slug,
        project_id: project.uuid
    };

    // Get locations for this project
    const projectLocations = hierarchy.locations
        .filter(loc => loc.project_id_fk === project.uuid);

    // Build location level
    projectLocations.forEach(location => {
        result[location.slug] = {
            location_name: location.name,
            location_slug: location.slug,
            location_id: location.uuid
        };

        // Get buildings for this location
        const locationBuildings = hierarchy.buildings
            .filter(build => build.location_id_fk === location.uuid);

        // Build building level
        locationBuildings.forEach(building => {
            result[location.slug][building.slug] = {
                building_name: building.name,
                building_slug: building.slug,
                building_id: building.uuid
            };

            // Get floors for this building
            const buildingFloors = hierarchy.floors
                .filter(floor => floor.building_id_fk === building.uuid);

            // Build floor level
            buildingFloors.forEach(floor => {
                result[location.slug][building.slug][floor.slug] = {
                    floor_name: floor.name,
                    floor_slug: floor.slug,
                    floor_id: floor.uuid
                };

                // Get rooms for this floor
                const floorRooms = hierarchy.rooms
                    .filter(room => room.floor_id_fk === floor.uuid);

                // Build room level
                floorRooms.forEach(room => {
                    result[location.slug][building.slug][floor.slug][room.slug] = {
                        room_name: room.name,
                        room_slug: room.slug,
                        room_id: room.uuid
                    };
                });
            });
        });
    });

    return result;
}


async function getProjectByUUID(uuid) {
    const db = await initDB();
    const tx = db.transaction("projects", "readonly");
    const store = tx.objectStore("projects");
    const project = await store.get(uuid);
    return project;
}

async function updateProjectDetails(projectData) {
    const db = await initDB();
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");

    await store.put(projectData);
    await tx.done;    
}


async function updateRoomDimension(roomUuid, field, value) {
    const db = await initDB();
    const tx = db.transaction("rooms", "readwrite");
    const store = tx.objectStore("rooms");
    const room = await store.get(roomUuid);
    room[field] = value;
    await store.put(room);
    await tx.done;
}

async function copyRoom(roomUuid, newRoomName, newFloorUuid) {
    const db = await initDB();
    const tx1 = db.transaction("rooms", "readwrite");
    const store = tx1.objectStore("rooms");
    const room = await store.get(roomUuid);
    const newUuid = generateUUID();
    const newRoom = { ...room, uuid: newUuid };
    console.log('Copying room to new room', roomUuid, newRoom.uuid);
    // append  " - copy" to room name room slug 
    newRoom.name = newRoomName || newRoom.name + " - Copy";
    newRoom.slug = await utils.slugify(newRoom.name);  
    newRoom.room_id_fk = newUuid;
    newRoom.floor_id_fk = newFloorUuid || newRoom.floor_id_fk;
    delete newRoom.id;
    await store.add(newRoom);
    await tx1.done;

    // now also copy the products in the old room to the new room
    const products = await getProductsForRoom(roomUuid);
    const tx2 = db.transaction("products", "readwrite");
    const productStore = tx2.objectStore("products");
    for (const product of products) {
        product.room_id_fk = newUuid;
        product.uuid = generateUUID();
        await productStore.add(product);
    }

    await tx2.done;
}

// get all floors in this project 
async function getFloors(project_id) {
    const db = await initDB();
    const tx = db.transaction(["locations", "buildings", "floors"], "readonly");

    // Get locations related to the project
    const locationStore = tx.objectStore("locations");
    const locations = await locationStore.index("project_id_fk").getAll(project_id);

    // Get buildings related to those locations
    const buildingStore = tx.objectStore("buildings");
    let buildings = [];
    for (const location of locations) {
        const locationBuildings = await buildingStore.index("location_id_fk").getAll(location.uuid);
        buildings = buildings.concat(locationBuildings);
    }

    // Get floors under those buildings
    const floorStore = tx.objectStore("floors");
    let floors = [];
    for (const building of buildings) {
        const buildingFloors = await floorStore.index("building_id_fk").getAll(building.uuid);
        floors = floors.concat(buildingFloors);
    }

    const floorArray = [];
    for (const floor of floors) {
        floorArray.push({uuid: floor.uuid, name: floor.name});
    }   
    return floorArray;
}

async function copyProject(project_id, projectName) {
    const db = await initDB();
    const tx = db.transaction(["projects", "locations", "buildings", "floors", "rooms", "products"], "readwrite");

    // Copy the project
    const projectStore = tx.objectStore("projects");
    const project = await projectStore.get(project_id);
    const newProjectID = generateUUID();
    const newProject = { ...project, uuid: newProjectID, name: projectName, room_id_fk: newProjectID };
    await projectStore.add(newProject);

    // Copy the locations
    const locationStore = tx.objectStore("locations");
    const locations = await locationStore.index("project_id_fk").getAll(project_id);
    for (const location of locations) {
        const newLocationID = generateUUID();
        const newLocation = { ...location, uuid: newLocationID, project_id_fk: newProjectID, room_if_fk: newLocationID };
        await locationStore.add(newLocation);

        // Copy the buildings
        const buildingStore = tx.objectStore("buildings");
        const buildings = await buildingStore.index("location_id_fk").getAll(location.uuid);    
        for (const building of buildings) {
            const newBuildingID = generateUUID();
            const newBuilding = { ...building, uuid: newBuildingID, location_id_fk: newLocationID, room_id_fk: newBuildingID };
            await buildingStore.add(newBuilding);

            // Copy the floors
            const floorStore = tx.objectStore("floors");
            const floors = await floorStore.index("building_id_fk").getAll(building.uuid);
            for (const floor of floors) {
                const newFloorID = generateUUID();
                const newFloor = { ...floor, uuid: newFloorID, building_id_fk: newBuildingID, room_id_fk: newFloorID };
                await floorStore.add(newFloor);

                // Copy the rooms
                const roomStore = tx.objectStore("rooms");
                const rooms = await roomStore.index("floor_id_fk").getAll(floor.uuid);
                for (const room of rooms) {
                    const newRoomID = generateUUID();
                    const newRoom = { ...room, uuid: newRoomID, floor_id_fk: newFloorID, room_id_fk: newRoomID };
                    await roomStore.add(newRoom);

                    // Copy the products
                    const productStore = tx.objectStore("products");
                    const products = await productStore.index("room_id_fk").getAll(room.uuid);
                    for (const product of products) {
                        const newProductID = generateUUID();
                        const newProduct = { ...product, uuid: newProductID, room_id_fk: newRoomID };
                        await productStore.add(newProduct);
                    }
                }
            }
        }
    }

    await tx.done;
    return newProjectID;
}

async function addNote(roomUuid, note) {
    const db = await initDB();
    const tx = db.transaction("notes", "readwrite");
    const store = tx.objectStore("notes");
    const newNoteID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');    
    const newNote = {
        created_on: now,
        last_updated: now,
        note: note,
        owner_id: await utils.getUserID(), 
        room_id_fk: roomUuid,        
        uuid: newNoteID,
        version: "1"
    };

    await store.add(newNote);
    await tx.done;
    return newNoteID;
}

async function removeNoteByUUID(noteUuid) {
    const db = await initDB();
    const tx = db.transaction("notes", "readwrite");
    const store = tx.objectStore("notes");
    await store.delete(noteUuid);
    await tx.done;
}

async function addImage(roomUuid, image) {

}

async function getUser(user_id) {
    user_id = user_id+ "";    
    const db = await initDB();
    const tx = db.transaction("users", "readonly");
    const store = tx.objectStore("users");
    return await store.get(user_id);
}

async function updateUser(formdata, user_id) {
    user_id = user_id + "";


    const db = await initDB();
    const tx = db.transaction("users", "readwrite");
    const store = tx.objectStore("users");
    const user = await store.get(user_id);       

    user.name = formdata.name;
    user.code = formdata.code;    
    user.email = formdata.email;
    user.password = formdata.password;
    user.last_updated = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await store.put(user);
    await tx.done;
}

async function getSchedulePerRoom(projectId) {
    if (!projectId) {
        throw new Error('No Project ID');
    }

    const db = await initDB();
    const tx = db.transaction(["projects", "locations", "buildings", "floors", "rooms", "products", "images", "notes"], "readonly");

    const projectStore = tx.objectStore("projects");
    const locationStore = tx.objectStore("locations");
    const buildingStore = tx.objectStore("buildings");
    const floorStore = tx.objectStore("floors");
    const roomStore = tx.objectStore("rooms");
    const productStore = tx.objectStore("products");
    const imageStore = tx.objectStore("images");
    const noteStore = tx.objectStore("notes");

    const project = await projectStore.get(projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    const locations = await locationStore.index("project_id_fk").getAll(projectId);
    const buildings = await buildingStore.getAll();
    const floors = await floorStore.getAll();
    const rooms = await roomStore.getAll();
    const products = await productStore.getAll();
    const images = await imageStore.getAll();
    const notes = await noteStore.getAll();

    const result = {};

    rooms.forEach(room => {
        const roomProducts = products.filter(product => product.room_id_fk === room.uuid);
        const roomImages = images.filter(image => image.room_id_fk === room.uuid);
        const roomNotes = notes.filter(note => note.room_id_fk === room.uuid);

        const floor = floors.find(floor => floor.uuid === room.floor_id_fk);
        const building = buildings.find(building => building.uuid === floor.building_id_fk);
        const location = locations.find(location => location.uuid === building.location_id_fk);

        roomProducts.forEach(product => {
            if (!result[room.slug]) {
                result[room.slug] = [];
            }

            // I need to ensure that the product is not already in the array for this room
            if (result[room.slug].find(p => p.sku === product.sku)) {
                return;
            }   

            result[room.slug].push({
                room_slug: room.slug,
                room_name: room.name,
                room_width: room.width,
                room_length: room.length,
                room_height: room.height,
                floor_name: floor.name,
                building_name: building.name,
                location_name: location.name,
                project_name: project.name,
                ref: product.ref,
                product_name: product.product_name,
                product_slug: product.product_slug,
                sku: product.sku,
                custom: product.custom,
                owner_id: product.owner_id,
                project_id_fk: project.uuid,
                project_slug: project.slug,
                project_version: project.version,
                qty: roomProducts.filter(p => p.sku === product.sku).length,
                image_filenames: roomImages.map(image => image.safe_filename).join('|'),
                room_notes: roomNotes.map(note => `${note.note} (updated: ${new Date(note.last_updated || note.created_on).toLocaleString()})`).join('|')
            });
        });
    });

    return result;
}

async function loginUser(formData) {    
    const db = await initDB();
    const tx = db.transaction("users", "readonly");
    const store = tx.objectStore("users");
    const index = store.index("email");

    // formData is a js formData object from the submitted form
    // parse the email and password from the form data
    const formDataObj = {};
    formData.forEach((value, key) => (formDataObj[key] = value));        
    if (!formDataObj.modal_form_email) {
        throw new Error("Email is required");
    }
    const user = await index.get(formDataObj.modal_form_email);

    if (user && user.password === formDataObj.modal_form_password) {
        // destroy all the local storage items
        localStorage.clear();
        // set the user_id cookie
        await utils.setCookie('user_id', user.uuid, 365);
        // set the user_name cookie
        await utils.setCookie('user_name', user.name, 365);

        return user;
    } else {
        return false;
    }   
}

async function getFavourites(user_id) {
    const db = await initDB();
    const tx = db.transaction("favourites", "readonly");
    const store = tx.objectStore("favourites");
    const index = store.index("owner_id");
    user_id = String(user_id);
    return await index.getAll(user_id);
}

async function addFavProduct(sku, product_name, user_id) {
    const db = await initDB();
    const tx = db.transaction("favourites", "readwrite");
    const store = tx.objectStore("favourites");
    const newFavID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const newFav = {
        created_on: now,
        last_updated: now,
        sku: sku,
        product_name: product_name,
        owner_id: user_id,
        uuid: newFavID,
        version: "1"
    };

    // Check if the product is already in the favourites for the same user_id
    // make sure not to save th same sku for the same user!  we now have keys on teh columns "sku" and "owner_id"
    const allFavs = await store.getAll();
    const existingFav = allFavs.find(fav => fav.sku === sku && fav.owner_id === user_id);
    if (existingFav) {
        UIkit.notification('Product already in favoutites', {status:'warning',pos: 'bottom-center',timeout: 1500});
        console.warn('Product already in favourites:', existingFav);
        return false;
    }

    await store.add(newFav);
    await tx.done;
    UIkit.notification('Added favourite product', {status:'success',pos: 'bottom-center',timeout: 1500});
    return newFavID;
}

async function addFavouriteToRoom(sku, room_id) {
    const db = await initDB();
    // first get the full data about the product from the "product_data" table by sku
    const productData = await getProducts();
    console.log('Product Data:', productData);  
    const p = productData.find(p => p.product_code === sku);
    if (!p) {
        throw new Error(`Product with SKU ${sku} not found`);
    }

    // build the product data object    
    const newProductData = {
        brand: p.site,
        type: p.type_slug,
        product_slug: p.product_slug,
        product_name: p.product_name,
        sku: p.product_code,
        room_id_fk: room_id,
        owner_id: await utils.getCookie('user_id'),
        custom: 0,
        ref: "",
        created_on: await utils.formatDateTime(new Date()),
        last_updated: await utils.formatDateTime(new Date()),
        order: null,
        range: null
    };
    this.saveProductToRoom(newProductData);   
}

async function removeFavourite(uuid) {
    const db = await initDB();
    uuid = uuid + "";
    const tx = db.transaction("favourites", "readwrite");
    const store = tx.objectStore("favourites");    
    await store.delete(uuid);
    await tx.done;
}

async function getImagesForRoom(room_id) {
    // get all images for this room and this user
    const db = await initDB();
    const tx = db.transaction("images", "readonly");
    const store = tx.objectStore("images");
    const index = store.index("room_id_fk");
    const images = await index.getAll(room_id);
    const user_id = await utils.getUserID()
    return images.filter(image => image.owner_id === user_id);
}

async function saveImageForRoom(room_id, data)  {
    const db = await initDB();
    const tx = db.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    const newImageID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const newImage = {
        created_on: now,
        last_updated: now,
        room_id_fk: room_id,
        owner_id: await utils.getUserID(),
        uuid: newImageID,
        version: "1",
        filename: data.fileName,
        safe_filename: data.safeFileName
    };

    await store.add(newImage);
    await tx.done;
    return newImageID;

}

async function pushUserData(user_id) {
    const db = await initDB();
    // gather all the user data from the indexedDB inclusing all the projects, locations, buildings, floors, rooms, products, images, notes, favourites
    const tx = db.transaction(["projects", "locations", "buildings", "floors", "rooms", "products", "images", "notes", "favourites"], "readonly");  
    const projectStore = tx.objectStore("projects");
    const locationStore = tx.objectStore("locations");
    const buildingStore = tx.objectStore("buildings");
    const floorStore = tx.objectStore("floors");
    const roomStore = tx.objectStore("rooms");
    const productStore = tx.objectStore("products");
    const imageStore = tx.objectStore("images");
    const noteStore = tx.objectStore("notes");
    const favStore = tx.objectStore("favourites");

    const projects = await projectStore.index("owner_id").getAll(user_id);
    const locations = await locationStore.index("owner_id").getAll(user_id);
    const buildings = await buildingStore.index("owner_id").getAll(user_id);
    const floors = await floorStore.index("owner_id").getAll(user_id);
    const rooms = await roomStore.index("owner_id").getAll(user_id);
    const products = await productStore.index("owner_id").getAll(user_id);
    const images = await imageStore.index("owner_id").getAll(user_id);
    const notes = await noteStore.index("owner_id").getAll(user_id);
    const favourites = await favStore.index("owner_id").getAll(user_id);

    // now push all this data to the server
    const userData = {
        projects: projects,
        locations: locations,
        buildings: buildings,
        floors: floors,
        rooms: rooms,
        products: products,
        images: images,
        notes: notes,
        favourites: favourites
    };

       
    const response = await fetch('https://sst.tamlite.co.uk/api/sync_user_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    // console.log('Response Data:', responseData);
    // console.log('Status:', responseData.status);  // error | success
    return(responseData);    
}


// Export the functions
module.exports = {
    generateUUID, 
    initDB,
    fetchAndStoreProducts,
    fetchAndStoreUsers,
    getProducts,
    getProjects,    
    getProjectByUUID,
    updateProjectDetails,
    syncData,
    saveProductToRoom,
    getProductsForRoom,
    deleteProductFromRoom,
    setSkuQtyForRoom,
    updateProductRef,
    getProjectStructure,
    getRoomMeta,
    updateName,
    addRoom,
    addFloor,
    addBuilding,
    addLocation,
    removeRoom,
    removeFloor,
    removeBuilding,
    createProject,
    updateRoomDimension,
    copyRoom,
    getFloors,
    copyProject,
    getRoomNotes,    
    addNote,
    addImage,
    removeNoteByUUID,
    getProductsForProject,
    getUser,
    updateUser,
    getSchedulePerRoom,
    loginUser,
    addFavProduct,
    getFavourites,
    addFavouriteToRoom,
    removeFavourite,
    getImagesForRoom,
    saveImageForRoom,
    pushUserData,
    pullUserData
    // Add other database-related functions here
};

(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
let registration;

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registration successful');
            checkForUpdates();
        } catch (err) {
            console.log('ServiceWorker registration failed:', err);
        }
    }
}

// Periodic update checker
function checkForUpdates() {
    // Check immediately on page load
    if (registration) {
        registration.update();
    }

    // Then check every 30 minutes
    setInterval(() => {
        if (registration) {
            registration.update();
        }
    }, 30 * 60 * 1000);
}

// Store update state in localStorage
function setUpdateAvailable(value) {
    localStorage.setItem('updateAvailable', value);
}

function isUpdateAvailable() {
    return localStorage.getItem('updateAvailable') === 'true';
}

// Modified showUpdateBar function
function showUpdateBar() {
    // Only show if we haven't already shown it
    if (!isUpdateAvailable()) {
        setUpdateAvailable(true);
        const updateNotification = UIkit.notification({
            message: 'A new version is available.<br>Click here to update.',
            status: 'primary',
            pos: 'bottom-center',
            timeout: 0,
            onclick: () => {
                updateNotification.close();
                
                const loadingNotification = UIkit.notification({
                    message: 'Updating...',
                    status: 'warning',
                    pos: 'bottom-center',
                    timeout: 0
                });
                
                if (registration?.waiting) {
                    registration.waiting.postMessage('skipWaiting');
                }
            }
        });
    }
}

// Check for stored update state on page load
function checkStoredUpdateState() {
    if (isUpdateAvailable()) {
        showUpdateBar();
    }
}

// Initialize
$(document).ready(function() {
    const Mustache = require('mustache');
    const db = require('./db'); // Import the db module    
    const sst = require('./sst'); // Import the db module
    const utils = require('./modules/utils');
        
    console.log("Mounted App...");
    //const user_id = utils.getUserID();

    $('a[href^="/"]').on('click', function(e) {
        e.preventDefault();
        const path = $(this).attr('href').substring(1);        
        window.router(path);
    });
    
    registerServiceWorker();
    checkStoredUpdateState();

    // Clear update flag after successful update
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(false);
    });

    // Listen for update events
    if (registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBar();
                }
            });
        });
    }

    // Handle online/offline status
    window.addEventListener('online', function() {
        //console.log('App is online');
        db.fetchAndStoreProducts();
        //db.fetchAndStoreUsers();
        //db.syncData(utils.getUserID());
    });

    window.addEventListener('offline', function() {
        console.log('App is offline - using cached data');
    });

    // Initialize app
    async function initApp() {
        await db.initDB();
        
        if (navigator.onLine) {    
            await db.fetchAndStoreProducts(); 
            await db.fetchAndStoreUsers();
            //await db.syncData(await utils.getUserID());
        }

        // Get current path and route
        const pathParts = window.location.pathname
            .split('/')
            .filter(part => part.length > 0);
        
        const projectId = pathParts[1] || '';
        window.router(pathParts[0] || 'home', projectId);

        // Set the project id in the hidden input
        if (projectId) {
            $('#m_project_id').val(projectId);
        }
    }


    initApp();
});

// Handle reload after update
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
        refreshing = true;
        window.location.reload();
    }
});
},{"./db":3,"./modules/utils":7,"./sst":9,"mustache":11}],2:[function(require,module,exports){
const API_ENDPOINTS = {
    PRODUCTS: 'https://sst.tamlite.co.uk/api/get_all_products_neat',
    USER_DATA: 'https://sst.tamlite.co.uk/api/get_all_user_data'
};

module.exports = API_ENDPOINTS;
},{}],3:[function(require,module,exports){
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
    let tx1 = db.transaction("rooms", "readwrite");
    let store1 = tx1.objectStore("rooms");
    let newRoomID = generateUUID();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const roomSlug = await utils.slugify(roomName);
    // i need to check if this room already exists in this project
    const existingRooms = await store1.getAll();
    console.log('Existing rooms:', existingRooms);
    const existingRoom = existingRooms.find(room => room.slug == roomSlug && room.floor_id_fk == floorUuid);
    console.log('Existing room:', existingRoom);
    if (existingRoom) {            
        return false;   
    }
    // if the room exists ANYWHERE in this PROJECT
    const currentProject = JSON.parse(localStorage.getItem('currentProject') || '{}');    
    const projectStore = db.transaction("projects", "readonly").objectStore("projects");
    const project = await projectStore.get(String(currentProject.project_id));    
    
    const locationStore = db.transaction("locations", "readonly").objectStore("locations");
    const locations = await locationStore.index("project_id_fk").getAll(project.uuid);
   
    const buildingStore = db.transaction("buildings", "readonly").objectStore("buildings");
    let buildings = [];
    for (const location of locations) {
        const locationBuildings = await buildingStore.index("location_id_fk").getAll(location.uuid);
        buildings = buildings.concat(locationBuildings);
    }
    const floorStore = db.transaction("floors", "readonly").objectStore("floors");
    let floors = [];
    for (const building of buildings) {
        const buildingFloors = await floorStore.index("building_id_fk").getAll(building.uuid);
        floors = floors.concat(buildingFloors);
    }
    const roomStore = db.transaction("rooms", "readonly").objectStore("rooms");
    let rooms = [];
    for (const floor of floors) {
        const floorRooms = await roomStore.index("floor_id_fk").getAll(floor.uuid);
        rooms = rooms.concat(floorRooms);
    }
    const existingRoomInProject = rooms.find(room => room.slug === roomSlug);
    if (existingRoomInProject) {        
        return false;
    }
   
    
    // add the room
    let tx = db.transaction("rooms", "readwrite");
    let store = tx.objectStore("rooms");
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


async function removeProject(project_id) {
    // rather than delete anything from the database, i just want to change the owner_if of the project to prepend] 999 in front 
    // but only in the projects table, so that it is not shown in the project list
    const db = await initDB();
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    const project = await store.get(project_id);
    project.owner_id = "999" + project.owner_id;
    await store.put(project);
    await tx.done;   
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
    const user = await index.get(formDataObj.modal_form_email.toLowerCase());

    if (user && user.password.toLowerCase() === formDataObj.modal_form_password.toLowerCase()) {
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
    pullUserData,
    removeProject
    // Add other database-related functions here
};

},{"./modules/utils":7,"idb":10}],4:[function(require,module,exports){
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
        if (Array.isArray(data) && data.length === 0) {
            return `<p>You have not added any faoutite products yet.</p>
            <p>You can add products to your favourites by first adding a product to this room then clicking the <span class="product-name" uk-icon="icon: heart;"></span> icon in the table.</p>`;
        }        
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
},{"../db":3,"./tables":6,"mustache":11}],5:[function(require,module,exports){
const db = require('../db');
const utils = require('./utils');
let sidebar; // placeholder for sidebar module, lazy loaded later

class SyncModule {
    constructor() {
        this.isInitialized = false;

        // Bind methods that need 'this' context
        //this.handleFileUpload = this.handleFileUpload.bind(this);
    }

    init() {
        if (this.isInitialized) return;        
        if (!sidebar) {
            sidebar = require('./sidebar');  // lazy load it to avoid circular dependencies, just use call init when required
        }        
        this.isInitialized = true;        
    }


    async clearLocalStorage() {
        this.init();
        if (!navigator.onLine) {
            UIkit.notification({message: 'You are offline. Please connect to the internet and try again.', status: 'warning', pos: 'bottom-center', timeout: 2000 });
            return;
        }        

        utils.showSpin();
        
        $('#syncicon').addClass('active');

        localStorage.clear();

        $('#syncicon').removeClass('active');  
                      
        utils.hideSpin();        
    }

    async getUserData() {
        this.init();
        if (!navigator.onLine) {
            UIkit.notification({message: 'You are offline. Please connect to the internet and try again.', status: 'warning', pos: 'bottom-center', timeout: 2000 });
            return;
        }        

        utils.showSpin();
        
        $('#syncicon').addClass('active');

        const user_id = await utils.getUserID();
        const result = await db.pullUserData(user_id);        
        $('#syncicon').removeClass('active');  
                      
        utils.hideSpin();
    }


    async pushAllUserData() {
        this.init();
        // detect if user is offline
        if (!navigator.onLine) {
            UIkit.notification({message: 'You are offline. Please connect to the internet and try again.', status: 'warning', pos: 'bottom-center', timeout: 2000 });
            return;
        }


        UIkit.notification({message: 'Data Push Started ...', status: 'primary', pos: 'bottom-center', timeout: 1000 });
        utils.showSpin();
        
        $('#syncicon').addClass('active');

        const user_id = await utils.getCookie('user_id');

        const result = await db.pushUserData(user_id);
        $('#syncicon').removeClass('active');        
        
        utils.hideSpin();
        if (result.status == 'error') {
            UIkit.notification({message: 'There was an error syncing your data! Please try again.', status: 'danger', pos: 'bottom-center', timeout: 2000 });
        } else {
            UIkit.notification({message: 'Data Push Complete ...', status: 'success', pos: 'bottom-center', timeout: 2000 });
        }

    }



}

module.exports = new SyncModule();
},{"../db":3,"./sidebar":4,"./utils":7}],6:[function(require,module,exports){
const db = require('../db');
const Mustache = require('mustache');
const utils = require('./utils');
let sidebar; // placeholder for sidebar module, lazy loaded later

class TablesModule {
    constructor() {
        this.isInitialized = false;
        this.pTable = null;
        // Bind methods that need 'this' context
        this.handleFileUpload = this.handleFileUpload.bind(this);
        this.updateImages = this.updateImages.bind(this);        
        this.getRoomImages = this.getRoomImages.bind(this);        
    }

    init() {
        if (this.isInitialized) return;
        Mustache.tags = ["[[", "]]"];                
        if (!sidebar) {
            sidebar = require('./sidebar');  // lazy load it to avoid circular dependencies, just use call init when required
        }        
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

        let optionsHtml = '<option value="">Select SKU</option>';
        skus.forEach(sku => {
            optionsHtml += `<option value="${sku.slug}">${sku.name}</option>`;
        }); 
        $('#form_sku').html(optionsHtml);
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

        let optionsHtml = '<option value="">Select Product</option>';
        products.forEach(product => {
            optionsHtml += `<option value="${product.slug}">${product.name}</option>`;
        });        
        $('#form_product').html(optionsHtml);
    }

    async getProductsForType(type) {
        const products = await db.getProducts();
        const site = $('#form_brand').val();

        return products
            .filter(product => product.type_slug === type && product.site === site )
            .reduce((acc, product) => {
            if (!acc.some(item => item.slug === product.product_slug)) {
                acc.push({ 
                slug: product.product_slug, 
                name: product.product_slug.replace(/^xcite-/i, '').toString().toUpperCase().trim().replace(/-/g, ' ')
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

    async renderTypesDropdown(types) {
        if (!types || !types.length) {
            console.error('No types data provided');
            return;
        }

        const template = $('#options');
        if (!template.length) {
            console.error('Template #options not found');
            return;
        }

        
        let optionsHtml = '<option value="">Select Type</option>';
        types.forEach(type => {
            optionsHtml += `<option value="${type.slug}">${type.name}</option>`;
        });        
        $('#form_type').html(optionsHtml);
    }

    async updateProjectClick(uuid) {

        console.log('updateProjectClick', uuid);

        const existingProject = await db.getProjectByUUID(uuid);

        console.log('existingProject', existingProject);

        if (!existingProject) {
            console.error('Project not found');
            return;
        }

        const projectData = {
            uuid: uuid,
            project_id: $('#form_edit_project_id').val() || existingProject.project_id,
            room_id_fk: existingProject.room_id_fk, // legacy
            name: $('#form_edit_project_name').val() || existingProject.name,
            slug: await utils.slugify($('#form_edit_project_name').val()) || existingProject.slug,
            engineer: $('#form_edit_project_engineer').val() || existingProject.engineer,
            project_version: $('#form_edit_project_version').val() || existingProject.project_version,
            last_updated: await utils.formatDateTime(new Date()),
            created_on: existingProject.created_on,
            owner_id: existingProject.owner_id,
            cef: existingProject.cef // unused
        };

        console.log('updateProjectClick', projectData);


        await db.updateProjectDetails(projectData);

        UIkit.notification({
            message: 'Project Updated',
            status: 'success',
            pos: 'bottom-center',
            timeout: 1500
    });        
      
                
    }

    async addSpecialToRoomClick() {
        // to save duplication just build the product data object and call the addProductToRoomClick method
        const productData = {
            brand: $('#form_custom_brand').val(),
            type: $('#form_custom_type').val(),
            product_slug: await utils.slugify($('#form_custom_product').val()),
            product_name: $('#form_custom_product').val(),
            sku: $('#form_custom_sku').val(),            
            room_id_fk: $('#m_room_id').val(),
            owner_id: await utils.getCookie('user_id'),
            custom: $('#form_custom_flag').val(),
            ref: "",
            created_on: await utils.formatDateTime(new Date()),
            last_updated: await utils.formatDateTime(new Date()),
            order: null,
            range: null
        };
        //UIkit.modal('#add-special').hide();
        this.doAddProduct(productData);   
    }

    async addProductToRoomClick() {

        // build the product data object    
        const productData = {
            brand: $('#form_brand').val(),
            type: $('#form_type').val(),
            product_slug: $('#form_product').val(),
            product_name: $('#form_product option:selected').text(),
            sku: $('#form_sku').val() || $('#form_product').val(),
            room_id_fk: $('#m_room_id').val(),
            owner_id: await utils.getCookie('user_id'),
            custom: 0,
            ref: "",
            created_on: await utils.formatDateTime(new Date()),
            last_updated: await utils.formatDateTime(new Date()),
            order: null,
            range: null
        };
        this.doAddProduct(productData);
    }

    async doAddProduct(productData) {

        if ( !productData.product_slug ) {
            UIkit.notification({
                message: 'All fields are required',
                status: 'danger',
                pos: 'bottom-center',
                timeout: 1500
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
                pos: 'bottom-center',
                timeout: 1500
            });

            utils.hideSpin();
            await this.setQtyDialog(productData.sku, 1);
        } catch (err) {
            console.error('Error saving product to room:', err);
            UIkit.notification({
                message: 'Error saving product to room',
                status: 'danger',
                pos: 'bottom-center',
                timeout: 1500
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


    async addFavDialog(sku, product_name) {
        await this.init();  // call init as we'll need the sidebar module to be loaded

        $('span.place_sku').html(sku);
        $('input#del_sku').val(sku);
        const user_id = await utils.getCookie('user_id');

        await db.addFavProduct(sku, product_name, user_id);       
        await sidebar.renderFavourites(user_id);       
    }



    async removeSkuDialog(sku) {
        // open the del-sku modal and pass the sku to be deleted
        $('span.place_sku').html(sku);
        $('input#del_sku').val(sku);

        UIkit.modal('#del-sku', { stack : true }).show();        

        $('#form-submit-del-sku').off('submit').on('submit', async (e) => {
            e.preventDefault();
            const sku = $('#del_sku').val();
            const room_id = $('#m_room_id').val();                        
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

        UIkit.modal('#set-qty', { stack : true }).show();    
        UIkit.util.on('#set-qty', 'shown', () => {
            $('#set_qty_qty').focus().select();
        });
        

        $('#form-submit-set-qty').off('submit').on('submit', async (e) => {
            e.preventDefault();
            const qty = $('#set_qty_qty').val();
            const sku = $('#set_qty_sku').val();
            const room_id = $('#m_room_id').val();
                        
            await db.setSkuQtyForRoom(qty, sku, room_id);
            this.refreshTableData();
            UIkit.modal('#set-qty').hide();            
        });      
    }


    async refreshTableData(roomID) {
        console.log('Refreshing table data for room:', roomID);
        let roomIDToUse = roomID || $('#m_room_id').val();        
        const allProductsInRoom = await db.getProductsForRoom(roomIDToUse);        
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
                    formatter: utils.iconFav,
                    width: 40,
                    hozAlign: "center",
                    cellClick: (e, cell) => {
                        this.addFavDialog(cell.getRow().getData().sku, cell.getRow().getData().product_name);
                    }
                },
                {                    
                    visible: true,
                    headerSort: false,
                    formatter: utils.iconX,
                    width: 40,
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

    async handleFileUpload(event) {
        
        try {
            const filePicker = event.target;
            
            if (!filePicker || !filePicker.files || !filePicker.files.length) {
                throw new Error('No file selected.');
            }
            
            const file = filePicker.files[0];
            console.log('Selected file:', file);

            UIkit.modal($('#upload-progress')).show();

            if (file) {
                var formData = new FormData();
                formData.append('image', file);
                formData.append('user_id', await utils.getCookie('user_id'));
                formData.append('room_id', $('#m_room_id').val());

                var xhr = new XMLHttpRequest();
                xhr.open("POST", "https://sst.tamlite.co.uk/api/image_upload", true)    ;

                // Monitor progress events
                xhr.upload.addEventListener("progress", function (e) {
                    if (e.lengthComputable) {
                        var percentage = (e.loaded / e.total) * 100; // Calculate percentage
                        $('#progress-text').text(`Uploading: ${Math.round(percentage)}%`);
                        $('.uk-progress').val(percentage); // Update progress bar
                    }
                });
                
                // Use arrow function to preserve 'this' context
                xhr.onload = async () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            console.log('File uploaded successfully:', response);
                            $('#progress-text').text('Upload complete!');
                            $('.uk-progress').val(100);
                            $('#upload-progress #close-progress').prop("disabled", false);
                            
                            await this.updateImages(response);
                        } else {
                            console.error('File upload failed:', response.message);
                            $('#progress-text').text('Upload failed: ' + response.message);
                            $('#upload-progress #close-progress').prop("disabled", false);
                        }
                    } else {
                        console.error('File upload failed. Status:', xhr.status);
                        $('#progress-text').text('Upload failed. Please try again.');
                        $('#upload-progress #close-progress').prop("disabled", false);
                    }
                };

                // Handle errors
                xhr.onerror = function () {
                    console.error('File upload failed due to a network error.');
                    $('#progress-text').text('Network error occurred during upload.');
                    $('#upload-progress #close-progress').prop("disabled", false);
                };

                xhr.timeout = 120000; // Set timeout to 2 minutes
                xhr.ontimeout = function () {
                    console.error('File upload timed out.');
                    $('#progress-text').text('Upload timed out. Please try again.');
                    $('#upload-progress #close-progress').prop("disabled", false);
                };

                xhr.send(formData); // Send the form data
            } else {
                console.warn('No file selected.');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
        }
    }    
    
    async updateImages(response) {        
        const res = await db.saveImageForRoom($('#m_room_id').val(), response);        
        await this.getRoomImages();
    }

    async getRoomImages() {
        const images = await db.getImagesForRoom($('#m_room_id').val());
        console.log('get room images:', images);
        const html = await this.generateImages(images);
        $('#images.room_images').html(html);
    }

    async generateImages(images) {
        let html = `<div class="uk-width-1-1" uk-lightbox="animation: slide">
        <div class="uk-grid-small uk-child-width-1-2 uk-child-width-1-2@s uk-child-width-1-3@m uk-child-width-1-4@l uk-flex-center uk-text-center " uk-grid>`;
            
        
        images.forEach(image => {
            html += `<div>
            <div class="uk-card uk-card-default uk-card-body uk-padding-remove">
                <a href="https://sst.tamlite.co.uk/uploads/${image.safe_filename}">
                <div class="imagebg" style="background-image: url(https://sst.tamlite.co.uk/uploads/${image.safe_filename});"></div>
                </a>
            </div>
            </div>`;
        });
            
        html += `</div></div>`;

        return(html);
    }


}

module.exports = new TablesModule();
},{"../db":3,"./sidebar":4,"./utils":7,"mustache":11}],7:[function(require,module,exports){
class UtilsModule {

    constructor() {
        console.log('UtilsModule constructor');
        this.isInitialized = false;   

        this.uid = this.getCookie('user_id');

        this.checkLogin();        
        
        this.iconPlus = function(cell, formatterParams, onRendered) {
            return '<i class="fa-solid fa-circle-plus"></i>';
        };
        this.iconMinus = function(cell, formatterParams, onRendered) {
            return '<i class="fa-solid fa-circle-minus"></i>';
        };
        this.iconX = function(cell, formatterParams, onRendered) {
            return '<span class="icon red" uk-icon="icon: trash; ratio: 1.3" title="Delete"></span>';
        };    
        this.iconCopy = function(cell, formatterParams, onRendered) {
            return '<span class="icon" uk-icon="icon: copy; ratio: 1.3" title="Duplicate"></span>';
        };     
        this.iconFav = function(cell, formatterParams, onRendered) {
            return '<span class="icon red" uk-icon="icon: heart; ratio: 1.3" title="Favourite"></span>';
        };   
        
      
        
        
        var login = UIkit.modal('.loginmodal', {
            bgClose : false,
            escClose : false
        });

    }

    init() {
        if (this.isInitialized) return;
        Mustache.tags = ["[[", "]]"];
        this.isInitialized = true;        
    }

    
    async checkLogin() {
        console.log('Checking authentication ...');
        const db = require('../db');         
        const user_id = await this.getCookie('user_id');
    
        if (user_id == "") {
            UIkit.modal('.loginmodal').show();
        } else {
            $('#m_user_id').val(user_id);
        }
        
        let that = this;
    
        $("#form-login").off("submit").on("submit", async function(e) {
            e.preventDefault();
            $('.login-error').hide();
            const form = document.querySelector("#form-login");            
            const user = await db.loginUser(new FormData(form));            
            
            if (user !== false) {
                $('#m_user_id').val(user.uuid);
                await that.setCookie('user_id', user.uuid);
                await that.setCookie('user_name', user.name);
                await db.syncData(user.uuid);  
    
                UIkit.modal($('#login')).hide();
                // Use replace state instead of redirect
                window.history.replaceState({}, '', '/');
                location.reload();
            } else {
                $('.login-error p').html("There was an error logging in. Please try again.");
                $('.login-error').show();
            }
        });
    }

    async logout() {
        await this.deleteCookie('user_id');
        await this.deleteCookie('user_name');
        // Use replace state instead of redirect
        window.history.replaceState({}, '', '/?t=');
        location.reload();
    }

    async deleteCookie(cname) {
        const d = new Date();
        d.setTime(d.getTime() - (24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=;" + expires + ";path=/";
    }

    async setCookie(cname, cvalue, exdays) {
        const d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires="+d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }

    async getCookie(cname) {
        let name = cname + "=";
        let ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }


    async getUserID() {
        const user_id = await this.getCookie('user_id');        
        if (user_id) {
            return user_id.toString();
        } else {
            // show login modal with UIkit
            this.checkLogin();
            // UIkit.modal('#login').show();
            // return false;
        }       
    }


    async showSpin() {
        $('#spinner').fadeIn('fast');
    }

    async hideSpin() {
        $('#spinner').fadeOut('fast');
    }

    async formatDateTime (date) {
        const pad = (num) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    async setCookie(cname, cvalue, exdays) {
        const d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires="+d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }

    async getCookie(cname) {
        let name = cname + "=";
        let ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }   
    
    async slugify(text) {
        // make a slug of this text
        return text.toString().toLowerCase().trim()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-');        // Replace multiple - with single -
    }
    async deslugify(text) {
        // make human readable text from slug   
        return text.toString().toLowerCase().trim()
            .replace(/-/g, ' ');           // Replace - with space          
    }

    async getAppVersion() {
        //console.log('getting version');
        try {
            // Wait for service worker registration
            const registration = await navigator.serviceWorker.ready;
            //console.log('got registration:', registration);
    
            if (!registration.active) {
                throw new Error('No active service worker found');
            }
    
            const versionPromise = new Promise((resolve, reject) => {
                let messageHandler;
    
                const cleanup = () => {
                    clearTimeout(timeout);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                };
    
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(new Error('Version request timed out'));
                }, 10000);
    
                messageHandler = (event) => {
                    //console.log('Utils received SW message:', event.data);
                    if (event.data?.type === 'CACHE_VERSION') {
                        cleanup();
                        const version = event.data.version.split('-v')[1];
                        console.log('Extracted version:', version);
                        resolve(version);
                    }
                };
    
                // Add message listener before sending message
                navigator.serviceWorker.addEventListener('message', messageHandler);
                
                // Send message to service worker
                //console.log('Utils sending getCacheVersion message');
                registration.active.postMessage({
                    type: 'GET_VERSION',
                    timestamp: Date.now()
                });
            });
    
            const version = await versionPromise;
            return `1.0.${version}`;
    
        } catch (error) {
            //console.error('Error getting app version:', error);
            return 'Not set';
        }
    }

    async clearServiceWorkerCache() {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
        //console.log('Service Worker and caches cleared');
        location.reload();
    }
    
    makeid(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        return result;
    }


}
module.exports = new UtilsModule();
},{"../db":3}],8:[function(require,module,exports){
const Mustache = require('mustache');
const db = require('./db');
const sst = require('./sst');
const utils = require('./modules/utils');
const CACHE_NAME = 'sst-cache-v27'; 
// test

async function loadTemplate(path) {
    try {
        const response = await fetch(`/views/${path}.html`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.text();
    } catch (error) {
        console.warn('Fetching from cache:', error);
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(`/views/${path}.html`);
        if (cachedResponse) {
            return await cachedResponse.text();
            isRouting = false;
        }
        throw error;
    }
}

let isRouting = false;

async function router(path, project_id) {
    if (isRouting) return;
    isRouting = true;
    
    await utils.checkLogin();

    // Update browser URL without reload
    window.history.pushState({}, '', `/${path}`);
    
    try {
        let template;
        switch(path) {
            case 'tables':                
                template = await loadTemplate('tables');
                // Get stored project data
                const projectData = JSON.parse(localStorage.getItem('currentProject') || '{}');
                
                const rendered = Mustache.render(template, { 
                    title: 'Tables Page',
                    project: projectData,
                    project_id: project_id
                });
                $('#page').html(rendered);
                sst.globalBinds();
                sst.tablesFunctions(project_id);
                break;
            case 'schedule':
                template = await loadTemplate('schedule');
                const renderedSchedule = Mustache.render(template, { 
                    title: 'Schedule Page',
                    content: 'This is the schedule page content'
                });
                $('#page').html(renderedSchedule);
                sst.globalBinds();
                sst.scheduleFunctions();
                break;
            case 'account':
                template = await loadTemplate('account');
                const renderedAccount = Mustache.render(template, { 
                    title: 'Account Page',
                    content: 'This is the account page content'
                });
                $('#page').html(renderedAccount);
                setTimeout(function() {
                    sst.globalBinds();
                    sst.accountFunctions();
                }, 500);
                break;                
            default:
                template = await loadTemplate('home');
                const renderedHome = Mustache.render(template, { 
                    title: 'Dashboard',
                    content: 'Your projects are listed below'
                });
                $('#page').html(renderedHome);
                sst.globalBinds();
                sst.homeFunctions();
        }
    } catch (error) {
        console.error('Routing error:', error);
        window.location.reload();        
    } finally {
        isRouting = false;
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    const pathParts = window.location.pathname
        .split('/')
        .filter(part => part.length > 0);
    router(pathParts[0] || 'home', pathParts[1]);
});

//module.exports = router;
window.router = router;

},{"./db":3,"./modules/utils":7,"./sst":9,"mustache":11}],9:[function(require,module,exports){
const db = require('./db'); 
const tables = require('./modules/tables');
const utils = require('./modules/utils');
const sidebar = require('./modules/sidebar');
const sync = require('./modules/sync');

async function globalBinds() {

    const currentProject = JSON.parse(localStorage.getItem('currentProject') || '{}');
    if (!currentProject.project_id) {
        $('.tables_link,.schedule_link').hide();
    } else {
        $('.tables_link,.schedule_link').show();
    }    

    $('#syncicon').off('click').on('click', async function(e) {
        e.preventDefault();
        sync.pushAllUserData();
    });
    $('#syncicon').on('touchend').on('touchend', async function(e) {
        setTimeout(function() {
            $('#syncicon').removeClass('active'); 
        }, 1000);
    });

}

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

    $('#add-image').on('change', tables.handleFileUpload);
    $('#upload-progress #close-progress').off('click').on('click', function() {
        UIkit.modal($('#upload-progress')).hide();
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

    //UIkit.offcanvas('.tables-side').hide();


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
    //UIkit.offcanvas('.tables-side').hide();

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
    const user_id = await utils.getCookie('user_id');
    const user = await db.getUser(user_id);   
    
    if (!user) {
        console.error('error getting ueer details');
        return false;
    }

    $('#name').val(user.name);
    $('#email').val(user.email);
    $('#password').val(user.password);
    $('#code').val(user.code);

    $('#btn_pull_user_data').off('click').on('click', async function(e) {
        e.preventDefault();
        await sync.getUserData();
    });

    $('#btn_clear_local_storage').off('click').on('click', async function(e) {
        e.preventDefault();
        await utils.clearServiceWorkerCache();
    });    

    $('#btn_logout').off('click').on('click', async function(e) {
        e.preventDefault();
        await utils.logout();
    });      

    $('#form-update-account').off('submit').on('submit', async function(e) {
        e.preventDefault();
        //console.log('Update account clicked');
        // build the user object from submitted form fields
        const formdata = {            
            name: $('#name').val(),
            email: $('#email').val(),
            password: $('#password').val(),
            code: $('#code').val()
        }        

        const user_id = await utils.getCookie('user_id');
        await db.updateUser(formdata, user_id);
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
    const project_id = $('input#m_project_id').val() || JSON.parse(localStorage.getItem('currentProject')).project_id;
    if (schedule_type == "by_project") {
        jsonData = data; // the schedule table data for a full project schedule
        callGenSheets(schedule_type);
    } else {
        try {            
            jsonData = await db.getSchedulePerRoom(project_id); // Wait for the data
            //console.log('jsonData', jsonData);
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

    const projects = await db.getProjects(await utils.getCookie('user_id'));
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
                width: "40%",
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
                width: "20%",
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
                width: "20%",
                visible: true
            },
            {                    
                visible: true,
                headerSort: false,
                formatter: utils.iconCopy,
                width: "10%",
                hozAlign: "center",
                cellClick: function (e, cell) {
                    copyProject(cell.getRow().getData().project_id);
                }
            },
            {                    
                visible: true,
                headerSort: false,
                formatter: utils.iconX,
                width: "10%",
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
            if (roomUuid) {
                UIkit.notification('Room added', {status:'success',pos: 'bottom-center',timeout: 1500});
                await renderSidebar(project_id); 
            } else {
                UIkit.notification({message: 'A room of the same name already exists.', status: 'danger', pos: 'bottom-center', timeout: 2500 });        
            }
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
            await renderSidebar(project_id); 
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
            await renderSidebar(project_id); 
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

async function deleteProject(project_id) {
    const msg = '<h4 class="red">Warning</h4><p>This will remove the project, all floors, rooms and <b>ALL products</b> in those rooms!</p>';
    UIkit.modal.confirm(msg).then( async function() {
        await db.removeProject(project_id);
        await renderProjectsTable();
        await renderSidebar(project_id);
        UIkit.notification('Project removed', {status:'success',pos: 'bottom-center',timeout: 1500});
    }, function () {
        console.log('Cancelled.')
    });        
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

    await tables.getRoomImages();
   
}



module.exports = {
    globalBinds,
    homeFunctions,
    tablesFunctions,
    scheduleFunctions,
    accountFunctions 
};

},{"./db":3,"./modules/sidebar":4,"./modules/sync":5,"./modules/tables":6,"./modules/utils":7}],10:[function(require,module,exports){
'use strict';

const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

let idbProxyableTypes;
let cursorAdvanceMethods;
// This is a function to prevent it throwing up in node environments.
function getIdbProxyableTypes() {
    return (idbProxyableTypes ||
        (idbProxyableTypes = [
            IDBDatabase,
            IDBObjectStore,
            IDBIndex,
            IDBCursor,
            IDBTransaction,
        ]));
}
// This is a function to prevent it throwing up in node environments.
function getCursorAdvanceMethods() {
    return (cursorAdvanceMethods ||
        (cursorAdvanceMethods = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
        ]));
}
const transactionDoneMap = new WeakMap();
const transformCache = new WeakMap();
const reverseTransformCache = new WeakMap();
function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
        const unlisten = () => {
            request.removeEventListener('success', success);
            request.removeEventListener('error', error);
        };
        const success = () => {
            resolve(wrap(request.result));
            unlisten();
        };
        const error = () => {
            reject(request.error);
            unlisten();
        };
        request.addEventListener('success', success);
        request.addEventListener('error', error);
    });
    // This mapping exists in reverseTransformCache but doesn't exist in transformCache. This
    // is because we create many promises from a single IDBRequest.
    reverseTransformCache.set(promise, request);
    return promise;
}
function cacheDonePromiseForTransaction(tx) {
    // Early bail if we've already created a done promise for this transaction.
    if (transactionDoneMap.has(tx))
        return;
    const done = new Promise((resolve, reject) => {
        const unlisten = () => {
            tx.removeEventListener('complete', complete);
            tx.removeEventListener('error', error);
            tx.removeEventListener('abort', error);
        };
        const complete = () => {
            resolve();
            unlisten();
        };
        const error = () => {
            reject(tx.error || new DOMException('AbortError', 'AbortError'));
            unlisten();
        };
        tx.addEventListener('complete', complete);
        tx.addEventListener('error', error);
        tx.addEventListener('abort', error);
    });
    // Cache it for later retrieval.
    transactionDoneMap.set(tx, done);
}
let idbProxyTraps = {
    get(target, prop, receiver) {
        if (target instanceof IDBTransaction) {
            // Special handling for transaction.done.
            if (prop === 'done')
                return transactionDoneMap.get(target);
            // Make tx.store return the only store in the transaction, or undefined if there are many.
            if (prop === 'store') {
                return receiver.objectStoreNames[1]
                    ? undefined
                    : receiver.objectStore(receiver.objectStoreNames[0]);
            }
        }
        // Else transform whatever we get back.
        return wrap(target[prop]);
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    },
    has(target, prop) {
        if (target instanceof IDBTransaction &&
            (prop === 'done' || prop === 'store')) {
            return true;
        }
        return prop in target;
    },
};
function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
    // Due to expected object equality (which is enforced by the caching in `wrap`), we
    // only create one new func per func.
    // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
    // with real promises, so each advance methods returns a new promise for the cursor object, or
    // undefined if the end of the cursor has been reached.
    if (getCursorAdvanceMethods().includes(func)) {
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            func.apply(unwrap(this), args);
            return wrap(this.request);
        };
    }
    return function (...args) {
        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
        // the original object.
        return wrap(func.apply(unwrap(this), args));
    };
}
function transformCachableValue(value) {
    if (typeof value === 'function')
        return wrapFunction(value);
    // This doesn't return, it just creates a 'done' promise for the transaction,
    // which is later returned for transaction.done (see idbObjectHandler).
    if (value instanceof IDBTransaction)
        cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
        return new Proxy(value, idbProxyTraps);
    // Return the same value back if we're not going to transform it.
    return value;
}
function wrap(value) {
    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
    if (value instanceof IDBRequest)
        return promisifyRequest(value);
    // If we've already transformed this value before, reuse the transformed value.
    // This is faster, but it also provides object equality.
    if (transformCache.has(value))
        return transformCache.get(value);
    const newValue = transformCachableValue(value);
    // Not all types are transformed.
    // These may be primitive types, so they can't be WeakMap keys.
    if (newValue !== value) {
        transformCache.set(value, newValue);
        reverseTransformCache.set(newValue, value);
    }
    return newValue;
}
const unwrap = (value) => reverseTransformCache.get(value);

/**
 * Open a database.
 *
 * @param name Name of the database.
 * @param version Schema version.
 * @param callbacks Additional callbacks.
 */
function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
        request.addEventListener('upgradeneeded', (event) => {
            upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
        });
    }
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event.newVersion, event));
    }
    openPromise
        .then((db) => {
        if (terminated)
            db.addEventListener('close', () => terminated());
        if (blocking) {
            db.addEventListener('versionchange', (event) => blocking(event.oldVersion, event.newVersion, event));
        }
    })
        .catch(() => { });
    return openPromise;
}
/**
 * Delete a database.
 *
 * @param name Name of the database.
 */
function deleteDB(name, { blocked } = {}) {
    const request = indexedDB.deleteDatabase(name);
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event));
    }
    return wrap(request).then(() => undefined);
}

const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
const writeMethods = ['put', 'add', 'delete', 'clear'];
const cachedMethods = new Map();
function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase &&
        !(prop in target) &&
        typeof prop === 'string')) {
        return;
    }
    if (cachedMethods.get(prop))
        return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, '');
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
        !(isWrite || readMethods.includes(targetFuncName))) {
        return;
    }
    const method = async function (storeName, ...args) {
        // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
        const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
        let target = tx.store;
        if (useIndex)
            target = target.index(args.shift());
        // Must reject if op rejects.
        // If it's a write operation, must reject if tx.done rejects.
        // Must reject with op rejection first.
        // Must resolve with op value.
        // Must handle both promises (no unhandled rejections)
        return (await Promise.all([
            target[targetFuncName](...args),
            isWrite && tx.done,
        ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
}));

const advanceMethodProps = ['continue', 'continuePrimaryKey', 'advance'];
const methodMap = {};
const advanceResults = new WeakMap();
const ittrProxiedCursorToOriginalProxy = new WeakMap();
const cursorIteratorTraps = {
    get(target, prop) {
        if (!advanceMethodProps.includes(prop))
            return target[prop];
        let cachedFunc = methodMap[prop];
        if (!cachedFunc) {
            cachedFunc = methodMap[prop] = function (...args) {
                advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
            };
        }
        return cachedFunc;
    },
};
async function* iterate(...args) {
    // tslint:disable-next-line:no-this-assignment
    let cursor = this;
    if (!(cursor instanceof IDBCursor)) {
        cursor = await cursor.openCursor(...args);
    }
    if (!cursor)
        return;
    cursor = cursor;
    const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
    ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
    // Map this double-proxy back to the original, so other cursor methods work.
    reverseTransformCache.set(proxiedCursor, unwrap(cursor));
    while (cursor) {
        yield proxiedCursor;
        // If one of the advancing methods was not called, call continue().
        cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
        advanceResults.delete(proxiedCursor);
    }
}
function isIteratorProp(target, prop) {
    return ((prop === Symbol.asyncIterator &&
        instanceOfAny(target, [IDBIndex, IDBObjectStore, IDBCursor])) ||
        (prop === 'iterate' && instanceOfAny(target, [IDBIndex, IDBObjectStore])));
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get(target, prop, receiver) {
        if (isIteratorProp(target, prop))
            return iterate;
        return oldTraps.get(target, prop, receiver);
    },
    has(target, prop) {
        return isIteratorProp(target, prop) || oldTraps.has(target, prop);
    },
}));

exports.deleteDB = deleteDB;
exports.openDB = openDB;
exports.unwrap = unwrap;
exports.wrap = wrap;

},{}],11:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Mustache = factory());
}(this, (function () { 'use strict';

  /*!
   * mustache.js - Logic-less {{mustache}} templates with JavaScript
   * http://github.com/janl/mustache.js
   */

  var objectToString = Object.prototype.toString;
  var isArray = Array.isArray || function isArrayPolyfill (object) {
    return objectToString.call(object) === '[object Array]';
  };

  function isFunction (object) {
    return typeof object === 'function';
  }

  /**
   * More correct typeof string handling array
   * which normally returns typeof 'object'
   */
  function typeStr (obj) {
    return isArray(obj) ? 'array' : typeof obj;
  }

  function escapeRegExp (string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
  }

  /**
   * Null safe way of checking whether or not an object,
   * including its prototype, has a given property
   */
  function hasProperty (obj, propName) {
    return obj != null && typeof obj === 'object' && (propName in obj);
  }

  /**
   * Safe way of detecting whether or not the given thing is a primitive and
   * whether it has the given property
   */
  function primitiveHasOwnProperty (primitive, propName) {
    return (
      primitive != null
      && typeof primitive !== 'object'
      && primitive.hasOwnProperty
      && primitive.hasOwnProperty(propName)
    );
  }

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  var regExpTest = RegExp.prototype.test;
  function testRegExp (re, string) {
    return regExpTest.call(re, string);
  }

  var nonSpaceRe = /\S/;
  function isWhitespace (string) {
    return !testRegExp(nonSpaceRe, string);
  }

  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  function escapeHtml (string) {
    return String(string).replace(/[&<>"'`=\/]/g, function fromEntityMap (s) {
      return entityMap[s];
    });
  }

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var equalsRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  /**
   * Breaks up the given `template` string into a tree of tokens. If the `tags`
   * argument is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. [ "<%", "%>" ]). Of
   * course, the default is to use mustaches (i.e. mustache.tags).
   *
   * A token is an array with at least 4 elements. The first element is the
   * mustache symbol that was used inside the tag, e.g. "#" or "&". If the tag
   * did not contain a symbol (i.e. {{myValue}}) this element is "name". For
   * all text that appears outside a symbol this element is "text".
   *
   * The second element of a token is its "value". For mustache tags this is
   * whatever else was inside the tag besides the opening symbol. For text tokens
   * this is the text itself.
   *
   * The third and fourth elements of the token are the start and end indices,
   * respectively, of the token in the original template.
   *
   * Tokens that are the root node of a subtree contain two more elements: 1) an
   * array of tokens in the subtree and 2) the index in the original template at
   * which the closing tag for that section begins.
   *
   * Tokens for partials also contain two more elements: 1) a string value of
   * indendation prior to that tag and 2) the index of that tag on that line -
   * eg a value of 2 indicates the partial is the third tag on this line.
   */
  function parseTemplate (template, tags) {
    if (!template)
      return [];
    var lineHasNonSpace = false;
    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?
    var indentation = '';  // Tracks indentation for tags that use it
    var tagIndex = 0;      // Stores a count of number of tags encountered on a line

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace () {
      if (hasTag && !nonSpace) {
        while (spaces.length)
          delete tokens[spaces.pop()];
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var openingTagRe, closingTagRe, closingCurlyRe;
    function compileTags (tagsToCompile) {
      if (typeof tagsToCompile === 'string')
        tagsToCompile = tagsToCompile.split(spaceRe, 2);

      if (!isArray(tagsToCompile) || tagsToCompile.length !== 2)
        throw new Error('Invalid tags: ' + tagsToCompile);

      openingTagRe = new RegExp(escapeRegExp(tagsToCompile[0]) + '\\s*');
      closingTagRe = new RegExp('\\s*' + escapeRegExp(tagsToCompile[1]));
      closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tagsToCompile[1]));
    }

    compileTags(tags || mustache.tags);

    var scanner = new Scanner(template);

    var start, type, value, chr, token, openSection;
    while (!scanner.eos()) {
      start = scanner.pos;

      // Match any text between tags.
      value = scanner.scanUntil(openingTagRe);

      if (value) {
        for (var i = 0, valueLength = value.length; i < valueLength; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
            indentation += chr;
          } else {
            nonSpace = true;
            lineHasNonSpace = true;
            indentation += ' ';
          }

          tokens.push([ 'text', chr, start, start + 1 ]);
          start += 1;

          // Check for whitespace on the current line.
          if (chr === '\n') {
            stripSpace();
            indentation = '';
            tagIndex = 0;
            lineHasNonSpace = false;
          }
        }
      }

      // Match the opening tag.
      if (!scanner.scan(openingTagRe))
        break;

      hasTag = true;

      // Get the tag type.
      type = scanner.scan(tagRe) || 'name';
      scanner.scan(whiteRe);

      // Get the tag value.
      if (type === '=') {
        value = scanner.scanUntil(equalsRe);
        scanner.scan(equalsRe);
        scanner.scanUntil(closingTagRe);
      } else if (type === '{') {
        value = scanner.scanUntil(closingCurlyRe);
        scanner.scan(curlyRe);
        scanner.scanUntil(closingTagRe);
        type = '&';
      } else {
        value = scanner.scanUntil(closingTagRe);
      }

      // Match the closing tag.
      if (!scanner.scan(closingTagRe))
        throw new Error('Unclosed tag at ' + scanner.pos);

      if (type == '>') {
        token = [ type, value, start, scanner.pos, indentation, tagIndex, lineHasNonSpace ];
      } else {
        token = [ type, value, start, scanner.pos ];
      }
      tagIndex++;
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === '/') {
        // Check section nesting.
        openSection = sections.pop();

        if (!openSection)
          throw new Error('Unopened section "' + value + '" at ' + start);

        if (openSection[1] !== value)
          throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
      } else if (type === 'name' || type === '{' || type === '&') {
        nonSpace = true;
      } else if (type === '=') {
        // Set the tags for the next time around.
        compileTags(value);
      }
    }

    stripSpace();

    // Make sure there are no open sections when we're done.
    openSection = sections.pop();

    if (openSection)
      throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);

    return nestTokens(squashTokens(tokens));
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens (tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      if (token) {
        if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
          lastToken[1] += token[1];
          lastToken[3] = token[3];
        } else {
          squashedTokens.push(token);
          lastToken = token;
        }
      }
    }

    return squashedTokens;
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens (tokens) {
    var nestedTokens = [];
    var collector = nestedTokens;
    var sections = [];

    var token, section;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      switch (token[0]) {
        case '#':
        case '^':
          collector.push(token);
          sections.push(token);
          collector = token[4] = [];
          break;
        case '/':
          section = sections.pop();
          section[5] = token[2];
          collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
          break;
        default:
          collector.push(token);
      }
    }

    return nestedTokens;
  }

  /**
   * A simple string scanner that is used by the template parser to find
   * tokens in template strings.
   */
  function Scanner (string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function eos () {
    return this.tail === '';
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function scan (re) {
    var match = this.tail.match(re);

    if (!match || match.index !== 0)
      return '';

    var string = match[0];

    this.tail = this.tail.substring(string.length);
    this.pos += string.length;

    return string;
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function scanUntil (re) {
    var index = this.tail.search(re), match;

    switch (index) {
      case -1:
        match = this.tail;
        this.tail = '';
        break;
      case 0:
        match = '';
        break;
      default:
        match = this.tail.substring(0, index);
        this.tail = this.tail.substring(index);
    }

    this.pos += match.length;

    return match;
  };

  /**
   * Represents a rendering context by wrapping a view object and
   * maintaining a reference to the parent context.
   */
  function Context (view, parentContext) {
    this.view = view;
    this.cache = { '.': this.view };
    this.parent = parentContext;
  }

  /**
   * Creates a new context using the given view with this context
   * as the parent.
   */
  Context.prototype.push = function push (view) {
    return new Context(view, this);
  };

  /**
   * Returns the value of the given name in this context, traversing
   * up the context hierarchy if the value is absent in this context's view.
   */
  Context.prototype.lookup = function lookup (name) {
    var cache = this.cache;

    var value;
    if (cache.hasOwnProperty(name)) {
      value = cache[name];
    } else {
      var context = this, intermediateValue, names, index, lookupHit = false;

      while (context) {
        if (name.indexOf('.') > 0) {
          intermediateValue = context.view;
          names = name.split('.');
          index = 0;

          /**
           * Using the dot notion path in `name`, we descend through the
           * nested objects.
           *
           * To be certain that the lookup has been successful, we have to
           * check if the last object in the path actually has the property
           * we are looking for. We store the result in `lookupHit`.
           *
           * This is specially necessary for when the value has been set to
           * `undefined` and we want to avoid looking up parent contexts.
           *
           * In the case where dot notation is used, we consider the lookup
           * to be successful even if the last "object" in the path is
           * not actually an object but a primitive (e.g., a string, or an
           * integer), because it is sometimes useful to access a property
           * of an autoboxed primitive, such as the length of a string.
           **/
          while (intermediateValue != null && index < names.length) {
            if (index === names.length - 1)
              lookupHit = (
                hasProperty(intermediateValue, names[index])
                || primitiveHasOwnProperty(intermediateValue, names[index])
              );

            intermediateValue = intermediateValue[names[index++]];
          }
        } else {
          intermediateValue = context.view[name];

          /**
           * Only checking against `hasProperty`, which always returns `false` if
           * `context.view` is not an object. Deliberately omitting the check
           * against `primitiveHasOwnProperty` if dot notation is not used.
           *
           * Consider this example:
           * ```
           * Mustache.render("The length of a football field is {{#length}}{{length}}{{/length}}.", {length: "100 yards"})
           * ```
           *
           * If we were to check also against `primitiveHasOwnProperty`, as we do
           * in the dot notation case, then render call would return:
           *
           * "The length of a football field is 9."
           *
           * rather than the expected:
           *
           * "The length of a football field is 100 yards."
           **/
          lookupHit = hasProperty(context.view, name);
        }

        if (lookupHit) {
          value = intermediateValue;
          break;
        }

        context = context.parent;
      }

      cache[name] = value;
    }

    if (isFunction(value))
      value = value.call(this.view);

    return value;
  };

  /**
   * A Writer knows how to take a stream of tokens and render them to a
   * string, given a context. It also maintains a cache of templates to
   * avoid the need to parse the same template twice.
   */
  function Writer () {
    this.templateCache = {
      _cache: {},
      set: function set (key, value) {
        this._cache[key] = value;
      },
      get: function get (key) {
        return this._cache[key];
      },
      clear: function clear () {
        this._cache = {};
      }
    };
  }

  /**
   * Clears all cached templates in this writer.
   */
  Writer.prototype.clearCache = function clearCache () {
    if (typeof this.templateCache !== 'undefined') {
      this.templateCache.clear();
    }
  };

  /**
   * Parses and caches the given `template` according to the given `tags` or
   * `mustache.tags` if `tags` is omitted,  and returns the array of tokens
   * that is generated from the parse.
   */
  Writer.prototype.parse = function parse (template, tags) {
    var cache = this.templateCache;
    var cacheKey = template + ':' + (tags || mustache.tags).join(':');
    var isCacheEnabled = typeof cache !== 'undefined';
    var tokens = isCacheEnabled ? cache.get(cacheKey) : undefined;

    if (tokens == undefined) {
      tokens = parseTemplate(template, tags);
      isCacheEnabled && cache.set(cacheKey, tokens);
    }
    return tokens;
  };

  /**
   * High-level method that is used to render the given `template` with
   * the given `view`.
   *
   * The optional `partials` argument may be an object that contains the
   * names and templates of partials that are used in the template. It may
   * also be a function that is used to load partial templates on the fly
   * that takes a single argument: the name of the partial.
   *
   * If the optional `config` argument is given here, then it should be an
   * object with a `tags` attribute or an `escape` attribute or both.
   * If an array is passed, then it will be interpreted the same way as
   * a `tags` attribute on a `config` object.
   *
   * The `tags` attribute of a `config` object must be an array with two
   * string values: the opening and closing tags used in the template (e.g.
   * [ "<%", "%>" ]). The default is to mustache.tags.
   *
   * The `escape` attribute of a `config` object must be a function which
   * accepts a string as input and outputs a safely escaped string.
   * If an `escape` function is not provided, then an HTML-safe string
   * escaping function is used as the default.
   */
  Writer.prototype.render = function render (template, view, partials, config) {
    var tags = this.getConfigTags(config);
    var tokens = this.parse(template, tags);
    var context = (view instanceof Context) ? view : new Context(view, undefined);
    return this.renderTokens(tokens, context, partials, template, config);
  };

  /**
   * Low-level method that renders the given array of `tokens` using
   * the given `context` and `partials`.
   *
   * Note: The `originalTemplate` is only ever used to extract the portion
   * of the original template that was contained in a higher-order section.
   * If the template doesn't use higher-order sections, this argument may
   * be omitted.
   */
  Writer.prototype.renderTokens = function renderTokens (tokens, context, partials, originalTemplate, config) {
    var buffer = '';

    var token, symbol, value;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      value = undefined;
      token = tokens[i];
      symbol = token[0];

      if (symbol === '#') value = this.renderSection(token, context, partials, originalTemplate, config);
      else if (symbol === '^') value = this.renderInverted(token, context, partials, originalTemplate, config);
      else if (symbol === '>') value = this.renderPartial(token, context, partials, config);
      else if (symbol === '&') value = this.unescapedValue(token, context);
      else if (symbol === 'name') value = this.escapedValue(token, context, config);
      else if (symbol === 'text') value = this.rawValue(token);

      if (value !== undefined)
        buffer += value;
    }

    return buffer;
  };

  Writer.prototype.renderSection = function renderSection (token, context, partials, originalTemplate, config) {
    var self = this;
    var buffer = '';
    var value = context.lookup(token[1]);

    // This function is used to render an arbitrary template
    // in the current context by higher-order sections.
    function subRender (template) {
      return self.render(template, context, partials, config);
    }

    if (!value) return;

    if (isArray(value)) {
      for (var j = 0, valueLength = value.length; j < valueLength; ++j) {
        buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate, config);
      }
    } else if (typeof value === 'object' || typeof value === 'string' || typeof value === 'number') {
      buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate, config);
    } else if (isFunction(value)) {
      if (typeof originalTemplate !== 'string')
        throw new Error('Cannot use higher-order sections without the original template');

      // Extract the portion of the original template that the section contains.
      value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);

      if (value != null)
        buffer += value;
    } else {
      buffer += this.renderTokens(token[4], context, partials, originalTemplate, config);
    }
    return buffer;
  };

  Writer.prototype.renderInverted = function renderInverted (token, context, partials, originalTemplate, config) {
    var value = context.lookup(token[1]);

    // Use JavaScript's definition of falsy. Include empty arrays.
    // See https://github.com/janl/mustache.js/issues/186
    if (!value || (isArray(value) && value.length === 0))
      return this.renderTokens(token[4], context, partials, originalTemplate, config);
  };

  Writer.prototype.indentPartial = function indentPartial (partial, indentation, lineHasNonSpace) {
    var filteredIndentation = indentation.replace(/[^ \t]/g, '');
    var partialByNl = partial.split('\n');
    for (var i = 0; i < partialByNl.length; i++) {
      if (partialByNl[i].length && (i > 0 || !lineHasNonSpace)) {
        partialByNl[i] = filteredIndentation + partialByNl[i];
      }
    }
    return partialByNl.join('\n');
  };

  Writer.prototype.renderPartial = function renderPartial (token, context, partials, config) {
    if (!partials) return;
    var tags = this.getConfigTags(config);

    var value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
    if (value != null) {
      var lineHasNonSpace = token[6];
      var tagIndex = token[5];
      var indentation = token[4];
      var indentedValue = value;
      if (tagIndex == 0 && indentation) {
        indentedValue = this.indentPartial(value, indentation, lineHasNonSpace);
      }
      var tokens = this.parse(indentedValue, tags);
      return this.renderTokens(tokens, context, partials, indentedValue, config);
    }
  };

  Writer.prototype.unescapedValue = function unescapedValue (token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return value;
  };

  Writer.prototype.escapedValue = function escapedValue (token, context, config) {
    var escape = this.getConfigEscape(config) || mustache.escape;
    var value = context.lookup(token[1]);
    if (value != null)
      return (typeof value === 'number' && escape === mustache.escape) ? String(value) : escape(value);
  };

  Writer.prototype.rawValue = function rawValue (token) {
    return token[1];
  };

  Writer.prototype.getConfigTags = function getConfigTags (config) {
    if (isArray(config)) {
      return config;
    }
    else if (config && typeof config === 'object') {
      return config.tags;
    }
    else {
      return undefined;
    }
  };

  Writer.prototype.getConfigEscape = function getConfigEscape (config) {
    if (config && typeof config === 'object' && !isArray(config)) {
      return config.escape;
    }
    else {
      return undefined;
    }
  };

  var mustache = {
    name: 'mustache.js',
    version: '4.2.0',
    tags: [ '{{', '}}' ],
    clearCache: undefined,
    escape: undefined,
    parse: undefined,
    render: undefined,
    Scanner: undefined,
    Context: undefined,
    Writer: undefined,
    /**
     * Allows a user to override the default caching strategy, by providing an
     * object with set, get and clear methods. This can also be used to disable
     * the cache by setting it to the literal `undefined`.
     */
    set templateCache (cache) {
      defaultWriter.templateCache = cache;
    },
    /**
     * Gets the default or overridden caching object from the default writer.
     */
    get templateCache () {
      return defaultWriter.templateCache;
    }
  };

  // All high-level mustache.* functions use this writer.
  var defaultWriter = new Writer();

  /**
   * Clears all cached templates in the default writer.
   */
  mustache.clearCache = function clearCache () {
    return defaultWriter.clearCache();
  };

  /**
   * Parses and caches the given template in the default writer and returns the
   * array of tokens it contains. Doing this ahead of time avoids the need to
   * parse templates on the fly as they are rendered.
   */
  mustache.parse = function parse (template, tags) {
    return defaultWriter.parse(template, tags);
  };

  /**
   * Renders the `template` with the given `view`, `partials`, and `config`
   * using the default writer.
   */
  mustache.render = function render (template, view, partials, config) {
    if (typeof template !== 'string') {
      throw new TypeError('Invalid template! Template should be a "string" ' +
                          'but "' + typeStr(template) + '" was given as the first ' +
                          'argument for mustache#render(template, view, partials)');
    }

    return defaultWriter.render(template, view, partials, config);
  };

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  mustache.escape = escapeHtml;

  // Export these mainly for testing, but also for advanced usage.
  mustache.Scanner = Scanner;
  mustache.Context = Context;
  mustache.Writer = Writer;

  return mustache;

})));

},{}]},{},[2,4,5,6,7,3,9,8,1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvanMvYXBwLmpzIiwiYXBwL2pzL2NvbmZpZy5qcyIsImFwcC9qcy9kYi5qcyIsImFwcC9qcy9tb2R1bGVzL3NpZGViYXIuanMiLCJhcHAvanMvbW9kdWxlcy9zeW5jLmpzIiwiYXBwL2pzL21vZHVsZXMvdGFibGVzLmpzIiwiYXBwL2pzL21vZHVsZXMvdXRpbHMuanMiLCJhcHAvanMvcm91dGVyLmpzIiwiYXBwL2pzL3NzdC5qcyIsIm5vZGVfbW9kdWxlcy9pZGIvYnVpbGQvaW5kZXguY2pzIiwibm9kZV9tb2R1bGVzL211c3RhY2hlL211c3RhY2hlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMzZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzM0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImxldCByZWdpc3RyYXRpb247XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZWdpc3RlclNlcnZpY2VXb3JrZXIoKSB7XHJcbiAgICBpZiAoJ3NlcnZpY2VXb3JrZXInIGluIG5hdmlnYXRvcikge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcvc3cuanMnKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlcnZpY2VXb3JrZXIgcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWwnKTtcclxuICAgICAgICAgICAgY2hlY2tGb3JVcGRhdGVzKCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQ6JywgZXJyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIFBlcmlvZGljIHVwZGF0ZSBjaGVja2VyXHJcbmZ1bmN0aW9uIGNoZWNrRm9yVXBkYXRlcygpIHtcclxuICAgIC8vIENoZWNrIGltbWVkaWF0ZWx5IG9uIHBhZ2UgbG9hZFxyXG4gICAgaWYgKHJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgIHJlZ2lzdHJhdGlvbi51cGRhdGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBUaGVuIGNoZWNrIGV2ZXJ5IDMwIG1pbnV0ZXNcclxuICAgIHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICBpZiAocmVnaXN0cmF0aW9uKSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51cGRhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9LCAzMCAqIDYwICogMTAwMCk7XHJcbn1cclxuXHJcbi8vIFN0b3JlIHVwZGF0ZSBzdGF0ZSBpbiBsb2NhbFN0b3JhZ2VcclxuZnVuY3Rpb24gc2V0VXBkYXRlQXZhaWxhYmxlKHZhbHVlKSB7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndXBkYXRlQXZhaWxhYmxlJywgdmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc1VwZGF0ZUF2YWlsYWJsZSgpIHtcclxuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndXBkYXRlQXZhaWxhYmxlJykgPT09ICd0cnVlJztcclxufVxyXG5cclxuLy8gTW9kaWZpZWQgc2hvd1VwZGF0ZUJhciBmdW5jdGlvblxyXG5mdW5jdGlvbiBzaG93VXBkYXRlQmFyKCkge1xyXG4gICAgLy8gT25seSBzaG93IGlmIHdlIGhhdmVuJ3QgYWxyZWFkeSBzaG93biBpdFxyXG4gICAgaWYgKCFpc1VwZGF0ZUF2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgc2V0VXBkYXRlQXZhaWxhYmxlKHRydWUpO1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZU5vdGlmaWNhdGlvbiA9IFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdBIG5ldyB2ZXJzaW9uIGlzIGF2YWlsYWJsZS48YnI+Q2xpY2sgaGVyZSB0byB1cGRhdGUuJyxcclxuICAgICAgICAgICAgc3RhdHVzOiAncHJpbWFyeScsXHJcbiAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiAwLFxyXG4gICAgICAgICAgICBvbmNsaWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVOb3RpZmljYXRpb24uY2xvc2UoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgbG9hZGluZ05vdGlmaWNhdGlvbiA9IFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VwZGF0aW5nLi4uJyxcclxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICd3YXJuaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbj8ud2FpdGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi53YWl0aW5nLnBvc3RNZXNzYWdlKCdza2lwV2FpdGluZycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIENoZWNrIGZvciBzdG9yZWQgdXBkYXRlIHN0YXRlIG9uIHBhZ2UgbG9hZFxyXG5mdW5jdGlvbiBjaGVja1N0b3JlZFVwZGF0ZVN0YXRlKCkge1xyXG4gICAgaWYgKGlzVXBkYXRlQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICBzaG93VXBkYXRlQmFyKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIEluaXRpYWxpemVcclxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XHJcbiAgICBjb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbiAgICBjb25zdCBkYiA9IHJlcXVpcmUoJy4vZGInKTsgLy8gSW1wb3J0IHRoZSBkYiBtb2R1bGUgICAgXHJcbiAgICBjb25zdCBzc3QgPSByZXF1aXJlKCcuL3NzdCcpOyAvLyBJbXBvcnQgdGhlIGRiIG1vZHVsZVxyXG4gICAgY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21vZHVsZXMvdXRpbHMnKTtcclxuICAgICAgICBcclxuICAgIGNvbnNvbGUubG9nKFwiTW91bnRlZCBBcHAuLi5cIik7XHJcbiAgICAvL2NvbnN0IHVzZXJfaWQgPSB1dGlscy5nZXRVc2VySUQoKTtcclxuXHJcbiAgICAkKCdhW2hyZWZePVwiL1wiXScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cignaHJlZicpLnN1YnN0cmluZygxKTsgICAgICAgIFxyXG4gICAgICAgIHdpbmRvdy5yb3V0ZXIocGF0aCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmVnaXN0ZXJTZXJ2aWNlV29ya2VyKCk7XHJcbiAgICBjaGVja1N0b3JlZFVwZGF0ZVN0YXRlKCk7XHJcblxyXG4gICAgLy8gQ2xlYXIgdXBkYXRlIGZsYWcgYWZ0ZXIgc3VjY2Vzc2Z1bCB1cGRhdGVcclxuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCAoKSA9PiB7XHJcbiAgICAgICAgc2V0VXBkYXRlQXZhaWxhYmxlKGZhbHNlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExpc3RlbiBmb3IgdXBkYXRlIGV2ZW50c1xyXG4gICAgaWYgKHJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgIHJlZ2lzdHJhdGlvbi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVmb3VuZCcsICgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbmV3V29ya2VyID0gcmVnaXN0cmF0aW9uLmluc3RhbGxpbmc7XHJcbiAgICAgICAgICAgIG5ld1dvcmtlci5hZGRFdmVudExpc3RlbmVyKCdzdGF0ZWNoYW5nZScsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChuZXdXb3JrZXIuc3RhdGUgPT09ICdpbnN0YWxsZWQnICYmIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBzaG93VXBkYXRlQmFyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBvbmxpbmUvb2ZmbGluZSBzdGF0dXNcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvbmxpbmUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKCdBcHAgaXMgb25saW5lJyk7XHJcbiAgICAgICAgZGIuZmV0Y2hBbmRTdG9yZVByb2R1Y3RzKCk7XHJcbiAgICAgICAgLy9kYi5mZXRjaEFuZFN0b3JlVXNlcnMoKTtcclxuICAgICAgICAvL2RiLnN5bmNEYXRhKHV0aWxzLmdldFVzZXJJRCgpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvZmZsaW5lJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0FwcCBpcyBvZmZsaW5lIC0gdXNpbmcgY2FjaGVkIGRhdGEnKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEluaXRpYWxpemUgYXBwXHJcbiAgICBhc3luYyBmdW5jdGlvbiBpbml0QXBwKCkge1xyXG4gICAgICAgIGF3YWl0IGRiLmluaXREQigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChuYXZpZ2F0b3Iub25MaW5lKSB7ICAgIFxyXG4gICAgICAgICAgICBhd2FpdCBkYi5mZXRjaEFuZFN0b3JlUHJvZHVjdHMoKTsgXHJcbiAgICAgICAgICAgIGF3YWl0IGRiLmZldGNoQW5kU3RvcmVVc2VycygpO1xyXG4gICAgICAgICAgICAvL2F3YWl0IGRiLnN5bmNEYXRhKGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEdldCBjdXJyZW50IHBhdGggYW5kIHJvdXRlXHJcbiAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lXHJcbiAgICAgICAgICAgIC5zcGxpdCgnLycpXHJcbiAgICAgICAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0Lmxlbmd0aCA+IDApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHByb2plY3RJZCA9IHBhdGhQYXJ0c1sxXSB8fCAnJztcclxuICAgICAgICB3aW5kb3cucm91dGVyKHBhdGhQYXJ0c1swXSB8fCAnaG9tZScsIHByb2plY3RJZCk7XHJcblxyXG4gICAgICAgIC8vIFNldCB0aGUgcHJvamVjdCBpZCBpbiB0aGUgaGlkZGVuIGlucHV0XHJcbiAgICAgICAgaWYgKHByb2plY3RJZCkge1xyXG4gICAgICAgICAgICAkKCcjbV9wcm9qZWN0X2lkJykudmFsKHByb2plY3RJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBpbml0QXBwKCk7XHJcbn0pO1xyXG5cclxuLy8gSGFuZGxlIHJlbG9hZCBhZnRlciB1cGRhdGVcclxubGV0IHJlZnJlc2hpbmcgPSBmYWxzZTtcclxubmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignY29udHJvbGxlcmNoYW5nZScsICgpID0+IHtcclxuICAgIGlmICghcmVmcmVzaGluZykge1xyXG4gICAgICAgIHJlZnJlc2hpbmcgPSB0cnVlO1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgIH1cclxufSk7IiwiY29uc3QgQVBJX0VORFBPSU5UUyA9IHtcclxuICAgIFBST0RVQ1RTOiAnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2FsbF9wcm9kdWN0c19uZWF0JyxcclxuICAgIFVTRVJfREFUQTogJ2h0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvYXBpL2dldF9hbGxfdXNlcl9kYXRhJ1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBBUElfRU5EUE9JTlRTOyIsImNvbnN0IHsgb3BlbkRCIH0gPSByZXF1aXJlKCdpZGInKTtcclxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21vZHVsZXMvdXRpbHMnKTtcclxuXHJcblxyXG5jb25zdCBEQl9OQU1FID0gJ3NzdF9kYXRhYmFzZSc7XHJcbmNvbnN0IERCX1ZFUlNJT04gPSAxODtcclxuY29uc3QgU1RPUkVfTkFNRSA9ICdwcm9kdWN0X2RhdGEnO1xyXG5cclxuLy8gQ3VzdG9tIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIFVVSURzXHJcbmZ1bmN0aW9uIGdlbmVyYXRlVVVJRCgpIHtcclxuICAgIHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uKGMpIHtcclxuICAgICAgICBjb25zdCByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KTtcclxuICAgICAgICByZXR1cm4gdi50b1N0cmluZygxNik7XHJcbiAgICB9KTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGluaXREQigpIHsgICAgXHJcbiAgICByZXR1cm4gYXdhaXQgb3BlbkRCKERCX05BTUUsIERCX1ZFUlNJT04sIHtcclxuICAgICAgICB1cGdyYWRlKGRiKSB7XHJcbiAgICAgICAgICAgIC8vIENoZWNrIGFuZCBjcmVhdGUgZXhpc3Rpbmcgc3RvcmUgZm9yIHByb2R1Y3RzXHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhTVE9SRV9OQU1FKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIG9iamVjdCBzdG9yZSBmb3IgcHJvZHVjdHMuLi4nKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiAncHJvZHVjdF9jb2RlJyB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdzaXRlJywgJ3NpdGUnLCB7IHVuaXF1ZTogZmFsc2UgfSk7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcInByb2plY3RzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwicHJvamVjdHNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJsb2NhdGlvbnNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJsb2NhdGlvbnNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwicHJvamVjdF9pZF9ma1wiLCBcInByb2plY3RfaWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcImJ1aWxkaW5nc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJsb2NhdGlvbl9pZF9ma1wiLCBcImxvY2F0aW9uX2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJmbG9vcnNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJmbG9vcnNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwiYnVpbGRpbmdfaWRfZmtcIiwgXCJidWlsZGluZ19pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7IFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcInJvb21zXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwicm9vbXNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwiZmxvb3JfaWRfZmtcIiwgXCJmbG9vcl9pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7IFxyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ3Jvb21faWRfZmsnLCAncm9vbV9pZF9maycsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJwcm9kdWN0c1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcInByb2R1Y3RzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcInJvb21faWRfZmtcIiwgXCJyb29tX2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJmYXZvdXJpdGVzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwiZmF2b3VyaXRlc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJza3Vfb3duZXJcIiwgW1wic2t1XCIsIFwib3duZXJfaWRcIl0sIHsgdW5pcXVlOiB0cnVlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pOyBcclxuICAgICAgICAgICAgfSAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJub3Rlc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcIm5vdGVzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcInJvb21faWRfZmtcIiwgXCJyb29tX2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfSAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJpbWFnZXNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJpbWFnZXNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwicm9vbV9pZF9ma1wiLCBcInJvb21faWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9ICAgXHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcInVzZXJzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwidXNlcnNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnZW1haWwnLCAnZW1haWwnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH0gICAgICAgICAgICBcclxuXHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkluZGV4ZWREQiBpbml0aWFsaXplZCB3aXRoIFVVSURzIGFuZCBvd25lcl9pZCBpbmRleGVzLlwiKTtcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZldGNoQW5kU3RvcmVQcm9kdWN0cygpIHtcclxuICAgIGNvbnN0IGlzRW1wdHkgPSBhd2FpdCBpc1Byb2R1Y3RzVGFibGVFbXB0eSgpO1xyXG4gICAgaWYgKGlzRW1wdHkpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRmV0Y2hpbmcgcHJvZHVjdHMgZnJvbSBBUEkuLi4nKTtcclxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2FsbF9wcm9kdWN0c19uZWF0Jyk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgZXJyb3IhIFN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgICAgICBhd2FpdCBzYXZlUHJvZHVjdHMocHJvZHVjdHMpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUHJvZHVjdHMgZmV0Y2hlZCBhbmQgc2F2ZWQgdG8gSW5kZXhlZERCJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgcHJvZHVjdCBkYXRhOicsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdQcm9kdWN0IGRhdGEgaXMgcHJlc2VudCBpbiBpbmRleGVkREIsIHNraXBwaW5nIGZldGNoLicpO1xyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBmZXRjaEFuZFN0b3JlVXNlcnMoKSB7XHJcbiAgICBjb25zdCBpc0VtcHR5ID0gYXdhaXQgaXNVc2Vyc1RhYmxlRW1wdHkoKTtcclxuICAgIGlmIChpc0VtcHR5KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIHByb2R1Y3RzIGZyb20gQVBJLi4uJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvYXBpL2dldF9hbGxfdXNlcnNfbmVhdCcpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQIGVycm9yISBTdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCB1c2VycyA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcclxuICAgICAgICAgICAgYXdhaXQgc2F2ZVVzZXJzKHVzZXJzKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBdXRoIHNhdmVkIHRvIEluZGV4ZWREQicpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIGF1dGggZGF0YTonLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQXV0aCBkYXRhIGlzIHByZXNlbnQgaW4gaW5kZXhlZERCLCBza2lwcGluZyBmZXRjaC4nKTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHB1bGxVc2VyRGF0YShvd25lcl9pZCkge1xyXG4gICAgaWYgKCFvd25lcl9pZCkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG93bmVyX2lkIHByb3ZpZGVkIGZvciBkYXRhIHN5bmMnKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9ICAgIFxyXG4gICAgb3duZXJfaWQgPSBvd25lcl9pZCtcIlwiOyAvLyBlbnN1cmUgaXQncyBhIHN0cmluZ1xyXG4gICAgY29uc3QgdXNlckRhdGEgPSB7XCJ1c2VyX2lkXCI6IG93bmVyX2lkfTsgLy8gVXNlIHRoZSBvd25lcl9pZCB2YXJpYWJsZVxyXG5cclxuICAgIC8vIHVzZXIgaGFzIHByb2plY3RzLCBvZmZlciB0byBwdWxsIGZyb20gYW5kIHNob3cgdGhlIHB1c2hlZCBkYXRlIG9uIHRoZSB1c2VyIHRhYmxlIGZvciBpbmZvcm1hdGlvblxyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2xhc3RfcHVzaGVkXCIsIHtcclxuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxyXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh1c2VyRGF0YSlcclxuICAgICAgICB9KTsgICAgXHJcbiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykgeyB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9YCk7IH1cclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpOyBcclxuICAgICAgICBjb25zb2xlLmxvZyhcInB1c2hlZDogXCIsIGRhdGEucHVzaGVkKTsgXHJcbiAgICAgICAgY29uc3QgbGFzdFB1c2hlZCA9IG5ldyBEYXRlKGRhdGEucHVzaGVkKTtcclxuICAgICAgICBjb25zdCBsYXN0UHVzaGVkU3RyID0gbGFzdFB1c2hlZC50b0xvY2FsZVN0cmluZygpO1xyXG4gICAgICAgIGNvbnN0IGxhc3RQdXNoZWRFcG9jaCA9IGxhc3RQdXNoZWQuZ2V0VGltZSgpO1xyXG4gICAgICAgIGNvbnN0IGxhc3RQdXNoZWRFcG9jaFN0ciA9IGxhc3RQdXNoZWRFcG9jaC50b1N0cmluZygpO1xyXG4gICAgICAgIC8vIG9mZmVyIGEgdWlraXQgY29uZmlybSBkaWFsb2cgdG8gcHVsbGwgZGF0YSwgc2hvd2luZyB0aGUgbGFzdCBwdXNoZWQgZGF0ZSBhbmQgdGltZVxyXG4gICAgICAgIGNvbnN0IHN0ciA9IGA8aDQ+WW91ciBsYXN0IHB1c2ggdG8gdGhlIHNlcnZlciB3YXMgPGJyPjxiPiR7bGFzdFB1c2hlZFN0cn08L2I+PC9oND4gPHA+V291bGQgeW91IGxpa2UgdG8gcHVsbCB0aGlzIGRhdGE/PC9wPmBcclxuICAgICAgICArYDxwIHN0eWxlPVwiY29sb3I6IHJlZDsgZm9udC13ZWlnaHQ6IGJvbGRcIj48c21hbGw+Q2xpY2tpbmcgT0sgd2lsbCBvdmVyd3JpdGUgYW55IGxvY2FsIGNoYW5nZXMgc2luY2UgdGhpcyBkYXRlLjwvc21hbGw+YDtcclxuICAgICAgICBVSWtpdC5tb2RhbC5jb25maXJtKHN0cikudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NvbmZpcm1lZC4nKVxyXG4gICAgICAgICAgICBzeW5jRGF0YShvd25lcl9pZCwgdHJ1ZSk7ICAgICAgXHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmVqZWN0ZWQuJylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIFxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHsgY29uc29sZS5lcnJvcihcIkRhdGEgc3luYyBmYWlsZWQ6XCIsIGVycm9yKTsgfSAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHN5bmNEYXRhKG93bmVyX2lkLCBmb3JjZSA9IGZhbHNlKSB7XHJcbiAgICBpZiAoIW93bmVyX2lkKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignTm8gb3duZXJfaWQgcHJvdmlkZWQgZm9yIGRhdGEgc3luYycpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gICAgXHJcbiAgICBvd25lcl9pZCA9IG93bmVyX2lkK1wiXCI7IC8vIGVuc3VyZSBpdCdzIGEgc3RyaW5nXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IHtcInVzZXJfaWRcIjogb3duZXJfaWR9OyAvLyBVc2UgdGhlIG93bmVyX2lkIHZhcmlhYmxlXHJcblxyXG4gICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1dvbnQgc3luYyBhcyBvZmZsaW5lJyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgLy9jb25zdCBpc0VtcHR5ID0gYXdhaXQgaXNEYXRhYmFzZUVtcHR5KCk7ICAvLyBuYWggSSB0aGluayB3ZSdsbCBncmFiIEpVU1QgdGhlIHVzZXIgZGF0YSBJRiB0aGVlciBpcyBub25lIGFscmVhZHlcclxuICAgIGNvbnN0IGhhc1Byb2plY3RzID0gYXdhaXQgZ2V0UHJvamVjdHMob3duZXJfaWQpOyAgICBcclxuXHJcbiAgICAvLyB1c2VyIGhhcyBwcm9qZWN0cywgb2ZmZXIgdG8gcHVsbCBmcm9tIGFuZCBzaG93IHRoZSBwdXNoZWQgZGF0ZSBvbiB0aGUgdXNlciB0YWJsZSBmb3IgaW5mb3JtYXRpb25cclxuICAgIGlmIChoYXNQcm9qZWN0cy5sZW5ndGggPiAwICYmICFmb3JjZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdMb2NhbCBQcm9qZWN0cyBleGlzdC4gTm90IGZvcmNpbmcuIERvbnQgc3luYy4nKTsgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZm9yY2UpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnZm9yY2luZyB1c2VyZGF0YSBQVUxMJyk7XHJcbiAgICB9XHJcbiAgICAgICAgXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXCJodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9nZXRfYWxsX3VzZXJfZGF0YVwiLCB7XHJcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZXJEYXRhKVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBkYlJlcXVlc3QgPSBpbmRleGVkREIub3BlbihEQl9OQU1FLCBEQl9WRVJTSU9OKTtcclxuICAgICAgICBkYlJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcclxuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihcclxuICAgICAgICAgICAgICAgIFtcInByb2plY3RzXCIsIFwibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCIsIFwicm9vbXNcIiwgXCJwcm9kdWN0c1wiLCBcImZhdm91cml0ZXNcIiwgXCJub3Rlc1wiLCBcImltYWdlc1wiXSxcclxuICAgICAgICAgICAgICAgIFwicmVhZHdyaXRlXCIgKTtcclxuXHJcbiAgICAgICAgICAgICAgICBbXCJwcm9qZWN0c1wiLCBcImxvY2F0aW9uc1wiLCBcImJ1aWxkaW5nc1wiLCBcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIiwgXCJmYXZvdXJpdGVzXCIsIFwibm90ZXNcIiwgXCJpbWFnZXNcIl0uZm9yRWFjaChcclxuICAgICAgICAgICAgICAgIChzdG9yZU5hbWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RvcmUuY2xlYXIoKTsgIC8vIENsZWFyIGV4aXN0aW5nIGRhdGFcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ29udmVydCBzaW5nbGUgb2JqZWN0IHRvIGFycmF5IGlmIG5lZWRlZFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gQXJyYXkuaXNBcnJheShkYXRhW3N0b3JlTmFtZV0pID8gZGF0YVtzdG9yZU5hbWVdIDogW2RhdGFbc3RvcmVOYW1lXV07XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbXMuZm9yRWFjaChpdGVtID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpdGVtIHx8ICFpdGVtLmlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBNaXNzaW5nIElEIGluICR7c3RvcmVOYW1lfTpgLCBpdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0udXVpZCA9IGl0ZW0uaWQ7ICAvLyBNYXAgJ2lkJyB0byAndXVpZCcgZm9yIEluZGV4ZWREQlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5vd25lcl9pZCA9IG93bmVyX2lkICsgXCJcIjsgLy8gQWRkIG93bmVyX2lkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJvb21faWRfZmsgPSBpdGVtLnJvb21faWRfZmsgfHwgaXRlbS51dWlkOyAvLyB0b2RvOiBjaGVjayBpZiB0aGlzIGlzIGNvcnJlY3QgKGRpZmZlcmVudCBmb3IgcHJvZHVjdHMsIG5vdGVzLCBpbWFnZXMpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgaXRlbS5pZDsgICAgICAgIC8vIFJlbW92ZSB0aGUgb3JpZ2luYWwgJ2lkJyBmaWVsZCB0byBhdm9pZCBjb25mbGljdHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0b3JlLnB1dChpdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAvLyB1cGRhdGUgdGhlIHVzZXJzIHRhYmxlIFwicHVsbGVkXCIgY29sdW1uIHdpdGggZHVycmVudCBkYXRldGltZVxyXG4gICAgICAgICAgICBzZXRQdWxsZWQob3duZXJfaWQpO1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdEYXRhIEZldGNoIENvbXBsZXRlIC4uLicsIHN0YXR1czogJ3N1Y2Nlc3MnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMTUwMCB9KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJEYXRhIHN5bmNlZCB0byBJbmRleGVkREIgc3VjY2Vzc2Z1bGx5LlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuKHRydWUpOyAgICAgICAgICAgIFxyXG4gICAgICAgIH07XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJEYXRhIHN5bmMgZmFpbGVkOlwiLCBlcnJvcik7XHJcbiAgICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHNldFB1bGxlZChvd25lcl9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJ1c2Vyc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJ1c2Vyc1wiKTtcclxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBzdG9yZS5nZXQob3duZXJfaWQpOyAgICAgICAgXHJcbiAgICB1c2VyLnB1bGxlZCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBhd2FpdCBzdG9yZS5wdXQodXNlcik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBpc0RhdGFiYXNlRW1wdHkoKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgcHJvamVjdENvdW50ID0gYXdhaXQgZGIuY291bnQoJ3Byb2plY3RzJyk7XHJcbiAgICBjb25zdCBsb2NhdGlvbkNvdW50ID0gYXdhaXQgZGIuY291bnQoJ2xvY2F0aW9ucycpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdDb3VudCA9IGF3YWl0IGRiLmNvdW50KCdidWlsZGluZ3MnKTtcclxuICAgIGNvbnN0IGZsb29yQ291bnQgPSBhd2FpdCBkYi5jb3VudCgnZmxvb3JzJyk7XHJcbiAgICBjb25zdCByb29tQ291bnQgPSBhd2FpdCBkYi5jb3VudCgncm9vbXMnKTtcclxuICAgIGNvbnN0IHByb2R1Y3RDb3VudCA9IGF3YWl0IGRiLmNvdW50KCdwcm9kdWN0cycpO1xyXG5cclxuICAgIHJldHVybiBwcm9qZWN0Q291bnQgPT09IDAgJiYgbG9jYXRpb25Db3VudCA9PT0gMCAmJiBidWlsZGluZ0NvdW50ID09PSAwICYmIGZsb29yQ291bnQgPT09IDAgJiYgcm9vbUNvdW50ID09PSAwICYmIHByb2R1Y3RDb3VudCA9PT0gMDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gaXNQcm9kdWN0c1RhYmxlRW1wdHkoKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgY291bnQgPSBhd2FpdCBkYi5jb3VudChTVE9SRV9OQU1FKTtcclxuICAgIHJldHVybiBjb3VudCA9PT0gMDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gaXNVc2Vyc1RhYmxlRW1wdHkoKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgY291bnQgPSBhd2FpdCBkYi5jb3VudCgndXNlcnMnKTtcclxuICAgIHJldHVybiBjb3VudCA9PT0gMDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2F2ZVByb2R1Y3RzKGRhdGEpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIGRhdGEpIHtcclxuICAgICAgICBhd2FpdCBzdG9yZS5wdXQocHJvZHVjdCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIGNvbnNvbGUubG9nKCdQcm9kdWN0cyBzdG9yZWQgaW4gSW5kZXhlZERCJyk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHNhdmVVc2VycyhkYXRhKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbigndXNlcnMnLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCd1c2VycycpO1xyXG5cclxuICAgIGZvciAoY29uc3QgdXNlciBvZiBkYXRhKSB7XHJcbiAgICAgICAgYXdhaXQgc3RvcmUucHV0KHVzZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICBjb25zb2xlLmxvZygnQXV0aCBzdG9yZWQgaW4gSW5kZXhlZERCJyk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2R1Y3RzKCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU1RPUkVfTkFNRSwgJ3JlYWRvbmx5Jyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNUT1JFX05BTUUpOyAgICBcclxuICAgIHJldHVybiBhd2FpdCBzdG9yZS5nZXRBbGwoKTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVByb2plY3QocHJvamVjdF9uYW1lLCBsb2NhdGlvbiwgYnVpbGRpbmcsIGZsb29yLCByb29tKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInByb2plY3RzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgbmV3UHJvamVjdElEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IHByb2plY3RTbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShwcm9qZWN0X25hbWUpO1xyXG4gICAgY29uc3QgcHJvamVjdCA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogcHJvamVjdF9uYW1lLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSwgXHJcbiAgICAgICAgcHJvamVjdF9pZF9mazogbmV3UHJvamVjdElELFxyXG4gICAgICAgIHNsdWc6IHByb2plY3RTbHVnLFxyXG4gICAgICAgIHV1aWQ6IG5ld1Byb2plY3RJRCxcclxuICAgICAgICB2ZXJzaW9uOiBcIjFcIlxyXG4gICAgfTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5hZGQocHJvamVjdCk7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG5cclxuICAgIGNvbnN0IGxvY2F0aW9uSUQgPSBhd2FpdCBhZGRMb2NhdGlvbihuZXdQcm9qZWN0SUQsIGxvY2F0aW9uKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nSUQgPSBhd2FpdCBhZGRCdWlsZGluZyhsb2NhdGlvbklELCBidWlsZGluZyk7XHJcbiAgICBjb25zdCBmbG9vcklEID0gYXdhaXQgYWRkRmxvb3IoYnVpbGRpbmdJRCwgZmxvb3IpO1xyXG4gICAgY29uc3Qgcm9vbUlEID0gYXdhaXQgYWRkUm9vbShmbG9vcklELCByb29tKTtcclxuXHJcbiAgICByZXR1cm4gcHJvamVjdC51dWlkO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9qZWN0cyh1c2VyX2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbigncHJvamVjdHMnLCAncmVhZG9ubHknKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoJ3Byb2plY3RzJyk7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KCdvd25lcl9pZCcpO1xyXG4gICAgdXNlcl9pZCA9IHVzZXJfaWQgKyBcIlwiO1xyXG4gICAgcmV0dXJuIGF3YWl0IGluZGV4LmdldEFsbCh1c2VyX2lkKTsgICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2plY3RIaWVyYXJjaHkob3duZXJfaWQsIHByb2plY3RfaWQpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiRmV0Y2hpbmcgZnJvbSBJbmRleGVkREIgZm9yIHByb2plY3RfaWQ6XCIsIHByb2plY3RfaWQpO1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIG93bmVyX2lkID0gU3RyaW5nKG93bmVyX2lkKTtcclxuXHJcbiAgICBsZXQgcHJvamVjdHMgPSBhd2FpdCBkYi5nZXRBbGxGcm9tSW5kZXgoJ3Byb2plY3RzJywgJ293bmVyX2lkJywgb3duZXJfaWQpO1xyXG5cclxuICAgIC8vIEZpbHRlciBwcm9qZWN0cyBieSBwcm9qZWN0X2lkXHJcbiAgICBpZiAocHJvamVjdF9pZCkge1xyXG4gICAgICAgIHByb2plY3RzID0gcHJvamVjdHMuZmlsdGVyKHByb2plY3QgPT4gcHJvamVjdC51dWlkID09PSBwcm9qZWN0X2lkKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIkZpbHRlcmVkIFByb2plY3RzOlwiLCBwcm9qZWN0cyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdObyBwcm9qZWN0IElELCBnZXR0aW5nIGFsbCBwcm9qZWN0cycpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcHJvamVjdHM6IHByb2plY3RzIHx8IFtdLFxyXG4gICAgICAgIGxvY2F0aW9uczogYXdhaXQgZGIuZ2V0QWxsRnJvbUluZGV4KCdsb2NhdGlvbnMnLCAnb3duZXJfaWQnLCBvd25lcl9pZCkgfHwgW10sXHJcbiAgICAgICAgYnVpbGRpbmdzOiBhd2FpdCBkYi5nZXRBbGxGcm9tSW5kZXgoJ2J1aWxkaW5ncycsICdvd25lcl9pZCcsIG93bmVyX2lkKSB8fCBbXSxcclxuICAgICAgICBmbG9vcnM6IGF3YWl0IGRiLmdldEFsbEZyb21JbmRleCgnZmxvb3JzJywgJ293bmVyX2lkJywgb3duZXJfaWQpIHx8IFtdLFxyXG4gICAgICAgIHJvb21zOiBhd2FpdCBkYi5nZXRBbGxGcm9tSW5kZXgoJ3Jvb21zJywgJ293bmVyX2lkJywgb3duZXJfaWQpIHx8IFtdXHJcbiAgICB9O1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9kdWN0c0ZvclJvb20ocm9vbUlkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInByb2R1Y3RzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTsgICAgIFxyXG4gICAgcm9vbUlkID0gU3RyaW5nKHJvb21JZCk7XHJcbiAgICByZXR1cm4gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21JZCk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2R1Y3RzRm9yUHJvamVjdChwcm9qZWN0SWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBwcm9qZWN0SWQgPSBTdHJpbmcocHJvamVjdElkKTsgICBcclxuXHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcInByb2R1Y3RzXCIsIFwicm9vbXNcIiwgXCJmbG9vcnNcIiwgXCJidWlsZGluZ3NcIiwgXCJsb2NhdGlvbnNcIiwgXCJwcm9qZWN0c1wiXSwgXCJyZWFkb25seVwiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IHByb2plY3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcblxyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBwcm9kdWN0U3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCByb29tcyA9IGF3YWl0IHJvb21TdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBidWlsZGluZ3MgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IHByb2plY3RzID0gYXdhaXQgcHJvamVjdFN0b3JlLmdldEFsbCgpO1xyXG5cclxuICAgIGNvbnN0IHByb2plY3RQcm9kdWN0cyA9IHByb2R1Y3RzLmZpbHRlcihwcm9kdWN0ID0+IHtcclxuICAgICAgICBjb25zdCByb29tID0gcm9vbXMuZmluZChyb29tID0+IHJvb20udXVpZCA9PT0gcHJvZHVjdC5yb29tX2lkX2ZrKTtcclxuICAgICAgICBpZiAoIXJvb20pIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBmbG9vciA9IGZsb29ycy5maW5kKGZsb29yID0+IGZsb29yLnV1aWQgPT09IHJvb20uZmxvb3JfaWRfZmspO1xyXG4gICAgICAgIGlmICghZmxvb3IpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBidWlsZGluZyA9IGJ1aWxkaW5ncy5maW5kKGJ1aWxkaW5nID0+IGJ1aWxkaW5nLnV1aWQgPT09IGZsb29yLmJ1aWxkaW5nX2lkX2ZrKTtcclxuICAgICAgICBpZiAoIWJ1aWxkaW5nKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgbG9jYXRpb24gPSBsb2NhdGlvbnMuZmluZChsb2NhdGlvbiA9PiBsb2NhdGlvbi51dWlkID09PSBidWlsZGluZy5sb2NhdGlvbl9pZF9mayk7XHJcbiAgICAgICAgaWYgKCFsb2NhdGlvbikgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IHByb2plY3QgPSBwcm9qZWN0cy5maW5kKHByb2plY3QgPT4gcHJvamVjdC51dWlkID09PSBsb2NhdGlvbi5wcm9qZWN0X2lkX2ZrKTtcclxuICAgICAgICByZXR1cm4gcHJvamVjdCAmJiBwcm9qZWN0LnV1aWQgPT09IHByb2plY3RJZDtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IHByb2plY3RQcm9kdWN0cy5yZWR1Y2UoKGFjYywgcHJvZHVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nUHJvZHVjdCA9IGFjYy5maW5kKHAgPT4gcC5za3UgPT09IHByb2R1Y3Quc2t1KTtcclxuICAgICAgICBpZiAoZXhpc3RpbmdQcm9kdWN0KSB7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nUHJvZHVjdC5xdHkgKz0gMTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCByb29tID0gcm9vbXMuZmluZChyb29tID0+IHJvb20udXVpZCA9PT0gcHJvZHVjdC5yb29tX2lkX2ZrKTtcclxuICAgICAgICAgICAgY29uc3QgZmxvb3IgPSBmbG9vcnMuZmluZChmbG9vciA9PiBmbG9vci51dWlkID09PSByb29tLmZsb29yX2lkX2ZrKTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRpbmcgPSBidWlsZGluZ3MuZmluZChidWlsZGluZyA9PiBidWlsZGluZy51dWlkID09PSBmbG9vci5idWlsZGluZ19pZF9mayk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gbG9jYXRpb25zLmZpbmQobG9jYXRpb24gPT4gbG9jYXRpb24udXVpZCA9PT0gYnVpbGRpbmcubG9jYXRpb25faWRfZmspO1xyXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0ID0gcHJvamVjdHMuZmluZChwcm9qZWN0ID0+IHByb2plY3QudXVpZCA9PT0gbG9jYXRpb24ucHJvamVjdF9pZF9mayk7XHJcblxyXG4gICAgICAgICAgICBhY2MucHVzaCh7XHJcbiAgICAgICAgICAgICAgICByZWY6IHByb2R1Y3QucmVmLFxyXG4gICAgICAgICAgICAgICAgcHJvZHVjdF9uYW1lOiBwcm9kdWN0LnByb2R1Y3RfbmFtZSxcclxuICAgICAgICAgICAgICAgIHByb2R1Y3Rfc2x1ZzogcHJvZHVjdC5wcm9kdWN0X3NsdWcsXHJcbiAgICAgICAgICAgICAgICBza3U6IHByb2R1Y3Quc2t1LFxyXG4gICAgICAgICAgICAgICAgY3VzdG9tOiBwcm9kdWN0LmN1c3RvbSxcclxuICAgICAgICAgICAgICAgIG93bmVyX2lkOiBwcm9kdWN0Lm93bmVyX2lkLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9pZF9mazogcHJvamVjdC51dWlkLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9zbHVnOiBwcm9qZWN0LnNsdWcsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X3ZlcnNpb246IHByb2plY3QudmVyc2lvbixcclxuICAgICAgICAgICAgICAgIHF0eTogMVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGFjYztcclxuICAgIH0sIFtdKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG5cclxufVxyXG5cclxuY29uc3Qgc2F2ZVByb2R1Y3RUb1Jvb20gPSBhc3luYyAocHJvZHVjdCkgPT4ge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9kdWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuXHJcbiAgICAvLyBFbnN1cmUgdGhlIHByb2R1Y3QgaGFzIGEgdXVpZCBhbmQgcm9vbV9pZF9ma1xyXG4gICAgaWYgKCFwcm9kdWN0LnV1aWQpIHtcclxuICAgICAgICBwcm9kdWN0LnV1aWQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuICAgIH1cclxuICAgIGlmICghcHJvZHVjdC5yb29tX2lkX2ZrKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicm9vbV9pZF9mayBpcyByZXF1aXJlZFwiKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCBzdG9yZS5hZGQocHJvZHVjdCk7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgY29uc29sZS5sb2coJ1Byb2R1Y3QgYWRkZWQgdG8gcm9vbTonLCBwcm9kdWN0KTtcclxufTtcclxuXHJcbmNvbnN0IGRlbGV0ZVByb2R1Y3RGcm9tUm9vbSA9IGFzeW5jIChza3UsIHJvb21faWQpID0+IHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tX2lkKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2YgcHJvZHVjdHMpIHtcclxuICAgICAgICBpZiAocHJvZHVjdC5za3UgPT09IHNrdSkge1xyXG4gICAgICAgICAgICBhd2FpdCBzdG9yZS5kZWxldGUocHJvZHVjdC51dWlkKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Byb2R1Y3QgZGVsZXRlZCBmcm9tIHJvb206JywgcHJvZHVjdCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5jb25zdCBzZXRTa3VRdHlGb3JSb29tID0gYXN5bmMgKHF0eSwgc2t1LCByb29tX2lkKSA9PiB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInByb2R1Y3RzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcblxyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBpbmRleC5nZXRBbGwocm9vbV9pZCk7XHJcbiAgICBjb25zdCBwcm9kdWN0ID0gcHJvZHVjdHMuZmluZChwID0+IHAuc2t1ID09PSBza3UpO1xyXG5cclxuICAgIC8vIFJlbW92ZSBhbGwgZXhpc3RpbmcgcHJvZHVjdHMgd2l0aCB0aGUgZ2l2ZW4gU0tVIGluIHRoZSBzcGVjaWZpZWQgcm9vbVxyXG4gICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgaWYgKHByb2R1Y3Quc2t1ID09PSBza3UpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdEZWxldGluZyBwcm9kdWN0OicsIHByb2R1Y3QpO1xyXG4gICAgICAgICAgICBhd2FpdCBzdG9yZS5kZWxldGUocHJvZHVjdC51dWlkKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmUtYWRkIHRoZSBwcm9kdWN0cyB3aXRoIHRoZSBzcGVjaWZpZWQgcXVhbnRpdHlcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcXR5OyBpKyspIHtcclxuICAgICAgICBjb25zdCBuZXdQcm9kdWN0ID0geyAuLi5wcm9kdWN0LCB1dWlkOiBnZW5lcmF0ZVVVSUQoKSB9O1xyXG4gICAgICAgIGF3YWl0IHN0b3JlLmFkZChuZXdQcm9kdWN0KTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbmNvbnN0IHVwZGF0ZVByb2R1Y3RSZWYgPSBhc3luYyAocm9vbV9pZCwgc2t1LCByZWYpID0+IHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tX2lkKTtcclxuICAgIGNvbnN0IHByb2R1Y3QgPSBwcm9kdWN0cy5maW5kKHAgPT4gcC5za3UgPT09IHNrdSk7ICAgIFxyXG5cclxuICAgIGlmIChwcm9kdWN0KSB7XHJcbiAgICAgICAgcHJvZHVjdC5yZWYgPSByZWY7XHJcbiAgICAgICAgYXdhaXQgc3RvcmUucHV0KHByb2R1Y3QpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdQcm9kdWN0IG5vdCBmb3VuZCBmb3IgU0tVOicsIHNrdSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IGdldFJvb21NZXRhID0gYXN5bmMgKHJvb21JZCkgPT4ge1xyXG4gICAgcm9vbUlkID0gU3RyaW5nKHJvb21JZCk7XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcbiAgICBjb25zdCByb29tID0gYXdhaXQgaW5kZXguZ2V0KHJvb21JZCk7ICAgIFxyXG4gICAgaWYgKCFyb29tKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSb29tIHdpdGggaWQgJHtyb29tSWR9IG5vdCBmb3VuZGApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImZsb29yc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3QgZmxvb3IgPSBhd2FpdCBmbG9vclN0b3JlLmdldChyb29tLmZsb29yX2lkX2ZrKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImJ1aWxkaW5nc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgY29uc3QgYnVpbGRpbmcgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmdldChmbG9vci5idWlsZGluZ19pZF9mayk7XHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJsb2NhdGlvbnNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uID0gYXdhaXQgbG9jYXRpb25TdG9yZS5nZXQoYnVpbGRpbmcubG9jYXRpb25faWRfZmspO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2NhdGlvbjogeyBuYW1lOiBsb2NhdGlvbi5uYW1lLCB1dWlkOiBsb2NhdGlvbi51dWlkIH0sXHJcbiAgICAgICAgYnVpbGRpbmc6IHsgbmFtZTogYnVpbGRpbmcubmFtZSwgdXVpZDogYnVpbGRpbmcudXVpZCB9LFxyXG4gICAgICAgIGZsb29yOiB7IG5hbWU6IGZsb29yLm5hbWUsIHV1aWQ6IGZsb29yLnV1aWQgfSxcclxuICAgICAgICByb29tOiB7IG5hbWU6IHJvb20ubmFtZSwgdXVpZDogcm9vbS51dWlkLCBoZWlnaHQ6IHJvb20uaGVpZ2h0LCB3aWR0aDogcm9vbS53aWR0aCwgbGVuZ3RoOiByb29tLmxlbmd0aCB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0Um9vbU5vdGVzKHJvb21JZCkge1xyXG4gICAgcm9vbUlkID0gU3RyaW5nKHJvb21JZCk7XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJub3Rlc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcbiAgICBjb25zdCBub3RlcyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tSWQpO1xyXG4gICAgbm90ZXMuc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5jcmVhdGVkX29uKSAtIG5ldyBEYXRlKGEuY3JlYXRlZF9vbikpO1xyXG4gICAgcmV0dXJuIG5vdGVzO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkUm9vbShmbG9vclV1aWQsIHJvb21OYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgbGV0IHR4MSA9IGRiLnRyYW5zYWN0aW9uKFwicm9vbXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBsZXQgc3RvcmUxID0gdHgxLm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBsZXQgbmV3Um9vbUlEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IHJvb21TbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShyb29tTmFtZSk7XHJcbiAgICAvLyBpIG5lZWQgdG8gY2hlY2sgaWYgdGhpcyByb29tIGFscmVhZHkgZXhpc3RzIGluIHRoaXMgcHJvamVjdFxyXG4gICAgY29uc3QgZXhpc3RpbmdSb29tcyA9IGF3YWl0IHN0b3JlMS5nZXRBbGwoKTtcclxuICAgIGNvbnNvbGUubG9nKCdFeGlzdGluZyByb29tczonLCBleGlzdGluZ1Jvb21zKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nUm9vbSA9IGV4aXN0aW5nUm9vbXMuZmluZChyb29tID0+IHJvb20uc2x1ZyA9PSByb29tU2x1ZyAmJiByb29tLmZsb29yX2lkX2ZrID09IGZsb29yVXVpZCk7XHJcbiAgICBjb25zb2xlLmxvZygnRXhpc3Rpbmcgcm9vbTonLCBleGlzdGluZ1Jvb20pO1xyXG4gICAgaWYgKGV4aXN0aW5nUm9vbSkgeyAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmYWxzZTsgICBcclxuICAgIH1cclxuICAgIC8vIGlmIHRoZSByb29tIGV4aXN0cyBBTllXSEVSRSBpbiB0aGlzIFBST0pFQ1RcclxuICAgIGNvbnN0IGN1cnJlbnRQcm9qZWN0ID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTsgICAgXHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSBkYi50cmFuc2FjdGlvbihcInByb2plY3RzXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBwcm9qZWN0U3RvcmUuZ2V0KFN0cmluZyhjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkKSk7ICAgIFxyXG4gICAgXHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJsb2NhdGlvbnNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuaW5kZXgoXCJwcm9qZWN0X2lkX2ZrXCIpLmdldEFsbChwcm9qZWN0LnV1aWQpO1xyXG4gICBcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImJ1aWxkaW5nc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgbGV0IGJ1aWxkaW5ncyA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBsb2NhdGlvbiBvZiBsb2NhdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBsb2NhdGlvbkJ1aWxkaW5ncyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuaW5kZXgoXCJsb2NhdGlvbl9pZF9ma1wiKS5nZXRBbGwobG9jYXRpb24udXVpZCk7XHJcbiAgICAgICAgYnVpbGRpbmdzID0gYnVpbGRpbmdzLmNvbmNhdChsb2NhdGlvbkJ1aWxkaW5ncyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJmbG9vcnNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGxldCBmbG9vcnMgPSBbXTtcclxuICAgIGZvciAoY29uc3QgYnVpbGRpbmcgb2YgYnVpbGRpbmdzKSB7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdGbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmluZGV4KFwiYnVpbGRpbmdfaWRfZmtcIikuZ2V0QWxsKGJ1aWxkaW5nLnV1aWQpO1xyXG4gICAgICAgIGZsb29ycyA9IGZsb29ycy5jb25jYXQoYnVpbGRpbmdGbG9vcnMpO1xyXG4gICAgfVxyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBsZXQgcm9vbXMgPSBbXTtcclxuICAgIGZvciAoY29uc3QgZmxvb3Igb2YgZmxvb3JzKSB7XHJcbiAgICAgICAgY29uc3QgZmxvb3JSb29tcyA9IGF3YWl0IHJvb21TdG9yZS5pbmRleChcImZsb29yX2lkX2ZrXCIpLmdldEFsbChmbG9vci51dWlkKTtcclxuICAgICAgICByb29tcyA9IHJvb21zLmNvbmNhdChmbG9vclJvb21zKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGV4aXN0aW5nUm9vbUluUHJvamVjdCA9IHJvb21zLmZpbmQocm9vbSA9PiByb29tLnNsdWcgPT09IHJvb21TbHVnKTtcclxuICAgIGlmIChleGlzdGluZ1Jvb21JblByb2plY3QpIHsgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgXHJcbiAgICBcclxuICAgIC8vIGFkZCB0aGUgcm9vbVxyXG4gICAgbGV0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGxldCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCByb29tID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBmbG9vcl9pZF9mazogU3RyaW5nKGZsb29yVXVpZCksXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogcm9vbU5hbWUsXHJcbiAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLCBcclxuICAgICAgICByb29tX2lkX2ZrOiBuZXdSb29tSUQsXHJcbiAgICAgICAgc2x1Zzogcm9vbVNsdWcsXHJcbiAgICAgICAgdXVpZDogbmV3Um9vbUlELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChyb29tKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gcm9vbS51dWlkO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBhZGRGbG9vcihidWlsZGluZ1V1aWQsIGZsb29yTmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJmbG9vcnNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3QgbmV3Rmxvb3JJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBjb25zdCBmbG9vclNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KGZsb29yTmFtZSk7XHJcbiAgICBjb25zdCBmbG9vciA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgYnVpbGRpbmdfaWRfZms6IFN0cmluZyhidWlsZGluZ1V1aWQpLFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIG5hbWU6IGZsb29yTmFtZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIGZsb29yX2lkX2ZrOiBuZXdGbG9vcklELFxyXG4gICAgICAgIHNsdWc6IGZsb29yU2x1ZyxcclxuICAgICAgICB1dWlkOiBuZXdGbG9vcklELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChmbG9vcik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIGZsb29yLnV1aWQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZExvY2F0aW9uKHByb2plY3RVdWlkLCBsb2NhdGlvbk5hbWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwibG9jYXRpb25zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IG5ld0xvY2F0aW9uSUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3QgbG9jYXRpb25TbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShsb2NhdGlvbk5hbWUpO1xyXG4gICAgY29uc3QgbG9jYXRpb24gPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIG5hbWU6IGxvY2F0aW9uTmFtZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIGxvY2F0aW9uX2lkX2ZrOiBuZXdMb2NhdGlvbklELFxyXG4gICAgICAgIHByb2plY3RfaWRfZms6IHByb2plY3RVdWlkLFxyXG4gICAgICAgIHNsdWc6IGxvY2F0aW9uU2x1ZyxcclxuICAgICAgICB1dWlkOiBuZXdMb2NhdGlvbklELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChsb2NhdGlvbik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIGxvY2F0aW9uLnV1aWQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEJ1aWxkaW5nKGxvY2F0aW9uVXVpZCwgYnVpbGRpbmdOYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImJ1aWxkaW5nc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBjb25zdCBuZXdCdWlsZGluZ0lEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU2x1ZyA9IGF3YWl0IHV0aWxzLnNsdWdpZnkoYnVpbGRpbmdOYW1lKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBsb2NhdGlvbl9pZF9mazogU3RyaW5nKGxvY2F0aW9uVXVpZCksXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogYnVpbGRpbmdOYW1lLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSwgXHJcbiAgICAgICAgYnVpbGRpbmdfaWRfZms6IG5ld0J1aWxkaW5nSUQsXHJcbiAgICAgICAgc2x1ZzogYnVpbGRpbmdTbHVnLFxyXG4gICAgICAgIHV1aWQ6IG5ld0J1aWxkaW5nSUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKGJ1aWxkaW5nKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gYnVpbGRpbmcudXVpZDtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZVJvb20ocm9vbVV1aWQpIHsgICAgXHJcbiAgICByb29tVXVpZCA9IFwiXCIgKyByb29tVXVpZDtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcInJvb21zXCIsIFwicHJvZHVjdHNcIl0sIFwicmVhZHdyaXRlXCIpO1xyXG5cclxuICAgIC8vIFJlbW92ZSB0aGUgcm9vbVxyXG4gICAgY29uc29sZS5sb2coJ3JlbW92aW5nIHJvb20gdXVpZDogJywgcm9vbVV1aWQpO1xyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIHJvb21VdWlkLnRvU3RyaW5nKCk7XHJcbiAgICBjb25zb2xlLmxvZygndHlwZW9mOiAnLHR5cGVvZiByb29tVXVpZCk7XHJcbiAgICBhd2FpdCByb29tU3RvcmUuZGVsZXRlKHJvb21VdWlkKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgYWxsIHByb2R1Y3RzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJvb21cclxuICAgIGNvbnN0IHByb2R1Y3RzU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBwcm9kdWN0c1N0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21VdWlkKTtcclxuICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgIGF3YWl0IHByb2R1Y3RzU3RvcmUuZGVsZXRlKHByb2R1Y3QudXVpZCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVtb3ZlRmxvb3IoZmxvb3JVdWlkKSB7ICAgIFxyXG4gICAgZmxvb3JVdWlkID0gXCJcIiArIGZsb29yVXVpZDtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIl0sIFwicmVhZHdyaXRlXCIpO1xyXG5cclxuICAgIC8vIFJlbW92ZSB0aGUgZmxvb3JcclxuICAgIGNvbnNvbGUubG9nKCdyZW1vdmluZyBmbG9vciB1dWlkOiAnICsgZmxvb3JVdWlkKTtcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGF3YWl0IGZsb29yU3RvcmUuZGVsZXRlKGZsb29yVXVpZCk7XHJcblxyXG4gICAgLy8gcmVtb3ZlIGFsbCBwcm9kdWN0cyBhc3NvY2lhdGVkIHdpdGggYWxsIHJvb21zIHdpdGhpbiB0aGlzIGZsb29yIGZpcnN0XHJcbiAgICBjb25zdCBwcm9kdWN0c1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCByb29tSW5kZXggPSBwcm9kdWN0c1N0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gcm9vbVN0b3JlLmluZGV4KFwiZmxvb3JfaWRfZmtcIik7XHJcbiAgICBjb25zdCByb29tcyA9IGF3YWl0IGluZGV4LmdldEFsbChmbG9vclV1aWQpO1xyXG5cclxuICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcm9vbUluZGV4LmdldEFsbChyb29tLnV1aWQpO1xyXG4gICAgICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgICAgICBhd2FpdCBwcm9kdWN0c1N0b3JlLmRlbGV0ZShwcm9kdWN0LnV1aWQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyByZW1vdmUgYWxsIHJvb21zIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZsb29yXHJcbiAgICBmb3IgKGNvbnN0IHJvb20gb2Ygcm9vbXMpIHtcclxuICAgICAgICBhd2FpdCByb29tU3RvcmUuZGVsZXRlKHJvb20udXVpZCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZUJ1aWxkaW5nKGJ1aWxkaW5nVXVpZCkge1xyXG4gICAgYnVpbGRpbmdVdWlkID0gU3RyaW5nKGJ1aWxkaW5nVXVpZCk7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCJdLCBcInJlYWR3cml0ZVwiKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgdGhlIGJ1aWxkaW5nXHJcbiAgICBjb25zb2xlLmxvZygncmVtb3ZpbmcgYnVpbGRpbmcgdXVpZDogJyArIGJ1aWxkaW5nVXVpZCk7XHJcbiAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBhd2FpdCBidWlsZGluZ1N0b3JlLmRlbGV0ZShidWlsZGluZ1V1aWQpO1xyXG5cclxuICAgIC8vIHJlbW92ZSBhbGwgZmxvb3JzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGJ1aWxkaW5nXHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCBmbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdGbG9vcnMgPSBmbG9vcnMuZmlsdGVyKGZsb29yID0+IGZsb29yLmJ1aWxkaW5nX2lkX2ZrID09PSBidWlsZGluZ1V1aWQpO1xyXG5cclxuICAgIGZvciAoY29uc3QgZmxvb3Igb2YgYnVpbGRpbmdGbG9vcnMpIHtcclxuICAgICAgICAvLyByZW1vdmUgYWxsIHByb2R1Y3RzIGFzc29jaWF0ZWQgd2l0aCBhbGwgcm9vbXMgd2l0aGluIHRoaXMgZmxvb3IgZmlyc3RcclxuICAgICAgICBjb25zdCBwcm9kdWN0c1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgICAgICBjb25zdCByb29tU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgICAgIGNvbnN0IHJvb21JbmRleCA9IHByb2R1Y3RzU3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gcm9vbVN0b3JlLmluZGV4KFwiZmxvb3JfaWRfZmtcIik7XHJcbiAgICAgICAgY29uc3Qgcm9vbXMgPSBhd2FpdCBpbmRleC5nZXRBbGwoZmxvb3IudXVpZCk7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHJvb21JbmRleC5nZXRBbGwocm9vbS51dWlkKTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBwcm9kdWN0c1N0b3JlLmRlbGV0ZShwcm9kdWN0LnV1aWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyByZW1vdmUgYWxsIHJvb21zIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZsb29yXHJcbiAgICAgICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHJvb21TdG9yZS5kZWxldGUocm9vbS51dWlkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlbW92ZSB0aGUgZmxvb3IgaXRzZWxmXHJcbiAgICAgICAgYXdhaXQgZmxvb3JTdG9yZS5kZWxldGUoZmxvb3IudXVpZCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZU5hbWUoc3RvcmUsIHV1aWQsIG5ld05hbWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKHN0b3JlLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IG9iamVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmUpO1xyXG4gICAgdXVpZCA9IFN0cmluZyh1dWlkKTtcclxuICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IG9iamVjdFN0b3JlLmdldCh1dWlkKTtcclxuICAgIHJlY29yZC5uYW1lID0gbmV3TmFtZTtcclxuICAgIHJlY29yZC5zbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShuZXdOYW1lKTtcclxuICAgIGF3YWl0IG9iamVjdFN0b3JlLnB1dChyZWNvcmQpO1xyXG4gICAgYXdhaXQgdHguZG9uZTsgICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2plY3RTdHJ1Y3R1cmUocHJvamVjdElkKSB7XHJcbiAgICBvd25lcl9pZCA9IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLCBcclxuICAgIG93bmVyX2lkID0gU3RyaW5nKG93bmVyX2lkKTtcclxuXHJcbiAgICBjb25zdCBoaWVyYXJjaHkgPSBhd2FpdCBnZXRQcm9qZWN0SGllcmFyY2h5KG93bmVyX2lkLCBwcm9qZWN0SWQpOyBcclxuICAgIGxldCByZXN1bHQgPSB7fTtcclxuXHJcbiAgICAvLyBHZXQgdGhlIHByb2plY3QgZGV0YWlsc1xyXG4gICAgY29uc3QgcHJvamVjdCA9IGhpZXJhcmNoeS5wcm9qZWN0c1swXTtcclxuICAgIGlmICghcHJvamVjdCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgLy8gSW5pdGlhbGl6ZSBwcm9qZWN0IGxldmVsXHJcbiAgICByZXN1bHQgPSB7XHJcbiAgICAgICAgcHJvamVjdF9uYW1lOiBwcm9qZWN0Lm5hbWUsXHJcbiAgICAgICAgcHJvamVjdF9zbHVnOiBwcm9qZWN0LnNsdWcsXHJcbiAgICAgICAgcHJvamVjdF9pZDogcHJvamVjdC51dWlkXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIEdldCBsb2NhdGlvbnMgZm9yIHRoaXMgcHJvamVjdFxyXG4gICAgY29uc3QgcHJvamVjdExvY2F0aW9ucyA9IGhpZXJhcmNoeS5sb2NhdGlvbnNcclxuICAgICAgICAuZmlsdGVyKGxvYyA9PiBsb2MucHJvamVjdF9pZF9mayA9PT0gcHJvamVjdC51dWlkKTtcclxuXHJcbiAgICAvLyBCdWlsZCBsb2NhdGlvbiBsZXZlbFxyXG4gICAgcHJvamVjdExvY2F0aW9ucy5mb3JFYWNoKGxvY2F0aW9uID0+IHtcclxuICAgICAgICByZXN1bHRbbG9jYXRpb24uc2x1Z10gPSB7XHJcbiAgICAgICAgICAgIGxvY2F0aW9uX25hbWU6IGxvY2F0aW9uLm5hbWUsXHJcbiAgICAgICAgICAgIGxvY2F0aW9uX3NsdWc6IGxvY2F0aW9uLnNsdWcsXHJcbiAgICAgICAgICAgIGxvY2F0aW9uX2lkOiBsb2NhdGlvbi51dWlkXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gR2V0IGJ1aWxkaW5ncyBmb3IgdGhpcyBsb2NhdGlvblxyXG4gICAgICAgIGNvbnN0IGxvY2F0aW9uQnVpbGRpbmdzID0gaGllcmFyY2h5LmJ1aWxkaW5nc1xyXG4gICAgICAgICAgICAuZmlsdGVyKGJ1aWxkID0+IGJ1aWxkLmxvY2F0aW9uX2lkX2ZrID09PSBsb2NhdGlvbi51dWlkKTtcclxuXHJcbiAgICAgICAgLy8gQnVpbGQgYnVpbGRpbmcgbGV2ZWxcclxuICAgICAgICBsb2NhdGlvbkJ1aWxkaW5ncy5mb3JFYWNoKGJ1aWxkaW5nID0+IHtcclxuICAgICAgICAgICAgcmVzdWx0W2xvY2F0aW9uLnNsdWddW2J1aWxkaW5nLnNsdWddID0ge1xyXG4gICAgICAgICAgICAgICAgYnVpbGRpbmdfbmFtZTogYnVpbGRpbmcubmFtZSxcclxuICAgICAgICAgICAgICAgIGJ1aWxkaW5nX3NsdWc6IGJ1aWxkaW5nLnNsdWcsXHJcbiAgICAgICAgICAgICAgICBidWlsZGluZ19pZDogYnVpbGRpbmcudXVpZFxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLy8gR2V0IGZsb29ycyBmb3IgdGhpcyBidWlsZGluZ1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZGluZ0Zsb29ycyA9IGhpZXJhcmNoeS5mbG9vcnNcclxuICAgICAgICAgICAgICAgIC5maWx0ZXIoZmxvb3IgPT4gZmxvb3IuYnVpbGRpbmdfaWRfZmsgPT09IGJ1aWxkaW5nLnV1aWQpO1xyXG5cclxuICAgICAgICAgICAgLy8gQnVpbGQgZmxvb3IgbGV2ZWxcclxuICAgICAgICAgICAgYnVpbGRpbmdGbG9vcnMuZm9yRWFjaChmbG9vciA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbbG9jYXRpb24uc2x1Z11bYnVpbGRpbmcuc2x1Z11bZmxvb3Iuc2x1Z10gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmxvb3JfbmFtZTogZmxvb3IubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBmbG9vcl9zbHVnOiBmbG9vci5zbHVnLFxyXG4gICAgICAgICAgICAgICAgICAgIGZsb29yX2lkOiBmbG9vci51dWlkXHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEdldCByb29tcyBmb3IgdGhpcyBmbG9vclxyXG4gICAgICAgICAgICAgICAgY29uc3QgZmxvb3JSb29tcyA9IGhpZXJhcmNoeS5yb29tc1xyXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIocm9vbSA9PiByb29tLmZsb29yX2lkX2ZrID09PSBmbG9vci51dWlkKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBCdWlsZCByb29tIGxldmVsXHJcbiAgICAgICAgICAgICAgICBmbG9vclJvb21zLmZvckVhY2gocm9vbSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2xvY2F0aW9uLnNsdWddW2J1aWxkaW5nLnNsdWddW2Zsb29yLnNsdWddW3Jvb20uc2x1Z10gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvb21fbmFtZTogcm9vbS5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByb29tX3NsdWc6IHJvb20uc2x1ZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbS51dWlkXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9qZWN0QnlVVUlEKHV1aWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBzdG9yZS5nZXQodXVpZCk7XHJcbiAgICByZXR1cm4gcHJvamVjdDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlUHJvamVjdERldGFpbHMocHJvamVjdERhdGEpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcblxyXG4gICAgYXdhaXQgc3RvcmUucHV0KHByb2plY3REYXRhKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7ICAgIFxyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlUm9vbURpbWVuc2lvbihyb29tVXVpZCwgZmllbGQsIHZhbHVlKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3Qgcm9vbSA9IGF3YWl0IHN0b3JlLmdldChyb29tVXVpZCk7XHJcbiAgICByb29tW2ZpZWxkXSA9IHZhbHVlO1xyXG4gICAgYXdhaXQgc3RvcmUucHV0KHJvb20pO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gY29weVJvb20ocm9vbVV1aWQsIG5ld1Jvb21OYW1lLCBuZXdGbG9vclV1aWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eDEgPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eDEub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IHJvb20gPSBhd2FpdCBzdG9yZS5nZXQocm9vbVV1aWQpO1xyXG4gICAgY29uc3QgbmV3VXVpZCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgY29uc3QgbmV3Um9vbSA9IHsgLi4ucm9vbSwgdXVpZDogbmV3VXVpZCB9O1xyXG4gICAgY29uc29sZS5sb2coJ0NvcHlpbmcgcm9vbSB0byBuZXcgcm9vbScsIHJvb21VdWlkLCBuZXdSb29tLnV1aWQpO1xyXG4gICAgLy8gYXBwZW5kICBcIiAtIGNvcHlcIiB0byByb29tIG5hbWUgcm9vbSBzbHVnIFxyXG4gICAgbmV3Um9vbS5uYW1lID0gbmV3Um9vbU5hbWUgfHwgbmV3Um9vbS5uYW1lICsgXCIgLSBDb3B5XCI7XHJcbiAgICBuZXdSb29tLnNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KG5ld1Jvb20ubmFtZSk7ICBcclxuICAgIG5ld1Jvb20ucm9vbV9pZF9mayA9IG5ld1V1aWQ7XHJcbiAgICBuZXdSb29tLmZsb29yX2lkX2ZrID0gbmV3Rmxvb3JVdWlkIHx8IG5ld1Jvb20uZmxvb3JfaWRfZms7XHJcbiAgICBkZWxldGUgbmV3Um9vbS5pZDtcclxuICAgIGF3YWl0IHN0b3JlLmFkZChuZXdSb29tKTtcclxuICAgIGF3YWl0IHR4MS5kb25lO1xyXG5cclxuICAgIC8vIG5vdyBhbHNvIGNvcHkgdGhlIHByb2R1Y3RzIGluIHRoZSBvbGQgcm9vbSB0byB0aGUgbmV3IHJvb21cclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgZ2V0UHJvZHVjdHNGb3JSb29tKHJvb21VdWlkKTtcclxuICAgIGNvbnN0IHR4MiA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBwcm9kdWN0U3RvcmUgPSB0eDIub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgIHByb2R1Y3Qucm9vbV9pZF9mayA9IG5ld1V1aWQ7XHJcbiAgICAgICAgcHJvZHVjdC51dWlkID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgYXdhaXQgcHJvZHVjdFN0b3JlLmFkZChwcm9kdWN0KTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eDIuZG9uZTtcclxufVxyXG5cclxuLy8gZ2V0IGFsbCBmbG9vcnMgaW4gdGhpcyBwcm9qZWN0IFxyXG5hc3luYyBmdW5jdGlvbiBnZXRGbG9vcnMocHJvamVjdF9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCJdLCBcInJlYWRvbmx5XCIpO1xyXG5cclxuICAgIC8vIEdldCBsb2NhdGlvbnMgcmVsYXRlZCB0byB0aGUgcHJvamVjdFxyXG4gICAgY29uc3QgbG9jYXRpb25TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5pbmRleChcInByb2plY3RfaWRfZmtcIikuZ2V0QWxsKHByb2plY3RfaWQpO1xyXG5cclxuICAgIC8vIEdldCBidWlsZGluZ3MgcmVsYXRlZCB0byB0aG9zZSBsb2NhdGlvbnNcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGxldCBidWlsZGluZ3MgPSBbXTtcclxuICAgIGZvciAoY29uc3QgbG9jYXRpb24gb2YgbG9jYXRpb25zKSB7XHJcbiAgICAgICAgY29uc3QgbG9jYXRpb25CdWlsZGluZ3MgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmluZGV4KFwibG9jYXRpb25faWRfZmtcIikuZ2V0QWxsKGxvY2F0aW9uLnV1aWQpO1xyXG4gICAgICAgIGJ1aWxkaW5ncyA9IGJ1aWxkaW5ncy5jb25jYXQobG9jYXRpb25CdWlsZGluZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEdldCBmbG9vcnMgdW5kZXIgdGhvc2UgYnVpbGRpbmdzXHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBsZXQgZmxvb3JzID0gW107XHJcbiAgICBmb3IgKGNvbnN0IGJ1aWxkaW5nIG9mIGJ1aWxkaW5ncykge1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nRmxvb3JzID0gYXdhaXQgZmxvb3JTdG9yZS5pbmRleChcImJ1aWxkaW5nX2lkX2ZrXCIpLmdldEFsbChidWlsZGluZy51dWlkKTtcclxuICAgICAgICBmbG9vcnMgPSBmbG9vcnMuY29uY2F0KGJ1aWxkaW5nRmxvb3JzKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmbG9vckFycmF5ID0gW107XHJcbiAgICBmb3IgKGNvbnN0IGZsb29yIG9mIGZsb29ycykge1xyXG4gICAgICAgIGZsb29yQXJyYXkucHVzaCh7dXVpZDogZmxvb3IudXVpZCwgbmFtZTogZmxvb3IubmFtZX0pO1xyXG4gICAgfSAgIFxyXG4gICAgcmV0dXJuIGZsb29yQXJyYXk7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiByZW1vdmVQcm9qZWN0KHByb2plY3RfaWQpIHtcclxuICAgIC8vIHJhdGhlciB0aGFuIGRlbGV0ZSBhbnl0aGluZyBmcm9tIHRoZSBkYXRhYmFzZSwgaSBqdXN0IHdhbnQgdG8gY2hhbmdlIHRoZSBvd25lcl9pZiBvZiB0aGUgcHJvamVjdCB0byBwcmVwZW5kXSA5OTkgaW4gZnJvbnQgXHJcbiAgICAvLyBidXQgb25seSBpbiB0aGUgcHJvamVjdHMgdGFibGUsIHNvIHRoYXQgaXQgaXMgbm90IHNob3duIGluIHRoZSBwcm9qZWN0IGxpc3RcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcbiAgICBjb25zdCBwcm9qZWN0ID0gYXdhaXQgc3RvcmUuZ2V0KHByb2plY3RfaWQpO1xyXG4gICAgcHJvamVjdC5vd25lcl9pZCA9IFwiOTk5XCIgKyBwcm9qZWN0Lm93bmVyX2lkO1xyXG4gICAgYXdhaXQgc3RvcmUucHV0KHByb2plY3QpO1xyXG4gICAgYXdhaXQgdHguZG9uZTsgICBcclxufVxyXG5cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBjb3B5UHJvamVjdChwcm9qZWN0X2lkLCBwcm9qZWN0TmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wicHJvamVjdHNcIiwgXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCJdLCBcInJlYWR3cml0ZVwiKTtcclxuXHJcbiAgICAvLyBDb3B5IHRoZSBwcm9qZWN0XHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgcHJvamVjdCA9IGF3YWl0IHByb2plY3RTdG9yZS5nZXQocHJvamVjdF9pZCk7XHJcbiAgICBjb25zdCBuZXdQcm9qZWN0SUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuICAgIGNvbnN0IG5ld1Byb2plY3QgPSB7IC4uLnByb2plY3QsIHV1aWQ6IG5ld1Byb2plY3RJRCwgbmFtZTogcHJvamVjdE5hbWUsIHJvb21faWRfZms6IG5ld1Byb2plY3RJRCB9O1xyXG4gICAgYXdhaXQgcHJvamVjdFN0b3JlLmFkZChuZXdQcm9qZWN0KTtcclxuXHJcbiAgICAvLyBDb3B5IHRoZSBsb2NhdGlvbnNcclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuaW5kZXgoXCJwcm9qZWN0X2lkX2ZrXCIpLmdldEFsbChwcm9qZWN0X2lkKTtcclxuICAgIGZvciAoY29uc3QgbG9jYXRpb24gb2YgbG9jYXRpb25zKSB7XHJcbiAgICAgICAgY29uc3QgbmV3TG9jYXRpb25JRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgIGNvbnN0IG5ld0xvY2F0aW9uID0geyAuLi5sb2NhdGlvbiwgdXVpZDogbmV3TG9jYXRpb25JRCwgcHJvamVjdF9pZF9mazogbmV3UHJvamVjdElELCByb29tX2lmX2ZrOiBuZXdMb2NhdGlvbklEIH07XHJcbiAgICAgICAgYXdhaXQgbG9jYXRpb25TdG9yZS5hZGQobmV3TG9jYXRpb24pO1xyXG5cclxuICAgICAgICAvLyBDb3B5IHRoZSBidWlsZGluZ3NcclxuICAgICAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdzID0gYXdhaXQgYnVpbGRpbmdTdG9yZS5pbmRleChcImxvY2F0aW9uX2lkX2ZrXCIpLmdldEFsbChsb2NhdGlvbi51dWlkKTsgICAgXHJcbiAgICAgICAgZm9yIChjb25zdCBidWlsZGluZyBvZiBidWlsZGluZ3MpIHtcclxuICAgICAgICAgICAgY29uc3QgbmV3QnVpbGRpbmdJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgICAgICBjb25zdCBuZXdCdWlsZGluZyA9IHsgLi4uYnVpbGRpbmcsIHV1aWQ6IG5ld0J1aWxkaW5nSUQsIGxvY2F0aW9uX2lkX2ZrOiBuZXdMb2NhdGlvbklELCByb29tX2lkX2ZrOiBuZXdCdWlsZGluZ0lEIH07XHJcbiAgICAgICAgICAgIGF3YWl0IGJ1aWxkaW5nU3RvcmUuYWRkKG5ld0J1aWxkaW5nKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENvcHkgdGhlIGZsb29yc1xyXG4gICAgICAgICAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICAgICAgICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuaW5kZXgoXCJidWlsZGluZ19pZF9ma1wiKS5nZXRBbGwoYnVpbGRpbmcudXVpZCk7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmxvb3Igb2YgZmxvb3JzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdGbG9vcklEID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdGbG9vciA9IHsgLi4uZmxvb3IsIHV1aWQ6IG5ld0Zsb29ySUQsIGJ1aWxkaW5nX2lkX2ZrOiBuZXdCdWlsZGluZ0lELCByb29tX2lkX2ZrOiBuZXdGbG9vcklEIH07XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBmbG9vclN0b3JlLmFkZChuZXdGbG9vcik7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ29weSB0aGUgcm9vbXNcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByb29tcyA9IGF3YWl0IHJvb21TdG9yZS5pbmRleChcImZsb29yX2lkX2ZrXCIpLmdldEFsbChmbG9vci51dWlkKTtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Jvb21JRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Jvb20gPSB7IC4uLnJvb20sIHV1aWQ6IG5ld1Jvb21JRCwgZmxvb3JfaWRfZms6IG5ld0Zsb29ySUQsIHJvb21faWRfZms6IG5ld1Jvb21JRCB9O1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJvb21TdG9yZS5hZGQobmV3Um9vbSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIENvcHkgdGhlIHByb2R1Y3RzXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvZHVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHByb2R1Y3RTdG9yZS5pbmRleChcInJvb21faWRfZmtcIikuZ2V0QWxsKHJvb20udXVpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Byb2R1Y3RJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQcm9kdWN0ID0geyAuLi5wcm9kdWN0LCB1dWlkOiBuZXdQcm9kdWN0SUQsIHJvb21faWRfZms6IG5ld1Jvb21JRCB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwcm9kdWN0U3RvcmUuYWRkKG5ld1Byb2R1Y3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIG5ld1Byb2plY3RJRDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkTm90ZShyb29tVXVpZCwgbm90ZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJub3Rlc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJub3Rlc1wiKTtcclxuICAgIGNvbnN0IG5ld05vdGVJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7ICAgIFxyXG4gICAgY29uc3QgbmV3Tm90ZSA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbm90ZTogbm90ZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIHJvb21faWRfZms6IHJvb21VdWlkLCAgICAgICAgXHJcbiAgICAgICAgdXVpZDogbmV3Tm90ZUlELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChuZXdOb3RlKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gbmV3Tm90ZUlEO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZW1vdmVOb3RlQnlVVUlEKG5vdGVVdWlkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcIm5vdGVzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG4gICAgYXdhaXQgc3RvcmUuZGVsZXRlKG5vdGVVdWlkKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEltYWdlKHJvb21VdWlkLCBpbWFnZSkge1xyXG5cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0VXNlcih1c2VyX2lkKSB7XHJcbiAgICB1c2VyX2lkID0gdXNlcl9pZCsgXCJcIjsgICAgXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInVzZXJzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICByZXR1cm4gYXdhaXQgc3RvcmUuZ2V0KHVzZXJfaWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVVc2VyKGZvcm1kYXRhLCB1c2VyX2lkKSB7XHJcbiAgICB1c2VyX2lkID0gdXNlcl9pZCArIFwiXCI7XHJcblxyXG5cclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwidXNlcnNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgc3RvcmUuZ2V0KHVzZXJfaWQpOyAgICAgICBcclxuXHJcbiAgICB1c2VyLm5hbWUgPSBmb3JtZGF0YS5uYW1lO1xyXG4gICAgdXNlci5jb2RlID0gZm9ybWRhdGEuY29kZTsgICAgXHJcbiAgICB1c2VyLmVtYWlsID0gZm9ybWRhdGEuZW1haWw7XHJcbiAgICB1c2VyLnBhc3N3b3JkID0gZm9ybWRhdGEucGFzc3dvcmQ7XHJcbiAgICB1c2VyLmxhc3RfdXBkYXRlZCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcblxyXG4gICAgYXdhaXQgc3RvcmUucHV0KHVzZXIpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0U2NoZWR1bGVQZXJSb29tKHByb2plY3RJZCkge1xyXG4gICAgaWYgKCFwcm9qZWN0SWQpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIFByb2plY3QgSUQnKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJwcm9qZWN0c1wiLCBcImxvY2F0aW9uc1wiLCBcImJ1aWxkaW5nc1wiLCBcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIiwgXCJpbWFnZXNcIiwgXCJub3Rlc1wiXSwgXCJyZWFkb25seVwiKTtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgY29uc3QgZmxvb3JTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IHByb2R1Y3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbWFnZVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJpbWFnZXNcIik7XHJcbiAgICBjb25zdCBub3RlU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBwcm9qZWN0U3RvcmUuZ2V0KHByb2plY3RJZCk7XHJcbiAgICBpZiAoIXByb2plY3QpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2plY3Qgbm90IGZvdW5kJyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5pbmRleChcInByb2plY3RfaWRfZmtcIikuZ2V0QWxsKHByb2plY3RJZCk7XHJcbiAgICBjb25zdCBidWlsZGluZ3MgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgZmxvb3JzID0gYXdhaXQgZmxvb3JTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IHJvb21zID0gYXdhaXQgcm9vbVN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBwcm9kdWN0U3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBpbWFnZXMgPSBhd2FpdCBpbWFnZVN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3Qgbm90ZXMgPSBhd2FpdCBub3RlU3RvcmUuZ2V0QWxsKCk7XHJcblxyXG4gICAgY29uc3QgcmVzdWx0ID0ge307XHJcblxyXG4gICAgcm9vbXMuZm9yRWFjaChyb29tID0+IHtcclxuICAgICAgICBjb25zdCByb29tUHJvZHVjdHMgPSBwcm9kdWN0cy5maWx0ZXIocHJvZHVjdCA9PiBwcm9kdWN0LnJvb21faWRfZmsgPT09IHJvb20udXVpZCk7XHJcbiAgICAgICAgY29uc3Qgcm9vbUltYWdlcyA9IGltYWdlcy5maWx0ZXIoaW1hZ2UgPT4gaW1hZ2Uucm9vbV9pZF9mayA9PT0gcm9vbS51dWlkKTtcclxuICAgICAgICBjb25zdCByb29tTm90ZXMgPSBub3Rlcy5maWx0ZXIobm90ZSA9PiBub3RlLnJvb21faWRfZmsgPT09IHJvb20udXVpZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGZsb29yID0gZmxvb3JzLmZpbmQoZmxvb3IgPT4gZmxvb3IudXVpZCA9PT0gcm9vbS5mbG9vcl9pZF9mayk7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmcgPSBidWlsZGluZ3MuZmluZChidWlsZGluZyA9PiBidWlsZGluZy51dWlkID09PSBmbG9vci5idWlsZGluZ19pZF9mayk7XHJcbiAgICAgICAgY29uc3QgbG9jYXRpb24gPSBsb2NhdGlvbnMuZmluZChsb2NhdGlvbiA9PiBsb2NhdGlvbi51dWlkID09PSBidWlsZGluZy5sb2NhdGlvbl9pZF9mayk7XHJcblxyXG4gICAgICAgIHJvb21Qcm9kdWN0cy5mb3JFYWNoKHByb2R1Y3QgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIXJlc3VsdFtyb29tLnNsdWddKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbcm9vbS5zbHVnXSA9IFtdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBJIG5lZWQgdG8gZW5zdXJlIHRoYXQgdGhlIHByb2R1Y3QgaXMgbm90IGFscmVhZHkgaW4gdGhlIGFycmF5IGZvciB0aGlzIHJvb21cclxuICAgICAgICAgICAgaWYgKHJlc3VsdFtyb29tLnNsdWddLmZpbmQocCA9PiBwLnNrdSA9PT0gcHJvZHVjdC5za3UpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH0gICBcclxuXHJcbiAgICAgICAgICAgIHJlc3VsdFtyb29tLnNsdWddLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgcm9vbV9zbHVnOiByb29tLnNsdWcsXHJcbiAgICAgICAgICAgICAgICByb29tX25hbWU6IHJvb20ubmFtZSxcclxuICAgICAgICAgICAgICAgIHJvb21fd2lkdGg6IHJvb20ud2lkdGgsXHJcbiAgICAgICAgICAgICAgICByb29tX2xlbmd0aDogcm9vbS5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICByb29tX2hlaWdodDogcm9vbS5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICBmbG9vcl9uYW1lOiBmbG9vci5uYW1lLFxyXG4gICAgICAgICAgICAgICAgYnVpbGRpbmdfbmFtZTogYnVpbGRpbmcubmFtZSxcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uX25hbWU6IGxvY2F0aW9uLm5hbWUsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X25hbWU6IHByb2plY3QubmFtZSxcclxuICAgICAgICAgICAgICAgIHJlZjogcHJvZHVjdC5yZWYsXHJcbiAgICAgICAgICAgICAgICBwcm9kdWN0X25hbWU6IHByb2R1Y3QucHJvZHVjdF9uYW1lLFxyXG4gICAgICAgICAgICAgICAgcHJvZHVjdF9zbHVnOiBwcm9kdWN0LnByb2R1Y3Rfc2x1ZyxcclxuICAgICAgICAgICAgICAgIHNrdTogcHJvZHVjdC5za3UsXHJcbiAgICAgICAgICAgICAgICBjdXN0b206IHByb2R1Y3QuY3VzdG9tLFxyXG4gICAgICAgICAgICAgICAgb3duZXJfaWQ6IHByb2R1Y3Qub3duZXJfaWQsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X2lkX2ZrOiBwcm9qZWN0LnV1aWQsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X3NsdWc6IHByb2plY3Quc2x1ZyxcclxuICAgICAgICAgICAgICAgIHByb2plY3RfdmVyc2lvbjogcHJvamVjdC52ZXJzaW9uLFxyXG4gICAgICAgICAgICAgICAgcXR5OiByb29tUHJvZHVjdHMuZmlsdGVyKHAgPT4gcC5za3UgPT09IHByb2R1Y3Quc2t1KS5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICBpbWFnZV9maWxlbmFtZXM6IHJvb21JbWFnZXMubWFwKGltYWdlID0+IGltYWdlLnNhZmVfZmlsZW5hbWUpLmpvaW4oJ3wnKSxcclxuICAgICAgICAgICAgICAgIHJvb21fbm90ZXM6IHJvb21Ob3Rlcy5tYXAobm90ZSA9PiBgJHtub3RlLm5vdGV9ICh1cGRhdGVkOiAke25ldyBEYXRlKG5vdGUubGFzdF91cGRhdGVkIHx8IG5vdGUuY3JlYXRlZF9vbikudG9Mb2NhbGVTdHJpbmcoKX0pYCkuam9pbignfCcpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbG9naW5Vc2VyKGZvcm1EYXRhKSB7ICAgIFxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJ1c2Vyc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInVzZXJzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcImVtYWlsXCIpO1xyXG5cclxuICAgIC8vIGZvcm1EYXRhIGlzIGEganMgZm9ybURhdGEgb2JqZWN0IGZyb20gdGhlIHN1Ym1pdHRlZCBmb3JtXHJcbiAgICAvLyBwYXJzZSB0aGUgZW1haWwgYW5kIHBhc3N3b3JkIGZyb20gdGhlIGZvcm0gZGF0YVxyXG4gICAgY29uc3QgZm9ybURhdGFPYmogPSB7fTtcclxuICAgIGZvcm1EYXRhLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IChmb3JtRGF0YU9ialtrZXldID0gdmFsdWUpKTsgICAgICAgIFxyXG4gICAgaWYgKCFmb3JtRGF0YU9iai5tb2RhbF9mb3JtX2VtYWlsKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW1haWwgaXMgcmVxdWlyZWRcIik7XHJcbiAgICB9XHJcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgaW5kZXguZ2V0KGZvcm1EYXRhT2JqLm1vZGFsX2Zvcm1fZW1haWwudG9Mb3dlckNhc2UoKSk7XHJcblxyXG4gICAgaWYgKHVzZXIgJiYgdXNlci5wYXNzd29yZC50b0xvd2VyQ2FzZSgpID09PSBmb3JtRGF0YU9iai5tb2RhbF9mb3JtX3Bhc3N3b3JkLnRvTG93ZXJDYXNlKCkpIHtcclxuICAgICAgICAvLyBkZXN0cm95IGFsbCB0aGUgbG9jYWwgc3RvcmFnZSBpdGVtc1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xyXG4gICAgICAgIC8vIHNldCB0aGUgdXNlcl9pZCBjb29raWVcclxuICAgICAgICBhd2FpdCB1dGlscy5zZXRDb29raWUoJ3VzZXJfaWQnLCB1c2VyLnV1aWQsIDM2NSk7XHJcbiAgICAgICAgLy8gc2V0IHRoZSB1c2VyX25hbWUgY29va2llXHJcbiAgICAgICAgYXdhaXQgdXRpbHMuc2V0Q29va2llKCd1c2VyX25hbWUnLCB1c2VyLm5hbWUsIDM2NSk7XHJcblxyXG4gICAgICAgIHJldHVybiB1c2VyO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9ICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldEZhdm91cml0ZXModXNlcl9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJmYXZvdXJpdGVzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmF2b3VyaXRlc1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKTtcclxuICAgIHVzZXJfaWQgPSBTdHJpbmcodXNlcl9pZCk7XHJcbiAgICByZXR1cm4gYXdhaXQgaW5kZXguZ2V0QWxsKHVzZXJfaWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBhZGRGYXZQcm9kdWN0KHNrdSwgcHJvZHVjdF9uYW1lLCB1c2VyX2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImZhdm91cml0ZXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmF2b3VyaXRlc1wiKTtcclxuICAgIGNvbnN0IG5ld0ZhdklEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IG5ld0ZhdiA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgc2t1OiBza3UsXHJcbiAgICAgICAgcHJvZHVjdF9uYW1lOiBwcm9kdWN0X25hbWUsXHJcbiAgICAgICAgb3duZXJfaWQ6IHVzZXJfaWQsXHJcbiAgICAgICAgdXVpZDogbmV3RmF2SUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHByb2R1Y3QgaXMgYWxyZWFkeSBpbiB0aGUgZmF2b3VyaXRlcyBmb3IgdGhlIHNhbWUgdXNlcl9pZFxyXG4gICAgLy8gbWFrZSBzdXJlIG5vdCB0byBzYXZlIHRoIHNhbWUgc2t1IGZvciB0aGUgc2FtZSB1c2VyISAgd2Ugbm93IGhhdmUga2V5cyBvbiB0ZWggY29sdW1ucyBcInNrdVwiIGFuZCBcIm93bmVyX2lkXCJcclxuICAgIGNvbnN0IGFsbEZhdnMgPSBhd2FpdCBzdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nRmF2ID0gYWxsRmF2cy5maW5kKGZhdiA9PiBmYXYuc2t1ID09PSBza3UgJiYgZmF2Lm93bmVyX2lkID09PSB1c2VyX2lkKTtcclxuICAgIGlmIChleGlzdGluZ0Zhdikge1xyXG4gICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignUHJvZHVjdCBhbHJlYWR5IGluIGZhdm91dGl0ZXMnLCB7c3RhdHVzOid3YXJuaW5nJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdQcm9kdWN0IGFscmVhZHkgaW4gZmF2b3VyaXRlczonLCBleGlzdGluZ0Zhdik7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChuZXdGYXYpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignQWRkZWQgZmF2b3VyaXRlIHByb2R1Y3QnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICByZXR1cm4gbmV3RmF2SUQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEZhdm91cml0ZVRvUm9vbShza3UsIHJvb21faWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICAvLyBmaXJzdCBnZXQgdGhlIGZ1bGwgZGF0YSBhYm91dCB0aGUgcHJvZHVjdCBmcm9tIHRoZSBcInByb2R1Y3RfZGF0YVwiIHRhYmxlIGJ5IHNrdVxyXG4gICAgY29uc3QgcHJvZHVjdERhdGEgPSBhd2FpdCBnZXRQcm9kdWN0cygpO1xyXG4gICAgY29uc29sZS5sb2coJ1Byb2R1Y3QgRGF0YTonLCBwcm9kdWN0RGF0YSk7ICBcclxuICAgIGNvbnN0IHAgPSBwcm9kdWN0RGF0YS5maW5kKHAgPT4gcC5wcm9kdWN0X2NvZGUgPT09IHNrdSk7XHJcbiAgICBpZiAoIXApIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb2R1Y3Qgd2l0aCBTS1UgJHtza3V9IG5vdCBmb3VuZGApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGJ1aWxkIHRoZSBwcm9kdWN0IGRhdGEgb2JqZWN0ICAgIFxyXG4gICAgY29uc3QgbmV3UHJvZHVjdERhdGEgPSB7XHJcbiAgICAgICAgYnJhbmQ6IHAuc2l0ZSxcclxuICAgICAgICB0eXBlOiBwLnR5cGVfc2x1ZyxcclxuICAgICAgICBwcm9kdWN0X3NsdWc6IHAucHJvZHVjdF9zbHVnLFxyXG4gICAgICAgIHByb2R1Y3RfbmFtZTogcC5wcm9kdWN0X25hbWUsXHJcbiAgICAgICAgc2t1OiBwLnByb2R1Y3RfY29kZSxcclxuICAgICAgICByb29tX2lkX2ZrOiByb29tX2lkLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKSxcclxuICAgICAgICBjdXN0b206IDAsXHJcbiAgICAgICAgcmVmOiBcIlwiLFxyXG4gICAgICAgIGNyZWF0ZWRfb246IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgb3JkZXI6IG51bGwsXHJcbiAgICAgICAgcmFuZ2U6IG51bGxcclxuICAgIH07XHJcbiAgICB0aGlzLnNhdmVQcm9kdWN0VG9Sb29tKG5ld1Byb2R1Y3REYXRhKTsgICBcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVtb3ZlRmF2b3VyaXRlKHV1aWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICB1dWlkID0gdXVpZCArIFwiXCI7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwiZmF2b3VyaXRlc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmYXZvdXJpdGVzXCIpOyAgICBcclxuICAgIGF3YWl0IHN0b3JlLmRlbGV0ZSh1dWlkKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldEltYWdlc0ZvclJvb20ocm9vbV9pZCkge1xyXG4gICAgLy8gZ2V0IGFsbCBpbWFnZXMgZm9yIHRoaXMgcm9vbSBhbmQgdGhpcyB1c2VyXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImltYWdlc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImltYWdlc1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG4gICAgY29uc3QgaW1hZ2VzID0gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21faWQpO1xyXG4gICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpXHJcbiAgICByZXR1cm4gaW1hZ2VzLmZpbHRlcihpbWFnZSA9PiBpbWFnZS5vd25lcl9pZCA9PT0gdXNlcl9pZCk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHNhdmVJbWFnZUZvclJvb20ocm9vbV9pZCwgZGF0YSkgIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwiaW1hZ2VzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImltYWdlc1wiKTtcclxuICAgIGNvbnN0IG5ld0ltYWdlSUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3QgbmV3SW1hZ2UgPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIHJvb21faWRfZms6IHJvb21faWQsXHJcbiAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLFxyXG4gICAgICAgIHV1aWQ6IG5ld0ltYWdlSUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCIsXHJcbiAgICAgICAgZmlsZW5hbWU6IGRhdGEuZmlsZU5hbWUsXHJcbiAgICAgICAgc2FmZV9maWxlbmFtZTogZGF0YS5zYWZlRmlsZU5hbWVcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKG5ld0ltYWdlKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gbmV3SW1hZ2VJRDtcclxuXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHB1c2hVc2VyRGF0YSh1c2VyX2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgLy8gZ2F0aGVyIGFsbCB0aGUgdXNlciBkYXRhIGZyb20gdGhlIGluZGV4ZWREQiBpbmNsdXNpbmcgYWxsIHRoZSBwcm9qZWN0cywgbG9jYXRpb25zLCBidWlsZGluZ3MsIGZsb29ycywgcm9vbXMsIHByb2R1Y3RzLCBpbWFnZXMsIG5vdGVzLCBmYXZvdXJpdGVzXHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcInByb2plY3RzXCIsIFwibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCIsIFwicm9vbXNcIiwgXCJwcm9kdWN0c1wiLCBcImltYWdlc1wiLCBcIm5vdGVzXCIsIFwiZmF2b3VyaXRlc1wiXSwgXCJyZWFkb25seVwiKTsgIFxyXG4gICAgY29uc3QgcHJvamVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCBwcm9kdWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW1hZ2VTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiaW1hZ2VzXCIpO1xyXG4gICAgY29uc3Qgbm90ZVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJub3Rlc1wiKTtcclxuICAgIGNvbnN0IGZhdlN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmYXZvdXJpdGVzXCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2plY3RzID0gYXdhaXQgcHJvamVjdFN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5ncyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBmbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3Qgcm9vbXMgPSBhd2FpdCByb29tU3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHByb2R1Y3RTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IGltYWdlcyA9IGF3YWl0IGltYWdlU3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBub3RlcyA9IGF3YWl0IG5vdGVTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IGZhdm91cml0ZXMgPSBhd2FpdCBmYXZTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuXHJcbiAgICAvLyBub3cgcHVzaCBhbGwgdGhpcyBkYXRhIHRvIHRoZSBzZXJ2ZXJcclxuICAgIGNvbnN0IHVzZXJEYXRhID0ge1xyXG4gICAgICAgIHByb2plY3RzOiBwcm9qZWN0cyxcclxuICAgICAgICBsb2NhdGlvbnM6IGxvY2F0aW9ucyxcclxuICAgICAgICBidWlsZGluZ3M6IGJ1aWxkaW5ncyxcclxuICAgICAgICBmbG9vcnM6IGZsb29ycyxcclxuICAgICAgICByb29tczogcm9vbXMsXHJcbiAgICAgICAgcHJvZHVjdHM6IHByb2R1Y3RzLFxyXG4gICAgICAgIGltYWdlczogaW1hZ2VzLFxyXG4gICAgICAgIG5vdGVzOiBub3RlcyxcclxuICAgICAgICBmYXZvdXJpdGVzOiBmYXZvdXJpdGVzXHJcbiAgICB9O1xyXG5cclxuICAgICAgIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvc3luY191c2VyX2RhdGEnLCB7XHJcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgICAgfSxcclxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh1c2VyRGF0YSlcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgZXJyb3IhIFN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2VEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ1Jlc3BvbnNlIERhdGE6JywgcmVzcG9uc2VEYXRhKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdTdGF0dXM6JywgcmVzcG9uc2VEYXRhLnN0YXR1cyk7ICAvLyBlcnJvciB8IHN1Y2Nlc3NcclxuICAgIHJldHVybihyZXNwb25zZURhdGEpOyAgICBcclxufVxyXG5cclxuXHJcbi8vIEV4cG9ydCB0aGUgZnVuY3Rpb25zXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZ2VuZXJhdGVVVUlELCBcclxuICAgIGluaXREQixcclxuICAgIGZldGNoQW5kU3RvcmVQcm9kdWN0cyxcclxuICAgIGZldGNoQW5kU3RvcmVVc2VycyxcclxuICAgIGdldFByb2R1Y3RzLFxyXG4gICAgZ2V0UHJvamVjdHMsICAgIFxyXG4gICAgZ2V0UHJvamVjdEJ5VVVJRCxcclxuICAgIHVwZGF0ZVByb2plY3REZXRhaWxzLFxyXG4gICAgc3luY0RhdGEsXHJcbiAgICBzYXZlUHJvZHVjdFRvUm9vbSxcclxuICAgIGdldFByb2R1Y3RzRm9yUm9vbSxcclxuICAgIGRlbGV0ZVByb2R1Y3RGcm9tUm9vbSxcclxuICAgIHNldFNrdVF0eUZvclJvb20sXHJcbiAgICB1cGRhdGVQcm9kdWN0UmVmLFxyXG4gICAgZ2V0UHJvamVjdFN0cnVjdHVyZSxcclxuICAgIGdldFJvb21NZXRhLFxyXG4gICAgdXBkYXRlTmFtZSxcclxuICAgIGFkZFJvb20sXHJcbiAgICBhZGRGbG9vcixcclxuICAgIGFkZEJ1aWxkaW5nLFxyXG4gICAgYWRkTG9jYXRpb24sXHJcbiAgICByZW1vdmVSb29tLFxyXG4gICAgcmVtb3ZlRmxvb3IsXHJcbiAgICByZW1vdmVCdWlsZGluZyxcclxuICAgIGNyZWF0ZVByb2plY3QsXHJcbiAgICB1cGRhdGVSb29tRGltZW5zaW9uLFxyXG4gICAgY29weVJvb20sXHJcbiAgICBnZXRGbG9vcnMsXHJcbiAgICBjb3B5UHJvamVjdCxcclxuICAgIGdldFJvb21Ob3RlcywgICAgXHJcbiAgICBhZGROb3RlLFxyXG4gICAgYWRkSW1hZ2UsXHJcbiAgICByZW1vdmVOb3RlQnlVVUlELFxyXG4gICAgZ2V0UHJvZHVjdHNGb3JQcm9qZWN0LFxyXG4gICAgZ2V0VXNlcixcclxuICAgIHVwZGF0ZVVzZXIsXHJcbiAgICBnZXRTY2hlZHVsZVBlclJvb20sXHJcbiAgICBsb2dpblVzZXIsXHJcbiAgICBhZGRGYXZQcm9kdWN0LFxyXG4gICAgZ2V0RmF2b3VyaXRlcyxcclxuICAgIGFkZEZhdm91cml0ZVRvUm9vbSxcclxuICAgIHJlbW92ZUZhdm91cml0ZSxcclxuICAgIGdldEltYWdlc0ZvclJvb20sXHJcbiAgICBzYXZlSW1hZ2VGb3JSb29tLFxyXG4gICAgcHVzaFVzZXJEYXRhLFxyXG4gICAgcHVsbFVzZXJEYXRhLFxyXG4gICAgcmVtb3ZlUHJvamVjdFxyXG4gICAgLy8gQWRkIG90aGVyIGRhdGFiYXNlLXJlbGF0ZWQgZnVuY3Rpb25zIGhlcmVcclxufTtcclxuIiwiY29uc3QgTXVzdGFjaGUgPSByZXF1aXJlKCdtdXN0YWNoZScpO1xyXG5jb25zdCBkYiA9IHJlcXVpcmUoJy4uL2RiJyk7XHJcbmNvbnN0IHRhYmxlcyA9IHJlcXVpcmUoJy4vdGFibGVzJyk7XHJcblxyXG5cclxuXHJcbmNsYXNzIFNpZGViYXJNb2R1bGUge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5tZW51SHRtbCA9ICcnO1xyXG4gICAgICAgIHRoaXMuaXNJbml0aWFsaXplZCA9IGZhbHNlOyAgICAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSByZXR1cm47XHJcbiAgICAgICAgTXVzdGFjaGUudGFncyA9IFtcIltbXCIsIFwiXV1cIl07XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gdHJ1ZTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdlbmVyYXRlRmF2b3VyaXRlcyhkYXRhKSAge1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpICYmIGRhdGEubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBgPHA+WW91IGhhdmUgbm90IGFkZGVkIGFueSBmYW91dGl0ZSBwcm9kdWN0cyB5ZXQuPC9wPlxyXG4gICAgICAgICAgICA8cD5Zb3UgY2FuIGFkZCBwcm9kdWN0cyB0byB5b3VyIGZhdm91cml0ZXMgYnkgZmlyc3QgYWRkaW5nIGEgcHJvZHVjdCB0byB0aGlzIHJvb20gdGhlbiBjbGlja2luZyB0aGUgPHNwYW4gY2xhc3M9XCJwcm9kdWN0LW5hbWVcIiB1ay1pY29uPVwiaWNvbjogaGVhcnQ7XCI+PC9zcGFuPiBpY29uIGluIHRoZSB0YWJsZS48L3A+YDtcclxuICAgICAgICB9ICAgICAgICBcclxuICAgICAgICBsZXQgaHRtbCA9ICcnO1xyXG5cclxuICAgICAgICAvLyBzb3J0IGZhdm91cml0ZXMgYnkgcHJvZHVjdF9uYW1lIGFuZCBhZGQgYWxsIHNrdSdzIHdpdGggdGhlIHNhbWUgcHJvZHVjdF9uYW1lIHRvIGEgY2hpbGQgb2JqZWN0LiBcclxuICAgICAgICAvLyBUaGlzIHdpbGwgYWxsb3cgdXMgdG8gZGlzcGxheSB0aGUgcHJvZHVjdF9uYW1lIG9uY2UgYW5kIGFsbCBza3UncyB1bmRlciBpdC5cclxuICAgICAgICBsZXQgc29ydGVkID0gZGF0YS5yZWR1Y2UoKGFjYywgaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWFjY1tpdGVtLnByb2R1Y3RfbmFtZV0pIHsgIFxyXG4gICAgICAgICAgICAgICAgYWNjW2l0ZW0ucHJvZHVjdF9uYW1lXSA9IFtdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGFjY1tpdGVtLnByb2R1Y3RfbmFtZV0ucHVzaChpdGVtKTtcclxuICAgICAgICAgICAgcmV0dXJuIGFjYzsgXHJcbiAgICAgICAgfSwge30pO1xyXG5cclxuICAgICAgICAvLyBsb29wIHRocm91Z2ggdGhlIHNvcnRlZCBvYmplY3QgYW5kIGdlbmVyYXRlIHRoZSBodG1sIGFzIGEgbGlzdCB3aXRoIHByb2R1Y3RfbmFtZSBhbmQgc2t1J3NcclxuICAgICAgICBPYmplY3Qua2V5cyhzb3J0ZWQpLmZvckVhY2goa2V5ID0+IHsgICAgXHJcbiAgICAgICAgICAgIGh0bWwgKz0gYDxsaSBjbGFzcz1cInByb2R1Y3QtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicHJvZHVjdC1uYW1lXCIgdWstaWNvbj1cImljb246IGZvbGRlcjtcIj48L3NwYW4+IFxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicHJvZHVjdC1uYW1lXCI+PGEgZGF0YS1wcm9kdWN0PVwiJHtrZXl9XCIgaHJlZj1cIiNcIj4ke2tleX08L2E+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPHVsIGNsYXNzPVwic2t1LWxpc3RcIj5gO1xyXG4gICAgICAgICAgICBzb3J0ZWRba2V5XS5mb3JFYWNoKGl0ZW0gPT4geyAgIFxyXG4gICAgICAgICAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgPGxpIGNsYXNzPVwic2t1LWl0ZW1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJza3UtbmFtZVwiPjxhIGNsYXNzPVwiYWRkLWZhdi10by1yb29tXCIgZGF0YS1za3U9XCIke2l0ZW0uc2t1fVwiIGhyZWY9XCIjXCI+JHtpdGVtLnNrdX08L2E+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwibWludXMtY2lyY2xlXCIgY2xhc3M9XCJhY3Rpb24taWNvbiByZW1vdmUtcHJvZHVjdC1mcm9tLWZhdnNcIiBkYXRhLXV1aWQ9XCIke2l0ZW0udXVpZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2xpPmA7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBodG1sICs9IGA8L3VsPjwvbGk+YDtcclxuICAgICAgICB9KTsgIFxyXG5cclxuICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgIH1cclxuXHJcbiAgICBcclxuICAgIC8vIFxyXG4gICAgLy8gcmVuZGVyRmF2b3VyaXRlc1xyXG4gICAgLy8gICAgIFxyXG4gICAgYXN5bmMgcmVuZGVyRmF2b3VyaXRlcyh1c2VyX2lkKSB7ICAgICAgICBcclxuICAgICAgICB1c2VyX2lkLnRvU3RyaW5nKCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBmYXZvdXJpdGVzID0gIGF3YWl0IGRiLmdldEZhdm91cml0ZXModXNlcl9pZCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBzaWRlbWVudUh0bWwgPSBhd2FpdCB0aGlzLmdlbmVyYXRlRmF2b3VyaXRlcyhmYXZvdXJpdGVzKTsgICAgICAgICAgIFxyXG5cclxuICAgICAgICAkKCcuZmF2b3VyaXRlcycpLmh0bWwoc2lkZW1lbnVIdG1sKTtcclxuXHJcbiAgICAgICAgJCgnLmFkZC1mYXYtdG8tcm9vbScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgY29uc3Qgc2t1ID0gJCh0aGlzKS5kYXRhKCdza3UnKTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbV9pZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTsgICAgICAgICAgXHJcbiAgICAgICAgICAgIGF3YWl0IGRiLmFkZEZhdm91cml0ZVRvUm9vbShza3UsIHJvb21faWQpO1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ0Zhdm91cml0ZSBhZGRlZCB0byByb29tJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICB0YWJsZXMucmVuZGVyUHJvZGN0c1RhYmxlKHJvb21faWQpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAkKCcuYWN0aW9uLWljb24ucmVtb3ZlLXByb2R1Y3QtZnJvbS1mYXZzJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIChlKSA9PiB7ICAvL2Fycm93IGZ1bmN0aW9uIHByZXNlcnZlcyB0aGUgY29udGV4dCBvZiB0aGlzXHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgY29uc3QgdXVpZCA9ICQoZS5jdXJyZW50VGFyZ2V0KS5kYXRhKCd1dWlkJyk7XHJcbiAgICAgICAgICAgIGF3YWl0IGRiLnJlbW92ZUZhdm91cml0ZSh1dWlkKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdGYXZvdXJpdGUgcmVtb3ZlZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTsgICAgICAgICAgICBcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZW5kZXJGYXZvdXJpdGVzKHVzZXJfaWQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSAgICBcclxuXHJcblxyXG4gICAgYXN5bmMgZ2VuZXJhdGVOYXZNZW51KGRhdGEpIHtcclxuICAgICAgICBpZiAoIWRhdGEpIHJldHVybiAnPGRpdj5ObyBwcm9qZWN0IHN0cnVjdHVyZSBhdmFpbGFibGU8L2Rpdj4nOyAgICAgICAgICAgICAgICBcclxuICAgICAgICBsZXQgaHRtbCA9ICcnO1xyXG5cclxuICAgICAgICAvLyBNYW5hZ2UgcHJvamVjdCBsaW5rXHJcbiAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwicHJvamVjdC1pdGVtXCI+XHJcbiAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgY2xhc3M9XCJlZGl0LXByb2plY3QtbGlua1wiIGRhdGEtaWQ9XCIke2RhdGEucHJvamVjdF9pZH1cIj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicHJvamVjdC1uYW1lXCIgdWstaWNvbj1cImljb246IGZvbGRlcjtcIj48L3NwYW4+ICR7ZGF0YS5wcm9qZWN0X25hbWV9XHJcbiAgICAgICAgICAgIDwvYT5cclxuICAgICAgICA8L2xpPmA7XHJcblxyXG4gICAgICAgIC8vIFByb2Nlc3MgbG9jYXRpb25zXHJcbiAgICAgICAgT2JqZWN0LmtleXMoZGF0YSkuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAncHJvamVjdF9uYW1lJyAmJiBrZXkgIT09ICdwcm9qZWN0X3NsdWcnICYmIGtleSAhPT0gJ3Byb2plY3RfaWQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsb2NhdGlvbiA9IGRhdGFba2V5XTtcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gdGhpcy5wcm9jZXNzTG9jYXRpb24oa2V5LCBsb2NhdGlvbiwgZGF0YS5wcm9qZWN0X2lkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgIH1cclxuXHJcbiAgICBwcm9jZXNzTG9jYXRpb24oc2x1ZywgbG9jYXRpb24sIHByb2plY3RJZCkge1xyXG4gICAgICAgIGxldCBodG1sID0gYFxyXG4gICAgICAgIDxsaSBjbGFzcz1cImxvY2F0aW9uLWl0ZW1cIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImxvY2F0aW9uLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJsb2NhdGlvbi1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cImljb246IGxvY2F0aW9uO1wiPjwvc3Bhbj4gJHtsb2NhdGlvbi5sb2NhdGlvbl9uYW1lfVxyXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1pY29ucyBsb2NhdGlvblwiPiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb25cIiBkYXRhLWlkPVwiJHtsb2NhdGlvbi5sb2NhdGlvbl9pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHVsIGNsYXNzPVwiYnVpbGRpbmctbGlzdFwiPmA7XHJcblxyXG4gICAgICAgIC8vIFByb2Nlc3MgYnVpbGRpbmdzXHJcbiAgICAgICAgT2JqZWN0LmtleXMobG9jYXRpb24pLmZvckVhY2goa2V5ID0+IHtcclxuICAgICAgICAgICAgaWYgKGtleSAhPT0gJ2xvY2F0aW9uX25hbWUnICYmIGtleSAhPT0gJ2xvY2F0aW9uX3NsdWcnICYmIGtleSAhPT0gJ2xvY2F0aW9uX2lkJykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYnVpbGRpbmcgPSBsb2NhdGlvbltrZXldO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSB0aGlzLnByb2Nlc3NCdWlsZGluZyhrZXksIGJ1aWxkaW5nLCBwcm9qZWN0SWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBcIkFkZCBCdWlsZGluZ1wiIG9wdGlvblxyXG4gICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgPGxpIGNsYXNzPVwiYnVpbGRpbmctaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYWRkLWJ1aWxkaW5nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgZGF0YS1pZD1cIiR7bG9jYXRpb24ubG9jYXRpb25faWR9XCIgZGF0YS1hY3Rpb249XCJhZGRcIj5BZGQgQnVpbGRpbmc8L2E+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9saT5cclxuICAgICAgICAgICAgPC91bD5cclxuICAgICAgICA8L2xpPmA7XHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3NCdWlsZGluZyhzbHVnLCBidWlsZGluZywgcHJvamVjdElkKSB7XHJcbiAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwiYnVpbGRpbmctaXRlbVwiPlxyXG4gICAgICAgICAgICA8aDQgY2xhc3M9XCJidWlsZGluZy1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYnVpbGRpbmctbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJpY29uOiBob21lO1wiPjwvc3Bhbj4gJHtidWlsZGluZy5idWlsZGluZ19uYW1lfVxyXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1pY29ucyBidWlsZGluZ1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJtaW51cy1jaXJjbGVcIiBjbGFzcz1cImFjdGlvbi1pY29uIGJ1aWxkaW5nXCIgZGF0YS1pZD1cIiR7YnVpbGRpbmcuYnVpbGRpbmdfaWR9XCIgZGF0YS1hY3Rpb249XCJyZW1vdmVcIj48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9oND5cclxuICAgICAgICAgICAgPHVsIGNsYXNzPVwiZmxvb3ItbGlzdFwiPmA7XHJcblxyXG4gICAgICAgIC8vIFByb2Nlc3MgZmxvb3JzXHJcbiAgICAgICAgT2JqZWN0LmtleXMoYnVpbGRpbmcpLmZvckVhY2goa2V5ID0+IHtcclxuICAgICAgICAgICAgaWYgKGtleSAhPT0gJ2J1aWxkaW5nX25hbWUnICYmIGtleSAhPT0gJ2J1aWxkaW5nX3NsdWcnICYmIGtleSAhPT0gJ2J1aWxkaW5nX2lkJykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZmxvb3IgPSBidWlsZGluZ1trZXldO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSB0aGlzLnByb2Nlc3NGbG9vcihrZXksIGZsb29yLCBwcm9qZWN0SWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBcIkFkZCBGbG9vclwiIG9wdGlvblxyXG4gICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgPGxpIGNsYXNzPVwiZmxvb3ItaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYWRkLWZsb29yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgZGF0YS1pZD1cIiR7YnVpbGRpbmcuYnVpbGRpbmdfaWR9XCIgZGF0YS1hY3Rpb249XCJhZGRcIj5BZGQgRmxvb3I8L2E+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9saT5cclxuICAgICAgICAgICAgPC91bD5cclxuICAgICAgICA8L2xpPmA7XHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3NGbG9vcihzbHVnLCBmbG9vciwgcHJvamVjdElkKSB7XHJcbiAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwiZmxvb3ItaXRlbVwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxvb3ItaGVhZGVyXCI+XHJcbiAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiIGRhdGEtaWQ9XCIke2Zsb29yLmZsb29yX2lkfVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxvb3ItbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwiaWNvbjogdGFibGU7XCI+PC9zcGFuPiAke2Zsb29yLmZsb29yX25hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1pY29ucyBmbG9vclwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJtaW51cy1jaXJjbGVcIiBjbGFzcz1cImFjdGlvbi1pY29uIGZsb29yXCIgZGF0YS1pZD1cIiR7Zmxvb3IuZmxvb3JfaWR9XCIgZGF0YS1hY3Rpb249XCJyZW1vdmVcIj48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDx1bCBjbGFzcz1cInJvb20tbGlzdFwiPmA7XHJcblxyXG4gICAgICAgIC8vIFByb2Nlc3Mgcm9vbXNcclxuICAgICAgICBPYmplY3Qua2V5cyhmbG9vcikuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAnZmxvb3JfbmFtZScgJiYga2V5ICE9PSAnZmxvb3Jfc2x1ZycgJiYga2V5ICE9PSAnZmxvb3JfaWQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByb29tID0gZmxvb3Jba2V5XTtcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gdGhpcy5wcm9jZXNzUm9vbShrZXksIHJvb20sIHByb2plY3RJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIFwiQWRkIFJvb21cIiBvcHRpb25cclxuICAgICAgICBodG1sICs9IGBcclxuICAgICAgICAgICAgICAgIDxsaSBjbGFzcz1cInJvb20taXRlbSBhZGQtcm9vbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYWRkLXJvb21cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBkYXRhLWFjdGlvbj1cImFkZFwiIGRhdGEtaWQ9XCIke2Zsb29yLmZsb29yX2lkfVwiPkFkZCBSb29tPC9hPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvbGk+XHJcbiAgICAgICAgICAgIDwvdWw+XHJcbiAgICAgICAgPC9saT5gO1xyXG5cclxuICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgIH1cclxuXHJcbiAgICBwcm9jZXNzUm9vbShzbHVnLCByb29tLCBwcm9qZWN0SWQpIHtcclxuICAgICAgICByZXR1cm4gYFxyXG4gICAgICAgIDxsaSBjbGFzcz1cInJvb20taXRlbSB2aWV3LXJvb21cIj5cclxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJyb29tLW5hbWVcIj5cclxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgY2xhc3M9XCJyb29tLWxpbmtcIiBkYXRhLWlkPVwiJHtyb29tLnJvb21faWR9XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cImljb246IG1vdmU7XCI+PC9zcGFuPiAke3Jvb20ucm9vbV9uYW1lfVxyXG4gICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJtaW51cy1jaXJjbGVcIiBjbGFzcz1cImFjdGlvbi1pY29uIHJvb21cIiBkYXRhLWlkPVwiJHtyb29tLnJvb21faWR9XCIgZGF0YS1hY3Rpb249XCJyZW1vdmVcIj48L3NwYW4+XHJcbiAgICAgICAgPC9saT5gO1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTaWRlYmFyTW9kdWxlKCk7IiwiY29uc3QgZGIgPSByZXF1aXJlKCcuLi9kYicpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxubGV0IHNpZGViYXI7IC8vIHBsYWNlaG9sZGVyIGZvciBzaWRlYmFyIG1vZHVsZSwgbGF6eSBsb2FkZWQgbGF0ZXJcclxuXHJcbmNsYXNzIFN5bmNNb2R1bGUge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIC8vIEJpbmQgbWV0aG9kcyB0aGF0IG5lZWQgJ3RoaXMnIGNvbnRleHRcclxuICAgICAgICAvL3RoaXMuaGFuZGxlRmlsZVVwbG9hZCA9IHRoaXMuaGFuZGxlRmlsZVVwbG9hZC5iaW5kKHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGluaXQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNJbml0aWFsaXplZCkgcmV0dXJuOyAgICAgICAgXHJcbiAgICAgICAgaWYgKCFzaWRlYmFyKSB7XHJcbiAgICAgICAgICAgIHNpZGViYXIgPSByZXF1aXJlKCcuL3NpZGViYXInKTsgIC8vIGxhenkgbG9hZCBpdCB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXMsIGp1c3QgdXNlIGNhbGwgaW5pdCB3aGVuIHJlcXVpcmVkXHJcbiAgICAgICAgfSAgICAgICAgXHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gdHJ1ZTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBhc3luYyBjbGVhckxvY2FsU3RvcmFnZSgpIHtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnWW91IGFyZSBvZmZsaW5lLiBQbGVhc2UgY29ubmVjdCB0byB0aGUgaW50ZXJuZXQgYW5kIHRyeSBhZ2Fpbi4nLCBzdGF0dXM6ICd3YXJuaW5nJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9ICAgICAgICBcclxuXHJcbiAgICAgICAgdXRpbHMuc2hvd1NwaW4oKTtcclxuICAgICAgICBcclxuICAgICAgICAkKCcjc3luY2ljb24nKS5hZGRDbGFzcygnYWN0aXZlJyk7XHJcblxyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xyXG5cclxuICAgICAgICAkKCcjc3luY2ljb24nKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7ICBcclxuICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHV0aWxzLmhpZGVTcGluKCk7ICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRVc2VyRGF0YSgpIHtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnWW91IGFyZSBvZmZsaW5lLiBQbGVhc2UgY29ubmVjdCB0byB0aGUgaW50ZXJuZXQgYW5kIHRyeSBhZ2Fpbi4nLCBzdGF0dXM6ICd3YXJuaW5nJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9ICAgICAgICBcclxuXHJcbiAgICAgICAgdXRpbHMuc2hvd1NwaW4oKTtcclxuICAgICAgICBcclxuICAgICAgICAkKCcjc3luY2ljb24nKS5hZGRDbGFzcygnYWN0aXZlJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRVc2VySUQoKTtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYi5wdWxsVXNlckRhdGEodXNlcl9pZCk7ICAgICAgICBcclxuICAgICAgICAkKCcjc3luY2ljb24nKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7ICBcclxuICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHV0aWxzLmhpZGVTcGluKCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGFzeW5jIHB1c2hBbGxVc2VyRGF0YSgpIHtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICAvLyBkZXRlY3QgaWYgdXNlciBpcyBvZmZsaW5lXHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7bWVzc2FnZTogJ1lvdSBhcmUgb2ZmbGluZS4gUGxlYXNlIGNvbm5lY3QgdG8gdGhlIGludGVybmV0IGFuZCB0cnkgYWdhaW4uJywgc3RhdHVzOiAnd2FybmluZycsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAyMDAwIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnRGF0YSBQdXNoIFN0YXJ0ZWQgLi4uJywgc3RhdHVzOiAncHJpbWFyeScsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAxMDAwIH0pO1xyXG4gICAgICAgIHV0aWxzLnNob3dTcGluKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgJCgnI3N5bmNpY29uJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cclxuICAgICAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRiLnB1c2hVc2VyRGF0YSh1c2VyX2lkKTtcclxuICAgICAgICAkKCcjc3luY2ljb24nKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7ICAgICAgICBcclxuICAgICAgICBcclxuICAgICAgICB1dGlscy5oaWRlU3BpbigpO1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09ICdlcnJvcicpIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnVGhlcmUgd2FzIGFuIGVycm9yIHN5bmNpbmcgeW91ciBkYXRhISBQbGVhc2UgdHJ5IGFnYWluLicsIHN0YXR1czogJ2RhbmdlcicsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAyMDAwIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7bWVzc2FnZTogJ0RhdGEgUHVzaCBDb21wbGV0ZSAuLi4nLCBzdGF0dXM6ICdzdWNjZXNzJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBuZXcgU3luY01vZHVsZSgpOyIsImNvbnN0IGRiID0gcmVxdWlyZSgnLi4vZGInKTtcclxuY29uc3QgTXVzdGFjaGUgPSByZXF1aXJlKCdtdXN0YWNoZScpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxubGV0IHNpZGViYXI7IC8vIHBsYWNlaG9sZGVyIGZvciBzaWRlYmFyIG1vZHVsZSwgbGF6eSBsb2FkZWQgbGF0ZXJcclxuXHJcbmNsYXNzIFRhYmxlc01vZHVsZSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLnBUYWJsZSA9IG51bGw7XHJcbiAgICAgICAgLy8gQmluZCBtZXRob2RzIHRoYXQgbmVlZCAndGhpcycgY29udGV4dFxyXG4gICAgICAgIHRoaXMuaGFuZGxlRmlsZVVwbG9hZCA9IHRoaXMuaGFuZGxlRmlsZVVwbG9hZC5iaW5kKHRoaXMpO1xyXG4gICAgICAgIHRoaXMudXBkYXRlSW1hZ2VzID0gdGhpcy51cGRhdGVJbWFnZXMuYmluZCh0aGlzKTsgICAgICAgIFxyXG4gICAgICAgIHRoaXMuZ2V0Um9vbUltYWdlcyA9IHRoaXMuZ2V0Um9vbUltYWdlcy5iaW5kKHRoaXMpOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSByZXR1cm47XHJcbiAgICAgICAgTXVzdGFjaGUudGFncyA9IFtcIltbXCIsIFwiXV1cIl07ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIGlmICghc2lkZWJhcikge1xyXG4gICAgICAgICAgICBzaWRlYmFyID0gcmVxdWlyZSgnLi9zaWRlYmFyJyk7ICAvLyBsYXp5IGxvYWQgaXQgdG8gYXZvaWQgY2lyY3VsYXIgZGVwZW5kZW5jaWVzLCBqdXN0IHVzZSBjYWxsIGluaXQgd2hlbiByZXF1aXJlZFxyXG4gICAgICAgIH0gICAgICAgIFxyXG4gICAgICAgIHRoaXMuaXNJbml0aWFsaXplZCA9IHRydWU7ICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyB1cGRhdGVTa3VzRHJvcGRvd24ocHJvZHVjdCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIGNvbnN0IHNrdXMgPSBhd2FpdCB0aGlzLmdldFNrdXNGb3JQcm9kdWN0KHByb2R1Y3QpOyAgICAgICAgXHJcbiAgICAgICAgdGhpcy5yZW5kZXJTa3VzRHJvcGRvd24oc2t1cyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgcmVuZGVyU2t1c0Ryb3Bkb3duKHNrdXMpIHtcclxuICAgICAgICBpZiAoIXNrdXMgfHwgIXNrdXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIHNrdSBkYXRhIHByb3ZpZGVkJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBvcHRpb25zSHRtbCA9ICc8b3B0aW9uIHZhbHVlPVwiXCI+U2VsZWN0IFNLVTwvb3B0aW9uPic7XHJcbiAgICAgICAgc2t1cy5mb3JFYWNoKHNrdSA9PiB7XHJcbiAgICAgICAgICAgIG9wdGlvbnNIdG1sICs9IGA8b3B0aW9uIHZhbHVlPVwiJHtza3Uuc2x1Z31cIj4ke3NrdS5uYW1lfTwvb3B0aW9uPmA7XHJcbiAgICAgICAgfSk7IFxyXG4gICAgICAgICQoJyNmb3JtX3NrdScpLmh0bWwob3B0aW9uc0h0bWwpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFNrdXNGb3JQcm9kdWN0KHVzZXJfcHJvZHVjdCkge1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgZGIuZ2V0UHJvZHVjdHMoKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcHJvZHVjdHNcclxuICAgICAgICAgICAgLmZpbHRlcihwcm9kdWN0ID0+IHByb2R1Y3QucHJvZHVjdF9zbHVnID09PSB1c2VyX3Byb2R1Y3QpXHJcbiAgICAgICAgICAgIC5yZWR1Y2UoKGFjYywgcHJvZHVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFhY2Muc29tZShpdGVtID0+IGl0ZW0uc2x1ZyA9PT0gcHJvZHVjdC5wcm9kdWN0X3NsdWcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWNjLnB1c2goeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2x1ZzogcHJvZHVjdC5wcm9kdWN0X2NvZGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9kdWN0LnByb2R1Y3RfY29kZSBcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XHJcbiAgICAgICAgICAgIH0sIFtdKSAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcbiAgICB9ICAgICAgIFxyXG4gICAgXHJcbiAgICBhc3luYyB1cGRhdGVQcm9kdWN0c0Ryb3Bkb3duKHR5cGUpIHtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHRoaXMuZ2V0UHJvZHVjdHNGb3JUeXBlKHR5cGUpOyAgICAgICAgXHJcbiAgICAgICAgdGhpcy5yZW5kZXJQcm9kdWN0c0Ryb3Bkb3duKHByb2R1Y3RzKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyByZW5kZXJQcm9kdWN0c0Ryb3Bkb3duKHByb2R1Y3RzKSB7XHJcbiAgICAgICAgaWYgKCFwcm9kdWN0cyB8fCAhcHJvZHVjdHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIHByb2R1Y3RzIGRhdGEgcHJvdmlkZWQnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IG9wdGlvbnNIdG1sID0gJzxvcHRpb24gdmFsdWU9XCJcIj5TZWxlY3QgUHJvZHVjdDwvb3B0aW9uPic7XHJcbiAgICAgICAgcHJvZHVjdHMuZm9yRWFjaChwcm9kdWN0ID0+IHtcclxuICAgICAgICAgICAgb3B0aW9uc0h0bWwgKz0gYDxvcHRpb24gdmFsdWU9XCIke3Byb2R1Y3Quc2x1Z31cIj4ke3Byb2R1Y3QubmFtZX08L29wdGlvbj5gO1xyXG4gICAgICAgIH0pOyAgICAgICAgXHJcbiAgICAgICAgJCgnI2Zvcm1fcHJvZHVjdCcpLmh0bWwob3B0aW9uc0h0bWwpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFByb2R1Y3RzRm9yVHlwZSh0eXBlKSB7XHJcbiAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBkYi5nZXRQcm9kdWN0cygpO1xyXG4gICAgICAgIGNvbnN0IHNpdGUgPSAkKCcjZm9ybV9icmFuZCcpLnZhbCgpO1xyXG5cclxuICAgICAgICByZXR1cm4gcHJvZHVjdHNcclxuICAgICAgICAgICAgLmZpbHRlcihwcm9kdWN0ID0+IHByb2R1Y3QudHlwZV9zbHVnID09PSB0eXBlICYmIHByb2R1Y3Quc2l0ZSA9PT0gc2l0ZSApXHJcbiAgICAgICAgICAgIC5yZWR1Y2UoKGFjYywgcHJvZHVjdCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWFjYy5zb21lKGl0ZW0gPT4gaXRlbS5zbHVnID09PSBwcm9kdWN0LnByb2R1Y3Rfc2x1ZykpIHtcclxuICAgICAgICAgICAgICAgIGFjYy5wdXNoKHsgXHJcbiAgICAgICAgICAgICAgICBzbHVnOiBwcm9kdWN0LnByb2R1Y3Rfc2x1ZywgXHJcbiAgICAgICAgICAgICAgICBuYW1lOiBwcm9kdWN0LnByb2R1Y3Rfc2x1Zy5yZXBsYWNlKC9eeGNpdGUtL2ksICcnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKCkudHJpbSgpLnJlcGxhY2UoLy0vZywgJyAnKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGFjYztcclxuICAgICAgICAgICAgfSwgW10pICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcclxuICAgIH0gICAgXHJcblxyXG4gICAgYXN5bmMgdXBkYXRlVHlwZXNEcm9wZG93bihicmFuZCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdHlwZXMgPSBhd2FpdCB0aGlzLmdldFR5cGVzRm9yQnJhbmQoYnJhbmQpOyAgICAgICAgXHJcbiAgICAgICAgdGhpcy5yZW5kZXJUeXBlc0Ryb3Bkb3duKHR5cGVzKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRUeXBlc0ZvckJyYW5kKGJyYW5kKSB7XHJcbiAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBkYi5nZXRQcm9kdWN0cygpO1xyXG4gICAgICAgIHJldHVybiBwcm9kdWN0c1xyXG4gICAgICAgICAgICAuZmlsdGVyKHByb2R1Y3QgPT4gcHJvZHVjdC5zaXRlID09PSBicmFuZClcclxuICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCBwcm9kdWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFjYy5zb21lKGl0ZW0gPT4gaXRlbS5zbHVnID09PSBwcm9kdWN0LnR5cGVfc2x1ZykpIHtcclxuICAgICAgICAgICAgICAgICAgICBhY2MucHVzaCh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzbHVnOiBwcm9kdWN0LnR5cGVfc2x1ZywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb2R1Y3QudHlwZV9uYW1lIFxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcclxuICAgICAgICAgICAgfSwgW10pXHJcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyByZW5kZXJUeXBlc0Ryb3Bkb3duKHR5cGVzKSB7XHJcbiAgICAgICAgaWYgKCF0eXBlcyB8fCAhdHlwZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIHR5cGVzIGRhdGEgcHJvdmlkZWQnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSAkKCcjb3B0aW9ucycpO1xyXG4gICAgICAgIGlmICghdGVtcGxhdGUubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1RlbXBsYXRlICNvcHRpb25zIG5vdCBmb3VuZCcpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBcclxuICAgICAgICBsZXQgb3B0aW9uc0h0bWwgPSAnPG9wdGlvbiB2YWx1ZT1cIlwiPlNlbGVjdCBUeXBlPC9vcHRpb24+JztcclxuICAgICAgICB0eXBlcy5mb3JFYWNoKHR5cGUgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb25zSHRtbCArPSBgPG9wdGlvbiB2YWx1ZT1cIiR7dHlwZS5zbHVnfVwiPiR7dHlwZS5uYW1lfTwvb3B0aW9uPmA7XHJcbiAgICAgICAgfSk7ICAgICAgICBcclxuICAgICAgICAkKCcjZm9ybV90eXBlJykuaHRtbChvcHRpb25zSHRtbCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgdXBkYXRlUHJvamVjdENsaWNrKHV1aWQpIHtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coJ3VwZGF0ZVByb2plY3RDbGljaycsIHV1aWQpO1xyXG5cclxuICAgICAgICBjb25zdCBleGlzdGluZ1Byb2plY3QgPSBhd2FpdCBkYi5nZXRQcm9qZWN0QnlVVUlEKHV1aWQpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZygnZXhpc3RpbmdQcm9qZWN0JywgZXhpc3RpbmdQcm9qZWN0KTtcclxuXHJcbiAgICAgICAgaWYgKCFleGlzdGluZ1Byb2plY3QpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignUHJvamVjdCBub3QgZm91bmQnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcHJvamVjdERhdGEgPSB7XHJcbiAgICAgICAgICAgIHV1aWQ6IHV1aWQsXHJcbiAgICAgICAgICAgIHByb2plY3RfaWQ6ICQoJyNmb3JtX2VkaXRfcHJvamVjdF9pZCcpLnZhbCgpIHx8IGV4aXN0aW5nUHJvamVjdC5wcm9qZWN0X2lkLFxyXG4gICAgICAgICAgICByb29tX2lkX2ZrOiBleGlzdGluZ1Byb2plY3Qucm9vbV9pZF9maywgLy8gbGVnYWN5XHJcbiAgICAgICAgICAgIG5hbWU6ICQoJyNmb3JtX2VkaXRfcHJvamVjdF9uYW1lJykudmFsKCkgfHwgZXhpc3RpbmdQcm9qZWN0Lm5hbWUsXHJcbiAgICAgICAgICAgIHNsdWc6IGF3YWl0IHV0aWxzLnNsdWdpZnkoJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X25hbWUnKS52YWwoKSkgfHwgZXhpc3RpbmdQcm9qZWN0LnNsdWcsXHJcbiAgICAgICAgICAgIGVuZ2luZWVyOiAkKCcjZm9ybV9lZGl0X3Byb2plY3RfZW5naW5lZXInKS52YWwoKSB8fCBleGlzdGluZ1Byb2plY3QuZW5naW5lZXIsXHJcbiAgICAgICAgICAgIHByb2plY3RfdmVyc2lvbjogJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X3ZlcnNpb24nKS52YWwoKSB8fCBleGlzdGluZ1Byb2plY3QucHJvamVjdF92ZXJzaW9uLFxyXG4gICAgICAgICAgICBsYXN0X3VwZGF0ZWQ6IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgICAgICBjcmVhdGVkX29uOiBleGlzdGluZ1Byb2plY3QuY3JlYXRlZF9vbixcclxuICAgICAgICAgICAgb3duZXJfaWQ6IGV4aXN0aW5nUHJvamVjdC5vd25lcl9pZCxcclxuICAgICAgICAgICAgY2VmOiBleGlzdGluZ1Byb2plY3QuY2VmIC8vIHVudXNlZFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKCd1cGRhdGVQcm9qZWN0Q2xpY2snLCBwcm9qZWN0RGF0YSk7XHJcblxyXG5cclxuICAgICAgICBhd2FpdCBkYi51cGRhdGVQcm9qZWN0RGV0YWlscyhwcm9qZWN0RGF0YSk7XHJcblxyXG4gICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdQcm9qZWN0IFVwZGF0ZWQnLFxyXG4gICAgICAgICAgICBzdGF0dXM6ICdzdWNjZXNzJyxcclxuICAgICAgICAgICAgcG9zOiAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgIHRpbWVvdXQ6IDE1MDBcclxuICAgIH0pOyAgICAgICAgXHJcbiAgICAgIFxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgYWRkU3BlY2lhbFRvUm9vbUNsaWNrKCkge1xyXG4gICAgICAgIC8vIHRvIHNhdmUgZHVwbGljYXRpb24ganVzdCBidWlsZCB0aGUgcHJvZHVjdCBkYXRhIG9iamVjdCBhbmQgY2FsbCB0aGUgYWRkUHJvZHVjdFRvUm9vbUNsaWNrIG1ldGhvZFxyXG4gICAgICAgIGNvbnN0IHByb2R1Y3REYXRhID0ge1xyXG4gICAgICAgICAgICBicmFuZDogJCgnI2Zvcm1fY3VzdG9tX2JyYW5kJykudmFsKCksXHJcbiAgICAgICAgICAgIHR5cGU6ICQoJyNmb3JtX2N1c3RvbV90eXBlJykudmFsKCksXHJcbiAgICAgICAgICAgIHByb2R1Y3Rfc2x1ZzogYXdhaXQgdXRpbHMuc2x1Z2lmeSgkKCcjZm9ybV9jdXN0b21fcHJvZHVjdCcpLnZhbCgpKSxcclxuICAgICAgICAgICAgcHJvZHVjdF9uYW1lOiAkKCcjZm9ybV9jdXN0b21fcHJvZHVjdCcpLnZhbCgpLFxyXG4gICAgICAgICAgICBza3U6ICQoJyNmb3JtX2N1c3RvbV9za3UnKS52YWwoKSwgICAgICAgICAgICBcclxuICAgICAgICAgICAgcm9vbV9pZF9mazogJCgnI21fcm9vbV9pZCcpLnZhbCgpLFxyXG4gICAgICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyksXHJcbiAgICAgICAgICAgIGN1c3RvbTogJCgnI2Zvcm1fY3VzdG9tX2ZsYWcnKS52YWwoKSxcclxuICAgICAgICAgICAgcmVmOiBcIlwiLFxyXG4gICAgICAgICAgICBjcmVhdGVkX29uOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICAgICAgbGFzdF91cGRhdGVkOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICAgICAgb3JkZXI6IG51bGwsXHJcbiAgICAgICAgICAgIHJhbmdlOiBudWxsXHJcbiAgICAgICAgfTtcclxuICAgICAgICAvL1VJa2l0Lm1vZGFsKCcjYWRkLXNwZWNpYWwnKS5oaWRlKCk7XHJcbiAgICAgICAgdGhpcy5kb0FkZFByb2R1Y3QocHJvZHVjdERhdGEpOyAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGFkZFByb2R1Y3RUb1Jvb21DbGljaygpIHtcclxuXHJcbiAgICAgICAgLy8gYnVpbGQgdGhlIHByb2R1Y3QgZGF0YSBvYmplY3QgICAgXHJcbiAgICAgICAgY29uc3QgcHJvZHVjdERhdGEgPSB7XHJcbiAgICAgICAgICAgIGJyYW5kOiAkKCcjZm9ybV9icmFuZCcpLnZhbCgpLFxyXG4gICAgICAgICAgICB0eXBlOiAkKCcjZm9ybV90eXBlJykudmFsKCksXHJcbiAgICAgICAgICAgIHByb2R1Y3Rfc2x1ZzogJCgnI2Zvcm1fcHJvZHVjdCcpLnZhbCgpLFxyXG4gICAgICAgICAgICBwcm9kdWN0X25hbWU6ICQoJyNmb3JtX3Byb2R1Y3Qgb3B0aW9uOnNlbGVjdGVkJykudGV4dCgpLFxyXG4gICAgICAgICAgICBza3U6ICQoJyNmb3JtX3NrdScpLnZhbCgpIHx8ICQoJyNmb3JtX3Byb2R1Y3QnKS52YWwoKSxcclxuICAgICAgICAgICAgcm9vbV9pZF9mazogJCgnI21fcm9vbV9pZCcpLnZhbCgpLFxyXG4gICAgICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyksXHJcbiAgICAgICAgICAgIGN1c3RvbTogMCxcclxuICAgICAgICAgICAgcmVmOiBcIlwiLFxyXG4gICAgICAgICAgICBjcmVhdGVkX29uOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICAgICAgbGFzdF91cGRhdGVkOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICAgICAgb3JkZXI6IG51bGwsXHJcbiAgICAgICAgICAgIHJhbmdlOiBudWxsXHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLmRvQWRkUHJvZHVjdChwcm9kdWN0RGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZG9BZGRQcm9kdWN0KHByb2R1Y3REYXRhKSB7XHJcblxyXG4gICAgICAgIGlmICggIXByb2R1Y3REYXRhLnByb2R1Y3Rfc2x1ZyApIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdBbGwgZmllbGRzIGFyZSByZXF1aXJlZCcsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdkYW5nZXInLFxyXG4gICAgICAgICAgICAgICAgcG9zOiAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxNTAwXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1dGlscy5zaG93U3BpbigpO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBkYi5zYXZlUHJvZHVjdFRvUm9vbShwcm9kdWN0RGF0YSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnJlZnJlc2hUYWJsZURhdGEoKTtcclxuXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJvZHVjdCBhZGRlZCB0byByb29tJyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogJ3N1Y2Nlc3MnLFxyXG4gICAgICAgICAgICAgICAgcG9zOiAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxNTAwXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdXRpbHMuaGlkZVNwaW4oKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRRdHlEaWFsb2cocHJvZHVjdERhdGEuc2t1LCAxKTtcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2F2aW5nIHByb2R1Y3QgdG8gcm9vbTonLCBlcnIpO1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe1xyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0Vycm9yIHNhdmluZyBwcm9kdWN0IHRvIHJvb20nLFxyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnZGFuZ2VyJyxcclxuICAgICAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICAgICAgdGltZW91dDogMTUwMFxyXG4gICAgICAgICAgICB9KTsgICAgICAgICAgICBcclxuICAgICAgICAgICAgdXRpbHMuaGlkZVNwaW4oKTsgICAgICAgICAgICBcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vIEdyb3VwIHByb2R1Y3RzIGJ5IFNLVSBhbmQgY291bnQgb2NjdXJyZW5jZXNcclxuICAgIGFzeW5jIGdyb3VwUHJvZHVjdHNCeVNLVShwcm9kdWN0cykge1xyXG4gICAgICAgIGNvbnN0IGdyb3VwZWRQcm9kdWN0cyA9IHByb2R1Y3RzLnJlZHVjZSgoYWNjLCBwcm9kdWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghYWNjW3Byb2R1Y3Quc2t1XSkge1xyXG4gICAgICAgICAgICAgICAgYWNjW3Byb2R1Y3Quc2t1XSA9IHsgLi4ucHJvZHVjdCwgcXR5OiAwIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYWNjW3Byb2R1Y3Quc2t1XS5xdHkgKz0gMTtcclxuICAgICAgICAgICAgcmV0dXJuIGFjYztcclxuICAgICAgICB9LCB7fSk7XHJcblxyXG4gICAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKGdyb3VwZWRQcm9kdWN0cyk7XHJcbiAgICB9ICAgIFxyXG5cclxuXHJcbiAgICBhc3luYyBhZGRGYXZEaWFsb2coc2t1LCBwcm9kdWN0X25hbWUpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLmluaXQoKTsgIC8vIGNhbGwgaW5pdCBhcyB3ZSdsbCBuZWVkIHRoZSBzaWRlYmFyIG1vZHVsZSB0byBiZSBsb2FkZWRcclxuXHJcbiAgICAgICAgJCgnc3Bhbi5wbGFjZV9za3UnKS5odG1sKHNrdSk7XHJcbiAgICAgICAgJCgnaW5wdXQjZGVsX3NrdScpLnZhbChza3UpO1xyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKTtcclxuXHJcbiAgICAgICAgYXdhaXQgZGIuYWRkRmF2UHJvZHVjdChza3UsIHByb2R1Y3RfbmFtZSwgdXNlcl9pZCk7ICAgICAgIFxyXG4gICAgICAgIGF3YWl0IHNpZGViYXIucmVuZGVyRmF2b3VyaXRlcyh1c2VyX2lkKTsgICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuXHJcbiAgICBhc3luYyByZW1vdmVTa3VEaWFsb2coc2t1KSB7XHJcbiAgICAgICAgLy8gb3BlbiB0aGUgZGVsLXNrdSBtb2RhbCBhbmQgcGFzcyB0aGUgc2t1IHRvIGJlIGRlbGV0ZWRcclxuICAgICAgICAkKCdzcGFuLnBsYWNlX3NrdScpLmh0bWwoc2t1KTtcclxuICAgICAgICAkKCdpbnB1dCNkZWxfc2t1JykudmFsKHNrdSk7XHJcblxyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjZGVsLXNrdScsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTsgICAgICAgIFxyXG5cclxuICAgICAgICAkKCcjZm9ybS1zdWJtaXQtZGVsLXNrdScpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIChlKSA9PiB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgY29uc3Qgc2t1ID0gJCgnI2RlbF9za3UnKS52YWwoKTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbV9pZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTsgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgYXdhaXQgZGIuZGVsZXRlUHJvZHVjdEZyb21Sb29tKHNrdSwgcm9vbV9pZCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVmcmVzaFRhYmxlRGF0YSgpO1xyXG4gICAgICAgICAgICBVSWtpdC5tb2RhbCgnI2RlbC1za3UnKS5oaWRlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0pOyAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNldFF0eURpYWxvZyhza3UsIHF0eSkge1xyXG4gICAgICAgIC8vIG9wZW4gdGhlIGRlbC1za3UgbW9kYWwgYW5kIHBhc3MgdGhlIHNrdSB0byBiZSBkZWxldGVkXHJcbiAgICAgICAgJCgnc3Bhbi5wbGFjZV9za3UnKS5odG1sKHNrdSk7XHJcbiAgICAgICAgJCgnaW5wdXQjc2V0X3F0eV9za3UnKS52YWwoc2t1KTtcclxuICAgICAgICAkKCdpbnB1dCNzZXRfcXR5X3F0eScpLnZhbChxdHkpO1xyXG5cclxuICAgICAgICBVSWtpdC5tb2RhbCgnI3NldC1xdHknLCB7IHN0YWNrIDogdHJ1ZSB9KS5zaG93KCk7ICAgIFxyXG4gICAgICAgIFVJa2l0LnV0aWwub24oJyNzZXQtcXR5JywgJ3Nob3duJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAkKCcjc2V0X3F0eV9xdHknKS5mb2N1cygpLnNlbGVjdCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG5cclxuICAgICAgICAkKCcjZm9ybS1zdWJtaXQtc2V0LXF0eScpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIChlKSA9PiB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgY29uc3QgcXR5ID0gJCgnI3NldF9xdHlfcXR5JykudmFsKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNrdSA9ICQoJyNzZXRfcXR5X3NrdScpLnZhbCgpO1xyXG4gICAgICAgICAgICBjb25zdCByb29tX2lkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgYXdhaXQgZGIuc2V0U2t1UXR5Rm9yUm9vbShxdHksIHNrdSwgcm9vbV9pZCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVmcmVzaFRhYmxlRGF0YSgpO1xyXG4gICAgICAgICAgICBVSWtpdC5tb2RhbCgnI3NldC1xdHknKS5oaWRlKCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgfSk7ICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuICAgIGFzeW5jIHJlZnJlc2hUYWJsZURhdGEocm9vbUlEKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1JlZnJlc2hpbmcgdGFibGUgZGF0YSBmb3Igcm9vbTonLCByb29tSUQpO1xyXG4gICAgICAgIGxldCByb29tSURUb1VzZSA9IHJvb21JRCB8fCAkKCcjbV9yb29tX2lkJykudmFsKCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBhbGxQcm9kdWN0c0luUm9vbSA9IGF3YWl0IGRiLmdldFByb2R1Y3RzRm9yUm9vbShyb29tSURUb1VzZSk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBncm91cGVkUHJvZHVjdHMgPSBhd2FpdCB0aGlzLmdyb3VwUHJvZHVjdHNCeVNLVShhbGxQcm9kdWN0c0luUm9vbSk7XHJcbiAgICAgICAgdGhpcy5wVGFibGUuc2V0RGF0YShncm91cGVkUHJvZHVjdHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHJlbmRlclByb2RjdHNUYWJsZShyb29tSUQpIHtcclxuXHJcbiAgICAgICAgbGV0IHJvb21JRFRvVXNlID0gcm9vbUlEIHx8ICQoJyNtX3Jvb21faWQnKS52YWwoKTtcclxuICAgICAgICBjb25zdCBhbGxQcm9kdWN0c0luUm9vbSA9IGF3YWl0IGRiLmdldFByb2R1Y3RzRm9yUm9vbShyb29tSURUb1VzZSk7XHJcbiAgICAgICAgY29uc3QgZ3JvdXBlZFByb2R1Y3RzID0gYXdhaXQgdGhpcy5ncm91cFByb2R1Y3RzQnlTS1UoYWxsUHJvZHVjdHNJblJvb20pO1xyXG5cclxuICAgICAgICB0aGlzLnBUYWJsZSA9IG5ldyBUYWJ1bGF0b3IoXCIjcHRhYmxlXCIsIHtcclxuICAgICAgICAgICAgZGF0YTogZ3JvdXBlZFByb2R1Y3RzLCAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsb2FkZXI6IGZhbHNlLFxyXG4gICAgICAgICAgICBsYXlvdXQ6IFwiZml0Q29sdW1uc1wiLFxyXG4gICAgICAgICAgICBkYXRhTG9hZGVyRXJyb3I6IFwiVGhlcmUgd2FzIGFuIGVycm9yIGxvYWRpbmcgdGhlIGRhdGFcIixcclxuICAgICAgICAgICAgaW5pdGlhbFNvcnQ6W1xyXG4gICAgICAgICAgICAgICAge2NvbHVtbjpcInByb2R1Y3Rfc2x1Z1wiLCBkaXI6XCJhc2NcIn0sIC8vc29ydCBieSB0aGlzIGZpcnN0XHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbHVtbnM6IFt7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwicHJvZHVjdF9pZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBcInV1aWRcIixcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJwcm9kdWN0X3NsdWdcIixcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9kdWN0X3NsdWdcIixcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJTS1VcIixcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogXCJza3VcIiwgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHNvcnRlcjpcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiUHJvZHVjdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2R1Y3RfbmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiUmVmXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IFwicmVmXCIsICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIGVkaXRvcjogXCJpbnB1dFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGVkaXRvclBhcmFtczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2g6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hc2s6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdENvbnRlbnRzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50QXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4bGVuZ3RoOiBcIjdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJRdHlcIixcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogXCJxdHlcIiwgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgY2VsbENsaWNrOiAoZSwgY2VsbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFF0eURpYWxvZyhjZWxsLmdldFJvdygpLmdldERhdGEoKS5za3UsIGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnF0eSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJTb3J0OiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBmb3JtYXR0ZXI6IHV0aWxzLmljb25GYXYsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDQwLFxyXG4gICAgICAgICAgICAgICAgICAgIGhvekFsaWduOiBcImNlbnRlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGNlbGxDbGljazogKGUsIGNlbGwpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRGYXZEaWFsb2coY2VsbC5nZXRSb3coKS5nZXREYXRhKCkuc2t1LCBjZWxsLmdldFJvdygpLmdldERhdGEoKS5wcm9kdWN0X25hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclNvcnQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdHRlcjogdXRpbHMuaWNvblgsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDQwLFxyXG4gICAgICAgICAgICAgICAgICAgIGhvekFsaWduOiBcImNlbnRlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGNlbGxDbGljazogKGUsIGNlbGwpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVTa3VEaWFsb2coY2VsbC5nZXRSb3coKS5nZXREYXRhKCkuc2t1KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucFRhYmxlLm9uKFwiY2VsbEVkaXRlZFwiLCBmdW5jdGlvbiAoY2VsbCkgeyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBza3UgPSBjZWxsLmdldFJvdygpLmdldERhdGEoKS5za3U7XHJcbiAgICAgICAgICAgIGNvbnN0IHJvb21faWQgPSAkKCcjbV9yb29tX2lkJykudmFsKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnJlZiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkYi51cGRhdGVQcm9kdWN0UmVmKHJvb21faWQsIHNrdSwgcmVmKTsgICAgICAgICBcclxuICAgICAgICB9KTsgICAgICAgIFxyXG5cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBoYW5kbGVGaWxlVXBsb2FkKGV2ZW50KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgZmlsZVBpY2tlciA9IGV2ZW50LnRhcmdldDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghZmlsZVBpY2tlciB8fCAhZmlsZVBpY2tlci5maWxlcyB8fCAhZmlsZVBpY2tlci5maWxlcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gZmlsZSBzZWxlY3RlZC4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGZpbGVQaWNrZXIuZmlsZXNbMF07XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZWxlY3RlZCBmaWxlOicsIGZpbGUpO1xyXG5cclxuICAgICAgICAgICAgVUlraXQubW9kYWwoJCgnI3VwbG9hZC1wcm9ncmVzcycpKS5zaG93KCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICAgICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2ltYWdlJywgZmlsZSk7XHJcbiAgICAgICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ3VzZXJfaWQnLCBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKSk7XHJcbiAgICAgICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ3Jvb21faWQnLCAkKCcjbV9yb29tX2lkJykudmFsKCkpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgICAgICAgICAgICAgIHhoci5vcGVuKFwiUE9TVFwiLCBcImh0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvYXBpL2ltYWdlX3VwbG9hZFwiLCB0cnVlKSAgICA7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gTW9uaXRvciBwcm9ncmVzcyBldmVudHNcclxuICAgICAgICAgICAgICAgIHhoci51cGxvYWQuYWRkRXZlbnRMaXN0ZW5lcihcInByb2dyZXNzXCIsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUubGVuZ3RoQ29tcHV0YWJsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGVyY2VudGFnZSA9IChlLmxvYWRlZCAvIGUudG90YWwpICogMTAwOyAvLyBDYWxjdWxhdGUgcGVyY2VudGFnZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoYFVwbG9hZGluZzogJHtNYXRoLnJvdW5kKHBlcmNlbnRhZ2UpfSVgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnLnVrLXByb2dyZXNzJykudmFsKHBlcmNlbnRhZ2UpOyAvLyBVcGRhdGUgcHJvZ3Jlc3MgYmFyXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIFVzZSBhcnJvdyBmdW5jdGlvbiB0byBwcmVzZXJ2ZSAndGhpcycgY29udGV4dFxyXG4gICAgICAgICAgICAgICAgeGhyLm9ubG9hZCA9IGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGaWxlIHVwbG9hZGVkIHN1Y2Nlc3NmdWxseTonLCByZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoJ1VwbG9hZCBjb21wbGV0ZSEnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJy51ay1wcm9ncmVzcycpLnZhbCgxMDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3VwbG9hZC1wcm9ncmVzcyAjY2xvc2UtcHJvZ3Jlc3MnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZUltYWdlcyhyZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWxlIHVwbG9hZCBmYWlsZWQ6JywgcmVzcG9uc2UubWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoJ1VwbG9hZCBmYWlsZWQ6ICcgKyByZXNwb25zZS5tZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyN1cGxvYWQtcHJvZ3Jlc3MgI2Nsb3NlLXByb2dyZXNzJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZpbGUgdXBsb2FkIGZhaWxlZC4gU3RhdHVzOicsIHhoci5zdGF0dXMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoJ1VwbG9hZCBmYWlsZWQuIFBsZWFzZSB0cnkgYWdhaW4uJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJyN1cGxvYWQtcHJvZ3Jlc3MgI2Nsb3NlLXByb2dyZXNzJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBlcnJvcnNcclxuICAgICAgICAgICAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZpbGUgdXBsb2FkIGZhaWxlZCBkdWUgdG8gYSBuZXR3b3JrIGVycm9yLicpO1xyXG4gICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dCgnTmV0d29yayBlcnJvciBvY2N1cnJlZCBkdXJpbmcgdXBsb2FkLicpO1xyXG4gICAgICAgICAgICAgICAgICAgICQoJyN1cGxvYWQtcHJvZ3Jlc3MgI2Nsb3NlLXByb2dyZXNzJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgeGhyLnRpbWVvdXQgPSAxMjAwMDA7IC8vIFNldCB0aW1lb3V0IHRvIDIgbWludXRlc1xyXG4gICAgICAgICAgICAgICAgeGhyLm9udGltZW91dCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWxlIHVwbG9hZCB0aW1lZCBvdXQuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KCdVcGxvYWQgdGltZWQgb3V0LiBQbGVhc2UgdHJ5IGFnYWluLicpO1xyXG4gICAgICAgICAgICAgICAgICAgICQoJyN1cGxvYWQtcHJvZ3Jlc3MgI2Nsb3NlLXByb2dyZXNzJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgeGhyLnNlbmQoZm9ybURhdGEpOyAvLyBTZW5kIHRoZSBmb3JtIGRhdGFcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignTm8gZmlsZSBzZWxlY3RlZC4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVcGxvYWQgZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH0gICAgXHJcbiAgICBcclxuICAgIGFzeW5jIHVwZGF0ZUltYWdlcyhyZXNwb25zZSkgeyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZGIuc2F2ZUltYWdlRm9yUm9vbSgkKCcjbV9yb29tX2lkJykudmFsKCksIHJlc3BvbnNlKTsgICAgICAgIFxyXG4gICAgICAgIGF3YWl0IHRoaXMuZ2V0Um9vbUltYWdlcygpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFJvb21JbWFnZXMoKSB7XHJcbiAgICAgICAgY29uc3QgaW1hZ2VzID0gYXdhaXQgZGIuZ2V0SW1hZ2VzRm9yUm9vbSgkKCcjbV9yb29tX2lkJykudmFsKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdnZXQgcm9vbSBpbWFnZXM6JywgaW1hZ2VzKTtcclxuICAgICAgICBjb25zdCBodG1sID0gYXdhaXQgdGhpcy5nZW5lcmF0ZUltYWdlcyhpbWFnZXMpO1xyXG4gICAgICAgICQoJyNpbWFnZXMucm9vbV9pbWFnZXMnKS5odG1sKGh0bWwpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdlbmVyYXRlSW1hZ2VzKGltYWdlcykge1xyXG4gICAgICAgIGxldCBodG1sID0gYDxkaXYgY2xhc3M9XCJ1ay13aWR0aC0xLTFcIiB1ay1saWdodGJveD1cImFuaW1hdGlvbjogc2xpZGVcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwidWstZ3JpZC1zbWFsbCB1ay1jaGlsZC13aWR0aC0xLTIgdWstY2hpbGQtd2lkdGgtMS0yQHMgdWstY2hpbGQtd2lkdGgtMS0zQG0gdWstY2hpbGQtd2lkdGgtMS00QGwgdWstZmxleC1jZW50ZXIgdWstdGV4dC1jZW50ZXIgXCIgdWstZ3JpZD5gO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBcclxuICAgICAgICBpbWFnZXMuZm9yRWFjaChpbWFnZSA9PiB7XHJcbiAgICAgICAgICAgIGh0bWwgKz0gYDxkaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ1ay1jYXJkIHVrLWNhcmQtZGVmYXVsdCB1ay1jYXJkLWJvZHkgdWstcGFkZGluZy1yZW1vdmVcIj5cclxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCJodHRwczovL3NzdC50YW1saXRlLmNvLnVrL3VwbG9hZHMvJHtpbWFnZS5zYWZlX2ZpbGVuYW1lfVwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImltYWdlYmdcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6IHVybChodHRwczovL3NzdC50YW1saXRlLmNvLnVrL3VwbG9hZHMvJHtpbWFnZS5zYWZlX2ZpbGVuYW1lfSk7XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5gO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBodG1sICs9IGA8L2Rpdj48L2Rpdj5gO1xyXG5cclxuICAgICAgICByZXR1cm4oaHRtbCk7XHJcbiAgICB9XHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBuZXcgVGFibGVzTW9kdWxlKCk7IiwiY2xhc3MgVXRpbHNNb2R1bGUge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdVdGlsc01vZHVsZSBjb25zdHJ1Y3RvcicpO1xyXG4gICAgICAgIHRoaXMuaXNJbml0aWFsaXplZCA9IGZhbHNlOyAgIFxyXG5cclxuICAgICAgICB0aGlzLnVpZCA9IHRoaXMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcblxyXG4gICAgICAgIHRoaXMuY2hlY2tMb2dpbigpOyAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5pY29uUGx1cyA9IGZ1bmN0aW9uKGNlbGwsIGZvcm1hdHRlclBhcmFtcywgb25SZW5kZXJlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJzxpIGNsYXNzPVwiZmEtc29saWQgZmEtY2lyY2xlLXBsdXNcIj48L2k+JztcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuaWNvbk1pbnVzID0gZnVuY3Rpb24oY2VsbCwgZm9ybWF0dGVyUGFyYW1zLCBvblJlbmRlcmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1jaXJjbGUtbWludXNcIj48L2k+JztcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuaWNvblggPSBmdW5jdGlvbihjZWxsLCBmb3JtYXR0ZXJQYXJhbXMsIG9uUmVuZGVyZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICc8c3BhbiBjbGFzcz1cImljb24gcmVkXCIgdWstaWNvbj1cImljb246IHRyYXNoOyByYXRpbzogMS4zXCIgdGl0bGU9XCJEZWxldGVcIj48L3NwYW4+JztcclxuICAgICAgICB9OyAgICBcclxuICAgICAgICB0aGlzLmljb25Db3B5ID0gZnVuY3Rpb24oY2VsbCwgZm9ybWF0dGVyUGFyYW1zLCBvblJlbmRlcmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnPHNwYW4gY2xhc3M9XCJpY29uXCIgdWstaWNvbj1cImljb246IGNvcHk7IHJhdGlvOiAxLjNcIiB0aXRsZT1cIkR1cGxpY2F0ZVwiPjwvc3Bhbj4nO1xyXG4gICAgICAgIH07ICAgICBcclxuICAgICAgICB0aGlzLmljb25GYXYgPSBmdW5jdGlvbihjZWxsLCBmb3JtYXR0ZXJQYXJhbXMsIG9uUmVuZGVyZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICc8c3BhbiBjbGFzcz1cImljb24gcmVkXCIgdWstaWNvbj1cImljb246IGhlYXJ0OyByYXRpbzogMS4zXCIgdGl0bGU9XCJGYXZvdXJpdGVcIj48L3NwYW4+JztcclxuICAgICAgICB9OyAgIFxyXG4gICAgICAgIFxyXG4gICAgICBcclxuICAgICAgICBcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbG9naW4gPSBVSWtpdC5tb2RhbCgnLmxvZ2lubW9kYWwnLCB7XHJcbiAgICAgICAgICAgIGJnQ2xvc2UgOiBmYWxzZSxcclxuICAgICAgICAgICAgZXNjQ2xvc2UgOiBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBpbml0KCkge1xyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGl6ZWQpIHJldHVybjtcclxuICAgICAgICBNdXN0YWNoZS50YWdzID0gW1wiW1tcIiwgXCJdXVwiXTtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgXHJcbiAgICBhc3luYyBjaGVja0xvZ2luKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDaGVja2luZyBhdXRoZW50aWNhdGlvbiAuLi4nKTtcclxuICAgICAgICBjb25zdCBkYiA9IHJlcXVpcmUoJy4uL2RiJyk7ICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHRoaXMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcbiAgICBcclxuICAgICAgICBpZiAodXNlcl9pZCA9PSBcIlwiKSB7XHJcbiAgICAgICAgICAgIFVJa2l0Lm1vZGFsKCcubG9naW5tb2RhbCcpLnNob3coKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAkKCcjbV91c2VyX2lkJykudmFsKHVzZXJfaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsZXQgdGhhdCA9IHRoaXM7XHJcbiAgICBcclxuICAgICAgICAkKFwiI2Zvcm0tbG9naW5cIikub2ZmKFwic3VibWl0XCIpLm9uKFwic3VibWl0XCIsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAkKCcubG9naW4tZXJyb3InKS5oaWRlKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2Zvcm0tbG9naW5cIik7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBkYi5sb2dpblVzZXIobmV3IEZvcm1EYXRhKGZvcm0pKTsgICAgICAgICAgICBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh1c2VyICE9PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgJCgnI21fdXNlcl9pZCcpLnZhbCh1c2VyLnV1aWQpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5zZXRDb29raWUoJ3VzZXJfaWQnLCB1c2VyLnV1aWQpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5zZXRDb29raWUoJ3VzZXJfbmFtZScsIHVzZXIubmFtZSk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBkYi5zeW5jRGF0YSh1c2VyLnV1aWQpOyAgXHJcbiAgICBcclxuICAgICAgICAgICAgICAgIFVJa2l0Lm1vZGFsKCQoJyNsb2dpbicpKS5oaWRlKCk7XHJcbiAgICAgICAgICAgICAgICAvLyBVc2UgcmVwbGFjZSBzdGF0ZSBpbnN0ZWFkIG9mIHJlZGlyZWN0XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoe30sICcnLCAnLycpO1xyXG4gICAgICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAkKCcubG9naW4tZXJyb3IgcCcpLmh0bWwoXCJUaGVyZSB3YXMgYW4gZXJyb3IgbG9nZ2luZyBpbi4gUGxlYXNlIHRyeSBhZ2Fpbi5cIik7XHJcbiAgICAgICAgICAgICAgICAkKCcubG9naW4tZXJyb3InKS5zaG93KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBsb2dvdXQoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5kZWxldGVDb29raWUoJ3VzZXJfaWQnKTtcclxuICAgICAgICBhd2FpdCB0aGlzLmRlbGV0ZUNvb2tpZSgndXNlcl9uYW1lJyk7XHJcbiAgICAgICAgLy8gVXNlIHJlcGxhY2Ugc3RhdGUgaW5zdGVhZCBvZiByZWRpcmVjdFxyXG4gICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgJycsICcvP3Q9Jyk7XHJcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZGVsZXRlQ29va2llKGNuYW1lKSB7XHJcbiAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgZC5zZXRUaW1lKGQuZ2V0VGltZSgpIC0gKDI0ICogNjAgKiA2MCAqIDEwMDApKTtcclxuICAgICAgICBsZXQgZXhwaXJlcyA9IFwiZXhwaXJlcz1cIiArIGQudG9VVENTdHJpbmcoKTtcclxuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjbmFtZSArIFwiPTtcIiArIGV4cGlyZXMgKyBcIjtwYXRoPS9cIjtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzZXRDb29raWUoY25hbWUsIGN2YWx1ZSwgZXhkYXlzKSB7XHJcbiAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgZC5zZXRUaW1lKGQuZ2V0VGltZSgpICsgKGV4ZGF5cyAqIDI0ICogNjAgKiA2MCAqIDEwMDApKTtcclxuICAgICAgICBsZXQgZXhwaXJlcyA9IFwiZXhwaXJlcz1cIitkLnRvVVRDU3RyaW5nKCk7XHJcbiAgICAgICAgZG9jdW1lbnQuY29va2llID0gY25hbWUgKyBcIj1cIiArIGN2YWx1ZSArIFwiO1wiICsgZXhwaXJlcyArIFwiO3BhdGg9L1wiO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldENvb2tpZShjbmFtZSkge1xyXG4gICAgICAgIGxldCBuYW1lID0gY25hbWUgKyBcIj1cIjtcclxuICAgICAgICBsZXQgY2EgPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcclxuICAgICAgICBmb3IobGV0IGkgPSAwOyBpIDwgY2EubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGMgPSBjYVtpXTtcclxuICAgICAgICAgICAgd2hpbGUgKGMuY2hhckF0KDApID09ICcgJykge1xyXG4gICAgICAgICAgICAgICAgYyA9IGMuc3Vic3RyaW5nKDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChjLmluZGV4T2YobmFtZSkgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGMuc3Vic3RyaW5nKG5hbWUubGVuZ3RoLCBjLmxlbmd0aCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGFzeW5jIGdldFVzZXJJRCgpIHtcclxuICAgICAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdGhpcy5nZXRDb29raWUoJ3VzZXJfaWQnKTsgICAgICAgIFxyXG4gICAgICAgIGlmICh1c2VyX2lkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB1c2VyX2lkLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gc2hvdyBsb2dpbiBtb2RhbCB3aXRoIFVJa2l0XHJcbiAgICAgICAgICAgIHRoaXMuY2hlY2tMb2dpbigpO1xyXG4gICAgICAgICAgICAvLyBVSWtpdC5tb2RhbCgnI2xvZ2luJykuc2hvdygpO1xyXG4gICAgICAgICAgICAvLyByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSAgICAgICBcclxuICAgIH1cclxuXHJcblxyXG4gICAgYXN5bmMgc2hvd1NwaW4oKSB7XHJcbiAgICAgICAgJCgnI3NwaW5uZXInKS5mYWRlSW4oJ2Zhc3QnKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBoaWRlU3BpbigpIHtcclxuICAgICAgICAkKCcjc3Bpbm5lcicpLmZhZGVPdXQoJ2Zhc3QnKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBmb3JtYXREYXRlVGltZSAoZGF0ZSkge1xyXG4gICAgICAgIGNvbnN0IHBhZCA9IChudW0pID0+IG51bS50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJyk7XHJcbiAgICAgICAgcmV0dXJuIGAke2RhdGUuZ2V0RnVsbFllYXIoKX0tJHtwYWQoZGF0ZS5nZXRNb250aCgpICsgMSl9LSR7cGFkKGRhdGUuZ2V0RGF0ZSgpKX0gJHtwYWQoZGF0ZS5nZXRIb3VycygpKX06JHtwYWQoZGF0ZS5nZXRNaW51dGVzKCkpfToke3BhZChkYXRlLmdldFNlY29uZHMoKSl9YDtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzZXRDb29raWUoY25hbWUsIGN2YWx1ZSwgZXhkYXlzKSB7XHJcbiAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgZC5zZXRUaW1lKGQuZ2V0VGltZSgpICsgKGV4ZGF5cyAqIDI0ICogNjAgKiA2MCAqIDEwMDApKTtcclxuICAgICAgICBsZXQgZXhwaXJlcyA9IFwiZXhwaXJlcz1cIitkLnRvVVRDU3RyaW5nKCk7XHJcbiAgICAgICAgZG9jdW1lbnQuY29va2llID0gY25hbWUgKyBcIj1cIiArIGN2YWx1ZSArIFwiO1wiICsgZXhwaXJlcyArIFwiO3BhdGg9L1wiO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldENvb2tpZShjbmFtZSkge1xyXG4gICAgICAgIGxldCBuYW1lID0gY25hbWUgKyBcIj1cIjtcclxuICAgICAgICBsZXQgY2EgPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcclxuICAgICAgICBmb3IobGV0IGkgPSAwOyBpIDwgY2EubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGMgPSBjYVtpXTtcclxuICAgICAgICAgICAgd2hpbGUgKGMuY2hhckF0KDApID09ICcgJykge1xyXG4gICAgICAgICAgICAgICAgYyA9IGMuc3Vic3RyaW5nKDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChjLmluZGV4T2YobmFtZSkgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGMuc3Vic3RyaW5nKG5hbWUubGVuZ3RoLCBjLmxlbmd0aCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9ICAgXHJcbiAgICBcclxuICAgIGFzeW5jIHNsdWdpZnkodGV4dCkge1xyXG4gICAgICAgIC8vIG1ha2UgYSBzbHVnIG9mIHRoaXMgdGV4dFxyXG4gICAgICAgIHJldHVybiB0ZXh0LnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS50cmltKClcclxuICAgICAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJy0nKSAgICAgICAgICAgLy8gUmVwbGFjZSBzcGFjZXMgd2l0aCAtXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXlxcd1xcLV0rL2csICcnKSAgICAgICAvLyBSZW1vdmUgYWxsIG5vbi13b3JkIGNoYXJzXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXC1cXC0rL2csICctJyk7ICAgICAgICAvLyBSZXBsYWNlIG11bHRpcGxlIC0gd2l0aCBzaW5nbGUgLVxyXG4gICAgfVxyXG4gICAgYXN5bmMgZGVzbHVnaWZ5KHRleHQpIHtcclxuICAgICAgICAvLyBtYWtlIGh1bWFuIHJlYWRhYmxlIHRleHQgZnJvbSBzbHVnICAgXHJcbiAgICAgICAgcmV0dXJuIHRleHQudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLnRyaW0oKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvLS9nLCAnICcpOyAgICAgICAgICAgLy8gUmVwbGFjZSAtIHdpdGggc3BhY2UgICAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0QXBwVmVyc2lvbigpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKCdnZXR0aW5nIHZlcnNpb24nKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBzZXJ2aWNlIHdvcmtlciByZWdpc3RyYXRpb25cclxuICAgICAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uID0gYXdhaXQgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIucmVhZHk7XHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ2dvdCByZWdpc3RyYXRpb246JywgcmVnaXN0cmF0aW9uKTtcclxuICAgIFxyXG4gICAgICAgICAgICBpZiAoIXJlZ2lzdHJhdGlvbi5hY3RpdmUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gYWN0aXZlIHNlcnZpY2Ugd29ya2VyIGZvdW5kJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBtZXNzYWdlSGFuZGxlcjtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG1lc3NhZ2VIYW5kbGVyKTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignVmVyc2lvbiByZXF1ZXN0IHRpbWVkIG91dCcpKTtcclxuICAgICAgICAgICAgICAgIH0sIDEwMDAwKTtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZUhhbmRsZXIgPSAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdVdGlscyByZWNlaXZlZCBTVyBtZXNzYWdlOicsIGV2ZW50LmRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChldmVudC5kYXRhPy50eXBlID09PSAnQ0FDSEVfVkVSU0lPTicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gZXZlbnQuZGF0YS52ZXJzaW9uLnNwbGl0KCctdicpWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXh0cmFjdGVkIHZlcnNpb246JywgdmVyc2lvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodmVyc2lvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gQWRkIG1lc3NhZ2UgbGlzdGVuZXIgYmVmb3JlIHNlbmRpbmcgbWVzc2FnZVxyXG4gICAgICAgICAgICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG1lc3NhZ2VIYW5kbGVyKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gU2VuZCBtZXNzYWdlIHRvIHNlcnZpY2Ugd29ya2VyXHJcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdVdGlscyBzZW5kaW5nIGdldENhY2hlVmVyc2lvbiBtZXNzYWdlJyk7XHJcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uYWN0aXZlLnBvc3RNZXNzYWdlKHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnR0VUX1ZFUlNJT04nLFxyXG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSBhd2FpdCB2ZXJzaW9uUHJvbWlzZTtcclxuICAgICAgICAgICAgcmV0dXJuIGAxLjAuJHt2ZXJzaW9ufWA7XHJcbiAgICBcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgYXBwIHZlcnNpb246JywgZXJyb3IpO1xyXG4gICAgICAgICAgICByZXR1cm4gJ05vdCBzZXQnO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBjbGVhclNlcnZpY2VXb3JrZXJDYWNoZSgpIHtcclxuICAgICAgICBjb25zdCByZWdpc3RyYXRpb25zID0gYXdhaXQgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuZ2V0UmVnaXN0cmF0aW9ucygpO1xyXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHJlZ2lzdHJhdGlvbnMubWFwKHJlZyA9PiByZWcudW5yZWdpc3RlcigpKSk7XHJcbiAgICAgICAgY29uc3QgY2FjaGVLZXlzID0gYXdhaXQgY2FjaGVzLmtleXMoKTtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChjYWNoZUtleXMubWFwKGtleSA9PiBjYWNoZXMuZGVsZXRlKGtleSkpKTtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKCdTZXJ2aWNlIFdvcmtlciBhbmQgY2FjaGVzIGNsZWFyZWQnKTtcclxuICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgbWFrZWlkKGxlbmd0aCkge1xyXG4gICAgICAgIGxldCByZXN1bHQgPSAnJztcclxuICAgICAgICBjb25zdCBjaGFyYWN0ZXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5JztcclxuICAgICAgICBjb25zdCBjaGFyYWN0ZXJzTGVuZ3RoID0gY2hhcmFjdGVycy5sZW5ndGg7XHJcbiAgICAgICAgbGV0IGNvdW50ZXIgPSAwO1xyXG4gICAgICAgIHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCArPSBjaGFyYWN0ZXJzLmNoYXJBdChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFyYWN0ZXJzTGVuZ3RoKSk7XHJcbiAgICAgICAgICAgIGNvdW50ZXIgKz0gMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcblxyXG59XHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IFV0aWxzTW9kdWxlKCk7IiwiY29uc3QgTXVzdGFjaGUgPSByZXF1aXJlKCdtdXN0YWNoZScpO1xyXG5jb25zdCBkYiA9IHJlcXVpcmUoJy4vZGInKTtcclxuY29uc3Qgc3N0ID0gcmVxdWlyZSgnLi9zc3QnKTtcclxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21vZHVsZXMvdXRpbHMnKTtcclxuY29uc3QgQ0FDSEVfTkFNRSA9ICdzc3QtY2FjaGUtdjI3JzsgXHJcbi8vIHRlc3RcclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRUZW1wbGF0ZShwYXRoKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYC92aWV3cy8ke3BhdGh9Lmh0bWxgKTtcclxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB0aHJvdyBuZXcgRXJyb3IoJ05ldHdvcmsgcmVzcG9uc2Ugd2FzIG5vdCBvaycpO1xyXG4gICAgICAgIHJldHVybiBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignRmV0Y2hpbmcgZnJvbSBjYWNoZTonLCBlcnJvcik7XHJcbiAgICAgICAgY29uc3QgY2FjaGUgPSBhd2FpdCBjYWNoZXMub3BlbihDQUNIRV9OQU1FKTtcclxuICAgICAgICBjb25zdCBjYWNoZWRSZXNwb25zZSA9IGF3YWl0IGNhY2hlLm1hdGNoKGAvdmlld3MvJHtwYXRofS5odG1sYCk7XHJcbiAgICAgICAgaWYgKGNhY2hlZFJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBjYWNoZWRSZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgICAgICAgIGlzUm91dGluZyA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxufVxyXG5cclxubGV0IGlzUm91dGluZyA9IGZhbHNlO1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gcm91dGVyKHBhdGgsIHByb2plY3RfaWQpIHtcclxuICAgIGlmIChpc1JvdXRpbmcpIHJldHVybjtcclxuICAgIGlzUm91dGluZyA9IHRydWU7XHJcbiAgICBcclxuICAgIGF3YWl0IHV0aWxzLmNoZWNrTG9naW4oKTtcclxuXHJcbiAgICAvLyBVcGRhdGUgYnJvd3NlciBVUkwgd2l0aG91dCByZWxvYWRcclxuICAgIHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZSh7fSwgJycsIGAvJHtwYXRofWApO1xyXG4gICAgXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGxldCB0ZW1wbGF0ZTtcclxuICAgICAgICBzd2l0Y2gocGF0aCkge1xyXG4gICAgICAgICAgICBjYXNlICd0YWJsZXMnOiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlID0gYXdhaXQgbG9hZFRlbXBsYXRlKCd0YWJsZXMnKTtcclxuICAgICAgICAgICAgICAgIC8vIEdldCBzdG9yZWQgcHJvamVjdCBkYXRhXHJcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0RGF0YSA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JykgfHwgJ3t9Jyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlcmVkID0gTXVzdGFjaGUucmVuZGVyKHRlbXBsYXRlLCB7IFxyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVGFibGVzIFBhZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3Q6IHByb2plY3REYXRhLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3RfaWQ6IHByb2plY3RfaWRcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgJCgnI3BhZ2UnKS5odG1sKHJlbmRlcmVkKTtcclxuICAgICAgICAgICAgICAgIHNzdC5nbG9iYWxCaW5kcygpO1xyXG4gICAgICAgICAgICAgICAgc3N0LnRhYmxlc0Z1bmN0aW9ucyhwcm9qZWN0X2lkKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdzY2hlZHVsZSc6XHJcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZSA9IGF3YWl0IGxvYWRUZW1wbGF0ZSgnc2NoZWR1bGUnKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlcmVkU2NoZWR1bGUgPSBNdXN0YWNoZS5yZW5kZXIodGVtcGxhdGUsIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdTY2hlZHVsZSBQYWdlJyxcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiAnVGhpcyBpcyB0aGUgc2NoZWR1bGUgcGFnZSBjb250ZW50J1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAkKCcjcGFnZScpLmh0bWwocmVuZGVyZWRTY2hlZHVsZSk7XHJcbiAgICAgICAgICAgICAgICBzc3QuZ2xvYmFsQmluZHMoKTtcclxuICAgICAgICAgICAgICAgIHNzdC5zY2hlZHVsZUZ1bmN0aW9ucygpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ2FjY291bnQnOlxyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGUgPSBhd2FpdCBsb2FkVGVtcGxhdGUoJ2FjY291bnQnKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlcmVkQWNjb3VudCA9IE11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgeyBcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ0FjY291bnQgUGFnZScsXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogJ1RoaXMgaXMgdGhlIGFjY291bnQgcGFnZSBjb250ZW50J1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAkKCcjcGFnZScpLmh0bWwocmVuZGVyZWRBY2NvdW50KTtcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3N0Lmdsb2JhbEJpbmRzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3N0LmFjY291bnRGdW5jdGlvbnMoKTtcclxuICAgICAgICAgICAgICAgIH0sIDUwMCk7XHJcbiAgICAgICAgICAgICAgICBicmVhazsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZSA9IGF3YWl0IGxvYWRUZW1wbGF0ZSgnaG9tZScpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWRIb21lID0gTXVzdGFjaGUucmVuZGVyKHRlbXBsYXRlLCB7IFxyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnRGFzaGJvYXJkJyxcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiAnWW91ciBwcm9qZWN0cyBhcmUgbGlzdGVkIGJlbG93J1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAkKCcjcGFnZScpLmh0bWwocmVuZGVyZWRIb21lKTtcclxuICAgICAgICAgICAgICAgIHNzdC5nbG9iYWxCaW5kcygpO1xyXG4gICAgICAgICAgICAgICAgc3N0LmhvbWVGdW5jdGlvbnMoKTtcclxuICAgICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1JvdXRpbmcgZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTsgICAgICAgIFxyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgICBpc1JvdXRpbmcgPSBmYWxzZTtcclxuICAgIH1cclxufVxyXG5cclxuLy8gSGFuZGxlIGJyb3dzZXIgYmFjay9mb3J3YXJkIGJ1dHRvbnNcclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgKCkgPT4ge1xyXG4gICAgY29uc3QgcGF0aFBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lXHJcbiAgICAgICAgLnNwbGl0KCcvJylcclxuICAgICAgICAuZmlsdGVyKHBhcnQgPT4gcGFydC5sZW5ndGggPiAwKTtcclxuICAgIHJvdXRlcihwYXRoUGFydHNbMF0gfHwgJ2hvbWUnLCBwYXRoUGFydHNbMV0pO1xyXG59KTtcclxuXHJcbi8vbW9kdWxlLmV4cG9ydHMgPSByb3V0ZXI7XHJcbndpbmRvdy5yb3V0ZXIgPSByb3V0ZXI7XHJcbiIsImNvbnN0IGRiID0gcmVxdWlyZSgnLi9kYicpOyBcclxuY29uc3QgdGFibGVzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3RhYmxlcycpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vbW9kdWxlcy91dGlscycpO1xyXG5jb25zdCBzaWRlYmFyID0gcmVxdWlyZSgnLi9tb2R1bGVzL3NpZGViYXInKTtcclxuY29uc3Qgc3luYyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9zeW5jJyk7XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnbG9iYWxCaW5kcygpIHtcclxuXHJcbiAgICBjb25zdCBjdXJyZW50UHJvamVjdCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JykgfHwgJ3t9Jyk7XHJcbiAgICBpZiAoIWN1cnJlbnRQcm9qZWN0LnByb2plY3RfaWQpIHtcclxuICAgICAgICAkKCcudGFibGVzX2xpbmssLnNjaGVkdWxlX2xpbmsnKS5oaWRlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgICQoJy50YWJsZXNfbGluaywuc2NoZWR1bGVfbGluaycpLnNob3coKTtcclxuICAgIH0gICAgXHJcblxyXG4gICAgJCgnI3N5bmNpY29uJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgc3luYy5wdXNoQWxsVXNlckRhdGEoKTtcclxuICAgIH0pO1xyXG4gICAgJCgnI3N5bmNpY29uJykub24oJ3RvdWNoZW5kJykub24oJ3RvdWNoZW5kJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgXHJcbiAgICAgICAgfSwgMTAwMCk7XHJcbiAgICB9KTtcclxuXHJcbn1cclxuXHJcbi8qXHJcbiogICBUYWJsZXMgcGFnZSBmdW5jdGlvbnNcclxuKi9cclxuYXN5bmMgZnVuY3Rpb24gdGFibGVzRnVuY3Rpb25zKHByb2plY3RfaWQpIHtcclxuICAgIHRhYmxlcy5pbml0KCk7ICAgICAgXHJcblxyXG4gICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG4gICAgXHJcbiAgICBjb25zdCBjdXJyZW50UHJvamVjdCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JykgfHwgJ3t9Jyk7XHJcbiAgICBpZiAoY3VycmVudFByb2plY3QucHJvamVjdF9pZCkge1xyXG4gICAgICAgIHByb2plY3RfaWQgPSBjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkO1xyXG4gICAgfSAgICAgICAgXHJcblxyXG4gICAgY29uc29sZS5sb2coJ1J1bm5pbmcgdGFibGVzIGZ1bmN0aW9ucyBmb3IgcHJvamVjdDonLCBwcm9qZWN0X2lkKTtcclxuXHJcbiAgICBcclxuXHJcbiAgICAvLyQoJyNkZWJ1ZycpLmh0bWwoY3VycmVudFByb2plY3QucHJvamVjdF9uYW1lKTtcclxuICAgICQoJy50YWJsZXNfbGluaycpLnNob3coKTtcclxuICAgIFVJa2l0Lm9mZmNhbnZhcygnLnRhYmxlcy1zaWRlJykuc2hvdygpO1xyXG5cclxuICAgIC8vIEluaXRpYWwgbG9hZCB3aXRoIGRlZmF1bHQgYnJhbmRcclxuICAgIGF3YWl0IHRhYmxlcy51cGRhdGVUeXBlc0Ryb3Bkb3duKCcxJyk7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZSBicmFuZCBjaGFuZ2VzXHJcbiAgICAkKCcjZm9ybV9icmFuZCcpLm9uKCdjaGFuZ2UnLCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICBhd2FpdCB0YWJsZXMudXBkYXRlVHlwZXNEcm9wZG93bigkKHRoaXMpLnZhbCgpKTtcclxuICAgIH0pO1xyXG4gICAgLy8gSGFuZGxlIHR5cGUgY2hhbmdlc1xyXG4gICAgJCgnI2Zvcm1fdHlwZScpLm9uKCdjaGFuZ2UnLCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICBhd2FpdCB0YWJsZXMudXBkYXRlUHJvZHVjdHNEcm9wZG93bigkKHRoaXMpLnZhbCgpKTtcclxuICAgIH0pO1xyXG4gICAgLy8gSGFuZGxlIHByb2R1Y3QgY2hhbmdlc1xyXG4gICAgJCgnI2Zvcm1fcHJvZHVjdCcpLm9uKCdjaGFuZ2UnLCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICBhd2FpdCB0YWJsZXMudXBkYXRlU2t1c0Ryb3Bkb3duKCQodGhpcykudmFsKCkpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuICAgIC8vIGFkZCBwcm9kY3V0IHRvIHJvb21cclxuICAgICQoJyNidG5fYWRkX3Byb2R1Y3QnKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICBhd2FpdCB0YWJsZXMuYWRkUHJvZHVjdFRvUm9vbUNsaWNrKCk7ICAgICAgIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIFNwZWNpYWwgdG8gcm9vbVxyXG4gICAgJCgnI2J0bl9hZGRfc3BlY2lhbCcpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAvL1VJa2l0Lm1vZGFsKCcjYWRkLXNwZWNpYWwnKS5yZW1vdmUoKTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2FkZC1zcGVjaWFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJCgnI2FkZC1pbWFnZScpLm9uKCdjaGFuZ2UnLCB0YWJsZXMuaGFuZGxlRmlsZVVwbG9hZCk7XHJcbiAgICAkKCcjdXBsb2FkLXByb2dyZXNzICNjbG9zZS1wcm9ncmVzcycpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBVSWtpdC5tb2RhbCgkKCcjdXBsb2FkLXByb2dyZXNzJykpLmhpZGUoKTtcclxuICAgIH0pOyAgICBcclxuXHJcblxyXG4gICAgYXdhaXQgdGFibGVzLnJlbmRlclByb2RjdHNUYWJsZSgpO1xyXG5cclxuICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgYXdhaXQgc2lkZWJhci5yZW5kZXJGYXZvdXJpdGVzKHVzZXJfaWQpO1xyXG5cclxuXHJcbiAgICAvLyBsb2FkUm9vbURhdGEgZm9yIHRoZSBmaXJzdCBtZW50aW9uZWQgcm9vbSBpZCBpbiB0aGUgc2lkZWJhclxyXG4gICAgY29uc3QgZmlyc3RSb29tSWQgPSAkKCcjbG9jYXRpb25zIC5yb29tLWxpbmsnKS5maXJzdCgpLmRhdGEoJ2lkJyk7ICAgIFxyXG4gICAgYXdhaXQgbG9hZFJvb21EYXRhKGZpcnN0Um9vbUlkKTtcclxuICAgIGF3YWl0IGxvYWRSb29tTm90ZXMoZmlyc3RSb29tSWQpO1xyXG4gICAgYXdhaXQgbG9hZFJvb21JbWFnZXMoZmlyc3RSb29tSWQpO1xyXG5cclxuICAgIC8vIG5hbWUgbGFiZWxzIChyZW5hbWUpXHJcbiAgICAkKCdzcGFuLm5hbWUnKS5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnTmFtZSBjbGlja2VkOicsICQodGhpcykuZGF0YSgnaWQnKSk7ICAgIFxyXG4gICAgICAgIGNvbnN0IHN0b3JlID0gJCh0aGlzKS5kYXRhKCd0YmwnKTtcclxuICAgICAgICBjb25zdCB1dWlkID0gJCh0aGlzKS5kYXRhKCdpZCcpO1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSAkKHRoaXMpLnRleHQoKTtcclxuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcclxuICAgICAgICAvLyBjYWxsIHRoZSBtb2RhbCB0byB1cGRhdGUgdGhlIG5hbWVcclxuICAgICAgICBVSWtpdC5tb2RhbC5wcm9tcHQoJzxoND5OZXcgbmFtZTwvaDQ+JywgbmFtZSkudGhlbihhc3luYyBmdW5jdGlvbihuZXdOYW1lKSB7XHJcbiAgICAgICAgICAgIGlmIChuZXdOYW1lKSB7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYXdhaXQgZGIudXBkYXRlTmFtZShzdG9yZSwgdXVpZCwgbmV3TmFtZSk7XHJcbiAgICAgICAgICAgICAgICAkKHRoYXQpLnRleHQobmV3TmFtZSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IC8vIHByb2plY3RfaWQgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgLy8gcm9vbSBkaW1lbnNpb24gZmllbGRzXHJcbiAgICAkKCcucm9vbWRpbScpLm9mZignYmx1cicpLm9uKCdibHVyJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGNvbnN0IHJvb21VdWlkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpO1xyXG4gICAgICAgIGNvbnN0IGZpZWxkID0gJCh0aGlzKS5kYXRhKCdmaWVsZCcpO1xyXG4gICAgICAgIGNvbnN0IHZhbHVlID0gJCh0aGlzKS52YWwoKTtcclxuICAgICAgICBhd2FpdCBkYi51cGRhdGVSb29tRGltZW5zaW9uKHJvb21VdWlkLCBmaWVsZCwgdmFsdWUpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gYWRkIHNwZWNpYWwgdG8gcm9vbVxyXG4gICAgJCgnI2Zvcm0tYWRkLXNwZWNpYWwnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IHRhYmxlcy5hZGRTcGVjaWFsVG9Sb29tQ2xpY2soKTsgICAgICAgICBcclxuICAgICAgICAkKCcjZm9ybS1hZGQtc3BlY2lhbCcpLnRyaWdnZXIoXCJyZXNldFwiKTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2FkZC1zcGVjaWFsJykuaGlkZSgpOyBcclxuICAgIH0pOyAgICAgXHJcblxyXG4gICAgLy8gb3BlbiBjb3B5IHJvb20gbW9kYWxcclxuICAgICQoJyNjb3B5X3Jvb20nKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgICAgXHJcbiAgICAgICAgY29uc3QgZmxvb3JzID0gYXdhaXQgZGIuZ2V0Rmxvb3JzKHByb2plY3RfaWQpO1xyXG4gICAgICAgIGxldCBmbG9vck9wdGlvbnMgPSBmbG9vcnMubWFwKGZsb29yID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtmbG9vci51dWlkfVwiPiR7Zmxvb3IubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKTtcclxuICAgICAgICAkKCcjY29weS1yb29tLW1vZGFsIHNlbGVjdCNtb2RhbF9mb3JtX2Zsb29yJykuaHRtbChmbG9vck9wdGlvbnMpO1xyXG5cclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2NvcHktcm9vbS1tb2RhbCcsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTsgICAgICAgXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBjb3B5IHJvb20gbW9kYWwgc3VibWl0dGVkXHJcbiAgICAkKCcjZm9ybS1jb3B5LXJvb20nKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IHJvb21VdWlkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgbmV3Um9vbU5hbWUgPSAkKCcjbW9kYWxfZm9ybV9uZXdfbmFtZScpLnZhbCgpO1xyXG4gICAgICAgIGNvbnN0IG5ld0Zsb29yVXVpZCA9ICQoJyNtb2RhbF9mb3JtX2Zsb29yJykuZmluZChcIjpzZWxlY3RlZFwiKS52YWwoKTtcclxuXHJcbiAgICAgICAgY29uc3QgbmV3Um9vbVV1aWQgPSBhd2FpdCBkYi5jb3B5Um9vbShyb29tVXVpZCwgbmV3Um9vbU5hbWUsIG5ld0Zsb29yVXVpZCk7XHJcbiAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgLy8gcHJvamVjdF9pZFxyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tRGF0YShuZXdSb29tVXVpZCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNjb3B5LXJvb20tbW9kYWwnKS5oaWRlKCk7IFxyXG4gICAgfSk7ICAgIFxyXG5cclxuICAgIC8vIGFkZCBub3RlIGJ1dHRvbiBjbGlja1xyXG4gICAgJCgnI2FkZC1ub3RlJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgJCgnI2VkaXRfbm90ZV91dWlkJykudmFsKCcnKTtcclxuICAgICAgICAkKCcjbW9kYWxfZm9ybV9ub3RlJykudmFsKCcnKTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2FkZC1ub3RlLW1vZGFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gYWRkIG5vdGUgbW9kYWwgc3VibWl0dGVkXHJcbiAgICAkKCcjZm9ybS1hZGQtbm90ZScpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3QgZWRpdE5vdGVVdWlkID0gJCgnI2VkaXRfbm90ZV91dWlkJykudmFsKCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCByb29tVXVpZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IG5vdGUgPSAkKCcjbW9kYWxfZm9ybV9ub3RlJykudmFsKCk7ICAgICAgICBcclxuXHJcbiAgICAgICAgLy8gZWRpdGluZywganVzdCBkZWxldGUgdGhlIG9sZCBvbmUgYW5kIHJlY3JlYXRlIChkb2VzIG1lYW4gdGhlIGNyZWF0ZWQgZGF0ZSB3aWxsIGFsc28gYmUgdXBkYXRlZClcclxuICAgICAgICBpZiAoZWRpdE5vdGVVdWlkICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgYXdhaXQgZGIucmVtb3ZlTm90ZUJ5VVVJRChlZGl0Tm90ZVV1aWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYXdhaXQgZGIuYWRkTm90ZShyb29tVXVpZCwgbm90ZSk7XHJcbiAgICAgICAgYXdhaXQgbG9hZFJvb21EYXRhKHJvb21VdWlkKTtcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbU5vdGVzKHJvb21VdWlkKTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2FkZC1ub3RlLW1vZGFsJykuaGlkZSgpOyBcclxuICAgIH0pOyAgICBcclxuXHJcbn1cclxuLyogXHJcbiAgICAvLyBFbmQgdGFibGVzRnVuY3Rpb25zIFxyXG4qL1xyXG5cclxuXHJcbi8qXHJcbiogICBIb21lIHBhZ2UgZnVuY3Rpb25zXHJcbiovXHJcbmNvbnN0IGhvbWVGdW5jdGlvbnMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zb2xlLmxvZygnUnVubmluZyBob21lIGZ1bmN0aW9ucyB2MicpO1xyXG5cclxuICAgIGxldCBkZWZlcnJlZFByb21wdDtcclxuICAgIGNvbnN0IGluc3RhbGxCdXR0b24gPSAkKCcjaW5zdGFsbEJ1dHRvbicpO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmVpbnN0YWxscHJvbXB0JywgKGUpID0+IHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICBcclxuICAgICAgICAvLyBTdGFzaCB0aGUgZXZlbnQgc28gaXQgY2FuIGJlIHRyaWdnZXJlZCBsYXRlclxyXG4gICAgICAgIGRlZmVycmVkUHJvbXB0ID0gZTtcclxuICAgICAgICAvLyBTaG93IHRoZSBpbnN0YWxsIGJ1dHRvblxyXG4gICAgICAgIGNvbnNvbGUubG9nKCdiZWZvcmVpbnN0YWxscHJvbXB0IGZpcmVkJyk7XHJcbiAgICAgICAgaW5zdGFsbEJ1dHRvbi5zaG93KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpbnN0YWxsQnV0dG9uLm9uKCdjbGljaycsIGFzeW5jICgpID0+IHtcclxuICAgICAgICBpZiAoIWRlZmVycmVkUHJvbXB0KSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gU2hvdyB0aGUgaW5zdGFsbCBwcm9tcHRcclxuICAgICAgICBkZWZlcnJlZFByb21wdC5wcm9tcHQoKTtcclxuICAgICAgICAvLyBXYWl0IGZvciB0aGUgdXNlciB0byByZXNwb25kIHRvIHRoZSBwcm9tcHRcclxuICAgICAgICBjb25zdCB7IG91dGNvbWUgfSA9IGF3YWl0IGRlZmVycmVkUHJvbXB0LnVzZXJDaG9pY2U7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFVzZXIgcmVzcG9uc2UgdG8gdGhlIGluc3RhbGwgcHJvbXB0OiAke291dGNvbWV9YCk7XHJcbiAgICAgICAgLy8gV2UndmUgdXNlZCB0aGUgcHJvbXB0LCBhbmQgY2FuJ3QgdXNlIGl0IGFnYWluLCBkaXNjYXJkIGl0XHJcbiAgICAgICAgZGVmZXJyZWRQcm9tcHQgPSBudWxsO1xyXG4gICAgICAgIC8vIEhpZGUgdGhlIGluc3RhbGwgYnV0dG9uXHJcbiAgICAgICAgaW5zdGFsbEJ1dHRvbi5oaWRlKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYXBwaW5zdGFsbGVkJywgKGV2dCkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdBcHBsaWNhdGlvbiBpbnN0YWxsZWQnKTtcclxuICAgICAgICBpbnN0YWxsQnV0dG9uLmhpZGUoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vVUlraXQub2ZmY2FudmFzKCcudGFibGVzLXNpZGUnKS5oaWRlKCk7XHJcblxyXG5cclxuICAgIHZhciBkYXNoVGFibGUgPSByZW5kZXJQcm9qZWN0c1RhYmxlKCk7XHJcbiAgICAvL2Rhc2hUYWJsZS5zZXREYXRhKGRhdGEpO1xyXG5cclxuICAgICQoJyNidG4tY3JlYXRlLXByb2plY3QnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAkKCcjZm9ybS1jcmVhdGUtcHJvamVjdCcpLnRyaWdnZXIoXCJyZXNldFwiKTsgICAgICAgIFxyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjY3JlYXRlLXByb2plY3QnLCB7IHN0YWNrIDogdHJ1ZSB9KS5zaG93KCk7XHJcbiAgICAgICAgJCgnI2Zvcm1fcHJvamVjdF9uYW1lJykuZm9jdXMoKTtcclxuICAgIH0pOyAgICBcclxuXHJcbiAgICAvKiBBZGQgcHJvamVjdCByZWxhdGVkIGJpbmRzICovXHJcbiAgICAkKCcjZm9ybV9wcm9qZWN0X25hbWUnKS5vZmYoJ2ZvY3VzJykub24oJ2ZvY3VzJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICQoJyNmb3JtX2xvY2F0aW9uJykuYXR0cih7J2Rpc2FibGVkJzonZGlzYWJsZWQnfSk7XHJcbiAgICAgICAgJCgnI2Zvcm1fYnVpbGRpbmcnKS5hdHRyKHsnZGlzYWJsZWQnOidkaXNhYmxlZCd9KTtcclxuICAgIH0pO1xyXG4gICAgJCgnI2Zvcm1fcHJvamVjdF9uYW1lJykub2ZmKCdibHVyJykub24oJ2JsdXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykudmFsKCkgIT0gXCJcIikge1xyXG4gICAgICAgICAgICAkKCcjZm9ybV9sb2NhdGlvbicpLnJlbW92ZUF0dHIoJ2Rpc2FibGVkJykuZm9jdXMoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgICQoJyNmb3JtX2xvY2F0aW9uJykub2ZmKCdibHVyJykub24oJ2JsdXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykudmFsKCkgIT0gXCJcIikge1xyXG4gICAgICAgICAgICAkKCcjZm9ybV9idWlsZGluZycpLnJlbW92ZUF0dHIoJ2Rpc2FibGVkJykuZm9jdXMoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgICQoJyNmb3JtX2J1aWxkaW5nJykub2ZmKCdibHVyJykub24oJ2JsdXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykudmFsKCkgIT0gXCJcIikge1xyXG4gICAgICAgICAgICAkKCcjZm9ybV9mbG9vcicpLnJlbW92ZUF0dHIoJ2Rpc2FibGVkJykuZm9jdXMoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTsgICBcclxuICAgICQoJyNmb3JtX2Zsb29yJykub2ZmKCdibHVyJykub24oJ2JsdXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykudmFsKCkgIT0gXCJcIikge1xyXG4gICAgICAgICAgICAkKCcjZm9ybV9yb29tJykucmVtb3ZlQXR0cignZGlzYWJsZWQnKS5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyAgICAgXHJcbiAgICBcclxuICAgICQoJyNmb3JtLWNyZWF0ZS1wcm9qZWN0Jykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjcmVhdGVQcm9qZWN0KCk7ICAgICAgICAgICAgICBcclxuICAgIH0pOyAgICAgICAgXHJcblxyXG5cclxufTtcclxuLyogXHJcbiAgICAvLyBFTkQgaG9tZUZ1bmN0aW9ucyBcclxuKi9cclxuXHJcblxyXG4vKlxyXG4qICAgU2NoZWR1bGUgZnVuY3Rpb25zXHJcbiovXHJcbmNvbnN0IHNjaGVkdWxlRnVuY3Rpb25zID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc29sZS5sb2coJ1J1bm5pbmcgc2NoZWR1bGUgZnVuY3Rpb25zIHYyJyk7XHJcbiAgICAvL1VJa2l0Lm9mZmNhbnZhcygnLnRhYmxlcy1zaWRlJykuaGlkZSgpO1xyXG5cclxuICAgIGxldCBwcm9qZWN0SWQgPSAkKCcjbV9wcm9qZWN0X2lkJykudmFsKCk7XHJcbiAgICBpZiAocHJvamVjdElkID09IFwiXCIpIHtcclxuICAgICAgICAvLyBnZXQgZnJvbSBsb2NhbCBzdG9yYWdlXHJcbiAgICAgICAgY29uc3QgY3VycmVudFByb2plY3QgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50UHJvamVjdCcpIHx8ICd7fScpO1xyXG4gICAgICAgIGlmIChjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkKSB7XHJcbiAgICAgICAgICAgIHByb2plY3RJZCA9IGN1cnJlbnRQcm9qZWN0LnByb2plY3RfaWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignTm8gcHJvamVjdCBpZCBmb3VuZCcpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHBkYXRhID0gYXdhaXQgZGIuZ2V0UHJvamVjdEJ5VVVJRChwcm9qZWN0SWQpO1xyXG5cclxuICAgICQoJyNtX3Byb2plY3Rfc2x1ZycpLnZhbChwZGF0YS5zbHVnKTtcclxuICAgICQoJyNtX3Byb2plY3RfdmVyc2lvbicpLnZhbChwZGF0YS52ZXJzaW9uKTtcclxuXHJcbiAgICAkKCcjaW5mb19wcm9qZWN0X25hbWUnKS5odG1sKHBkYXRhLm5hbWUpO1xyXG4gICAgJCgnI2luZm9fcHJvamVjdF9pZCcpLmh0bWwocGRhdGEucHJvamVjdF9pZCk7ICAgIFxyXG4gICAgJCgnI2luZm9fZW5naW5lZXInKS5odG1sKHBkYXRhLmVuZ2luZWVyKTtcclxuICAgICQoJyNpbmZvX2RhdGUnKS5odG1sKG5ldyBEYXRlKHBkYXRhLmxhc3RfdXBkYXRlZCkudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicpKTtcclxuXHJcbiAgICBjb25zdCBzZGF0YSA9IGF3YWl0IGRiLmdldFByb2R1Y3RzRm9yUHJvamVjdChwcm9qZWN0SWQpO1xyXG5cclxuICAgIGxldCB0YWJsZWRhdGEgPSBzZGF0YS5tYXAocHJvZHVjdCA9PiAoe1xyXG4gICAgICAgIHV1aWQ6IHByb2R1Y3QudXVpZCxcclxuICAgICAgICBwcm9kdWN0X3NsdWc6IHByb2R1Y3QucHJvZHVjdF9zbHVnLFxyXG4gICAgICAgIHByb2R1Y3RfbmFtZTogcHJvZHVjdC5wcm9kdWN0X25hbWUsICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHJlZjogcHJvZHVjdC5yZWYsXHJcbiAgICAgICAgcXR5OiBwcm9kdWN0LnF0eSxcclxuICAgICAgICBza3U6IHByb2R1Y3Quc2t1ICAgICAgICBcclxuICAgIH0pKTsgICAgICAgXHJcblxyXG4gICAgdmFyIHNUYWJsZSA9IG5ldyBUYWJ1bGF0b3IoXCIjc3RhYmxlXCIsIHtcclxuICAgICAgICBkYXRhOiB0YWJsZWRhdGEsXHJcbiAgICAgICAgbGF5b3V0OiBcImZpdENvbHVtbnNcIixcclxuICAgICAgICBsb2FkZXI6IGZhbHNlLFxyXG4gICAgICAgIGRhdGFMb2FkZXJFcnJvcjogXCJUaGVyZSB3YXMgYW4gZXJyb3IgbG9hZGluZyB0aGUgZGF0YVwiLFxyXG4gICAgICAgIGRvd25sb2FkRW5jb2RlcjogZnVuY3Rpb24oZmlsZUNvbnRlbnRzLCBtaW1lVHlwZSl7XHJcbiAgICAgICAgICAgIGdlbmVyYXRlRGF0YVNoZWV0cyhmaWxlQ29udGVudHMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY29sdW1uczogW3tcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcImlkXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJ1dWlkXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJQcm9kdWN0XCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9kdWN0X25hbWVcIixcclxuICAgICAgICAgICAgICAgIGhvekFsaWduOiBcImxlZnRcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlF0eVwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwicXR5XCIsICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaG96QWxpZ246IFwibGVmdFwiLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTS1VcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInNrdVwiLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiNTAlXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUmVmXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJyZWZcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgJCgnI2dlbl9kYXRhc2hlZXRzLCNnZW5fc2NoZWR1bGVzX2NvbmZpcm0nKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBpZiAoJCgnI2luY2x1ZGVfc2NoZWR1bGUnKS5pcygnOmNoZWNrZWQnKSA9PSBmYWxzZSAmJlxyXG4gICAgICAgICAgICAkKCcjaW5jbHVkZV9kYXRhc2hlZXRzJykuaXMoJzpjaGVja2VkJykgPT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIGFsZXJ0KCdOb3RoaW5nIHRvIGdlbmVyYXRlLCBwbGVhc2Ugc2VsZWN0IGFuIG9wdGlvbicpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuKGZhbHNlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHRyaWdnZXIgdGhlICAgZG93bmxvYWQsIHdoaWNoIGlzIGludGVyY2VwdGVkIGFuZCB0cmlnZ2Vyc1xyXG4gICAgICAgIC8vIGdlbmVyYXRlRGF0YVNoZWV0cygpXHJcbiAgICAgICAgc1RhYmxlLmRvd25sb2FkKFwianNvblwiLCBcImRhdGEuanNvblwiLCB7fSwgXCJ2aXNpYmxlXCIpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgICQoJyNmb3JtLXN1Ym1pdC1mb2xpby1wcm9ncmVzcycpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBmaWxlbmFtZSA9IHBkYXRhLnNsdWc7XHJcbiAgICAgICAgaWYgKHBkYXRhLnZlcnNpb24gPiAxKSB7XHJcbiAgICAgICAgICAgIGZpbGVuYW1lID0gZmlsZW5hbWUrXCItdlwiICsgcGRhdGEudmVyc2lvbjtcclxuICAgICAgICB9ICAgICAgICBcclxuICAgICAgICBjb25zdCBidXN0ZXIgPSB1dGlscy5tYWtlaWQoMTApO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCQoJyNmb2xpby1wcm9ncmVzcycpKS5oaWRlKCk7XHJcbiAgICAgICAgd2luZG93Lm9wZW4oXCJodHRwczovL3N0YWdpbmcudGFtbGl0ZS5jby51ay9wZGZtZXJnZS9cIitmaWxlbmFtZStcIi5wZGY/dD1cIitidXN0ZXIsICdfYmxhbmsnKTtcclxuICAgIH0pOyAgICBcclxuXHJcblxyXG59XHJcbi8qXHJcbiogLy8gRW5kIFNjaGVkdWxlIGZ1bmN0aW9uc1xyXG4qL1xyXG5cclxuXHJcbi8qXHJcbiogQWNjb3VudCBQYWdlIGZ1bmN0aW9uc1xyXG4qL1xyXG5jb25zdCBhY2NvdW50RnVuY3Rpb25zID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc29sZS5sb2coJ1J1bm5pbmcgYWNjb3VudCBmdW5jdGlvbnMgdjInKTtcclxuICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKTtcclxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBkYi5nZXRVc2VyKHVzZXJfaWQpOyAgIFxyXG4gICAgXHJcbiAgICBpZiAoIXVzZXIpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdlcnJvciBnZXR0aW5nIHVlZXIgZGV0YWlscycpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAkKCcjbmFtZScpLnZhbCh1c2VyLm5hbWUpO1xyXG4gICAgJCgnI2VtYWlsJykudmFsKHVzZXIuZW1haWwpO1xyXG4gICAgJCgnI3Bhc3N3b3JkJykudmFsKHVzZXIucGFzc3dvcmQpO1xyXG4gICAgJCgnI2NvZGUnKS52YWwodXNlci5jb2RlKTtcclxuXHJcbiAgICAkKCcjYnRuX3B1bGxfdXNlcl9kYXRhJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYXdhaXQgc3luYy5nZXRVc2VyRGF0YSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJCgnI2J0bl9jbGVhcl9sb2NhbF9zdG9yYWdlJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYXdhaXQgdXRpbHMuY2xlYXJTZXJ2aWNlV29ya2VyQ2FjaGUoKTtcclxuICAgIH0pOyAgICBcclxuXHJcbiAgICAkKCcjYnRuX2xvZ291dCcpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IHV0aWxzLmxvZ291dCgpO1xyXG4gICAgfSk7ICAgICAgXHJcblxyXG4gICAgJCgnI2Zvcm0tdXBkYXRlLWFjY291bnQnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIC8vY29uc29sZS5sb2coJ1VwZGF0ZSBhY2NvdW50IGNsaWNrZWQnKTtcclxuICAgICAgICAvLyBidWlsZCB0aGUgdXNlciBvYmplY3QgZnJvbSBzdWJtaXR0ZWQgZm9ybSBmaWVsZHNcclxuICAgICAgICBjb25zdCBmb3JtZGF0YSA9IHsgICAgICAgICAgICBcclxuICAgICAgICAgICAgbmFtZTogJCgnI25hbWUnKS52YWwoKSxcclxuICAgICAgICAgICAgZW1haWw6ICQoJyNlbWFpbCcpLnZhbCgpLFxyXG4gICAgICAgICAgICBwYXNzd29yZDogJCgnI3Bhc3N3b3JkJykudmFsKCksXHJcbiAgICAgICAgICAgIGNvZGU6ICQoJyNjb2RlJykudmFsKClcclxuICAgICAgICB9ICAgICAgICBcclxuXHJcbiAgICAgICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG4gICAgICAgIGF3YWl0IGRiLnVwZGF0ZVVzZXIoZm9ybWRhdGEsIHVzZXJfaWQpO1xyXG4gICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignQWNjb3VudCB1cGRhdGVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgfSk7XHJcblxyXG59XHJcbi8qXHJcbiogLy8gRW5kIGFjY291bnQgcGFnZSBmdW5jdGlvbnNcclxuKi9cclxuXHJcblxyXG5cclxuLypcclxuKiBHZW5lcmF0ZSBEYXRhIFNoZWV0cyByZWxhdGVkIGZ1bmN0aW9uc1xyXG4qL1xyXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZURhdGFTaGVldHMoZGF0YSkge1xyXG4gICAgVUlraXQubW9kYWwoJCgnI2ZvbGlvLXByb2dyZXNzJykpLnNob3coKTtcclxuICAgIGNvbnN0IHNjaGVkdWxlX3R5cGUgPSAkKCdpbnB1dFtuYW1lPXNjaGVkdWxlX3R5cGVdOmNoZWNrZWQnKS52YWwoKTtcclxuICAgIGNvbnN0IHByb2plY3RfaWQgPSAkKCdpbnB1dCNtX3Byb2plY3RfaWQnKS52YWwoKSB8fCBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50UHJvamVjdCcpKS5wcm9qZWN0X2lkO1xyXG4gICAgaWYgKHNjaGVkdWxlX3R5cGUgPT0gXCJieV9wcm9qZWN0XCIpIHtcclxuICAgICAgICBqc29uRGF0YSA9IGRhdGE7IC8vIHRoZSBzY2hlZHVsZSB0YWJsZSBkYXRhIGZvciBhIGZ1bGwgcHJvamVjdCBzY2hlZHVsZVxyXG4gICAgICAgIGNhbGxHZW5TaGVldHMoc2NoZWR1bGVfdHlwZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRyeSB7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGpzb25EYXRhID0gYXdhaXQgZGIuZ2V0U2NoZWR1bGVQZXJSb29tKHByb2plY3RfaWQpOyAvLyBXYWl0IGZvciB0aGUgZGF0YVxyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdqc29uRGF0YScsIGpzb25EYXRhKTtcclxuICAgICAgICAgICAgY2FsbEdlblNoZWV0cyhzY2hlZHVsZV90eXBlKTsgLy8gQ2FsbCB3aXRoIHRoZSByZXNvbHZlZCBkYXRhXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGZldGNoaW5nIHNjaGVkdWxlIHBlciByb29tOlwiLCBlcnJvcik7XHJcbiAgICAgICAgICAgIGFsZXJ0KFwiRmFpbGVkIHRvIGZldGNoIHNjaGVkdWxlIGRhdGEuIFBsZWFzZSB0cnkgYWdhaW4uXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gY2FsbEdlblNoZWV0cyhzY2hlZHVsZV90eXBlKSB7XHJcbiAgICAkKCcudWstcHJvZ3Jlc3MnKS52YWwoMTApO1xyXG4gICAgJCgnI2Rvd25sb2FkX2RhdGFzaGVldHMnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XHJcbiAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoXCJHYXRoZXJpbmcgRGF0YSAuLi5cIik7XHJcblxyXG4gICAgJC5hamF4KHtcclxuICAgICAgICB1cmw6IFwiaHR0cHM6Ly9zdGFnaW5nLnRhbWxpdGUuY28udWsvY2lfaW5kZXgucGhwL2Rvd25sb2FkX3NjaGVkdWxlXCIsXHJcbiAgICAgICAgdHlwZTogXCJQT1NUXCIsXHJcbiAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICBwcm9qZWN0X3NsdWc6ICQoJyNtX3Byb2plY3Rfc2x1ZycpLnZhbCgpLFxyXG4gICAgICAgICAgICBwcm9qZWN0X3ZlcnNpb246ICQoJyNtX3Byb2plY3RfdmVyc2lvbicpLnZhbCgpLFxyXG4gICAgICAgICAgICBpbmZvX3Byb2plY3RfbmFtZTogJCgnI2luZm9fcHJvamVjdF9uYW1lJykudGV4dCgpLFxyXG4gICAgICAgICAgICBpbmZvX3Byb2plY3RfaWQ6ICQoJyNpbmZvX3Byb2plY3RfaWQnKS50ZXh0KCksXHJcbiAgICAgICAgICAgIGluZm9fZW5naW5lZXI6ICQoJyNpbmZvX2VuZ2luZWVyJykudGV4dCgpLFxyXG4gICAgICAgICAgICBpbmZvX2RhdGU6ICQoJyNpbmZvX2RhdGUnKS50ZXh0KCksXHJcbiAgICAgICAgICAgIGluY2x1ZGVfc2NoZWR1bGU6ICQoJyNpbmNsdWRlX3NjaGVkdWxlJykuaXMoJzpjaGVja2VkJyksXHJcbiAgICAgICAgICAgIGluY2x1ZGVfZGF0YXNoZWV0czogJCgnI2luY2x1ZGVfZGF0YXNoZWV0cycpLmlzKCc6Y2hlY2tlZCcpLFxyXG4gICAgICAgICAgICBzY2hlZHVsZV90eXBlOiBzY2hlZHVsZV90eXBlLFxyXG4gICAgICAgICAgICBza3VzOiBqc29uRGF0YSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHhocjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgd2luZG93LlhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgIGxldCBsYXN0UHJvY2Vzc2VkSW5kZXggPSAwO1xyXG4gICAgICAgICAgICB4aHIub25wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlVGV4dCA9IHhoci5yZXNwb25zZVRleHQudHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSByZXNwb25zZVRleHQuc3BsaXQoJ1xcbicpO1xyXG5cclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSBsYXN0UHJvY2Vzc2VkSW5kZXg7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cobGluZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsaW5lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGUgPSBKU09OLnBhcnNlKGxpbmUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlLnN0ZXAgJiYgdXBkYXRlLnRvdGFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwZXJjZW50YWdlID0gKHVwZGF0ZS5zdGVwIC8gKHVwZGF0ZS50b3RhbCAtIDEpKSAqIDEwMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dCh1cGRhdGUubWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcudWstcHJvZ3Jlc3MnKS52YWwocGVyY2VudGFnZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVwZGF0ZS5jb21wbGV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1Byb2Nlc3NpbmcgY29tcGxldGU6JywgdXBkYXRlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJy51ay1wcm9ncmVzcycpLnZhbCgxMDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KHVwZGF0ZS5tZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyNkb3dubG9hZF9kYXRhc2hlZXRzJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiU2tpcHBpbmcgaW52YWxpZCBKU09OIGxpbmU6XCIsIGxpbmUsIGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxhc3RQcm9jZXNzZWRJbmRleCA9IGxpbmVzLmxlbmd0aDtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHhocjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbiAoeGhyLCBzdGF0dXMsIGVycm9yKSB7XHJcbiAgICAgICAgICAgIGlmIChzdGF0dXMgPT09IFwidGltZW91dFwiKSB7XHJcbiAgICAgICAgICAgICAgICBhbGVydChcIlRoZSByZXF1ZXN0IHRpbWVkIG91dC4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIik7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyB0b2RvOiB0aGlzIGlzIGFjdHVhbGx5IGZpcmluZyBidXQgYWxsIHdvcmtzIG9rLCBkZWJ1Z1xyXG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmVycm9yKFwiQW4gZXJyb3Igb2NjdXJyZWQ6XCIsIHN0YXR1cywgZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0aW1lb3V0OiAzMTAwMDAsIC8vIDMxMCBzZWNvbmRzICg1IG1pbnV0ZXMgKyBidWZmZXIpXHJcbiAgICB9KTtcclxufVxyXG4vKlxyXG4qIC8vIGVuZCBHZW5lcmF0ZSBEYXRhIFNoZWV0c1xyXG4qL1xyXG5cclxuXHJcblxyXG4vKlxyXG4qIEdldCBhbGwgcHJvamVjdHMgKGZvciB0aGlzIHVzZXIpIGFuZCByZW5kZXIgdGhlIHRhYmxlXHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbmRlclByb2plY3RzVGFibGUoKSB7XHJcblxyXG4gICAgY29uc3QgcHJvamVjdHMgPSBhd2FpdCBkYi5nZXRQcm9qZWN0cyhhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKSk7XHJcbiAgICBsZXQgdGFibGVkYXRhID0gcHJvamVjdHMubWFwKHByb2plY3QgPT4gKHtcclxuICAgICAgICBwcm9qZWN0X25hbWU6IHByb2plY3QubmFtZSxcclxuICAgICAgICBwcm9qZWN0X3NsdWc6IHByb2plY3Quc2x1ZyxcclxuICAgICAgICB2ZXJzaW9uOiBwcm9qZWN0LnZlcnNpb24sXHJcbiAgICAgICAgcHJvamVjdF9pZDogcHJvamVjdC51dWlkLFxyXG4gICAgICAgIHByb2plY3RfcmVmOiBwcm9qZWN0LnByb2plY3RfaWQsXHJcbiAgICAgICAgY3JlYXRlZDogbmV3IERhdGUocHJvamVjdC5jcmVhdGVkX29uKS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJyksXHJcbiAgICAgICAgcHJvZHVjdHM6IHByb2plY3QucHJvZHVjdHNfY291bnRcclxuICAgIH0pKTsgICAgIFxyXG5cclxuICAgIHZhciBkYXNoVGFibGUgPSBuZXcgVGFidWxhdG9yKFwiI2Rhc2hib2FyZF9wcm9qZWN0c1wiLCB7XHJcbiAgICAgICAgZGF0YTogdGFibGVkYXRhLCAgICAgICAgICAgIFxyXG4gICAgICAgIGxvYWRlcjogZmFsc2UsXHJcbiAgICAgICAgbGF5b3V0OiBcImZpdENvbHVtbnNcIixcclxuICAgICAgICBkYXRhTG9hZGVyRXJyb3I6IFwiVGhlcmUgd2FzIGFuIGVycm9yIGxvYWRpbmcgdGhlIGRhdGFcIixcclxuICAgICAgICBpbml0aWFsU29ydDpbXHJcbiAgICAgICAgICAgIHtjb2x1bW46XCJwcm9qZWN0X25hbWVcIiwgZGlyOlwiYXNjXCJ9LCBcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbHVtbnM6IFt7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJwcm9qZWN0X2lkXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9qZWN0X2lkXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJwcm9qZWN0X3NsdWdcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3Rfc2x1Z1wiLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUHJvamVjdCBOYW1lXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9qZWN0X25hbWVcIixcclxuICAgICAgICAgICAgICAgIGZvcm1hdHRlcjogXCJsaW5rXCIsXHJcbiAgICAgICAgICAgICAgICBzb3J0ZXI6XCJzdHJpbmdcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBoZWFkZXJTb3J0U3RhcnRpbmdEaXI6XCJkZXNjXCIsXHJcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZXJQYXJhbXM6e1xyXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsRmllbGQ6IFwicHJvamVjdF9uYW1lXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBcIl9zZWxmXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdXJsOiBcIiNcIixcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogXCI0MCVcIixcclxuICAgICAgICAgICAgICAgIGNlbGxDbGljazogZnVuY3Rpb24oZSwgY2VsbCkgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvamVjdERhdGEgPSBjZWxsLmdldFJvdygpLmdldERhdGEoKTsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50UHJvamVjdCcsIEpTT04uc3RyaW5naWZ5KHByb2plY3REYXRhKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgJCgnI21fcHJvamVjdF9pZCcpLnZhbChwcm9qZWN0RGF0YS5wcm9qZWN0X2lkKTtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cucm91dGVyKCd0YWJsZXMnLCBwcm9qZWN0RGF0YS5wcm9qZWN0X2lkKTsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJQcm9qZWN0IElEXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9qZWN0X3JlZlwiLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMjAlXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlByb2R1Y3RzXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9kdWN0c1wiLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IDEyMCxcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlJldlwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwidmVyc2lvblwiLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IDgwLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiQ3JlYXRlZFwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwiY3JlYXRlZFwiLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMjAlXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGhlYWRlclNvcnQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZm9ybWF0dGVyOiB1dGlscy5pY29uQ29weSxcclxuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjEwJVwiLFxyXG4gICAgICAgICAgICAgICAgaG96QWxpZ246IFwiY2VudGVyXCIsXHJcbiAgICAgICAgICAgICAgICBjZWxsQ2xpY2s6IGZ1bmN0aW9uIChlLCBjZWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29weVByb2plY3QoY2VsbC5nZXRSb3coKS5nZXREYXRhKCkucHJvamVjdF9pZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGhlYWRlclNvcnQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZm9ybWF0dGVyOiB1dGlscy5pY29uWCxcclxuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjEwJVwiLFxyXG4gICAgICAgICAgICAgICAgaG96QWxpZ246IFwiY2VudGVyXCIsXHJcbiAgICAgICAgICAgICAgICBjZWxsQ2xpY2s6IGZ1bmN0aW9uIChlLCBjZWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlUHJvamVjdChjZWxsLmdldFJvdygpLmdldERhdGEoKS5wcm9qZWN0X2lkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgfSk7ICAgIFxyXG59XHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbi8vIFxyXG4vLyByZW5kZXJTaWRlYmFyXHJcbi8vIFxyXG5hc3luYyBmdW5jdGlvbiByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpIHtcclxuICAgIHByb2plY3RfaWQudG9TdHJpbmcoKTtcclxuICAgIGNvbnNvbGUubG9nKCdSZW5kZXJpbmcgc2lkZWJhciBmb3IgcHJvamVjdDonLCBwcm9qZWN0X2lkKTtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0U3RydWN0dXJlID0gYXdhaXQgZGIuZ2V0UHJvamVjdFN0cnVjdHVyZShwcm9qZWN0X2lkKTsgLy8gcHJvamVjdF9pZCAgICAgICAgICAgICAgXHJcbiAgICBjb25zdCBzaWRlbWVudUh0bWwgPSBhd2FpdCBzaWRlYmFyLmdlbmVyYXRlTmF2TWVudShwcm9qZWN0U3RydWN0dXJlKTsgICBcclxuXHJcbiAgICAkKCcubG9jYXRpb25zJykuaHRtbChzaWRlbWVudUh0bWwpO1xyXG5cclxuICAgIC8qIFByb2plY3QgQ2xpY2sgLSBsb2FkIHByb2plY3QgZGF0YSAqL1xyXG4gICAgJCgnYS5lZGl0LXByb2plY3QtbGluaycpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRQcm9qZWN0RGF0YShwcm9qZWN0X2lkKTtcclxuICAgIH0pOyAgICBcclxuXHJcblxyXG5cclxuICAgIC8qIFJvb20gQ2xpY2sgLSBsb2FkIHJvb20gZGF0YSAqL1xyXG4gICAgJCgnYS5yb29tLWxpbmsnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbURhdGEoJCh0aGlzKS5kYXRhKCdpZCcpKTtcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbU5vdGVzKCQodGhpcykuZGF0YSgnaWQnKSk7XHJcbiAgICAgICAgYXdhaXQgbG9hZFJvb21JbWFnZXMoJCh0aGlzKS5kYXRhKCdpZCcpKTtcclxuICAgIH0pOyAgICBcclxuXHJcbiAgICAvKiBBZGQgUm9vbSBDbGljayAtIGFkZCBhIG5ldyByb29tICovXHJcbiAgICAkKCdzcGFuLmFkZC1yb29tIGEnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zdCBmbG9vclV1aWQgPSAkKHRoaXMpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgY29uc3Qgcm9vbU5hbWUgPSBhd2FpdCBVSWtpdC5tb2RhbC5wcm9tcHQoJzxoND5FbnRlciB0aGUgcm9vbSBuYW1lPC9oND4nKTtcclxuICAgICAgICBpZiAocm9vbU5hbWUpIHtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbVV1aWQgPSBhd2FpdCBkYi5hZGRSb29tKGZsb29yVXVpZCwgcm9vbU5hbWUpO1xyXG4gICAgICAgICAgICBpZiAocm9vbVV1aWQpIHtcclxuICAgICAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignUm9vbSBhZGRlZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnQSByb29tIG9mIHRoZSBzYW1lIG5hbWUgYWxyZWFkeSBleGlzdHMuJywgc3RhdHVzOiAnZGFuZ2VyJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDI1MDAgfSk7ICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gICBcclxuICAgIH0pO1xyXG5cclxuICAgIC8qIEFkZCBGTG9vciBDbGljayAtIGFkZCBhIG5ldyBmbG9vciAqL1xyXG4gICAgJCgnc3Bhbi5hZGQtZmxvb3IgYScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nVXVpZCA9ICQodGhpcykuZGF0YSgnaWQnKTsgICBcclxuICAgICAgICBjb25zdCBmbG9vck5hbWUgPSBhd2FpdCBVSWtpdC5tb2RhbC5wcm9tcHQoJzxoND5FbnRlciB0aGUgZmxvb3IgbmFtZTwvaDQ+Jyk7XHJcbiAgICAgICAgaWYgKGZsb29yTmFtZSkge1xyXG4gICAgICAgICAgICBjb25zdCBmbG9vclV1aWQgPSBhd2FpdCBkYi5hZGRGbG9vcihidWlsZGluZ1V1aWQsIGZsb29yTmFtZSk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignRmxvb3IgYWRkZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgICAgIH0gICBcclxuICAgIH0pO1xyXG5cclxuICAgIC8qIEFkZCBidWlsZGluZyBDbGljayAtIGFkZCBhIG5ldyBidWlsZGluZyAqL1xyXG4gICAgJCgnc3Bhbi5hZGQtYnVpbGRpbmcgYScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgXHJcbiAgICAgICAgY29uc3QgbG9jYXRpb25VdWlkID0gJCh0aGlzKS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nTmFtZSA9IGF3YWl0IFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0PkVudGVyIHRoZSBidWlsZGluZyBuYW1lPC9oND4nKTtcclxuICAgICAgICBpZiAoYnVpbGRpbmdOYW1lKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkaW5nVXVpZCA9IGF3YWl0IGRiLmFkZEJ1aWxkaW5nKGxvY2F0aW9uVXVpZCwgYnVpbGRpbmdOYW1lKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ2J1aWxkaW5nIGFkZGVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyBcclxuICAgICAgICB9ICAgXHJcbiAgICB9KTsgICAgIFxyXG4gICAgXHJcbiAgICAkKCdsaS5yb29tLWl0ZW0gc3Bhbi5hY3Rpb24taWNvbi5yb29tJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgY29uc3QgbXNnID0gJzxoNCBjbGFzcz1cInJlZFwiPldhcm5pbmc8L2g0PjxwPlRoaXMgd2lsbCByZW1vdmUgdGhlIHJvb20gYW5kIDxiPkFMTCBwcm9kdWN0czwvYj4gaW4gdGhlIHJvb20hPC9wJztcclxuICAgICAgICBVSWtpdC5tb2RhbC5jb25maXJtKG1zZykudGhlbiggYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJvb21VdWlkID0gJCh0aGF0KS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmVtb3Zpbmcgcm9vbTonLCByb29tVXVpZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJvb21OYW1lID0gYXdhaXQgZGIucmVtb3ZlUm9vbShyb29tVXVpZCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1JlbW92ZWQgcm9vbTonLCByb29tTmFtZSk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignUm9vbSByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW5jZWxsZWQuJylcclxuICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgfSk7ICAgXHJcbiAgICBcclxuICAgICQoJ2xpLmZsb29yLWl0ZW0gc3Bhbi5hY3Rpb24taWNvbi5mbG9vcicpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xyXG4gICAgICAgIGNvbnN0IG1zZyA9ICc8aDQgY2xhc3M9XCJyZWRcIj5XYXJuaW5nPC9oND48cD5UaGlzIHdpbGwgcmVtb3ZlIHRoZSBmbG9vciwgcm9vbXMgYW5kIDxiPkFMTCBwcm9kdWN0czwvYj4gaW4gdGhvc2Ugcm9vbXMhPC9wJztcclxuICAgICAgICBVSWtpdC5tb2RhbC5jb25maXJtKG1zZykudGhlbiggYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZsb29yVXVpZCA9ICQodGhhdCkuZGF0YSgnaWQnKTsgICBcclxuICAgICAgICAgICAgY29uc3QgZmxvb3JOYW1lID0gYXdhaXQgZGIucmVtb3ZlRmxvb3IoZmxvb3JVdWlkKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ0Zsb29yIGFuZCByb29tcyByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW5jZWxsZWQuJylcclxuICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgfSk7ICAgICAgICAgIFxyXG5cclxuICAgICQoJ2xpLmJ1aWxkaW5nLWl0ZW0gc3Bhbi5hY3Rpb24taWNvbi5idWlsZGluZycpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xyXG4gICAgICAgIGNvbnN0IG1zZyA9ICc8aDQgY2xhc3M9XCJyZWRcIj5XYXJuaW5nPC9oND48cD5UaGlzIHdpbGwgcmVtb3ZlIHRoZSBidWlsZGluZywgYWxsIGZsb29yLCByb29tcyBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aG9zZSByb29tcyE8L3AnO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRpbmdVdWlkID0gJCh0aGF0KS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgICAgICBjb25zdCBidWlsZGluZ05hbWUgPSBhd2FpdCBkYi5yZW1vdmVCdWlsZGluZyhidWlsZGluZ1V1aWQpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignYnVpbGRpbmcsIGZsb29ycyBhbmQgcm9vbXMgcmVtb3ZlZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgICAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgLy8gcHJvamVjdF9pZCAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ2FuY2VsbGVkLicpXHJcbiAgICAgICAgfSk7ICAgICAgICBcclxuICAgIH0pOyAgXHJcbiAgICAgIFxyXG5cclxuICAgIC8vIHVwZGF0ZSBwcm9qZWN0IGRldGFpbHNcclxuICAgICQoJyNmb3JtLXVwZGF0ZS1wcm9qZWN0Jykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHByb2plY3RfaWQgPSAkKCcjbV9wcm9qZWN0X2lkJykudmFsKCk7XHJcbiAgICAgICAgYXdhaXQgdGFibGVzLnVwZGF0ZVByb2plY3RDbGljayhwcm9qZWN0X2lkKTtcclxuICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjZWRpdC1wcm9qZWN0LW1vZGFsJykuaGlkZSgpOyBcclxuICAgIH0pOyAgICAgXHJcblxyXG59XHJcbi8vIFxyXG4vLyBFbmQgcmVuZGVyU2lkZWJhclxyXG4vLyBcclxuXHJcblxyXG4vKiBcclxuKiBDcmVhdGUgUHJvamVjdFxyXG4qL1xyXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVQcm9qZWN0KCkge1xyXG4gICAgY29uc3QgcHJvamVjdF9uYW1lID0gJCgnI2Zvcm1fcHJvamVjdF9uYW1lJykudmFsKCk7XHJcbiAgICBjb25zdCBsb2NhdGlvbiA9ICQoJyNmb3JtX2xvY2F0aW9uJykudmFsKCk7XHJcbiAgICBjb25zdCBidWlsZGluZyA9ICQoJyNmb3JtX2J1aWxkaW5nJykudmFsKCk7XHJcbiAgICBjb25zdCBmbG9vciA9ICQoJyNmb3JtX2Zsb29yJykudmFsKCk7XHJcbiAgICBjb25zdCByb29tID0gJCgnI2Zvcm1fcm9vbScpLnZhbCgpO1xyXG4gICAgY29uc3QgcHJvamVjdF9pZCA9IGF3YWl0IGRiLmNyZWF0ZVByb2plY3QocHJvamVjdF9uYW1lLCBsb2NhdGlvbiwgYnVpbGRpbmcsIGZsb29yLCByb29tKTsgICAgXHJcbiAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyBcclxuICAgIGF3YWl0IHJlbmRlclByb2plY3RzVGFibGUoKTtcclxuICAgIFVJa2l0Lm1vZGFsKCcjY3JlYXRlLXByb2plY3QnKS5oaWRlKCk7XHJcbn1cclxuXHJcbi8qIFxyXG4qIENvcHkgUHJvamVjdFxyXG4qL1xyXG5hc3luYyBmdW5jdGlvbiBjb3B5UHJvamVjdChwcm9qZWN0X2lkKSB7XHJcbiAgICBjb25zdCBwcm9qZWN0RGF0YSA9IGF3YWl0IGRiLmdldFByb2plY3RCeVVVSUQocHJvamVjdF9pZCk7XHJcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGF3YWl0IFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0PkVudGVyIHRoZSBuZXcgcHJvamVjdCBuYW1lPC9oND4nLCBwcm9qZWN0RGF0YS5uYW1lICsgJyAtIENvcHknKTtcclxuICAgIGlmIChwcm9qZWN0TmFtZSkge1xyXG4gICAgICAgIGNvbnN0IG5ld1Byb2plY3RJZCA9IGF3YWl0IGRiLmNvcHlQcm9qZWN0KHByb2plY3RfaWQsIHByb2plY3ROYW1lKTtcclxuICAgICAgICBhd2FpdCByZW5kZXJQcm9qZWN0c1RhYmxlKCk7XHJcbiAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdQcm9qZWN0IGNvcGllZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZGVsZXRlUHJvamVjdChwcm9qZWN0X2lkKSB7XHJcbiAgICBjb25zdCBtc2cgPSAnPGg0IGNsYXNzPVwicmVkXCI+V2FybmluZzwvaDQ+PHA+VGhpcyB3aWxsIHJlbW92ZSB0aGUgcHJvamVjdCwgYWxsIGZsb29ycywgcm9vbXMgYW5kIDxiPkFMTCBwcm9kdWN0czwvYj4gaW4gdGhvc2Ugcm9vbXMhPC9wPic7XHJcbiAgICBVSWtpdC5tb2RhbC5jb25maXJtKG1zZykudGhlbiggYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgYXdhaXQgZGIucmVtb3ZlUHJvamVjdChwcm9qZWN0X2lkKTtcclxuICAgICAgICBhd2FpdCByZW5kZXJQcm9qZWN0c1RhYmxlKCk7XHJcbiAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTtcclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ1Byb2plY3QgcmVtb3ZlZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgIH0sIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQ2FuY2VsbGVkLicpXHJcbiAgICB9KTsgICAgICAgIFxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvamVjdERhdGEocHJvamVjdElkKSB7ICAgIFxyXG4gICAgJCgnI21fcHJvamVjdF9pZCcpLnZhbChwcm9qZWN0SWQpO1xyXG4gICAgaWYgKCFwcm9qZWN0SWQpIHJldHVybjtcclxuICAgIHByb2plY3RJZCA9IHByb2plY3RJZC50b1N0cmluZygpO1xyXG4gICAgY29uc3QgcHJvamVjdERhdGEgPSBhd2FpdCBkYi5nZXRQcm9qZWN0QnlVVUlEKHByb2plY3RJZCk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudFByb2plY3QnLCBKU09OLnN0cmluZ2lmeShwcm9qZWN0RGF0YSkpO1xyXG5cclxuICAgICQoJyNmb3JtX2VkaXRfcHJvamVjdF9uYW1lJykudmFsKHByb2plY3REYXRhLm5hbWUpO1xyXG4gICAgJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X2lkJykudmFsKHByb2plY3REYXRhLnByb2plY3RfaWQpO1xyXG4gICAgJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X2VuZ2luZWVyJykudmFsKHByb2plY3REYXRhLmVuZ2luZWVyKTsgICAgXHJcbiAgICAkKCcjZm9ybV9lZGl0X3Byb2plY3RfdmVyc2lvbicpLnZhbChwcm9qZWN0RGF0YS52ZXJzaW9uKTtcclxuXHJcbiAgICBVSWtpdC5tb2RhbCgnI2VkaXQtcHJvamVjdC1tb2RhbCcsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTtcclxufSAgICBcclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2FkUm9vbURhdGEocm9vbUlkKSB7XHJcbiAgICAkKCcjbV9yb29tX2lkJykudmFsKHJvb21JZCk7ICAgXHJcbiAgICBpZiAoIXJvb21JZCkgcmV0dXJuOyAgICAgXHJcbiAgICByb29tSWQgPSByb29tSWQudG9TdHJpbmcoKTtcclxuICAgIHJvb21JZCA9IFwiXCIgKyByb29tSWQ7XHJcbiAgICAvLyBnZXQgdGhlIG5hbWVzIGZvciB0aGUgbG9jYXRpb24sIGJ1aWxkaW5nLCBmbG9vciBhbmQgcm9vbSBiYXNlZCBvbiB0aGlzIHJvb21JZC5cclxuICAgIGNvbnN0IHJvb21NZXRhID0gYXdhaXQgZGIuZ2V0Um9vbU1ldGEocm9vbUlkKTsgICAgICAgIFxyXG4gICAgJCgnLm5hbWUubG9jYXRpb25fbmFtZScpLmh0bWwocm9vbU1ldGEubG9jYXRpb24ubmFtZSkuYXR0cignZGF0YS1pZCcsIHJvb21NZXRhLmxvY2F0aW9uLnV1aWQpO1xyXG4gICAgJCgnLm5hbWUuYnVpbGRpbmdfbmFtZScpLmh0bWwocm9vbU1ldGEuYnVpbGRpbmcubmFtZSkuYXR0cignZGF0YS1pZCcsIHJvb21NZXRhLmJ1aWxkaW5nLnV1aWQpO1xyXG4gICAgJCgnLm5hbWUuZmxvb3JfbmFtZScpLmh0bWwocm9vbU1ldGEuZmxvb3IubmFtZSkuYXR0cignZGF0YS1pZCcsIHJvb21NZXRhLmZsb29yLnV1aWQpO1xyXG4gICAgJCgnLm5hbWUucm9vbV9uYW1lJykuaHRtbChyb29tTWV0YS5yb29tLm5hbWUpLmF0dHIoJ2RhdGEtaWQnLCByb29tTWV0YS5yb29tLnV1aWQpO1xyXG5cclxuICAgICQoJyNyb29tX2hlaWdodCcpLnZhbChyb29tTWV0YS5yb29tLmhlaWdodCk7XHJcbiAgICAkKCcjcm9vbV93aWR0aCcpLnZhbChyb29tTWV0YS5yb29tLndpZHRoKTtcclxuICAgICQoJyNyb29tX2xlbmd0aCcpLnZhbChyb29tTWV0YS5yb29tLmxlbmd0aCk7XHJcblxyXG4gICAgYXdhaXQgdGFibGVzLnJlZnJlc2hUYWJsZURhdGEocm9vbUlkKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbG9hZFJvb21Ob3Rlcyhyb29tSWQpIHtcclxuICAgICQoJyNtX3Jvb21faWQnKS52YWwocm9vbUlkKTsgICBcclxuICAgIGlmICghcm9vbUlkKSByZXR1cm47ICAgICAgICAgXHJcbiAgICByb29tSWQgPSBcIlwiICsgcm9vbUlkO1xyXG4gICAgXHJcbiAgICBjb25zdCByb29tTm90ZXMgPSBhd2FpdCBkYi5nZXRSb29tTm90ZXMocm9vbUlkKTsgIFxyXG4gICAgLy8gaXRlcmF0ZSB0aGUgbm90ZXMgYW5kIGJ1aWxkIGh0bWwgdG8gZGlzcGxheSB0aGVtIGFzIGEgbGlzdC4gYWxzbyBhZGQgYSBkZWxldGUgaWNvbiB0byBlYWNoIG5vdGUgYW5kIHNob3QgdGhlIGRhdGUgY3JlYXRlZCBpbiBkZC1tbS15eXkgZm9ybWF0XHJcbiAgICBsZXQgbm90ZXNIdG1sID0gcm9vbU5vdGVzLm1hcChub3RlID0+IFxyXG4gICAgICAgIGA8bGkgY2xhc3M9XCJub3RlXCI+XHJcbiAgICAgICAgPHAgY2xhc3M9XCJub3RlLWRhdGVcIj4ke25ldyBEYXRlKG5vdGUuY3JlYXRlZF9vbikudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicpfTwvcD5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwibm90ZS1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgIDxzcGFuIGRhdGEtdXVpZD1cIiR7bm90ZS51dWlkfVwiIGNsYXNzPVwiaWNvbiBlZGl0X25vdGVcIiB1ay1pY29uPVwiaWNvbjogZmlsZS1lZGl0OyByYXRpbzogMVwiIHRpdGxlPVwiRWRpdFwiPjwvc3Bhbj4gICAgXHJcbiAgICAgICAgICAgIDxzcGFuIGRhdGEtdXVpZD1cIiR7bm90ZS51dWlkfVwiIGNsYXNzPVwiaWNvbiByZWQgZGVsZXRlX25vdGVcIiB1ay1pY29uPVwiaWNvbjogdHJhc2g7IHJhdGlvOiAxXCIgdGl0bGU9XCJEZWxldGVcIj48L3NwYW4+ICAgICAgICAgICAgXHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxwIGNsYXNzPVwibm90ZS10ZXh0ICR7bm90ZS51dWlkfVwiPiR7bm90ZS5ub3RlfTwvcD5cclxuICAgICAgICA8L2xpPmApLmpvaW4oJycpO1xyXG4gICAgJCgnI3Jvb21fbm90ZXMnKS5odG1sKG5vdGVzSHRtbCk7XHJcblxyXG5cclxuICAgICQoJy5ub3RlLWFjdGlvbnMgLmVkaXRfbm90ZScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IG5vdGVVdWlkID0gJCh0aGlzKS5kYXRhKCd1dWlkJyk7XHJcbiAgICAgICAgY29uc3Qgbm90ZVRleHQgPSAkKGAubm90ZS10ZXh0LiR7bm90ZVV1aWR9YCkudGV4dCgpO1xyXG4gICAgICAgICQoJyNlZGl0X25vdGVfdXVpZCcpLnZhbChub3RlVXVpZCk7XHJcbiAgICAgICAgJCgnI21vZGFsX2Zvcm1fbm90ZScpLnZhbChub3RlVGV4dCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNhZGQtbm90ZS1tb2RhbCcsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTsgICAgICAgXHJcbiAgICB9KTsgICAgICBcclxuXHJcblxyXG4gICAgJCgnLm5vdGUtYWN0aW9ucyAuZGVsZXRlX25vdGUnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zdCBub3RlVXVpZCA9ICQodGhpcykuZGF0YSgndXVpZCcpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0oJ0FyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgdGhpcyBub3RlPycpLnRoZW4oYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGRiLnJlbW92ZU5vdGVCeVVVSUQobm90ZVV1aWQpO1xyXG4gICAgICAgICAgICBhd2FpdCBsb2FkUm9vbU5vdGVzKCQoJyNtX3Jvb21faWQnKS52YWwoKSk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignTm90ZSBEZWxldGVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0RlbGV0ZSBub3RlIGNhbmNlbGxlZC4nKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pOyAgICBcclxuICAgIFxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2FkUm9vbUltYWdlcyhyb29tSWQpIHtcclxuICAgICQoJyNtX3Jvb21faWQnKS52YWwocm9vbUlkKTsgICBcclxuICAgIGlmICghcm9vbUlkKSByZXR1cm47ICAgICAgICAgXHJcbiAgICByb29tSWQgPSBcIlwiICsgcm9vbUlkO1xyXG5cclxuICAgIGF3YWl0IHRhYmxlcy5nZXRSb29tSW1hZ2VzKCk7XHJcbiAgIFxyXG59XHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZ2xvYmFsQmluZHMsXHJcbiAgICBob21lRnVuY3Rpb25zLFxyXG4gICAgdGFibGVzRnVuY3Rpb25zLFxyXG4gICAgc2NoZWR1bGVGdW5jdGlvbnMsXHJcbiAgICBhY2NvdW50RnVuY3Rpb25zIFxyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGluc3RhbmNlT2ZBbnkgPSAob2JqZWN0LCBjb25zdHJ1Y3RvcnMpID0+IGNvbnN0cnVjdG9ycy5zb21lKChjKSA9PiBvYmplY3QgaW5zdGFuY2VvZiBjKTtcblxubGV0IGlkYlByb3h5YWJsZVR5cGVzO1xubGV0IGN1cnNvckFkdmFuY2VNZXRob2RzO1xuLy8gVGhpcyBpcyBhIGZ1bmN0aW9uIHRvIHByZXZlbnQgaXQgdGhyb3dpbmcgdXAgaW4gbm9kZSBlbnZpcm9ubWVudHMuXG5mdW5jdGlvbiBnZXRJZGJQcm94eWFibGVUeXBlcygpIHtcbiAgICByZXR1cm4gKGlkYlByb3h5YWJsZVR5cGVzIHx8XG4gICAgICAgIChpZGJQcm94eWFibGVUeXBlcyA9IFtcbiAgICAgICAgICAgIElEQkRhdGFiYXNlLFxuICAgICAgICAgICAgSURCT2JqZWN0U3RvcmUsXG4gICAgICAgICAgICBJREJJbmRleCxcbiAgICAgICAgICAgIElEQkN1cnNvcixcbiAgICAgICAgICAgIElEQlRyYW5zYWN0aW9uLFxuICAgICAgICBdKSk7XG59XG4vLyBUaGlzIGlzIGEgZnVuY3Rpb24gdG8gcHJldmVudCBpdCB0aHJvd2luZyB1cCBpbiBub2RlIGVudmlyb25tZW50cy5cbmZ1bmN0aW9uIGdldEN1cnNvckFkdmFuY2VNZXRob2RzKCkge1xuICAgIHJldHVybiAoY3Vyc29yQWR2YW5jZU1ldGhvZHMgfHxcbiAgICAgICAgKGN1cnNvckFkdmFuY2VNZXRob2RzID0gW1xuICAgICAgICAgICAgSURCQ3Vyc29yLnByb3RvdHlwZS5hZHZhbmNlLFxuICAgICAgICAgICAgSURCQ3Vyc29yLnByb3RvdHlwZS5jb250aW51ZSxcbiAgICAgICAgICAgIElEQkN1cnNvci5wcm90b3R5cGUuY29udGludWVQcmltYXJ5S2V5LFxuICAgICAgICBdKSk7XG59XG5jb25zdCB0cmFuc2FjdGlvbkRvbmVNYXAgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgdHJhbnNmb3JtQ2FjaGUgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgcmV2ZXJzZVRyYW5zZm9ybUNhY2hlID0gbmV3IFdlYWtNYXAoKTtcbmZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkge1xuICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHVubGlzdGVuID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVxdWVzdC5yZW1vdmVFdmVudExpc3RlbmVyKCdzdWNjZXNzJywgc3VjY2Vzcyk7XG4gICAgICAgICAgICByZXF1ZXN0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBzdWNjZXNzID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZSh3cmFwKHJlcXVlc3QucmVzdWx0KSk7XG4gICAgICAgICAgICB1bmxpc3RlbigpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBlcnJvciA9ICgpID0+IHtcbiAgICAgICAgICAgIHJlamVjdChyZXF1ZXN0LmVycm9yKTtcbiAgICAgICAgICAgIHVubGlzdGVuKCk7XG4gICAgICAgIH07XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignc3VjY2VzcycsIHN1Y2Nlc3MpO1xuICAgICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3IpO1xuICAgIH0pO1xuICAgIC8vIFRoaXMgbWFwcGluZyBleGlzdHMgaW4gcmV2ZXJzZVRyYW5zZm9ybUNhY2hlIGJ1dCBkb2Vzbid0IGV4aXN0IGluIHRyYW5zZm9ybUNhY2hlLiBUaGlzXG4gICAgLy8gaXMgYmVjYXVzZSB3ZSBjcmVhdGUgbWFueSBwcm9taXNlcyBmcm9tIGEgc2luZ2xlIElEQlJlcXVlc3QuXG4gICAgcmV2ZXJzZVRyYW5zZm9ybUNhY2hlLnNldChwcm9taXNlLCByZXF1ZXN0KTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbn1cbmZ1bmN0aW9uIGNhY2hlRG9uZVByb21pc2VGb3JUcmFuc2FjdGlvbih0eCkge1xuICAgIC8vIEVhcmx5IGJhaWwgaWYgd2UndmUgYWxyZWFkeSBjcmVhdGVkIGEgZG9uZSBwcm9taXNlIGZvciB0aGlzIHRyYW5zYWN0aW9uLlxuICAgIGlmICh0cmFuc2FjdGlvbkRvbmVNYXAuaGFzKHR4KSlcbiAgICAgICAgcmV0dXJuO1xuICAgIGNvbnN0IGRvbmUgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHVubGlzdGVuID0gKCkgPT4ge1xuICAgICAgICAgICAgdHgucmVtb3ZlRXZlbnRMaXN0ZW5lcignY29tcGxldGUnLCBjb21wbGV0ZSk7XG4gICAgICAgICAgICB0eC5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICAgIHR4LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgZXJyb3IpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBjb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIHVubGlzdGVuKCk7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KHR4LmVycm9yIHx8IG5ldyBET01FeGNlcHRpb24oJ0Fib3J0RXJyb3InLCAnQWJvcnRFcnJvcicpKTtcbiAgICAgICAgICAgIHVubGlzdGVuKCk7XG4gICAgICAgIH07XG4gICAgICAgIHR4LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbXBsZXRlJywgY29tcGxldGUpO1xuICAgICAgICB0eC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgdHguYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBlcnJvcik7XG4gICAgfSk7XG4gICAgLy8gQ2FjaGUgaXQgZm9yIGxhdGVyIHJldHJpZXZhbC5cbiAgICB0cmFuc2FjdGlvbkRvbmVNYXAuc2V0KHR4LCBkb25lKTtcbn1cbmxldCBpZGJQcm94eVRyYXBzID0ge1xuICAgIGdldCh0YXJnZXQsIHByb3AsIHJlY2VpdmVyKSB7XG4gICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBJREJUcmFuc2FjdGlvbikge1xuICAgICAgICAgICAgLy8gU3BlY2lhbCBoYW5kbGluZyBmb3IgdHJhbnNhY3Rpb24uZG9uZS5cbiAgICAgICAgICAgIGlmIChwcm9wID09PSAnZG9uZScpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyYW5zYWN0aW9uRG9uZU1hcC5nZXQodGFyZ2V0KTtcbiAgICAgICAgICAgIC8vIE1ha2UgdHguc3RvcmUgcmV0dXJuIHRoZSBvbmx5IHN0b3JlIGluIHRoZSB0cmFuc2FjdGlvbiwgb3IgdW5kZWZpbmVkIGlmIHRoZXJlIGFyZSBtYW55LlxuICAgICAgICAgICAgaWYgKHByb3AgPT09ICdzdG9yZScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVjZWl2ZXIub2JqZWN0U3RvcmVOYW1lc1sxXVxuICAgICAgICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICA6IHJlY2VpdmVyLm9iamVjdFN0b3JlKHJlY2VpdmVyLm9iamVjdFN0b3JlTmFtZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEVsc2UgdHJhbnNmb3JtIHdoYXRldmVyIHdlIGdldCBiYWNrLlxuICAgICAgICByZXR1cm4gd3JhcCh0YXJnZXRbcHJvcF0pO1xuICAgIH0sXG4gICAgc2V0KHRhcmdldCwgcHJvcCwgdmFsdWUpIHtcbiAgICAgICAgdGFyZ2V0W3Byb3BdID0gdmFsdWU7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgaGFzKHRhcmdldCwgcHJvcCkge1xuICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgSURCVHJhbnNhY3Rpb24gJiZcbiAgICAgICAgICAgIChwcm9wID09PSAnZG9uZScgfHwgcHJvcCA9PT0gJ3N0b3JlJykpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm9wIGluIHRhcmdldDtcbiAgICB9LFxufTtcbmZ1bmN0aW9uIHJlcGxhY2VUcmFwcyhjYWxsYmFjaykge1xuICAgIGlkYlByb3h5VHJhcHMgPSBjYWxsYmFjayhpZGJQcm94eVRyYXBzKTtcbn1cbmZ1bmN0aW9uIHdyYXBGdW5jdGlvbihmdW5jKSB7XG4gICAgLy8gRHVlIHRvIGV4cGVjdGVkIG9iamVjdCBlcXVhbGl0eSAod2hpY2ggaXMgZW5mb3JjZWQgYnkgdGhlIGNhY2hpbmcgaW4gYHdyYXBgKSwgd2VcbiAgICAvLyBvbmx5IGNyZWF0ZSBvbmUgbmV3IGZ1bmMgcGVyIGZ1bmMuXG4gICAgLy8gQ3Vyc29yIG1ldGhvZHMgYXJlIHNwZWNpYWwsIGFzIHRoZSBiZWhhdmlvdXIgaXMgYSBsaXR0bGUgbW9yZSBkaWZmZXJlbnQgdG8gc3RhbmRhcmQgSURCLiBJblxuICAgIC8vIElEQiwgeW91IGFkdmFuY2UgdGhlIGN1cnNvciBhbmQgd2FpdCBmb3IgYSBuZXcgJ3N1Y2Nlc3MnIG9uIHRoZSBJREJSZXF1ZXN0IHRoYXQgZ2F2ZSB5b3UgdGhlXG4gICAgLy8gY3Vyc29yLiBJdCdzIGtpbmRhIGxpa2UgYSBwcm9taXNlIHRoYXQgY2FuIHJlc29sdmUgd2l0aCBtYW55IHZhbHVlcy4gVGhhdCBkb2Vzbid0IG1ha2Ugc2Vuc2VcbiAgICAvLyB3aXRoIHJlYWwgcHJvbWlzZXMsIHNvIGVhY2ggYWR2YW5jZSBtZXRob2RzIHJldHVybnMgYSBuZXcgcHJvbWlzZSBmb3IgdGhlIGN1cnNvciBvYmplY3QsIG9yXG4gICAgLy8gdW5kZWZpbmVkIGlmIHRoZSBlbmQgb2YgdGhlIGN1cnNvciBoYXMgYmVlbiByZWFjaGVkLlxuICAgIGlmIChnZXRDdXJzb3JBZHZhbmNlTWV0aG9kcygpLmluY2x1ZGVzKGZ1bmMpKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICAgICAgLy8gQ2FsbGluZyB0aGUgb3JpZ2luYWwgZnVuY3Rpb24gd2l0aCB0aGUgcHJveHkgYXMgJ3RoaXMnIGNhdXNlcyBJTExFR0FMIElOVk9DQVRJT04sIHNvIHdlIHVzZVxuICAgICAgICAgICAgLy8gdGhlIG9yaWdpbmFsIG9iamVjdC5cbiAgICAgICAgICAgIGZ1bmMuYXBwbHkodW53cmFwKHRoaXMpLCBhcmdzKTtcbiAgICAgICAgICAgIHJldHVybiB3cmFwKHRoaXMucmVxdWVzdCk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICAvLyBDYWxsaW5nIHRoZSBvcmlnaW5hbCBmdW5jdGlvbiB3aXRoIHRoZSBwcm94eSBhcyAndGhpcycgY2F1c2VzIElMTEVHQUwgSU5WT0NBVElPTiwgc28gd2UgdXNlXG4gICAgICAgIC8vIHRoZSBvcmlnaW5hbCBvYmplY3QuXG4gICAgICAgIHJldHVybiB3cmFwKGZ1bmMuYXBwbHkodW53cmFwKHRoaXMpLCBhcmdzKSk7XG4gICAgfTtcbn1cbmZ1bmN0aW9uIHRyYW5zZm9ybUNhY2hhYmxlVmFsdWUodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKVxuICAgICAgICByZXR1cm4gd3JhcEZ1bmN0aW9uKHZhbHVlKTtcbiAgICAvLyBUaGlzIGRvZXNuJ3QgcmV0dXJuLCBpdCBqdXN0IGNyZWF0ZXMgYSAnZG9uZScgcHJvbWlzZSBmb3IgdGhlIHRyYW5zYWN0aW9uLFxuICAgIC8vIHdoaWNoIGlzIGxhdGVyIHJldHVybmVkIGZvciB0cmFuc2FjdGlvbi5kb25lIChzZWUgaWRiT2JqZWN0SGFuZGxlcikuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSURCVHJhbnNhY3Rpb24pXG4gICAgICAgIGNhY2hlRG9uZVByb21pc2VGb3JUcmFuc2FjdGlvbih2YWx1ZSk7XG4gICAgaWYgKGluc3RhbmNlT2ZBbnkodmFsdWUsIGdldElkYlByb3h5YWJsZVR5cGVzKCkpKVxuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHZhbHVlLCBpZGJQcm94eVRyYXBzKTtcbiAgICAvLyBSZXR1cm4gdGhlIHNhbWUgdmFsdWUgYmFjayBpZiB3ZSdyZSBub3QgZ29pbmcgdG8gdHJhbnNmb3JtIGl0LlxuICAgIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHdyYXAodmFsdWUpIHtcbiAgICAvLyBXZSBzb21ldGltZXMgZ2VuZXJhdGUgbXVsdGlwbGUgcHJvbWlzZXMgZnJvbSBhIHNpbmdsZSBJREJSZXF1ZXN0IChlZyB3aGVuIGN1cnNvcmluZyksIGJlY2F1c2VcbiAgICAvLyBJREIgaXMgd2VpcmQgYW5kIGEgc2luZ2xlIElEQlJlcXVlc3QgY2FuIHlpZWxkIG1hbnkgcmVzcG9uc2VzLCBzbyB0aGVzZSBjYW4ndCBiZSBjYWNoZWQuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSURCUmVxdWVzdClcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3QodmFsdWUpO1xuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgdHJhbnNmb3JtZWQgdGhpcyB2YWx1ZSBiZWZvcmUsIHJldXNlIHRoZSB0cmFuc2Zvcm1lZCB2YWx1ZS5cbiAgICAvLyBUaGlzIGlzIGZhc3RlciwgYnV0IGl0IGFsc28gcHJvdmlkZXMgb2JqZWN0IGVxdWFsaXR5LlxuICAgIGlmICh0cmFuc2Zvcm1DYWNoZS5oYXModmFsdWUpKVxuICAgICAgICByZXR1cm4gdHJhbnNmb3JtQ2FjaGUuZ2V0KHZhbHVlKTtcbiAgICBjb25zdCBuZXdWYWx1ZSA9IHRyYW5zZm9ybUNhY2hhYmxlVmFsdWUodmFsdWUpO1xuICAgIC8vIE5vdCBhbGwgdHlwZXMgYXJlIHRyYW5zZm9ybWVkLlxuICAgIC8vIFRoZXNlIG1heSBiZSBwcmltaXRpdmUgdHlwZXMsIHNvIHRoZXkgY2FuJ3QgYmUgV2Vha01hcCBrZXlzLlxuICAgIGlmIChuZXdWYWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgdHJhbnNmb3JtQ2FjaGUuc2V0KHZhbHVlLCBuZXdWYWx1ZSk7XG4gICAgICAgIHJldmVyc2VUcmFuc2Zvcm1DYWNoZS5zZXQobmV3VmFsdWUsIHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1ZhbHVlO1xufVxuY29uc3QgdW53cmFwID0gKHZhbHVlKSA9PiByZXZlcnNlVHJhbnNmb3JtQ2FjaGUuZ2V0KHZhbHVlKTtcblxuLyoqXG4gKiBPcGVuIGEgZGF0YWJhc2UuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgZGF0YWJhc2UuXG4gKiBAcGFyYW0gdmVyc2lvbiBTY2hlbWEgdmVyc2lvbi5cbiAqIEBwYXJhbSBjYWxsYmFja3MgQWRkaXRpb25hbCBjYWxsYmFja3MuXG4gKi9cbmZ1bmN0aW9uIG9wZW5EQihuYW1lLCB2ZXJzaW9uLCB7IGJsb2NrZWQsIHVwZ3JhZGUsIGJsb2NraW5nLCB0ZXJtaW5hdGVkIH0gPSB7fSkge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBpbmRleGVkREIub3BlbihuYW1lLCB2ZXJzaW9uKTtcbiAgICBjb25zdCBvcGVuUHJvbWlzZSA9IHdyYXAocmVxdWVzdCk7XG4gICAgaWYgKHVwZ3JhZGUpIHtcbiAgICAgICAgcmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCd1cGdyYWRlbmVlZGVkJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB1cGdyYWRlKHdyYXAocmVxdWVzdC5yZXN1bHQpLCBldmVudC5vbGRWZXJzaW9uLCBldmVudC5uZXdWZXJzaW9uLCB3cmFwKHJlcXVlc3QudHJhbnNhY3Rpb24pLCBldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoYmxvY2tlZCkge1xuICAgICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Jsb2NrZWQnLCAoZXZlbnQpID0+IGJsb2NrZWQoXG4gICAgICAgIC8vIENhc3RpbmcgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC1ET00tbGliLWdlbmVyYXRvci9wdWxsLzE0MDVcbiAgICAgICAgZXZlbnQub2xkVmVyc2lvbiwgZXZlbnQubmV3VmVyc2lvbiwgZXZlbnQpKTtcbiAgICB9XG4gICAgb3BlblByb21pc2VcbiAgICAgICAgLnRoZW4oKGRiKSA9PiB7XG4gICAgICAgIGlmICh0ZXJtaW5hdGVkKVxuICAgICAgICAgICAgZGIuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCAoKSA9PiB0ZXJtaW5hdGVkKCkpO1xuICAgICAgICBpZiAoYmxvY2tpbmcpIHtcbiAgICAgICAgICAgIGRiLmFkZEV2ZW50TGlzdGVuZXIoJ3ZlcnNpb25jaGFuZ2UnLCAoZXZlbnQpID0+IGJsb2NraW5nKGV2ZW50Lm9sZFZlcnNpb24sIGV2ZW50Lm5ld1ZlcnNpb24sIGV2ZW50KSk7XG4gICAgICAgIH1cbiAgICB9KVxuICAgICAgICAuY2F0Y2goKCkgPT4geyB9KTtcbiAgICByZXR1cm4gb3BlblByb21pc2U7XG59XG4vKipcbiAqIERlbGV0ZSBhIGRhdGFiYXNlLlxuICpcbiAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGRhdGFiYXNlLlxuICovXG5mdW5jdGlvbiBkZWxldGVEQihuYW1lLCB7IGJsb2NrZWQgfSA9IHt9KSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5kZWxldGVEYXRhYmFzZShuYW1lKTtcbiAgICBpZiAoYmxvY2tlZCkge1xuICAgICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Jsb2NrZWQnLCAoZXZlbnQpID0+IGJsb2NrZWQoXG4gICAgICAgIC8vIENhc3RpbmcgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC1ET00tbGliLWdlbmVyYXRvci9wdWxsLzE0MDVcbiAgICAgICAgZXZlbnQub2xkVmVyc2lvbiwgZXZlbnQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXAocmVxdWVzdCkudGhlbigoKSA9PiB1bmRlZmluZWQpO1xufVxuXG5jb25zdCByZWFkTWV0aG9kcyA9IFsnZ2V0JywgJ2dldEtleScsICdnZXRBbGwnLCAnZ2V0QWxsS2V5cycsICdjb3VudCddO1xuY29uc3Qgd3JpdGVNZXRob2RzID0gWydwdXQnLCAnYWRkJywgJ2RlbGV0ZScsICdjbGVhciddO1xuY29uc3QgY2FjaGVkTWV0aG9kcyA9IG5ldyBNYXAoKTtcbmZ1bmN0aW9uIGdldE1ldGhvZCh0YXJnZXQsIHByb3ApIHtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBJREJEYXRhYmFzZSAmJlxuICAgICAgICAhKHByb3AgaW4gdGFyZ2V0KSAmJlxuICAgICAgICB0eXBlb2YgcHJvcCA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGNhY2hlZE1ldGhvZHMuZ2V0KHByb3ApKVxuICAgICAgICByZXR1cm4gY2FjaGVkTWV0aG9kcy5nZXQocHJvcCk7XG4gICAgY29uc3QgdGFyZ2V0RnVuY05hbWUgPSBwcm9wLnJlcGxhY2UoL0Zyb21JbmRleCQvLCAnJyk7XG4gICAgY29uc3QgdXNlSW5kZXggPSBwcm9wICE9PSB0YXJnZXRGdW5jTmFtZTtcbiAgICBjb25zdCBpc1dyaXRlID0gd3JpdGVNZXRob2RzLmluY2x1ZGVzKHRhcmdldEZ1bmNOYW1lKTtcbiAgICBpZiAoXG4gICAgLy8gQmFpbCBpZiB0aGUgdGFyZ2V0IGRvZXNuJ3QgZXhpc3Qgb24gdGhlIHRhcmdldC4gRWcsIGdldEFsbCBpc24ndCBpbiBFZGdlLlxuICAgICEodGFyZ2V0RnVuY05hbWUgaW4gKHVzZUluZGV4ID8gSURCSW5kZXggOiBJREJPYmplY3RTdG9yZSkucHJvdG90eXBlKSB8fFxuICAgICAgICAhKGlzV3JpdGUgfHwgcmVhZE1ldGhvZHMuaW5jbHVkZXModGFyZ2V0RnVuY05hbWUpKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9IGFzeW5jIGZ1bmN0aW9uIChzdG9yZU5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgICAgLy8gaXNXcml0ZSA/ICdyZWFkd3JpdGUnIDogdW5kZWZpbmVkIGd6aXBwcyBiZXR0ZXIsIGJ1dCBmYWlscyBpbiBFZGdlIDooXG4gICAgICAgIGNvbnN0IHR4ID0gdGhpcy50cmFuc2FjdGlvbihzdG9yZU5hbWUsIGlzV3JpdGUgPyAncmVhZHdyaXRlJyA6ICdyZWFkb25seScpO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gdHguc3RvcmU7XG4gICAgICAgIGlmICh1c2VJbmRleClcbiAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5pbmRleChhcmdzLnNoaWZ0KCkpO1xuICAgICAgICAvLyBNdXN0IHJlamVjdCBpZiBvcCByZWplY3RzLlxuICAgICAgICAvLyBJZiBpdCdzIGEgd3JpdGUgb3BlcmF0aW9uLCBtdXN0IHJlamVjdCBpZiB0eC5kb25lIHJlamVjdHMuXG4gICAgICAgIC8vIE11c3QgcmVqZWN0IHdpdGggb3AgcmVqZWN0aW9uIGZpcnN0LlxuICAgICAgICAvLyBNdXN0IHJlc29sdmUgd2l0aCBvcCB2YWx1ZS5cbiAgICAgICAgLy8gTXVzdCBoYW5kbGUgYm90aCBwcm9taXNlcyAobm8gdW5oYW5kbGVkIHJlamVjdGlvbnMpXG4gICAgICAgIHJldHVybiAoYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgdGFyZ2V0W3RhcmdldEZ1bmNOYW1lXSguLi5hcmdzKSxcbiAgICAgICAgICAgIGlzV3JpdGUgJiYgdHguZG9uZSxcbiAgICAgICAgXSkpWzBdO1xuICAgIH07XG4gICAgY2FjaGVkTWV0aG9kcy5zZXQocHJvcCwgbWV0aG9kKTtcbiAgICByZXR1cm4gbWV0aG9kO1xufVxucmVwbGFjZVRyYXBzKChvbGRUcmFwcykgPT4gKHtcbiAgICAuLi5vbGRUcmFwcyxcbiAgICBnZXQ6ICh0YXJnZXQsIHByb3AsIHJlY2VpdmVyKSA9PiBnZXRNZXRob2QodGFyZ2V0LCBwcm9wKSB8fCBvbGRUcmFwcy5nZXQodGFyZ2V0LCBwcm9wLCByZWNlaXZlciksXG4gICAgaGFzOiAodGFyZ2V0LCBwcm9wKSA9PiAhIWdldE1ldGhvZCh0YXJnZXQsIHByb3ApIHx8IG9sZFRyYXBzLmhhcyh0YXJnZXQsIHByb3ApLFxufSkpO1xuXG5jb25zdCBhZHZhbmNlTWV0aG9kUHJvcHMgPSBbJ2NvbnRpbnVlJywgJ2NvbnRpbnVlUHJpbWFyeUtleScsICdhZHZhbmNlJ107XG5jb25zdCBtZXRob2RNYXAgPSB7fTtcbmNvbnN0IGFkdmFuY2VSZXN1bHRzID0gbmV3IFdlYWtNYXAoKTtcbmNvbnN0IGl0dHJQcm94aWVkQ3Vyc29yVG9PcmlnaW5hbFByb3h5ID0gbmV3IFdlYWtNYXAoKTtcbmNvbnN0IGN1cnNvckl0ZXJhdG9yVHJhcHMgPSB7XG4gICAgZ2V0KHRhcmdldCwgcHJvcCkge1xuICAgICAgICBpZiAoIWFkdmFuY2VNZXRob2RQcm9wcy5pbmNsdWRlcyhwcm9wKSlcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXRbcHJvcF07XG4gICAgICAgIGxldCBjYWNoZWRGdW5jID0gbWV0aG9kTWFwW3Byb3BdO1xuICAgICAgICBpZiAoIWNhY2hlZEZ1bmMpIHtcbiAgICAgICAgICAgIGNhY2hlZEZ1bmMgPSBtZXRob2RNYXBbcHJvcF0gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICAgICAgICAgIGFkdmFuY2VSZXN1bHRzLnNldCh0aGlzLCBpdHRyUHJveGllZEN1cnNvclRvT3JpZ2luYWxQcm94eS5nZXQodGhpcylbcHJvcF0oLi4uYXJncykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FjaGVkRnVuYztcbiAgICB9LFxufTtcbmFzeW5jIGZ1bmN0aW9uKiBpdGVyYXRlKC4uLmFyZ3MpIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdGhpcy1hc3NpZ25tZW50XG4gICAgbGV0IGN1cnNvciA9IHRoaXM7XG4gICAgaWYgKCEoY3Vyc29yIGluc3RhbmNlb2YgSURCQ3Vyc29yKSkge1xuICAgICAgICBjdXJzb3IgPSBhd2FpdCBjdXJzb3Iub3BlbkN1cnNvciguLi5hcmdzKTtcbiAgICB9XG4gICAgaWYgKCFjdXJzb3IpXG4gICAgICAgIHJldHVybjtcbiAgICBjdXJzb3IgPSBjdXJzb3I7XG4gICAgY29uc3QgcHJveGllZEN1cnNvciA9IG5ldyBQcm94eShjdXJzb3IsIGN1cnNvckl0ZXJhdG9yVHJhcHMpO1xuICAgIGl0dHJQcm94aWVkQ3Vyc29yVG9PcmlnaW5hbFByb3h5LnNldChwcm94aWVkQ3Vyc29yLCBjdXJzb3IpO1xuICAgIC8vIE1hcCB0aGlzIGRvdWJsZS1wcm94eSBiYWNrIHRvIHRoZSBvcmlnaW5hbCwgc28gb3RoZXIgY3Vyc29yIG1ldGhvZHMgd29yay5cbiAgICByZXZlcnNlVHJhbnNmb3JtQ2FjaGUuc2V0KHByb3hpZWRDdXJzb3IsIHVud3JhcChjdXJzb3IpKTtcbiAgICB3aGlsZSAoY3Vyc29yKSB7XG4gICAgICAgIHlpZWxkIHByb3hpZWRDdXJzb3I7XG4gICAgICAgIC8vIElmIG9uZSBvZiB0aGUgYWR2YW5jaW5nIG1ldGhvZHMgd2FzIG5vdCBjYWxsZWQsIGNhbGwgY29udGludWUoKS5cbiAgICAgICAgY3Vyc29yID0gYXdhaXQgKGFkdmFuY2VSZXN1bHRzLmdldChwcm94aWVkQ3Vyc29yKSB8fCBjdXJzb3IuY29udGludWUoKSk7XG4gICAgICAgIGFkdmFuY2VSZXN1bHRzLmRlbGV0ZShwcm94aWVkQ3Vyc29yKTtcbiAgICB9XG59XG5mdW5jdGlvbiBpc0l0ZXJhdG9yUHJvcCh0YXJnZXQsIHByb3ApIHtcbiAgICByZXR1cm4gKChwcm9wID09PSBTeW1ib2wuYXN5bmNJdGVyYXRvciAmJlxuICAgICAgICBpbnN0YW5jZU9mQW55KHRhcmdldCwgW0lEQkluZGV4LCBJREJPYmplY3RTdG9yZSwgSURCQ3Vyc29yXSkpIHx8XG4gICAgICAgIChwcm9wID09PSAnaXRlcmF0ZScgJiYgaW5zdGFuY2VPZkFueSh0YXJnZXQsIFtJREJJbmRleCwgSURCT2JqZWN0U3RvcmVdKSkpO1xufVxucmVwbGFjZVRyYXBzKChvbGRUcmFwcykgPT4gKHtcbiAgICAuLi5vbGRUcmFwcyxcbiAgICBnZXQodGFyZ2V0LCBwcm9wLCByZWNlaXZlcikge1xuICAgICAgICBpZiAoaXNJdGVyYXRvclByb3AodGFyZ2V0LCBwcm9wKSlcbiAgICAgICAgICAgIHJldHVybiBpdGVyYXRlO1xuICAgICAgICByZXR1cm4gb2xkVHJhcHMuZ2V0KHRhcmdldCwgcHJvcCwgcmVjZWl2ZXIpO1xuICAgIH0sXG4gICAgaGFzKHRhcmdldCwgcHJvcCkge1xuICAgICAgICByZXR1cm4gaXNJdGVyYXRvclByb3AodGFyZ2V0LCBwcm9wKSB8fCBvbGRUcmFwcy5oYXModGFyZ2V0LCBwcm9wKTtcbiAgICB9LFxufSkpO1xuXG5leHBvcnRzLmRlbGV0ZURCID0gZGVsZXRlREI7XG5leHBvcnRzLm9wZW5EQiA9IG9wZW5EQjtcbmV4cG9ydHMudW53cmFwID0gdW53cmFwO1xuZXhwb3J0cy53cmFwID0gd3JhcDtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcbiAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKGZhY3RvcnkpIDpcbiAgKGdsb2JhbCA9IGdsb2JhbCB8fCBzZWxmLCBnbG9iYWwuTXVzdGFjaGUgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbiAgLyohXG4gICAqIG11c3RhY2hlLmpzIC0gTG9naWMtbGVzcyB7e211c3RhY2hlfX0gdGVtcGxhdGVzIHdpdGggSmF2YVNjcmlwdFxuICAgKiBodHRwOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzXG4gICAqL1xuXG4gIHZhciBvYmplY3RUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiBpc0FycmF5UG9seWZpbGwgKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3RUb1N0cmluZy5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNGdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT09ICdmdW5jdGlvbic7XG4gIH1cblxuICAvKipcbiAgICogTW9yZSBjb3JyZWN0IHR5cGVvZiBzdHJpbmcgaGFuZGxpbmcgYXJyYXlcbiAgICogd2hpY2ggbm9ybWFsbHkgcmV0dXJucyB0eXBlb2YgJ29iamVjdCdcbiAgICovXG4gIGZ1bmN0aW9uIHR5cGVTdHIgKG9iaikge1xuICAgIHJldHVybiBpc0FycmF5KG9iaikgPyAnYXJyYXknIDogdHlwZW9mIG9iajtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cCAoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bXFwtXFxbXFxde30oKSorPy4sXFxcXFxcXiR8I1xcc10vZywgJ1xcXFwkJicpO1xuICB9XG5cbiAgLyoqXG4gICAqIE51bGwgc2FmZSB3YXkgb2YgY2hlY2tpbmcgd2hldGhlciBvciBub3QgYW4gb2JqZWN0LFxuICAgKiBpbmNsdWRpbmcgaXRzIHByb3RvdHlwZSwgaGFzIGEgZ2l2ZW4gcHJvcGVydHlcbiAgICovXG4gIGZ1bmN0aW9uIGhhc1Byb3BlcnR5IChvYmosIHByb3BOYW1lKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIChwcm9wTmFtZSBpbiBvYmopO1xuICB9XG5cbiAgLyoqXG4gICAqIFNhZmUgd2F5IG9mIGRldGVjdGluZyB3aGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gdGhpbmcgaXMgYSBwcmltaXRpdmUgYW5kXG4gICAqIHdoZXRoZXIgaXQgaGFzIHRoZSBnaXZlbiBwcm9wZXJ0eVxuICAgKi9cbiAgZnVuY3Rpb24gcHJpbWl0aXZlSGFzT3duUHJvcGVydHkgKHByaW1pdGl2ZSwgcHJvcE5hbWUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgcHJpbWl0aXZlICE9IG51bGxcbiAgICAgICYmIHR5cGVvZiBwcmltaXRpdmUgIT09ICdvYmplY3QnXG4gICAgICAmJiBwcmltaXRpdmUuaGFzT3duUHJvcGVydHlcbiAgICAgICYmIHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSlcbiAgICApO1xuICB9XG5cbiAgLy8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9DT1VDSERCLTU3N1xuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4OVxuICB2YXIgcmVnRXhwVGVzdCA9IFJlZ0V4cC5wcm90b3R5cGUudGVzdDtcbiAgZnVuY3Rpb24gdGVzdFJlZ0V4cCAocmUsIHN0cmluZykge1xuICAgIHJldHVybiByZWdFeHBUZXN0LmNhbGwocmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgbm9uU3BhY2VSZSA9IC9cXFMvO1xuICBmdW5jdGlvbiBpc1doaXRlc3BhY2UgKHN0cmluZykge1xuICAgIHJldHVybiAhdGVzdFJlZ0V4cChub25TcGFjZVJlLCBzdHJpbmcpO1xuICB9XG5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICAnJic6ICcmYW1wOycsXG4gICAgJzwnOiAnJmx0OycsXG4gICAgJz4nOiAnJmd0OycsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmIzM5OycsXG4gICAgJy8nOiAnJiN4MkY7JyxcbiAgICAnYCc6ICcmI3g2MDsnLFxuICAgICc9JzogJyYjeDNEOydcbiAgfTtcblxuICBmdW5jdGlvbiBlc2NhcGVIdG1sIChzdHJpbmcpIHtcbiAgICByZXR1cm4gU3RyaW5nKHN0cmluZykucmVwbGFjZSgvWyY8PlwiJ2A9XFwvXS9nLCBmdW5jdGlvbiBmcm9tRW50aXR5TWFwIChzKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwW3NdO1xuICAgIH0pO1xuICB9XG5cbiAgdmFyIHdoaXRlUmUgPSAvXFxzKi87XG4gIHZhciBzcGFjZVJlID0gL1xccysvO1xuICB2YXIgZXF1YWxzUmUgPSAvXFxzKj0vO1xuICB2YXIgY3VybHlSZSA9IC9cXHMqXFx9LztcbiAgdmFyIHRhZ1JlID0gLyN8XFxefFxcL3w+fFxce3wmfD18IS87XG5cbiAgLyoqXG4gICAqIEJyZWFrcyB1cCB0aGUgZ2l2ZW4gYHRlbXBsYXRlYCBzdHJpbmcgaW50byBhIHRyZWUgb2YgdG9rZW5zLiBJZiB0aGUgYHRhZ3NgXG4gICAqIGFyZ3VtZW50IGlzIGdpdmVuIGhlcmUgaXQgbXVzdCBiZSBhbiBhcnJheSB3aXRoIHR3byBzdHJpbmcgdmFsdWVzOiB0aGVcbiAgICogb3BlbmluZyBhbmQgY2xvc2luZyB0YWdzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIChlLmcuIFsgXCI8JVwiLCBcIiU+XCIgXSkuIE9mXG4gICAqIGNvdXJzZSwgdGhlIGRlZmF1bHQgaXMgdG8gdXNlIG11c3RhY2hlcyAoaS5lLiBtdXN0YWNoZS50YWdzKS5cbiAgICpcbiAgICogQSB0b2tlbiBpcyBhbiBhcnJheSB3aXRoIGF0IGxlYXN0IDQgZWxlbWVudHMuIFRoZSBmaXJzdCBlbGVtZW50IGlzIHRoZVxuICAgKiBtdXN0YWNoZSBzeW1ib2wgdGhhdCB3YXMgdXNlZCBpbnNpZGUgdGhlIHRhZywgZS5nLiBcIiNcIiBvciBcIiZcIi4gSWYgdGhlIHRhZ1xuICAgKiBkaWQgbm90IGNvbnRhaW4gYSBzeW1ib2wgKGkuZS4ge3tteVZhbHVlfX0pIHRoaXMgZWxlbWVudCBpcyBcIm5hbWVcIi4gRm9yXG4gICAqIGFsbCB0ZXh0IHRoYXQgYXBwZWFycyBvdXRzaWRlIGEgc3ltYm9sIHRoaXMgZWxlbWVudCBpcyBcInRleHRcIi5cbiAgICpcbiAgICogVGhlIHNlY29uZCBlbGVtZW50IG9mIGEgdG9rZW4gaXMgaXRzIFwidmFsdWVcIi4gRm9yIG11c3RhY2hlIHRhZ3MgdGhpcyBpc1xuICAgKiB3aGF0ZXZlciBlbHNlIHdhcyBpbnNpZGUgdGhlIHRhZyBiZXNpZGVzIHRoZSBvcGVuaW5nIHN5bWJvbC4gRm9yIHRleHQgdG9rZW5zXG4gICAqIHRoaXMgaXMgdGhlIHRleHQgaXRzZWxmLlxuICAgKlxuICAgKiBUaGUgdGhpcmQgYW5kIGZvdXJ0aCBlbGVtZW50cyBvZiB0aGUgdG9rZW4gYXJlIHRoZSBzdGFydCBhbmQgZW5kIGluZGljZXMsXG4gICAqIHJlc3BlY3RpdmVseSwgb2YgdGhlIHRva2VuIGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVG9rZW5zIHRoYXQgYXJlIHRoZSByb290IG5vZGUgb2YgYSBzdWJ0cmVlIGNvbnRhaW4gdHdvIG1vcmUgZWxlbWVudHM6IDEpIGFuXG4gICAqIGFycmF5IG9mIHRva2VucyBpbiB0aGUgc3VidHJlZSBhbmQgMikgdGhlIGluZGV4IGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSBhdFxuICAgKiB3aGljaCB0aGUgY2xvc2luZyB0YWcgZm9yIHRoYXQgc2VjdGlvbiBiZWdpbnMuXG4gICAqXG4gICAqIFRva2VucyBmb3IgcGFydGlhbHMgYWxzbyBjb250YWluIHR3byBtb3JlIGVsZW1lbnRzOiAxKSBhIHN0cmluZyB2YWx1ZSBvZlxuICAgKiBpbmRlbmRhdGlvbiBwcmlvciB0byB0aGF0IHRhZyBhbmQgMikgdGhlIGluZGV4IG9mIHRoYXQgdGFnIG9uIHRoYXQgbGluZSAtXG4gICAqIGVnIGEgdmFsdWUgb2YgMiBpbmRpY2F0ZXMgdGhlIHBhcnRpYWwgaXMgdGhlIHRoaXJkIHRhZyBvbiB0aGlzIGxpbmUuXG4gICAqL1xuICBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlICh0ZW1wbGF0ZSwgdGFncykge1xuICAgIGlmICghdGVtcGxhdGUpXG4gICAgICByZXR1cm4gW107XG4gICAgdmFyIGxpbmVIYXNOb25TcGFjZSA9IGZhbHNlO1xuICAgIHZhciBzZWN0aW9ucyA9IFtdOyAgICAgLy8gU3RhY2sgdG8gaG9sZCBzZWN0aW9uIHRva2Vuc1xuICAgIHZhciB0b2tlbnMgPSBbXTsgICAgICAgLy8gQnVmZmVyIHRvIGhvbGQgdGhlIHRva2Vuc1xuICAgIHZhciBzcGFjZXMgPSBbXTsgICAgICAgLy8gSW5kaWNlcyBvZiB3aGl0ZXNwYWNlIHRva2VucyBvbiB0aGUgY3VycmVudCBsaW5lXG4gICAgdmFyIGhhc1RhZyA9IGZhbHNlOyAgICAvLyBJcyB0aGVyZSBhIHt7dGFnfX0gb24gdGhlIGN1cnJlbnQgbGluZT9cbiAgICB2YXIgbm9uU3BhY2UgPSBmYWxzZTsgIC8vIElzIHRoZXJlIGEgbm9uLXNwYWNlIGNoYXIgb24gdGhlIGN1cnJlbnQgbGluZT9cbiAgICB2YXIgaW5kZW50YXRpb24gPSAnJzsgIC8vIFRyYWNrcyBpbmRlbnRhdGlvbiBmb3IgdGFncyB0aGF0IHVzZSBpdFxuICAgIHZhciB0YWdJbmRleCA9IDA7ICAgICAgLy8gU3RvcmVzIGEgY291bnQgb2YgbnVtYmVyIG9mIHRhZ3MgZW5jb3VudGVyZWQgb24gYSBsaW5lXG5cbiAgICAvLyBTdHJpcHMgYWxsIHdoaXRlc3BhY2UgdG9rZW5zIGFycmF5IGZvciB0aGUgY3VycmVudCBsaW5lXG4gICAgLy8gaWYgdGhlcmUgd2FzIGEge3sjdGFnfX0gb24gaXQgYW5kIG90aGVyd2lzZSBvbmx5IHNwYWNlLlxuICAgIGZ1bmN0aW9uIHN0cmlwU3BhY2UgKCkge1xuICAgICAgaWYgKGhhc1RhZyAmJiAhbm9uU3BhY2UpIHtcbiAgICAgICAgd2hpbGUgKHNwYWNlcy5sZW5ndGgpXG4gICAgICAgICAgZGVsZXRlIHRva2Vuc1tzcGFjZXMucG9wKCldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BhY2VzID0gW107XG4gICAgICB9XG5cbiAgICAgIGhhc1RhZyA9IGZhbHNlO1xuICAgICAgbm9uU3BhY2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgb3BlbmluZ1RhZ1JlLCBjbG9zaW5nVGFnUmUsIGNsb3NpbmdDdXJseVJlO1xuICAgIGZ1bmN0aW9uIGNvbXBpbGVUYWdzICh0YWdzVG9Db21waWxlKSB7XG4gICAgICBpZiAodHlwZW9mIHRhZ3NUb0NvbXBpbGUgPT09ICdzdHJpbmcnKVxuICAgICAgICB0YWdzVG9Db21waWxlID0gdGFnc1RvQ29tcGlsZS5zcGxpdChzcGFjZVJlLCAyKTtcblxuICAgICAgaWYgKCFpc0FycmF5KHRhZ3NUb0NvbXBpbGUpIHx8IHRhZ3NUb0NvbXBpbGUubGVuZ3RoICE9PSAyKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdGFnczogJyArIHRhZ3NUb0NvbXBpbGUpO1xuXG4gICAgICBvcGVuaW5nVGFnUmUgPSBuZXcgUmVnRXhwKGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzBdKSArICdcXFxccyonKTtcbiAgICAgIGNsb3NpbmdUYWdSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAodGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgICAgY2xvc2luZ0N1cmx5UmUgPSBuZXcgUmVnRXhwKCdcXFxccyonICsgZXNjYXBlUmVnRXhwKCd9JyArIHRhZ3NUb0NvbXBpbGVbMV0pKTtcbiAgICB9XG5cbiAgICBjb21waWxlVGFncyh0YWdzIHx8IG11c3RhY2hlLnRhZ3MpO1xuXG4gICAgdmFyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcih0ZW1wbGF0ZSk7XG5cbiAgICB2YXIgc3RhcnQsIHR5cGUsIHZhbHVlLCBjaHIsIHRva2VuLCBvcGVuU2VjdGlvbjtcbiAgICB3aGlsZSAoIXNjYW5uZXIuZW9zKCkpIHtcbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG5cbiAgICAgIC8vIE1hdGNoIGFueSB0ZXh0IGJldHdlZW4gdGFncy5cbiAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwob3BlbmluZ1RhZ1JlKTtcblxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCB2YWx1ZUxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IHZhbHVlTGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjaHIgPSB2YWx1ZS5jaGFyQXQoaSk7XG5cbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNocikpIHtcbiAgICAgICAgICAgIHNwYWNlcy5wdXNoKHRva2Vucy5sZW5ndGgpO1xuICAgICAgICAgICAgaW5kZW50YXRpb24gKz0gY2hyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgICBsaW5lSGFzTm9uU3BhY2UgPSB0cnVlO1xuICAgICAgICAgICAgaW5kZW50YXRpb24gKz0gJyAnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRva2Vucy5wdXNoKFsgJ3RleHQnLCBjaHIsIHN0YXJ0LCBzdGFydCArIDEgXSk7XG4gICAgICAgICAgc3RhcnQgKz0gMTtcblxuICAgICAgICAgIC8vIENoZWNrIGZvciB3aGl0ZXNwYWNlIG9uIHRoZSBjdXJyZW50IGxpbmUuXG4gICAgICAgICAgaWYgKGNociA9PT0gJ1xcbicpIHtcbiAgICAgICAgICAgIHN0cmlwU3BhY2UoKTtcbiAgICAgICAgICAgIGluZGVudGF0aW9uID0gJyc7XG4gICAgICAgICAgICB0YWdJbmRleCA9IDA7XG4gICAgICAgICAgICBsaW5lSGFzTm9uU3BhY2UgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIG9wZW5pbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4ob3BlbmluZ1RhZ1JlKSlcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGhhc1RhZyA9IHRydWU7XG5cbiAgICAgIC8vIEdldCB0aGUgdGFnIHR5cGUuXG4gICAgICB0eXBlID0gc2Nhbm5lci5zY2FuKHRhZ1JlKSB8fCAnbmFtZSc7XG4gICAgICBzY2FubmVyLnNjYW4od2hpdGVSZSk7XG5cbiAgICAgIC8vIEdldCB0aGUgdGFnIHZhbHVlLlxuICAgICAgaWYgKHR5cGUgPT09ICc9Jykge1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGVxdWFsc1JlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuKGVxdWFsc1JlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3snKSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ0N1cmx5UmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oY3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhblVudGlsKGNsb3NpbmdUYWdSZSk7XG4gICAgICAgIHR5cGUgPSAnJic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGNsb3NpbmdUYWdSZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIE1hdGNoIHRoZSBjbG9zaW5nIHRhZy5cbiAgICAgIGlmICghc2Nhbm5lci5zY2FuKGNsb3NpbmdUYWdSZSkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgdGFnIGF0ICcgKyBzY2FubmVyLnBvcyk7XG5cbiAgICAgIGlmICh0eXBlID09ICc+Jykge1xuICAgICAgICB0b2tlbiA9IFsgdHlwZSwgdmFsdWUsIHN0YXJ0LCBzY2FubmVyLnBvcywgaW5kZW50YXRpb24sIHRhZ0luZGV4LCBsaW5lSGFzTm9uU3BhY2UgXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRva2VuID0gWyB0eXBlLCB2YWx1ZSwgc3RhcnQsIHNjYW5uZXIucG9zIF07XG4gICAgICB9XG4gICAgICB0YWdJbmRleCsrO1xuICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuXG4gICAgICBpZiAodHlwZSA9PT0gJyMnIHx8IHR5cGUgPT09ICdeJykge1xuICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJy8nKSB7XG4gICAgICAgIC8vIENoZWNrIHNlY3Rpb24gbmVzdGluZy5cbiAgICAgICAgb3BlblNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgICAgICBpZiAoIW9wZW5TZWN0aW9uKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5vcGVuZWQgc2VjdGlvbiBcIicgKyB2YWx1ZSArICdcIiBhdCAnICsgc3RhcnQpO1xuXG4gICAgICAgIGlmIChvcGVuU2VjdGlvblsxXSAhPT0gdmFsdWUpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIG9wZW5TZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzdGFydCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICduYW1lJyB8fCB0eXBlID09PSAneycgfHwgdHlwZSA9PT0gJyYnKSB7XG4gICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIC8vIFNldCB0aGUgdGFncyBmb3IgdGhlIG5leHQgdGltZSBhcm91bmQuXG4gICAgICAgIGNvbXBpbGVUYWdzKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdHJpcFNwYWNlKCk7XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlcmUgYXJlIG5vIG9wZW4gc2VjdGlvbnMgd2hlbiB3ZSdyZSBkb25lLlxuICAgIG9wZW5TZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICBpZiAob3BlblNlY3Rpb24pXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgb3BlblNlY3Rpb25bMV0gKyAnXCIgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgIHJldHVybiBuZXN0VG9rZW5zKHNxdWFzaFRva2Vucyh0b2tlbnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21iaW5lcyB0aGUgdmFsdWVzIG9mIGNvbnNlY3V0aXZlIHRleHQgdG9rZW5zIGluIHRoZSBnaXZlbiBgdG9rZW5zYCBhcnJheVxuICAgKiB0byBhIHNpbmdsZSB0b2tlbi5cbiAgICovXG4gIGZ1bmN0aW9uIHNxdWFzaFRva2VucyAodG9rZW5zKSB7XG4gICAgdmFyIHNxdWFzaGVkVG9rZW5zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIGxhc3RUb2tlbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgIGlmICh0b2tlblswXSA9PT0gJ3RleHQnICYmIGxhc3RUb2tlbiAmJiBsYXN0VG9rZW5bMF0gPT09ICd0ZXh0Jykge1xuICAgICAgICAgIGxhc3RUb2tlblsxXSArPSB0b2tlblsxXTtcbiAgICAgICAgICBsYXN0VG9rZW5bM10gPSB0b2tlblszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzcXVhc2hlZFRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBsYXN0VG9rZW4gPSB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcXVhc2hlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtcyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgaW50byBhIG5lc3RlZCB0cmVlIHN0cnVjdHVyZSB3aGVyZVxuICAgKiB0b2tlbnMgdGhhdCByZXByZXNlbnQgYSBzZWN0aW9uIGhhdmUgdHdvIGFkZGl0aW9uYWwgaXRlbXM6IDEpIGFuIGFycmF5IG9mXG4gICAqIGFsbCB0b2tlbnMgdGhhdCBhcHBlYXIgaW4gdGhhdCBzZWN0aW9uIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsXG4gICAqIHRlbXBsYXRlIHRoYXQgcmVwcmVzZW50cyB0aGUgZW5kIG9mIHRoYXQgc2VjdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIG5lc3RUb2tlbnMgKHRva2Vucykge1xuICAgIHZhciBuZXN0ZWRUb2tlbnMgPSBbXTtcbiAgICB2YXIgY29sbGVjdG9yID0gbmVzdGVkVG9rZW5zO1xuICAgIHZhciBzZWN0aW9ucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuLCBzZWN0aW9uO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgICBzd2l0Y2ggKHRva2VuWzBdKSB7XG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICBjYXNlICdeJzpcbiAgICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICAgICAgY29sbGVjdG9yID0gdG9rZW5bNF0gPSBbXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgc2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuICAgICAgICAgIHNlY3Rpb25bNV0gPSB0b2tlblsyXTtcbiAgICAgICAgICBjb2xsZWN0b3IgPSBzZWN0aW9ucy5sZW5ndGggPiAwID8gc2VjdGlvbnNbc2VjdGlvbnMubGVuZ3RoIC0gMV1bNF0gOiBuZXN0ZWRUb2tlbnM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29sbGVjdG9yLnB1c2godG9rZW4pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXN0ZWRUb2tlbnM7XG4gIH1cblxuICAvKipcbiAgICogQSBzaW1wbGUgc3RyaW5nIHNjYW5uZXIgdGhhdCBpcyB1c2VkIGJ5IHRoZSB0ZW1wbGF0ZSBwYXJzZXIgdG8gZmluZFxuICAgKiB0b2tlbnMgaW4gdGVtcGxhdGUgc3RyaW5ncy5cbiAgICovXG4gIGZ1bmN0aW9uIFNjYW5uZXIgKHN0cmluZykge1xuICAgIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xuICAgIHRoaXMudGFpbCA9IHN0cmluZztcbiAgICB0aGlzLnBvcyA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHRhaWwgaXMgZW1wdHkgKGVuZCBvZiBzdHJpbmcpLlxuICAgKi9cbiAgU2Nhbm5lci5wcm90b3R5cGUuZW9zID0gZnVuY3Rpb24gZW9zICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWlsID09PSAnJztcbiAgfTtcblxuICAvKipcbiAgICogVHJpZXMgdG8gbWF0Y2ggdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBhdCB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogUmV0dXJucyB0aGUgbWF0Y2hlZCB0ZXh0IGlmIGl0IGNhbiBtYXRjaCwgdGhlIGVtcHR5IHN0cmluZyBvdGhlcndpc2UuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuID0gZnVuY3Rpb24gc2NhbiAocmUpIHtcbiAgICB2YXIgbWF0Y2ggPSB0aGlzLnRhaWwubWF0Y2gocmUpO1xuXG4gICAgaWYgKCFtYXRjaCB8fCBtYXRjaC5pbmRleCAhPT0gMClcbiAgICAgIHJldHVybiAnJztcblxuICAgIHZhciBzdHJpbmcgPSBtYXRjaFswXTtcblxuICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoc3RyaW5nLmxlbmd0aCk7XG4gICAgdGhpcy5wb3MgKz0gc3RyaW5nLmxlbmd0aDtcblxuICAgIHJldHVybiBzdHJpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNraXBzIGFsbCB0ZXh0IHVudGlsIHRoZSBnaXZlbiByZWd1bGFyIGV4cHJlc3Npb24gY2FuIGJlIG1hdGNoZWQuIFJldHVybnNcbiAgICogdGhlIHNraXBwZWQgc3RyaW5nLCB3aGljaCBpcyB0aGUgZW50aXJlIHRhaWwgaWYgbm8gbWF0Y2ggY2FuIGJlIG1hZGUuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuVW50aWwgPSBmdW5jdGlvbiBzY2FuVW50aWwgKHJlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy50YWlsLnNlYXJjaChyZSksIG1hdGNoO1xuXG4gICAgc3dpdGNoIChpbmRleCkge1xuICAgICAgY2FzZSAtMTpcbiAgICAgICAgbWF0Y2ggPSB0aGlzLnRhaWw7XG4gICAgICAgIHRoaXMudGFpbCA9ICcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgbWF0Y2ggPSAnJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBtYXRjaCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKGluZGV4KTtcbiAgICB9XG5cbiAgICB0aGlzLnBvcyArPSBtYXRjaC5sZW5ndGg7XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSByZW5kZXJpbmcgY29udGV4dCBieSB3cmFwcGluZyBhIHZpZXcgb2JqZWN0IGFuZFxuICAgKiBtYWludGFpbmluZyBhIHJlZmVyZW5jZSB0byB0aGUgcGFyZW50IGNvbnRleHQuXG4gICAqL1xuICBmdW5jdGlvbiBDb250ZXh0ICh2aWV3LCBwYXJlbnRDb250ZXh0KSB7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLmNhY2hlID0geyAnLic6IHRoaXMudmlldyB9O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50Q29udGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGNvbnRleHQgdXNpbmcgdGhlIGdpdmVuIHZpZXcgd2l0aCB0aGlzIGNvbnRleHRcbiAgICogYXMgdGhlIHBhcmVudC5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoICh2aWV3KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0KHZpZXcsIHRoaXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gbmFtZSBpbiB0aGlzIGNvbnRleHQsIHRyYXZlcnNpbmdcbiAgICogdXAgdGhlIGNvbnRleHQgaGllcmFyY2h5IGlmIHRoZSB2YWx1ZSBpcyBhYnNlbnQgaW4gdGhpcyBjb250ZXh0J3Mgdmlldy5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uIGxvb2t1cCAobmFtZSkge1xuICAgIHZhciBjYWNoZSA9IHRoaXMuY2FjaGU7XG5cbiAgICB2YXIgdmFsdWU7XG4gICAgaWYgKGNhY2hlLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICB2YWx1ZSA9IGNhY2hlW25hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIGludGVybWVkaWF0ZVZhbHVlLCBuYW1lcywgaW5kZXgsIGxvb2t1cEhpdCA9IGZhbHNlO1xuXG4gICAgICB3aGlsZSAoY29udGV4dCkge1xuICAgICAgICBpZiAobmFtZS5pbmRleE9mKCcuJykgPiAwKSB7XG4gICAgICAgICAgaW50ZXJtZWRpYXRlVmFsdWUgPSBjb250ZXh0LnZpZXc7XG4gICAgICAgICAgbmFtZXMgPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgICAgaW5kZXggPSAwO1xuXG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogVXNpbmcgdGhlIGRvdCBub3Rpb24gcGF0aCBpbiBgbmFtZWAsIHdlIGRlc2NlbmQgdGhyb3VnaCB0aGVcbiAgICAgICAgICAgKiBuZXN0ZWQgb2JqZWN0cy5cbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIFRvIGJlIGNlcnRhaW4gdGhhdCB0aGUgbG9va3VwIGhhcyBiZWVuIHN1Y2Nlc3NmdWwsIHdlIGhhdmUgdG9cbiAgICAgICAgICAgKiBjaGVjayBpZiB0aGUgbGFzdCBvYmplY3QgaW4gdGhlIHBhdGggYWN0dWFsbHkgaGFzIHRoZSBwcm9wZXJ0eVxuICAgICAgICAgICAqIHdlIGFyZSBsb29raW5nIGZvci4gV2Ugc3RvcmUgdGhlIHJlc3VsdCBpbiBgbG9va3VwSGl0YC5cbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIFRoaXMgaXMgc3BlY2lhbGx5IG5lY2Vzc2FyeSBmb3Igd2hlbiB0aGUgdmFsdWUgaGFzIGJlZW4gc2V0IHRvXG4gICAgICAgICAgICogYHVuZGVmaW5lZGAgYW5kIHdlIHdhbnQgdG8gYXZvaWQgbG9va2luZyB1cCBwYXJlbnQgY29udGV4dHMuXG4gICAgICAgICAgICpcbiAgICAgICAgICAgKiBJbiB0aGUgY2FzZSB3aGVyZSBkb3Qgbm90YXRpb24gaXMgdXNlZCwgd2UgY29uc2lkZXIgdGhlIGxvb2t1cFxuICAgICAgICAgICAqIHRvIGJlIHN1Y2Nlc3NmdWwgZXZlbiBpZiB0aGUgbGFzdCBcIm9iamVjdFwiIGluIHRoZSBwYXRoIGlzXG4gICAgICAgICAgICogbm90IGFjdHVhbGx5IGFuIG9iamVjdCBidXQgYSBwcmltaXRpdmUgKGUuZy4sIGEgc3RyaW5nLCBvciBhblxuICAgICAgICAgICAqIGludGVnZXIpLCBiZWNhdXNlIGl0IGlzIHNvbWV0aW1lcyB1c2VmdWwgdG8gYWNjZXNzIGEgcHJvcGVydHlcbiAgICAgICAgICAgKiBvZiBhbiBhdXRvYm94ZWQgcHJpbWl0aXZlLCBzdWNoIGFzIHRoZSBsZW5ndGggb2YgYSBzdHJpbmcuXG4gICAgICAgICAgICoqL1xuICAgICAgICAgIHdoaWxlIChpbnRlcm1lZGlhdGVWYWx1ZSAhPSBudWxsICYmIGluZGV4IDwgbmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoaW5kZXggPT09IG5hbWVzLmxlbmd0aCAtIDEpXG4gICAgICAgICAgICAgIGxvb2t1cEhpdCA9IChcbiAgICAgICAgICAgICAgICBoYXNQcm9wZXJ0eShpbnRlcm1lZGlhdGVWYWx1ZSwgbmFtZXNbaW5kZXhdKVxuICAgICAgICAgICAgICAgIHx8IHByaW1pdGl2ZUhhc093blByb3BlcnR5KGludGVybWVkaWF0ZVZhbHVlLCBuYW1lc1tpbmRleF0pXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGludGVybWVkaWF0ZVZhbHVlID0gaW50ZXJtZWRpYXRlVmFsdWVbbmFtZXNbaW5kZXgrK11dO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpbnRlcm1lZGlhdGVWYWx1ZSA9IGNvbnRleHQudmlld1tuYW1lXTtcblxuICAgICAgICAgIC8qKlxuICAgICAgICAgICAqIE9ubHkgY2hlY2tpbmcgYWdhaW5zdCBgaGFzUHJvcGVydHlgLCB3aGljaCBhbHdheXMgcmV0dXJucyBgZmFsc2VgIGlmXG4gICAgICAgICAgICogYGNvbnRleHQudmlld2AgaXMgbm90IGFuIG9iamVjdC4gRGVsaWJlcmF0ZWx5IG9taXR0aW5nIHRoZSBjaGVja1xuICAgICAgICAgICAqIGFnYWluc3QgYHByaW1pdGl2ZUhhc093blByb3BlcnR5YCBpZiBkb3Qgbm90YXRpb24gaXMgbm90IHVzZWQuXG4gICAgICAgICAgICpcbiAgICAgICAgICAgKiBDb25zaWRlciB0aGlzIGV4YW1wbGU6XG4gICAgICAgICAgICogYGBgXG4gICAgICAgICAgICogTXVzdGFjaGUucmVuZGVyKFwiVGhlIGxlbmd0aCBvZiBhIGZvb3RiYWxsIGZpZWxkIGlzIHt7I2xlbmd0aH19e3tsZW5ndGh9fXt7L2xlbmd0aH19LlwiLCB7bGVuZ3RoOiBcIjEwMCB5YXJkc1wifSlcbiAgICAgICAgICAgKiBgYGBcbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIElmIHdlIHdlcmUgdG8gY2hlY2sgYWxzbyBhZ2FpbnN0IGBwcmltaXRpdmVIYXNPd25Qcm9wZXJ0eWAsIGFzIHdlIGRvXG4gICAgICAgICAgICogaW4gdGhlIGRvdCBub3RhdGlvbiBjYXNlLCB0aGVuIHJlbmRlciBjYWxsIHdvdWxkIHJldHVybjpcbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIFwiVGhlIGxlbmd0aCBvZiBhIGZvb3RiYWxsIGZpZWxkIGlzIDkuXCJcbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIHJhdGhlciB0aGFuIHRoZSBleHBlY3RlZDpcbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIFwiVGhlIGxlbmd0aCBvZiBhIGZvb3RiYWxsIGZpZWxkIGlzIDEwMCB5YXJkcy5cIlxuICAgICAgICAgICAqKi9cbiAgICAgICAgICBsb29rdXBIaXQgPSBoYXNQcm9wZXJ0eShjb250ZXh0LnZpZXcsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvb2t1cEhpdCkge1xuICAgICAgICAgIHZhbHVlID0gaW50ZXJtZWRpYXRlVmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIGNhY2hlW25hbWVdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKVxuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKHRoaXMudmlldyk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgV3JpdGVyIGtub3dzIGhvdyB0byB0YWtlIGEgc3RyZWFtIG9mIHRva2VucyBhbmQgcmVuZGVyIHRoZW0gdG8gYVxuICAgKiBzdHJpbmcsIGdpdmVuIGEgY29udGV4dC4gSXQgYWxzbyBtYWludGFpbnMgYSBjYWNoZSBvZiB0ZW1wbGF0ZXMgdG9cbiAgICogYXZvaWQgdGhlIG5lZWQgdG8gcGFyc2UgdGhlIHNhbWUgdGVtcGxhdGUgdHdpY2UuXG4gICAqL1xuICBmdW5jdGlvbiBXcml0ZXIgKCkge1xuICAgIHRoaXMudGVtcGxhdGVDYWNoZSA9IHtcbiAgICAgIF9jYWNoZToge30sXG4gICAgICBzZXQ6IGZ1bmN0aW9uIHNldCAoa2V5LCB2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYWNoZVtrZXldID0gdmFsdWU7XG4gICAgICB9LFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQgKGtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGVba2V5XTtcbiAgICAgIH0sXG4gICAgICBjbGVhcjogZnVuY3Rpb24gY2xlYXIgKCkge1xuICAgICAgICB0aGlzLl9jYWNoZSA9IHt9O1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXJzIGFsbCBjYWNoZWQgdGVtcGxhdGVzIGluIHRoaXMgd3JpdGVyLlxuICAgKi9cbiAgV3JpdGVyLnByb3RvdHlwZS5jbGVhckNhY2hlID0gZnVuY3Rpb24gY2xlYXJDYWNoZSAoKSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLnRlbXBsYXRlQ2FjaGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLnRlbXBsYXRlQ2FjaGUuY2xlYXIoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiBgdGVtcGxhdGVgIGFjY29yZGluZyB0byB0aGUgZ2l2ZW4gYHRhZ3NgIG9yXG4gICAqIGBtdXN0YWNoZS50YWdzYCBpZiBgdGFnc2AgaXMgb21pdHRlZCwgIGFuZCByZXR1cm5zIHRoZSBhcnJheSBvZiB0b2tlbnNcbiAgICogdGhhdCBpcyBnZW5lcmF0ZWQgZnJvbSB0aGUgcGFyc2UuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy50ZW1wbGF0ZUNhY2hlO1xuICAgIHZhciBjYWNoZUtleSA9IHRlbXBsYXRlICsgJzonICsgKHRhZ3MgfHwgbXVzdGFjaGUudGFncykuam9pbignOicpO1xuICAgIHZhciBpc0NhY2hlRW5hYmxlZCA9IHR5cGVvZiBjYWNoZSAhPT0gJ3VuZGVmaW5lZCc7XG4gICAgdmFyIHRva2VucyA9IGlzQ2FjaGVFbmFibGVkID8gY2FjaGUuZ2V0KGNhY2hlS2V5KSA6IHVuZGVmaW5lZDtcblxuICAgIGlmICh0b2tlbnMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0b2tlbnMgPSBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCB0YWdzKTtcbiAgICAgIGlzQ2FjaGVFbmFibGVkICYmIGNhY2hlLnNldChjYWNoZUtleSwgdG9rZW5zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRva2VucztcbiAgfTtcblxuICAvKipcbiAgICogSGlnaC1sZXZlbCBtZXRob2QgdGhhdCBpcyB1c2VkIHRvIHJlbmRlciB0aGUgZ2l2ZW4gYHRlbXBsYXRlYCB3aXRoXG4gICAqIHRoZSBnaXZlbiBgdmlld2AuXG4gICAqXG4gICAqIFRoZSBvcHRpb25hbCBgcGFydGlhbHNgIGFyZ3VtZW50IG1heSBiZSBhbiBvYmplY3QgdGhhdCBjb250YWlucyB0aGVcbiAgICogbmFtZXMgYW5kIHRlbXBsYXRlcyBvZiBwYXJ0aWFscyB0aGF0IGFyZSB1c2VkIGluIHRoZSB0ZW1wbGF0ZS4gSXQgbWF5XG4gICAqIGFsc28gYmUgYSBmdW5jdGlvbiB0aGF0IGlzIHVzZWQgdG8gbG9hZCBwYXJ0aWFsIHRlbXBsYXRlcyBvbiB0aGUgZmx5XG4gICAqIHRoYXQgdGFrZXMgYSBzaW5nbGUgYXJndW1lbnQ6IHRoZSBuYW1lIG9mIHRoZSBwYXJ0aWFsLlxuICAgKlxuICAgKiBJZiB0aGUgb3B0aW9uYWwgYGNvbmZpZ2AgYXJndW1lbnQgaXMgZ2l2ZW4gaGVyZSwgdGhlbiBpdCBzaG91bGQgYmUgYW5cbiAgICogb2JqZWN0IHdpdGggYSBgdGFnc2AgYXR0cmlidXRlIG9yIGFuIGBlc2NhcGVgIGF0dHJpYnV0ZSBvciBib3RoLlxuICAgKiBJZiBhbiBhcnJheSBpcyBwYXNzZWQsIHRoZW4gaXQgd2lsbCBiZSBpbnRlcnByZXRlZCB0aGUgc2FtZSB3YXkgYXNcbiAgICogYSBgdGFnc2AgYXR0cmlidXRlIG9uIGEgYGNvbmZpZ2Agb2JqZWN0LlxuICAgKlxuICAgKiBUaGUgYHRhZ3NgIGF0dHJpYnV0ZSBvZiBhIGBjb25maWdgIG9iamVjdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvXG4gICAqIHN0cmluZyB2YWx1ZXM6IHRoZSBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy5cbiAgICogWyBcIjwlXCIsIFwiJT5cIiBdKS4gVGhlIGRlZmF1bHQgaXMgdG8gbXVzdGFjaGUudGFncy5cbiAgICpcbiAgICogVGhlIGBlc2NhcGVgIGF0dHJpYnV0ZSBvZiBhIGBjb25maWdgIG9iamVjdCBtdXN0IGJlIGEgZnVuY3Rpb24gd2hpY2hcbiAgICogYWNjZXB0cyBhIHN0cmluZyBhcyBpbnB1dCBhbmQgb3V0cHV0cyBhIHNhZmVseSBlc2NhcGVkIHN0cmluZy5cbiAgICogSWYgYW4gYGVzY2FwZWAgZnVuY3Rpb24gaXMgbm90IHByb3ZpZGVkLCB0aGVuIGFuIEhUTUwtc2FmZSBzdHJpbmdcbiAgICogZXNjYXBpbmcgZnVuY3Rpb24gaXMgdXNlZCBhcyB0aGUgZGVmYXVsdC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMsIGNvbmZpZykge1xuICAgIHZhciB0YWdzID0gdGhpcy5nZXRDb25maWdUYWdzKGNvbmZpZyk7XG4gICAgdmFyIHRva2VucyA9IHRoaXMucGFyc2UodGVtcGxhdGUsIHRhZ3MpO1xuICAgIHZhciBjb250ZXh0ID0gKHZpZXcgaW5zdGFuY2VvZiBDb250ZXh0KSA/IHZpZXcgOiBuZXcgQ29udGV4dCh2aWV3LCB1bmRlZmluZWQpO1xuICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCB0ZW1wbGF0ZSwgY29uZmlnKTtcbiAgfTtcblxuICAvKipcbiAgICogTG93LWxldmVsIG1ldGhvZCB0aGF0IHJlbmRlcnMgdGhlIGdpdmVuIGFycmF5IG9mIGB0b2tlbnNgIHVzaW5nXG4gICAqIHRoZSBnaXZlbiBgY29udGV4dGAgYW5kIGBwYXJ0aWFsc2AuXG4gICAqXG4gICAqIE5vdGU6IFRoZSBgb3JpZ2luYWxUZW1wbGF0ZWAgaXMgb25seSBldmVyIHVzZWQgdG8gZXh0cmFjdCB0aGUgcG9ydGlvblxuICAgKiBvZiB0aGUgb3JpZ2luYWwgdGVtcGxhdGUgdGhhdCB3YXMgY29udGFpbmVkIGluIGEgaGlnaGVyLW9yZGVyIHNlY3Rpb24uXG4gICAqIElmIHRoZSB0ZW1wbGF0ZSBkb2Vzbid0IHVzZSBoaWdoZXItb3JkZXIgc2VjdGlvbnMsIHRoaXMgYXJndW1lbnQgbWF5XG4gICAqIGJlIG9taXR0ZWQuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclRva2VucyA9IGZ1bmN0aW9uIHJlbmRlclRva2VucyAodG9rZW5zLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKSB7XG4gICAgdmFyIGJ1ZmZlciA9ICcnO1xuXG4gICAgdmFyIHRva2VuLCBzeW1ib2wsIHZhbHVlO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICBzeW1ib2wgPSB0b2tlblswXTtcblxuICAgICAgaWYgKHN5bWJvbCA9PT0gJyMnKSB2YWx1ZSA9IHRoaXMucmVuZGVyU2VjdGlvbih0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICdeJykgdmFsdWUgPSB0aGlzLnJlbmRlckludmVydGVkKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJz4nKSB2YWx1ZSA9IHRoaXMucmVuZGVyUGFydGlhbCh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIGNvbmZpZyk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICcmJykgdmFsdWUgPSB0aGlzLnVuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ25hbWUnKSB2YWx1ZSA9IHRoaXMuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0LCBjb25maWcpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAndGV4dCcpIHZhbHVlID0gdGhpcy5yYXdWYWx1ZSh0b2tlbik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclNlY3Rpb24gPSBmdW5jdGlvbiByZW5kZXJTZWN0aW9uICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYnVmZmVyID0gJyc7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIHJlbmRlciBhbiBhcmJpdHJhcnkgdGVtcGxhdGVcbiAgICAvLyBpbiB0aGUgY3VycmVudCBjb250ZXh0IGJ5IGhpZ2hlci1vcmRlciBzZWN0aW9ucy5cbiAgICBmdW5jdGlvbiBzdWJSZW5kZXIgKHRlbXBsYXRlKSB7XG4gICAgICByZXR1cm4gc2VsZi5yZW5kZXIodGVtcGxhdGUsIGNvbnRleHQsIHBhcnRpYWxzLCBjb25maWcpO1xuICAgIH1cblxuICAgIGlmICghdmFsdWUpIHJldHVybjtcblxuICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgZm9yICh2YXIgaiA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBqIDwgdmFsdWVMZW5ndGg7ICsraikge1xuICAgICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZVtqXSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gICAgfSBlbHNlIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgaWYgKHR5cGVvZiBvcmlnaW5hbFRlbXBsYXRlICE9PSAnc3RyaW5nJylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdXNlIGhpZ2hlci1vcmRlciBzZWN0aW9ucyB3aXRob3V0IHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZScpO1xuXG4gICAgICAvLyBFeHRyYWN0IHRoZSBwb3J0aW9uIG9mIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSB0aGF0IHRoZSBzZWN0aW9uIGNvbnRhaW5zLlxuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKGNvbnRleHQudmlldywgb3JpZ2luYWxUZW1wbGF0ZS5zbGljZSh0b2tlblszXSwgdG9rZW5bNV0pLCBzdWJSZW5kZXIpO1xuXG4gICAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgICAgYnVmZmVyICs9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVySW52ZXJ0ZWQgPSBmdW5jdGlvbiByZW5kZXJJbnZlcnRlZCAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBVc2UgSmF2YVNjcmlwdCdzIGRlZmluaXRpb24gb2YgZmFsc3kuIEluY2x1ZGUgZW1wdHkgYXJyYXlzLlxuICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg2XG4gICAgaWYgKCF2YWx1ZSB8fCAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSlcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5pbmRlbnRQYXJ0aWFsID0gZnVuY3Rpb24gaW5kZW50UGFydGlhbCAocGFydGlhbCwgaW5kZW50YXRpb24sIGxpbmVIYXNOb25TcGFjZSkge1xuICAgIHZhciBmaWx0ZXJlZEluZGVudGF0aW9uID0gaW5kZW50YXRpb24ucmVwbGFjZSgvW14gXFx0XS9nLCAnJyk7XG4gICAgdmFyIHBhcnRpYWxCeU5sID0gcGFydGlhbC5zcGxpdCgnXFxuJyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0aWFsQnlObC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBhcnRpYWxCeU5sW2ldLmxlbmd0aCAmJiAoaSA+IDAgfHwgIWxpbmVIYXNOb25TcGFjZSkpIHtcbiAgICAgICAgcGFydGlhbEJ5TmxbaV0gPSBmaWx0ZXJlZEluZGVudGF0aW9uICsgcGFydGlhbEJ5TmxbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwYXJ0aWFsQnlObC5qb2luKCdcXG4nKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclBhcnRpYWwgPSBmdW5jdGlvbiByZW5kZXJQYXJ0aWFsICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIGNvbmZpZykge1xuICAgIGlmICghcGFydGlhbHMpIHJldHVybjtcbiAgICB2YXIgdGFncyA9IHRoaXMuZ2V0Q29uZmlnVGFncyhjb25maWcpO1xuXG4gICAgdmFyIHZhbHVlID0gaXNGdW5jdGlvbihwYXJ0aWFscykgPyBwYXJ0aWFscyh0b2tlblsxXSkgOiBwYXJ0aWFsc1t0b2tlblsxXV07XG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgIHZhciBsaW5lSGFzTm9uU3BhY2UgPSB0b2tlbls2XTtcbiAgICAgIHZhciB0YWdJbmRleCA9IHRva2VuWzVdO1xuICAgICAgdmFyIGluZGVudGF0aW9uID0gdG9rZW5bNF07XG4gICAgICB2YXIgaW5kZW50ZWRWYWx1ZSA9IHZhbHVlO1xuICAgICAgaWYgKHRhZ0luZGV4ID09IDAgJiYgaW5kZW50YXRpb24pIHtcbiAgICAgICAgaW5kZW50ZWRWYWx1ZSA9IHRoaXMuaW5kZW50UGFydGlhbCh2YWx1ZSwgaW5kZW50YXRpb24sIGxpbmVIYXNOb25TcGFjZSk7XG4gICAgICB9XG4gICAgICB2YXIgdG9rZW5zID0gdGhpcy5wYXJzZShpbmRlbnRlZFZhbHVlLCB0YWdzKTtcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCBpbmRlbnRlZFZhbHVlLCBjb25maWcpO1xuICAgIH1cbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnVuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gdW5lc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gZXNjYXBlZFZhbHVlICh0b2tlbiwgY29udGV4dCwgY29uZmlnKSB7XG4gICAgdmFyIGVzY2FwZSA9IHRoaXMuZ2V0Q29uZmlnRXNjYXBlKGNvbmZpZykgfHwgbXVzdGFjaGUuZXNjYXBlO1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBlc2NhcGUgPT09IG11c3RhY2hlLmVzY2FwZSkgPyBTdHJpbmcodmFsdWUpIDogZXNjYXBlKHZhbHVlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJhd1ZhbHVlID0gZnVuY3Rpb24gcmF3VmFsdWUgKHRva2VuKSB7XG4gICAgcmV0dXJuIHRva2VuWzFdO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuZ2V0Q29uZmlnVGFncyA9IGZ1bmN0aW9uIGdldENvbmZpZ1RhZ3MgKGNvbmZpZykge1xuICAgIGlmIChpc0FycmF5KGNvbmZpZykpIHtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGNvbmZpZyAmJiB0eXBlb2YgY29uZmlnID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIGNvbmZpZy50YWdzO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuZ2V0Q29uZmlnRXNjYXBlID0gZnVuY3Rpb24gZ2V0Q29uZmlnRXNjYXBlIChjb25maWcpIHtcbiAgICBpZiAoY29uZmlnICYmIHR5cGVvZiBjb25maWcgPT09ICdvYmplY3QnICYmICFpc0FycmF5KGNvbmZpZykpIHtcbiAgICAgIHJldHVybiBjb25maWcuZXNjYXBlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9O1xuXG4gIHZhciBtdXN0YWNoZSA9IHtcbiAgICBuYW1lOiAnbXVzdGFjaGUuanMnLFxuICAgIHZlcnNpb246ICc0LjIuMCcsXG4gICAgdGFnczogWyAne3snLCAnfX0nIF0sXG4gICAgY2xlYXJDYWNoZTogdW5kZWZpbmVkLFxuICAgIGVzY2FwZTogdW5kZWZpbmVkLFxuICAgIHBhcnNlOiB1bmRlZmluZWQsXG4gICAgcmVuZGVyOiB1bmRlZmluZWQsXG4gICAgU2Nhbm5lcjogdW5kZWZpbmVkLFxuICAgIENvbnRleHQ6IHVuZGVmaW5lZCxcbiAgICBXcml0ZXI6IHVuZGVmaW5lZCxcbiAgICAvKipcbiAgICAgKiBBbGxvd3MgYSB1c2VyIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0IGNhY2hpbmcgc3RyYXRlZ3ksIGJ5IHByb3ZpZGluZyBhblxuICAgICAqIG9iamVjdCB3aXRoIHNldCwgZ2V0IGFuZCBjbGVhciBtZXRob2RzLiBUaGlzIGNhbiBhbHNvIGJlIHVzZWQgdG8gZGlzYWJsZVxuICAgICAqIHRoZSBjYWNoZSBieSBzZXR0aW5nIGl0IHRvIHRoZSBsaXRlcmFsIGB1bmRlZmluZWRgLlxuICAgICAqL1xuICAgIHNldCB0ZW1wbGF0ZUNhY2hlIChjYWNoZSkge1xuICAgICAgZGVmYXVsdFdyaXRlci50ZW1wbGF0ZUNhY2hlID0gY2FjaGU7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBkZWZhdWx0IG9yIG92ZXJyaWRkZW4gY2FjaGluZyBvYmplY3QgZnJvbSB0aGUgZGVmYXVsdCB3cml0ZXIuXG4gICAgICovXG4gICAgZ2V0IHRlbXBsYXRlQ2FjaGUgKCkge1xuICAgICAgcmV0dXJuIGRlZmF1bHRXcml0ZXIudGVtcGxhdGVDYWNoZTtcbiAgICB9XG4gIH07XG5cbiAgLy8gQWxsIGhpZ2gtbGV2ZWwgbXVzdGFjaGUuKiBmdW5jdGlvbnMgdXNlIHRoaXMgd3JpdGVyLlxuICB2YXIgZGVmYXVsdFdyaXRlciA9IG5ldyBXcml0ZXIoKTtcblxuICAvKipcbiAgICogQ2xlYXJzIGFsbCBjYWNoZWQgdGVtcGxhdGVzIGluIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5jbGVhckNhY2hlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpbiB0aGUgZGVmYXVsdCB3cml0ZXIgYW5kIHJldHVybnMgdGhlXG4gICAqIGFycmF5IG9mIHRva2VucyBpdCBjb250YWlucy4gRG9pbmcgdGhpcyBhaGVhZCBvZiB0aW1lIGF2b2lkcyB0aGUgbmVlZCB0b1xuICAgKiBwYXJzZSB0ZW1wbGF0ZXMgb24gdGhlIGZseSBhcyB0aGV5IGFyZSByZW5kZXJlZC5cbiAgICovXG4gIG11c3RhY2hlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRXcml0ZXIucGFyc2UodGVtcGxhdGUsIHRhZ3MpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW5kZXJzIHRoZSBgdGVtcGxhdGVgIHdpdGggdGhlIGdpdmVuIGB2aWV3YCwgYHBhcnRpYWxzYCwgYW5kIGBjb25maWdgXG4gICAqIHVzaW5nIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlciAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzLCBjb25maWcpIHtcbiAgICBpZiAodHlwZW9mIHRlbXBsYXRlICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCB0ZW1wbGF0ZSEgVGVtcGxhdGUgc2hvdWxkIGJlIGEgXCJzdHJpbmdcIiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ2J1dCBcIicgKyB0eXBlU3RyKHRlbXBsYXRlKSArICdcIiB3YXMgZ2l2ZW4gYXMgdGhlIGZpcnN0ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnYXJndW1lbnQgZm9yIG11c3RhY2hlI3JlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmF1bHRXcml0ZXIucmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscywgY29uZmlnKTtcbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIGVzY2FwaW5nIGZ1bmN0aW9uIHNvIHRoYXQgdGhlIHVzZXIgbWF5IG92ZXJyaWRlIGl0LlxuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzI0NFxuICBtdXN0YWNoZS5lc2NhcGUgPSBlc2NhcGVIdG1sO1xuXG4gIC8vIEV4cG9ydCB0aGVzZSBtYWlubHkgZm9yIHRlc3RpbmcsIGJ1dCBhbHNvIGZvciBhZHZhbmNlZCB1c2FnZS5cbiAgbXVzdGFjaGUuU2Nhbm5lciA9IFNjYW5uZXI7XG4gIG11c3RhY2hlLkNvbnRleHQgPSBDb250ZXh0O1xuICBtdXN0YWNoZS5Xcml0ZXIgPSBXcml0ZXI7XG5cbiAgcmV0dXJuIG11c3RhY2hlO1xuXG59KSkpO1xuIl19

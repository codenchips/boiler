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
        $('#generate_datasheets_button').prop("disabled", false);
        $('#btn_update_account').prop("disabled", false);
        $('#btn_push_user_data').prop("disabled", false);
        $('#btn_pull_user_data').prop("disabled", false);
        $('#btn_clear_local_storage').prop("disabled", false);
        $('#btn_logout').prop("disabled", false);
        $('#btn_logout').prop("disabled", false);
        $('.syncicon').css({'opacity': '100%'});

    });

    window.addEventListener('offline', function() {
        console.log('App is offline - using cached data');
        
        $('#generate_datasheets_button').prop("disabled", true);
        $('#btn_update_account').prop("disabled", true);
        $('#btn_push_user_data').prop("disabled", true);
        $('#btn_pull_user_data').prop("disabled", true);
        $('#btn_clear_local_storage').prop("disabled", true);        
        $('#btn_logout').prop("disabled", true);
        $('#btn_logout').prop("disabled", true);
        $('.syncicon').removeClass('active').css({'opacity': '20%'});

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
    //console.log('Existing rooms:', existingRooms);
    const existingRoom = existingRooms.find(room => room.slug == roomSlug && room.floor_id_fk == floorUuid);
    //console.log('Existing room:', existingRoom);

    const user_uuid = $('#m_user_id').val();

    if (existingRoom) {            
        return false;   
    }
    // if the room exists ANYWHERE in this PROJECT
    const currentProject = JSON.parse(localStorage.getItem('currentProject') || '{}');    
    const projectStore = db.transaction("projects", "readonly").objectStore("projects");
    const project = await projectStore.get(String(currentProject.project_id));    
    
    

    const locationStore = db.transaction("locations", "readonly").objectStore("locations");
    const locations = await locationStore.index("project_id_fk").getAll(user_uuid);
   
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

        if ('ontouchstart' in window) {
            let touchStartX = 0;
            let touchEndX = 0;
            
            document.addEventListener('touchstart', e => {
                console.log('touchstart');
                touchStartX = e.changedTouches[0].screenX;
            }, false);
            
            document.addEventListener('touchend', e => {
                console.log('touchend');
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, false);
            
            const handleSwipe = () => {
                const swipeThreshold = 100; // minimum distance for swipe
                const edgeThreshold = 240;   // pixels from left edge to start swipe
                
                if (touchStartX < edgeThreshold && (touchEndX - touchStartX) > swipeThreshold) {
                    console.log('Swipe right from left edge');
                    // Swipe right from left edge
                    UIkit.offcanvas('#offcanvas-sidebar').show();
                }
            };
        }

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
const CACHE_NAME = 'sst-cache-v30'; 

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvanMvYXBwLmpzIiwiYXBwL2pzL2NvbmZpZy5qcyIsImFwcC9qcy9kYi5qcyIsImFwcC9qcy9tb2R1bGVzL3NpZGViYXIuanMiLCJhcHAvanMvbW9kdWxlcy9zeW5jLmpzIiwiYXBwL2pzL21vZHVsZXMvdGFibGVzLmpzIiwiYXBwL2pzL21vZHVsZXMvdXRpbHMuanMiLCJhcHAvanMvcm91dGVyLmpzIiwiYXBwL2pzL3NzdC5qcyIsIm5vZGVfbW9kdWxlcy9pZGIvYnVpbGQvaW5kZXguY2pzIiwibm9kZV9tb2R1bGVzL211c3RhY2hlL211c3RhY2hlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaDdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNWpCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzM0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImxldCByZWdpc3RyYXRpb247XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZWdpc3RlclNlcnZpY2VXb3JrZXIoKSB7XHJcbiAgICBpZiAoJ3NlcnZpY2VXb3JrZXInIGluIG5hdmlnYXRvcikge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcvc3cuanMnKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlcnZpY2VXb3JrZXIgcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWwnKTtcclxuICAgICAgICAgICAgY2hlY2tGb3JVcGRhdGVzKCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQ6JywgZXJyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIFBlcmlvZGljIHVwZGF0ZSBjaGVja2VyXHJcbmZ1bmN0aW9uIGNoZWNrRm9yVXBkYXRlcygpIHtcclxuICAgIC8vIENoZWNrIGltbWVkaWF0ZWx5IG9uIHBhZ2UgbG9hZFxyXG4gICAgaWYgKHJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgIHJlZ2lzdHJhdGlvbi51cGRhdGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBUaGVuIGNoZWNrIGV2ZXJ5IDMwIG1pbnV0ZXNcclxuICAgIHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICBpZiAocmVnaXN0cmF0aW9uKSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51cGRhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9LCAzMCAqIDYwICogMTAwMCk7XHJcbn1cclxuXHJcbi8vIFN0b3JlIHVwZGF0ZSBzdGF0ZSBpbiBsb2NhbFN0b3JhZ2VcclxuZnVuY3Rpb24gc2V0VXBkYXRlQXZhaWxhYmxlKHZhbHVlKSB7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndXBkYXRlQXZhaWxhYmxlJywgdmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc1VwZGF0ZUF2YWlsYWJsZSgpIHtcclxuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndXBkYXRlQXZhaWxhYmxlJykgPT09ICd0cnVlJztcclxufVxyXG5cclxuLy8gTW9kaWZpZWQgc2hvd1VwZGF0ZUJhciBmdW5jdGlvblxyXG5mdW5jdGlvbiBzaG93VXBkYXRlQmFyKCkge1xyXG4gICAgLy8gT25seSBzaG93IGlmIHdlIGhhdmVuJ3QgYWxyZWFkeSBzaG93biBpdFxyXG4gICAgaWYgKCFpc1VwZGF0ZUF2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgc2V0VXBkYXRlQXZhaWxhYmxlKHRydWUpO1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZU5vdGlmaWNhdGlvbiA9IFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdBIG5ldyB2ZXJzaW9uIGlzIGF2YWlsYWJsZS48YnI+Q2xpY2sgaGVyZSB0byB1cGRhdGUuJyxcclxuICAgICAgICAgICAgc3RhdHVzOiAncHJpbWFyeScsXHJcbiAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiAwLFxyXG4gICAgICAgICAgICBvbmNsaWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVOb3RpZmljYXRpb24uY2xvc2UoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgbG9hZGluZ05vdGlmaWNhdGlvbiA9IFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VwZGF0aW5nLi4uJyxcclxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICd3YXJuaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbj8ud2FpdGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi53YWl0aW5nLnBvc3RNZXNzYWdlKCdza2lwV2FpdGluZycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIENoZWNrIGZvciBzdG9yZWQgdXBkYXRlIHN0YXRlIG9uIHBhZ2UgbG9hZFxyXG5mdW5jdGlvbiBjaGVja1N0b3JlZFVwZGF0ZVN0YXRlKCkge1xyXG4gICAgaWYgKGlzVXBkYXRlQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICBzaG93VXBkYXRlQmFyKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIEluaXRpYWxpemVcclxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XHJcbiAgICBjb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbiAgICBjb25zdCBkYiA9IHJlcXVpcmUoJy4vZGInKTsgLy8gSW1wb3J0IHRoZSBkYiBtb2R1bGUgICAgXHJcbiAgICBjb25zdCBzc3QgPSByZXF1aXJlKCcuL3NzdCcpOyAvLyBJbXBvcnQgdGhlIGRiIG1vZHVsZVxyXG4gICAgY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21vZHVsZXMvdXRpbHMnKTtcclxuICAgICAgICBcclxuICAgIGNvbnNvbGUubG9nKFwiTW91bnRlZCBBcHAuLi5cIik7XHJcbiAgICAvL2NvbnN0IHVzZXJfaWQgPSB1dGlscy5nZXRVc2VySUQoKTtcclxuXHJcbiAgICAkKCdhW2hyZWZePVwiL1wiXScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cignaHJlZicpLnN1YnN0cmluZygxKTsgICAgICAgIFxyXG4gICAgICAgIHdpbmRvdy5yb3V0ZXIocGF0aCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmVnaXN0ZXJTZXJ2aWNlV29ya2VyKCk7XHJcbiAgICBjaGVja1N0b3JlZFVwZGF0ZVN0YXRlKCk7XHJcblxyXG4gICAgLy8gQ2xlYXIgdXBkYXRlIGZsYWcgYWZ0ZXIgc3VjY2Vzc2Z1bCB1cGRhdGVcclxuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCAoKSA9PiB7XHJcbiAgICAgICAgc2V0VXBkYXRlQXZhaWxhYmxlKGZhbHNlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExpc3RlbiBmb3IgdXBkYXRlIGV2ZW50c1xyXG4gICAgaWYgKHJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgIHJlZ2lzdHJhdGlvbi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVmb3VuZCcsICgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbmV3V29ya2VyID0gcmVnaXN0cmF0aW9uLmluc3RhbGxpbmc7XHJcbiAgICAgICAgICAgIG5ld1dvcmtlci5hZGRFdmVudExpc3RlbmVyKCdzdGF0ZWNoYW5nZScsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChuZXdXb3JrZXIuc3RhdGUgPT09ICdpbnN0YWxsZWQnICYmIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBzaG93VXBkYXRlQmFyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBvbmxpbmUvb2ZmbGluZSBzdGF0dXNcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvbmxpbmUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKCdBcHAgaXMgb25saW5lJyk7XHJcbiAgICAgICAgZGIuZmV0Y2hBbmRTdG9yZVByb2R1Y3RzKCk7XHJcbiAgICAgICAgLy9kYi5mZXRjaEFuZFN0b3JlVXNlcnMoKTtcclxuICAgICAgICAvL2RiLnN5bmNEYXRhKHV0aWxzLmdldFVzZXJJRCgpKTtcclxuICAgICAgICAkKCcjZ2VuZXJhdGVfZGF0YXNoZWV0c19idXR0b24nKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICQoJyNidG5fdXBkYXRlX2FjY291bnQnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICQoJyNidG5fcHVzaF91c2VyX2RhdGEnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICQoJyNidG5fcHVsbF91c2VyX2RhdGEnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICQoJyNidG5fY2xlYXJfbG9jYWxfc3RvcmFnZScpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgJCgnI2J0bl9sb2dvdXQnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICQoJyNidG5fbG9nb3V0JykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAkKCcuc3luY2ljb24nKS5jc3MoeydvcGFjaXR5JzogJzEwMCUnfSk7XHJcblxyXG4gICAgfSk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29mZmxpbmUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQXBwIGlzIG9mZmxpbmUgLSB1c2luZyBjYWNoZWQgZGF0YScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoJyNnZW5lcmF0ZV9kYXRhc2hlZXRzX2J1dHRvbicpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICAgICAkKCcjYnRuX3VwZGF0ZV9hY2NvdW50JykucHJvcChcImRpc2FibGVkXCIsIHRydWUpO1xyXG4gICAgICAgICQoJyNidG5fcHVzaF91c2VyX2RhdGEnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgJCgnI2J0bl9wdWxsX3VzZXJfZGF0YScpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICAgICAkKCcjYnRuX2NsZWFyX2xvY2FsX3N0b3JhZ2UnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7ICAgICAgICBcclxuICAgICAgICAkKCcjYnRuX2xvZ291dCcpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICAgICAkKCcjYnRuX2xvZ291dCcpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICAgICAkKCcuc3luY2ljb24nKS5yZW1vdmVDbGFzcygnYWN0aXZlJykuY3NzKHsnb3BhY2l0eSc6ICcyMCUnfSk7XHJcblxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSW5pdGlhbGl6ZSBhcHBcclxuICAgIGFzeW5jIGZ1bmN0aW9uIGluaXRBcHAoKSB7XHJcbiAgICAgICAgYXdhaXQgZGIuaW5pdERCKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG5hdmlnYXRvci5vbkxpbmUpIHsgICAgXHJcbiAgICAgICAgICAgIGF3YWl0IGRiLmZldGNoQW5kU3RvcmVQcm9kdWN0cygpOyBcclxuICAgICAgICAgICAgYXdhaXQgZGIuZmV0Y2hBbmRTdG9yZVVzZXJzKCk7XHJcbiAgICAgICAgICAgIC8vYXdhaXQgZGIuc3luY0RhdGEoYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gR2V0IGN1cnJlbnQgcGF0aCBhbmQgcm91dGVcclxuICAgICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWVcclxuICAgICAgICAgICAgLnNwbGl0KCcvJylcclxuICAgICAgICAgICAgLmZpbHRlcihwYXJ0ID0+IHBhcnQubGVuZ3RoID4gMCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcHJvamVjdElkID0gcGF0aFBhcnRzWzFdIHx8ICcnO1xyXG4gICAgICAgIHdpbmRvdy5yb3V0ZXIocGF0aFBhcnRzWzBdIHx8ICdob21lJywgcHJvamVjdElkKTtcclxuXHJcbiAgICAgICAgLy8gU2V0IHRoZSBwcm9qZWN0IGlkIGluIHRoZSBoaWRkZW4gaW5wdXRcclxuICAgICAgICBpZiAocHJvamVjdElkKSB7XHJcbiAgICAgICAgICAgICQoJyNtX3Byb2plY3RfaWQnKS52YWwocHJvamVjdElkKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGluaXRBcHAoKTtcclxufSk7XHJcblxyXG4vLyBIYW5kbGUgcmVsb2FkIGFmdGVyIHVwZGF0ZVxyXG5sZXQgcmVmcmVzaGluZyA9IGZhbHNlO1xyXG5uYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdjb250cm9sbGVyY2hhbmdlJywgKCkgPT4ge1xyXG4gICAgaWYgKCFyZWZyZXNoaW5nKSB7XHJcbiAgICAgICAgcmVmcmVzaGluZyA9IHRydWU7XHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xyXG4gICAgfVxyXG59KTsiLCJjb25zdCBBUElfRU5EUE9JTlRTID0ge1xyXG4gICAgUFJPRFVDVFM6ICdodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9nZXRfYWxsX3Byb2R1Y3RzX25lYXQnLFxyXG4gICAgVVNFUl9EQVRBOiAnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2FsbF91c2VyX2RhdGEnXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEFQSV9FTkRQT0lOVFM7IiwiY29uc3QgeyBvcGVuREIgfSA9IHJlcXVpcmUoJ2lkYicpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vbW9kdWxlcy91dGlscycpO1xyXG5cclxuXHJcbmNvbnN0IERCX05BTUUgPSAnc3N0X2RhdGFiYXNlJztcclxuY29uc3QgREJfVkVSU0lPTiA9IDE4O1xyXG5jb25zdCBTVE9SRV9OQU1FID0gJ3Byb2R1Y3RfZGF0YSc7XHJcblxyXG4vLyBDdXN0b20gZnVuY3Rpb24gdG8gZ2VuZXJhdGUgVVVJRHNcclxuZnVuY3Rpb24gZ2VuZXJhdGVVVUlEKCkge1xyXG4gICAgcmV0dXJuICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24oYykge1xyXG4gICAgICAgIGNvbnN0IHIgPSBNYXRoLnJhbmRvbSgpICogMTYgfCAwLCB2ID0gYyA9PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpO1xyXG4gICAgICAgIHJldHVybiB2LnRvU3RyaW5nKDE2KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gaW5pdERCKCkgeyAgICBcclxuICAgIHJldHVybiBhd2FpdCBvcGVuREIoREJfTkFNRSwgREJfVkVSU0lPTiwge1xyXG4gICAgICAgIHVwZ3JhZGUoZGIpIHtcclxuICAgICAgICAgICAgLy8gQ2hlY2sgYW5kIGNyZWF0ZSBleGlzdGluZyBzdG9yZSBmb3IgcHJvZHVjdHNcclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFNUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgb2JqZWN0IHN0b3JlIGZvciBwcm9kdWN0cy4uLicpO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShTVE9SRV9OQU1FLCB7IGtleVBhdGg6ICdwcm9kdWN0X2NvZGUnIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ3NpdGUnLCAnc2l0ZScsIHsgdW5pcXVlOiBmYWxzZSB9KTsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwicHJvamVjdHNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcImxvY2F0aW9uc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcImxvY2F0aW9uc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJwcm9qZWN0X2lkX2ZrXCIsIFwicHJvamVjdF9pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwiYnVpbGRpbmdzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcImxvY2F0aW9uX2lkX2ZrXCIsIFwibG9jYXRpb25faWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcImZsb29yc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcImZsb29yc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJidWlsZGluZ19pZF9ma1wiLCBcImJ1aWxkaW5nX2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTsgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwicm9vbXNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJyb29tc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJmbG9vcl9pZF9ma1wiLCBcImZsb29yX2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTsgXHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgncm9vbV9pZF9maycsICdyb29tX2lkX2ZrJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcInByb2R1Y3RzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwicHJvZHVjdHNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwicm9vbV9pZF9ma1wiLCBcInJvb21faWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcImZhdm91cml0ZXNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJmYXZvdXJpdGVzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcInNrdV9vd25lclwiLCBbXCJza3VcIiwgXCJvd25lcl9pZFwiXSwgeyB1bmlxdWU6IHRydWUgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7IFxyXG4gICAgICAgICAgICB9ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcIm5vdGVzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwibm90ZXNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwicm9vbV9pZF9ma1wiLCBcInJvb21faWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhcImltYWdlc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcImltYWdlc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJyb29tX2lkX2ZrXCIsIFwicm9vbV9pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwidXNlcnNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJ1c2Vyc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pOyAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdlbWFpbCcsICdlbWFpbCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfSAgICAgICAgICAgIFxyXG5cclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW5kZXhlZERCIGluaXRpYWxpemVkIHdpdGggVVVJRHMgYW5kIG93bmVyX2lkIGluZGV4ZXMuXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hBbmRTdG9yZVByb2R1Y3RzKCkge1xyXG4gICAgY29uc3QgaXNFbXB0eSA9IGF3YWl0IGlzUHJvZHVjdHNUYWJsZUVtcHR5KCk7XHJcbiAgICBpZiAoaXNFbXB0eSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBwcm9kdWN0cyBmcm9tIEFQSS4uLicpO1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9nZXRfYWxsX3Byb2R1Y3RzX25lYXQnKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCBlcnJvciEgU3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHNhdmVQcm9kdWN0cyhwcm9kdWN0cyk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQcm9kdWN0cyBmZXRjaGVkIGFuZCBzYXZlZCB0byBJbmRleGVkREInKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBwcm9kdWN0IGRhdGE6JywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1Byb2R1Y3QgZGF0YSBpcyBwcmVzZW50IGluIGluZGV4ZWREQiwgc2tpcHBpbmcgZmV0Y2guJyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZldGNoQW5kU3RvcmVVc2VycygpIHtcclxuICAgIGNvbnN0IGlzRW1wdHkgPSBhd2FpdCBpc1VzZXJzVGFibGVFbXB0eSgpO1xyXG4gICAgaWYgKGlzRW1wdHkpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRmV0Y2hpbmcgcHJvZHVjdHMgZnJvbSBBUEkuLi4nKTtcclxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2FsbF91c2Vyc19uZWF0Jyk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgZXJyb3IhIFN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHVzZXJzID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgICAgICBhd2FpdCBzYXZlVXNlcnModXNlcnMpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0F1dGggc2F2ZWQgdG8gSW5kZXhlZERCJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgYXV0aCBkYXRhOicsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdBdXRoIGRhdGEgaXMgcHJlc2VudCBpbiBpbmRleGVkREIsIHNraXBwaW5nIGZldGNoLicpO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcHVsbFVzZXJEYXRhKG93bmVyX2lkKSB7XHJcbiAgICBpZiAoIW93bmVyX2lkKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignTm8gb3duZXJfaWQgcHJvdmlkZWQgZm9yIGRhdGEgc3luYycpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gICAgXHJcbiAgICBvd25lcl9pZCA9IG93bmVyX2lkK1wiXCI7IC8vIGVuc3VyZSBpdCdzIGEgc3RyaW5nXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IHtcInVzZXJfaWRcIjogb3duZXJfaWR9OyAvLyBVc2UgdGhlIG93bmVyX2lkIHZhcmlhYmxlXHJcblxyXG4gICAgLy8gdXNlciBoYXMgcHJvamVjdHMsIG9mZmVyIHRvIHB1bGwgZnJvbSBhbmQgc2hvdyB0aGUgcHVzaGVkIGRhdGUgb24gdGhlIHVzZXIgdGFibGUgZm9yIGluZm9ybWF0aW9uXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXCJodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9nZXRfbGFzdF9wdXNoZWRcIiwge1xyXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXHJcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZXJEYXRhKVxyXG4gICAgICAgIH0pOyAgICBcclxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7IHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gKTsgfVxyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7IFxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwicHVzaGVkOiBcIiwgZGF0YS5wdXNoZWQpOyBcclxuICAgICAgICBjb25zdCBsYXN0UHVzaGVkID0gbmV3IERhdGUoZGF0YS5wdXNoZWQpO1xyXG4gICAgICAgIGNvbnN0IGxhc3RQdXNoZWRTdHIgPSBsYXN0UHVzaGVkLnRvTG9jYWxlU3RyaW5nKCk7XHJcbiAgICAgICAgY29uc3QgbGFzdFB1c2hlZEVwb2NoID0gbGFzdFB1c2hlZC5nZXRUaW1lKCk7XHJcbiAgICAgICAgY29uc3QgbGFzdFB1c2hlZEVwb2NoU3RyID0gbGFzdFB1c2hlZEVwb2NoLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgLy8gb2ZmZXIgYSB1aWtpdCBjb25maXJtIGRpYWxvZyB0byBwdWxsbCBkYXRhLCBzaG93aW5nIHRoZSBsYXN0IHB1c2hlZCBkYXRlIGFuZCB0aW1lXHJcbiAgICAgICAgY29uc3Qgc3RyID0gYDxoND5Zb3VyIGxhc3QgcHVzaCB0byB0aGUgc2VydmVyIHdhcyA8YnI+PGI+JHtsYXN0UHVzaGVkU3RyfTwvYj48L2g0PiA8cD5Xb3VsZCB5b3UgbGlrZSB0byBwdWxsIHRoaXMgZGF0YT88L3A+YFxyXG4gICAgICAgICtgPHAgc3R5bGU9XCJjb2xvcjogcmVkOyBmb250LXdlaWdodDogYm9sZFwiPjxzbWFsbD5DbGlja2luZyBPSyB3aWxsIG92ZXJ3cml0ZSBhbnkgbG9jYWwgY2hhbmdlcyBzaW5jZSB0aGlzIGRhdGUuPC9zbWFsbD5gO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0oc3RyKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ29uZmlybWVkLicpXHJcbiAgICAgICAgICAgIHN5bmNEYXRhKG93bmVyX2lkLCB0cnVlKTsgICAgICBcclxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZWplY3RlZC4nKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICB9IGNhdGNoIChlcnJvcikgeyBjb25zb2xlLmVycm9yKFwiRGF0YSBzeW5jIGZhaWxlZDpcIiwgZXJyb3IpOyB9ICAgICAgICBcclxuICAgICAgICBcclxuICAgIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc3luY0RhdGEob3duZXJfaWQsIGZvcmNlID0gZmFsc2UpIHtcclxuICAgIGlmICghb3duZXJfaWQpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBvd25lcl9pZCBwcm92aWRlZCBmb3IgZGF0YSBzeW5jJyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSAgICBcclxuICAgIG93bmVyX2lkID0gb3duZXJfaWQrXCJcIjsgLy8gZW5zdXJlIGl0J3MgYSBzdHJpbmdcclxuICAgIGNvbnN0IHVzZXJEYXRhID0ge1widXNlcl9pZFwiOiBvd25lcl9pZH07IC8vIFVzZSB0aGUgb3duZXJfaWQgdmFyaWFibGVcclxuXHJcbiAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnV29udCBzeW5jIGFzIG9mZmxpbmUnKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICAvL2NvbnN0IGlzRW1wdHkgPSBhd2FpdCBpc0RhdGFiYXNlRW1wdHkoKTsgIC8vIG5haCBJIHRoaW5rIHdlJ2xsIGdyYWIgSlVTVCB0aGUgdXNlciBkYXRhIElGIHRoZWVyIGlzIG5vbmUgYWxyZWFkeVxyXG4gICAgY29uc3QgaGFzUHJvamVjdHMgPSBhd2FpdCBnZXRQcm9qZWN0cyhvd25lcl9pZCk7ICAgIFxyXG5cclxuICAgIC8vIHVzZXIgaGFzIHByb2plY3RzLCBvZmZlciB0byBwdWxsIGZyb20gYW5kIHNob3cgdGhlIHB1c2hlZCBkYXRlIG9uIHRoZSB1c2VyIHRhYmxlIGZvciBpbmZvcm1hdGlvblxyXG4gICAgaWYgKGhhc1Byb2plY3RzLmxlbmd0aCA+IDAgJiYgIWZvcmNlKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0xvY2FsIFByb2plY3RzIGV4aXN0LiBOb3QgZm9yY2luZy4gRG9udCBzeW5jLicpOyAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChmb3JjZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdmb3JjaW5nIHVzZXJkYXRhIFBVTEwnKTtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvYXBpL2dldF9hbGxfdXNlcl9kYXRhXCIsIHtcclxuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXNlckRhdGEpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGRiUmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKERCX05BTUUsIERCX1ZFUlNJT04pO1xyXG4gICAgICAgIGRiUmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xyXG4gICAgICAgICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IGRiLnRyYW5zYWN0aW9uKFxyXG4gICAgICAgICAgICAgICAgW1wicHJvamVjdHNcIiwgXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCIsIFwiZmF2b3VyaXRlc1wiLCBcIm5vdGVzXCIsIFwiaW1hZ2VzXCJdLFxyXG4gICAgICAgICAgICAgICAgXCJyZWFkd3JpdGVcIiApO1xyXG5cclxuICAgICAgICAgICAgICAgIFtcInByb2plY3RzXCIsIFwibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCIsIFwicm9vbXNcIiwgXCJwcm9kdWN0c1wiLCBcImZhdm91cml0ZXNcIiwgXCJub3Rlc1wiLCBcImltYWdlc1wiXS5mb3JFYWNoKFxyXG4gICAgICAgICAgICAgICAgKHN0b3JlTmFtZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoc3RvcmVOYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICBzdG9yZS5jbGVhcigpOyAgLy8gQ2xlYXIgZXhpc3RpbmcgZGF0YVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IHNpbmdsZSBvYmplY3QgdG8gYXJyYXkgaWYgbmVlZGVkXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KGRhdGFbc3RvcmVOYW1lXSkgPyBkYXRhW3N0b3JlTmFtZV0gOiBbZGF0YVtzdG9yZU5hbWVdXTtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0gfHwgIWl0ZW0uaWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYE1pc3NpbmcgSUQgaW4gJHtzdG9yZU5hbWV9OmAsIGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS51dWlkID0gaXRlbS5pZDsgIC8vIE1hcCAnaWQnIHRvICd1dWlkJyBmb3IgSW5kZXhlZERCXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLm93bmVyX2lkID0gb3duZXJfaWQgKyBcIlwiOyAvLyBBZGQgb3duZXJfaWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucm9vbV9pZF9mayA9IGl0ZW0ucm9vbV9pZF9mayB8fCBpdGVtLnV1aWQ7IC8vIHRvZG86IGNoZWNrIGlmIHRoaXMgaXMgY29ycmVjdCAoZGlmZmVyZW50IGZvciBwcm9kdWN0cywgbm90ZXMsIGltYWdlcylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBpdGVtLmlkOyAgICAgICAgLy8gUmVtb3ZlIHRoZSBvcmlnaW5hbCAnaWQnIGZpZWxkIHRvIGF2b2lkIGNvbmZsaWN0c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmUucHV0KGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIC8vIHVwZGF0ZSB0aGUgdXNlcnMgdGFibGUgXCJwdWxsZWRcIiBjb2x1bW4gd2l0aCBkdXJyZW50IGRhdGV0aW1lXHJcbiAgICAgICAgICAgIHNldFB1bGxlZChvd25lcl9pZCk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7bWVzc2FnZTogJ0RhdGEgRmV0Y2ggQ29tcGxldGUgLi4uJywgc3RhdHVzOiAnc3VjY2VzcycsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAxNTAwIH0pO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkRhdGEgc3luY2VkIHRvIEluZGV4ZWREQiBzdWNjZXNzZnVsbHkuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4odHJ1ZSk7ICAgICAgICAgICAgXHJcbiAgICAgICAgfTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkRhdGEgc3luYyBmYWlsZWQ6XCIsIGVycm9yKTtcclxuICAgIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2V0UHVsbGVkKG93bmVyX2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInVzZXJzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInVzZXJzXCIpO1xyXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHN0b3JlLmdldChvd25lcl9pZCk7ICAgICAgICBcclxuICAgIHVzZXIucHVsbGVkID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGF3YWl0IHN0b3JlLnB1dCh1c2VyKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGlzRGF0YWJhc2VFbXB0eSgpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCBwcm9qZWN0Q291bnQgPSBhd2FpdCBkYi5jb3VudCgncHJvamVjdHMnKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uQ291bnQgPSBhd2FpdCBkYi5jb3VudCgnbG9jYXRpb25zJyk7XHJcbiAgICBjb25zdCBidWlsZGluZ0NvdW50ID0gYXdhaXQgZGIuY291bnQoJ2J1aWxkaW5ncycpO1xyXG4gICAgY29uc3QgZmxvb3JDb3VudCA9IGF3YWl0IGRiLmNvdW50KCdmbG9vcnMnKTtcclxuICAgIGNvbnN0IHJvb21Db3VudCA9IGF3YWl0IGRiLmNvdW50KCdyb29tcycpO1xyXG4gICAgY29uc3QgcHJvZHVjdENvdW50ID0gYXdhaXQgZGIuY291bnQoJ3Byb2R1Y3RzJyk7XHJcblxyXG4gICAgcmV0dXJuIHByb2plY3RDb3VudCA9PT0gMCAmJiBsb2NhdGlvbkNvdW50ID09PSAwICYmIGJ1aWxkaW5nQ291bnQgPT09IDAgJiYgZmxvb3JDb3VudCA9PT0gMCAmJiByb29tQ291bnQgPT09IDAgJiYgcHJvZHVjdENvdW50ID09PSAwO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBpc1Byb2R1Y3RzVGFibGVFbXB0eSgpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCBjb3VudCA9IGF3YWl0IGRiLmNvdW50KFNUT1JFX05BTUUpO1xyXG4gICAgcmV0dXJuIGNvdW50ID09PSAwO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBpc1VzZXJzVGFibGVFbXB0eSgpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCBjb3VudCA9IGF3YWl0IGRiLmNvdW50KCd1c2VycycpO1xyXG4gICAgcmV0dXJuIGNvdW50ID09PSAwO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzYXZlUHJvZHVjdHMoZGF0YSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShTVE9SRV9OQU1FKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2YgZGF0YSkge1xyXG4gICAgICAgIGF3YWl0IHN0b3JlLnB1dChwcm9kdWN0KTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgY29uc29sZS5sb2coJ1Byb2R1Y3RzIHN0b3JlZCBpbiBJbmRleGVkREInKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2F2ZVVzZXJzKGRhdGEpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCd1c2VycycsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ3VzZXJzJyk7XHJcblxyXG4gICAgZm9yIChjb25zdCB1c2VyIG9mIGRhdGEpIHtcclxuICAgICAgICBhd2FpdCBzdG9yZS5wdXQodXNlcik7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIGNvbnNvbGUubG9nKCdBdXRoIHN0b3JlZCBpbiBJbmRleGVkREInKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvZHVjdHMoKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihTVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU1RPUkVfTkFNRSk7ICAgIFxyXG4gICAgcmV0dXJuIGF3YWl0IHN0b3JlLmdldEFsbCgpO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlUHJvamVjdChwcm9qZWN0X25hbWUsIGxvY2F0aW9uLCBidWlsZGluZywgZmxvb3IsIHJvb20pIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcbiAgICBjb25zdCBuZXdQcm9qZWN0SUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3QgcHJvamVjdFNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KHByb2plY3RfbmFtZSk7XHJcbiAgICBjb25zdCBwcm9qZWN0ID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5vdyxcclxuICAgICAgICBuYW1lOiBwcm9qZWN0X25hbWUsXHJcbiAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLCBcclxuICAgICAgICBwcm9qZWN0X2lkX2ZrOiBuZXdQcm9qZWN0SUQsXHJcbiAgICAgICAgc2x1ZzogcHJvamVjdFNsdWcsXHJcbiAgICAgICAgdXVpZDogbmV3UHJvamVjdElELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChwcm9qZWN0KTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcblxyXG4gICAgY29uc3QgbG9jYXRpb25JRCA9IGF3YWl0IGFkZExvY2F0aW9uKG5ld1Byb2plY3RJRCwgbG9jYXRpb24pO1xyXG4gICAgY29uc3QgYnVpbGRpbmdJRCA9IGF3YWl0IGFkZEJ1aWxkaW5nKGxvY2F0aW9uSUQsIGJ1aWxkaW5nKTtcclxuICAgIGNvbnN0IGZsb29ySUQgPSBhd2FpdCBhZGRGbG9vcihidWlsZGluZ0lELCBmbG9vcik7XHJcbiAgICBjb25zdCByb29tSUQgPSBhd2FpdCBhZGRSb29tKGZsb29ySUQsIHJvb20pO1xyXG5cclxuICAgIHJldHVybiBwcm9qZWN0LnV1aWQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2plY3RzKHVzZXJfaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0cmFuc2FjdGlvbiA9IGRiLnRyYW5zYWN0aW9uKCdwcm9qZWN0cycsICdyZWFkb25seScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZSgncHJvamVjdHMnKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoJ293bmVyX2lkJyk7XHJcbiAgICB1c2VyX2lkID0gdXNlcl9pZCArIFwiXCI7XHJcbiAgICByZXR1cm4gYXdhaXQgaW5kZXguZ2V0QWxsKHVzZXJfaWQpOyAgICBcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvamVjdEhpZXJhcmNoeShvd25lcl9pZCwgcHJvamVjdF9pZCkge1xyXG4gICAgY29uc29sZS5sb2coXCJGZXRjaGluZyBmcm9tIEluZGV4ZWREQiBmb3IgcHJvamVjdF9pZDpcIiwgcHJvamVjdF9pZCk7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgb3duZXJfaWQgPSBTdHJpbmcob3duZXJfaWQpO1xyXG5cclxuICAgIGxldCBwcm9qZWN0cyA9IGF3YWl0IGRiLmdldEFsbEZyb21JbmRleCgncHJvamVjdHMnLCAnb3duZXJfaWQnLCBvd25lcl9pZCk7XHJcblxyXG4gICAgLy8gRmlsdGVyIHByb2plY3RzIGJ5IHByb2plY3RfaWRcclxuICAgIGlmIChwcm9qZWN0X2lkKSB7XHJcbiAgICAgICAgcHJvamVjdHMgPSBwcm9qZWN0cy5maWx0ZXIocHJvamVjdCA9PiBwcm9qZWN0LnV1aWQgPT09IHByb2plY3RfaWQpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiRmlsdGVyZWQgUHJvamVjdHM6XCIsIHByb2plY3RzKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ05vIHByb2plY3QgSUQsIGdldHRpbmcgYWxsIHByb2plY3RzJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBwcm9qZWN0czogcHJvamVjdHMgfHwgW10sXHJcbiAgICAgICAgbG9jYXRpb25zOiBhd2FpdCBkYi5nZXRBbGxGcm9tSW5kZXgoJ2xvY2F0aW9ucycsICdvd25lcl9pZCcsIG93bmVyX2lkKSB8fCBbXSxcclxuICAgICAgICBidWlsZGluZ3M6IGF3YWl0IGRiLmdldEFsbEZyb21JbmRleCgnYnVpbGRpbmdzJywgJ293bmVyX2lkJywgb3duZXJfaWQpIHx8IFtdLFxyXG4gICAgICAgIGZsb29yczogYXdhaXQgZGIuZ2V0QWxsRnJvbUluZGV4KCdmbG9vcnMnLCAnb3duZXJfaWQnLCBvd25lcl9pZCkgfHwgW10sXHJcbiAgICAgICAgcm9vbXM6IGF3YWl0IGRiLmdldEFsbEZyb21JbmRleCgncm9vbXMnLCAnb3duZXJfaWQnLCBvd25lcl9pZCkgfHwgW11cclxuICAgIH07XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2R1Y3RzRm9yUm9vbShyb29tSWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpOyAgICAgXHJcbiAgICByb29tSWQgPSBTdHJpbmcocm9vbUlkKTtcclxuICAgIHJldHVybiBhd2FpdCBpbmRleC5nZXRBbGwocm9vbUlkKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvZHVjdHNGb3JQcm9qZWN0KHByb2plY3RJZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIHByb2plY3RJZCA9IFN0cmluZyhwcm9qZWN0SWQpOyAgIFxyXG5cclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wicHJvZHVjdHNcIiwgXCJyb29tc1wiLCBcImZsb29yc1wiLCBcImJ1aWxkaW5nc1wiLCBcImxvY2F0aW9uc1wiLCBcInByb2plY3RzXCJdLCBcInJlYWRvbmx5XCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2R1Y3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCByb29tU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3QgZmxvb3JTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgcHJvamVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHByb2R1Y3RTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IHJvb21zID0gYXdhaXQgcm9vbVN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgZmxvb3JzID0gYXdhaXQgZmxvb3JTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5ncyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBsb2NhdGlvbnMgPSBhd2FpdCBsb2NhdGlvblN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgcHJvamVjdHMgPSBhd2FpdCBwcm9qZWN0U3RvcmUuZ2V0QWxsKCk7XHJcblxyXG4gICAgY29uc3QgcHJvamVjdFByb2R1Y3RzID0gcHJvZHVjdHMuZmlsdGVyKHByb2R1Y3QgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJvb20gPSByb29tcy5maW5kKHJvb20gPT4gcm9vbS51dWlkID09PSBwcm9kdWN0LnJvb21faWRfZmspO1xyXG4gICAgICAgIGlmICghcm9vbSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGZsb29yID0gZmxvb3JzLmZpbmQoZmxvb3IgPT4gZmxvb3IudXVpZCA9PT0gcm9vbS5mbG9vcl9pZF9mayk7XHJcbiAgICAgICAgaWYgKCFmbG9vcikgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nID0gYnVpbGRpbmdzLmZpbmQoYnVpbGRpbmcgPT4gYnVpbGRpbmcudXVpZCA9PT0gZmxvb3IuYnVpbGRpbmdfaWRfZmspO1xyXG4gICAgICAgIGlmICghYnVpbGRpbmcpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBsb2NhdGlvbiA9IGxvY2F0aW9ucy5maW5kKGxvY2F0aW9uID0+IGxvY2F0aW9uLnV1aWQgPT09IGJ1aWxkaW5nLmxvY2F0aW9uX2lkX2ZrKTtcclxuICAgICAgICBpZiAoIWxvY2F0aW9uKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdCA9IHByb2plY3RzLmZpbmQocHJvamVjdCA9PiBwcm9qZWN0LnV1aWQgPT09IGxvY2F0aW9uLnByb2plY3RfaWRfZmspO1xyXG4gICAgICAgIHJldHVybiBwcm9qZWN0ICYmIHByb2plY3QudXVpZCA9PT0gcHJvamVjdElkO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVzdWx0ID0gcHJvamVjdFByb2R1Y3RzLnJlZHVjZSgoYWNjLCBwcm9kdWN0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmdQcm9kdWN0ID0gYWNjLmZpbmQocCA9PiBwLnNrdSA9PT0gcHJvZHVjdC5za3UpO1xyXG4gICAgICAgIGlmIChleGlzdGluZ1Byb2R1Y3QpIHtcclxuICAgICAgICAgICAgZXhpc3RpbmdQcm9kdWN0LnF0eSArPSAxO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSByb29tcy5maW5kKHJvb20gPT4gcm9vbS51dWlkID09PSBwcm9kdWN0LnJvb21faWRfZmspO1xyXG4gICAgICAgICAgICBjb25zdCBmbG9vciA9IGZsb29ycy5maW5kKGZsb29yID0+IGZsb29yLnV1aWQgPT09IHJvb20uZmxvb3JfaWRfZmspO1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZGluZyA9IGJ1aWxkaW5ncy5maW5kKGJ1aWxkaW5nID0+IGJ1aWxkaW5nLnV1aWQgPT09IGZsb29yLmJ1aWxkaW5nX2lkX2ZrKTtcclxuICAgICAgICAgICAgY29uc3QgbG9jYXRpb24gPSBsb2NhdGlvbnMuZmluZChsb2NhdGlvbiA9PiBsb2NhdGlvbi51dWlkID09PSBidWlsZGluZy5sb2NhdGlvbl9pZF9mayk7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3QgPSBwcm9qZWN0cy5maW5kKHByb2plY3QgPT4gcHJvamVjdC51dWlkID09PSBsb2NhdGlvbi5wcm9qZWN0X2lkX2ZrKTtcclxuXHJcbiAgICAgICAgICAgIGFjYy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHJlZjogcHJvZHVjdC5yZWYsXHJcbiAgICAgICAgICAgICAgICBwcm9kdWN0X25hbWU6IHByb2R1Y3QucHJvZHVjdF9uYW1lLFxyXG4gICAgICAgICAgICAgICAgcHJvZHVjdF9zbHVnOiBwcm9kdWN0LnByb2R1Y3Rfc2x1ZyxcclxuICAgICAgICAgICAgICAgIHNrdTogcHJvZHVjdC5za3UsXHJcbiAgICAgICAgICAgICAgICBjdXN0b206IHByb2R1Y3QuY3VzdG9tLFxyXG4gICAgICAgICAgICAgICAgb3duZXJfaWQ6IHByb2R1Y3Qub3duZXJfaWQsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X2lkX2ZrOiBwcm9qZWN0LnV1aWQsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X3NsdWc6IHByb2plY3Quc2x1ZyxcclxuICAgICAgICAgICAgICAgIHByb2plY3RfdmVyc2lvbjogcHJvamVjdC52ZXJzaW9uLFxyXG4gICAgICAgICAgICAgICAgcXR5OiAxXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgfSwgW10pO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcblxyXG59XHJcblxyXG5jb25zdCBzYXZlUHJvZHVjdFRvUm9vbSA9IGFzeW5jIChwcm9kdWN0KSA9PiB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInByb2R1Y3RzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG5cclxuICAgIC8vIEVuc3VyZSB0aGUgcHJvZHVjdCBoYXMgYSB1dWlkIGFuZCByb29tX2lkX2ZrXHJcbiAgICBpZiAoIXByb2R1Y3QudXVpZCkge1xyXG4gICAgICAgIHByb2R1Y3QudXVpZCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFwcm9kdWN0LnJvb21faWRfZmspIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyb29tX2lkX2ZrIGlzIHJlcXVpcmVkXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChwcm9kdWN0KTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICBjb25zb2xlLmxvZygnUHJvZHVjdCBhZGRlZCB0byByb29tOicsIHByb2R1Y3QpO1xyXG59O1xyXG5cclxuY29uc3QgZGVsZXRlUHJvZHVjdEZyb21Sb29tID0gYXN5bmMgKHNrdSwgcm9vbV9pZCkgPT4ge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9kdWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21faWQpO1xyXG5cclxuICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgIGlmIChwcm9kdWN0LnNrdSA9PT0gc2t1KSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHN0b3JlLmRlbGV0ZShwcm9kdWN0LnV1aWQpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUHJvZHVjdCBkZWxldGVkIGZyb20gcm9vbTonLCBwcm9kdWN0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IHNldFNrdVF0eUZvclJvb20gPSBhc3luYyAocXR5LCBza3UsIHJvb21faWQpID0+IHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tX2lkKTtcclxuICAgIGNvbnN0IHByb2R1Y3QgPSBwcm9kdWN0cy5maW5kKHAgPT4gcC5za3UgPT09IHNrdSk7XHJcblxyXG4gICAgLy8gUmVtb3ZlIGFsbCBleGlzdGluZyBwcm9kdWN0cyB3aXRoIHRoZSBnaXZlbiBTS1UgaW4gdGhlIHNwZWNpZmllZCByb29tXHJcbiAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2YgcHJvZHVjdHMpIHtcclxuICAgICAgICBpZiAocHJvZHVjdC5za3UgPT09IHNrdSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0RlbGV0aW5nIHByb2R1Y3Q6JywgcHJvZHVjdCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHN0b3JlLmRlbGV0ZShwcm9kdWN0LnV1aWQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBSZS1hZGQgdGhlIHByb2R1Y3RzIHdpdGggdGhlIHNwZWNpZmllZCBxdWFudGl0eVxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdHk7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IG5ld1Byb2R1Y3QgPSB7IC4uLnByb2R1Y3QsIHV1aWQ6IGdlbmVyYXRlVVVJRCgpIH07XHJcbiAgICAgICAgYXdhaXQgc3RvcmUuYWRkKG5ld1Byb2R1Y3QpO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuY29uc3QgdXBkYXRlUHJvZHVjdFJlZiA9IGFzeW5jIChyb29tX2lkLCBza3UsIHJlZikgPT4ge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9kdWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21faWQpO1xyXG4gICAgY29uc3QgcHJvZHVjdCA9IHByb2R1Y3RzLmZpbmQocCA9PiBwLnNrdSA9PT0gc2t1KTsgICAgXHJcblxyXG4gICAgaWYgKHByb2R1Y3QpIHtcclxuICAgICAgICBwcm9kdWN0LnJlZiA9IHJlZjtcclxuICAgICAgICBhd2FpdCBzdG9yZS5wdXQocHJvZHVjdCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb2R1Y3Qgbm90IGZvdW5kIGZvciBTS1U6Jywgc2t1KTtcclxuICAgIH1cclxufVxyXG5cclxuY29uc3QgZ2V0Um9vbU1ldGEgPSBhc3luYyAocm9vbUlkKSA9PiB7XHJcbiAgICByb29tSWQgPSBTdHJpbmcocm9vbUlkKTtcclxuXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IHJvb20gPSBhd2FpdCBpbmRleC5nZXQocm9vbUlkKTsgICAgXHJcbiAgICBpZiAoIXJvb20pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJvb20gd2l0aCBpZCAke3Jvb21JZH0gbm90IGZvdW5kYCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZmxvb3JTdG9yZSA9IGRiLnRyYW5zYWN0aW9uKFwiZmxvb3JzXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCBmbG9vciA9IGF3YWl0IGZsb29yU3RvcmUuZ2V0KHJvb20uZmxvb3JfaWRfZmspO1xyXG4gICAgY29uc3QgYnVpbGRpbmdTdG9yZSA9IGRiLnRyYW5zYWN0aW9uKFwiYnVpbGRpbmdzXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBjb25zdCBidWlsZGluZyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuZ2V0KGZsb29yLmJ1aWxkaW5nX2lkX2ZrKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImxvY2F0aW9uc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb24gPSBhd2FpdCBsb2NhdGlvblN0b3JlLmdldChidWlsZGluZy5sb2NhdGlvbl9pZF9mayk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvY2F0aW9uOiB7IG5hbWU6IGxvY2F0aW9uLm5hbWUsIHV1aWQ6IGxvY2F0aW9uLnV1aWQgfSxcclxuICAgICAgICBidWlsZGluZzogeyBuYW1lOiBidWlsZGluZy5uYW1lLCB1dWlkOiBidWlsZGluZy51dWlkIH0sXHJcbiAgICAgICAgZmxvb3I6IHsgbmFtZTogZmxvb3IubmFtZSwgdXVpZDogZmxvb3IudXVpZCB9LFxyXG4gICAgICAgIHJvb206IHsgbmFtZTogcm9vbS5uYW1lLCB1dWlkOiByb29tLnV1aWQsIGhlaWdodDogcm9vbS5oZWlnaHQsIHdpZHRoOiByb29tLndpZHRoLCBsZW5ndGg6IHJvb20ubGVuZ3RoIH1cclxuICAgIH07XHJcbn07XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRSb29tTm90ZXMocm9vbUlkKSB7XHJcbiAgICByb29tSWQgPSBTdHJpbmcocm9vbUlkKTtcclxuXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcIm5vdGVzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibm90ZXNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21JZCk7XHJcbiAgICBub3Rlcy5zb3J0KChhLCBiKSA9PiBuZXcgRGF0ZShiLmNyZWF0ZWRfb24pIC0gbmV3IERhdGUoYS5jcmVhdGVkX29uKSk7XHJcbiAgICByZXR1cm4gbm90ZXM7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBhZGRSb29tKGZsb29yVXVpZCwgcm9vbU5hbWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBsZXQgdHgxID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGxldCBzdG9yZTEgPSB0eDEub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGxldCBuZXdSb29tSUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3Qgcm9vbVNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KHJvb21OYW1lKTtcclxuICAgIC8vIGkgbmVlZCB0byBjaGVjayBpZiB0aGlzIHJvb20gYWxyZWFkeSBleGlzdHMgaW4gdGhpcyBwcm9qZWN0XHJcbiAgICBjb25zdCBleGlzdGluZ1Jvb21zID0gYXdhaXQgc3RvcmUxLmdldEFsbCgpO1xyXG4gICAgLy9jb25zb2xlLmxvZygnRXhpc3Rpbmcgcm9vbXM6JywgZXhpc3RpbmdSb29tcyk7XHJcbiAgICBjb25zdCBleGlzdGluZ1Jvb20gPSBleGlzdGluZ1Jvb21zLmZpbmQocm9vbSA9PiByb29tLnNsdWcgPT0gcm9vbVNsdWcgJiYgcm9vbS5mbG9vcl9pZF9mayA9PSBmbG9vclV1aWQpO1xyXG4gICAgLy9jb25zb2xlLmxvZygnRXhpc3Rpbmcgcm9vbTonLCBleGlzdGluZ1Jvb20pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJfdXVpZCA9ICQoJyNtX3VzZXJfaWQnKS52YWwoKTtcclxuXHJcbiAgICBpZiAoZXhpc3RpbmdSb29tKSB7ICAgICAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAgIFxyXG4gICAgfVxyXG4gICAgLy8gaWYgdGhlIHJvb20gZXhpc3RzIEFOWVdIRVJFIGluIHRoaXMgUFJPSkVDVFxyXG4gICAgY29uc3QgY3VycmVudFByb2plY3QgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50UHJvamVjdCcpIHx8ICd7fScpOyAgICBcclxuICAgIGNvbnN0IHByb2plY3RTdG9yZSA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgcHJvamVjdCA9IGF3YWl0IHByb2plY3RTdG9yZS5nZXQoU3RyaW5nKGN1cnJlbnRQcm9qZWN0LnByb2plY3RfaWQpKTsgICAgXHJcbiAgICBcclxuICAgIFxyXG5cclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImxvY2F0aW9uc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5pbmRleChcInByb2plY3RfaWRfZmtcIikuZ2V0QWxsKHVzZXJfdXVpZCk7XHJcbiAgIFxyXG4gICAgY29uc3QgYnVpbGRpbmdTdG9yZSA9IGRiLnRyYW5zYWN0aW9uKFwiYnVpbGRpbmdzXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBsZXQgYnVpbGRpbmdzID0gW107XHJcbiAgICBmb3IgKGNvbnN0IGxvY2F0aW9uIG9mIGxvY2F0aW9ucykge1xyXG4gICAgICAgIGNvbnN0IGxvY2F0aW9uQnVpbGRpbmdzID0gYXdhaXQgYnVpbGRpbmdTdG9yZS5pbmRleChcImxvY2F0aW9uX2lkX2ZrXCIpLmdldEFsbChsb2NhdGlvbi51dWlkKTtcclxuICAgICAgICBidWlsZGluZ3MgPSBidWlsZGluZ3MuY29uY2F0KGxvY2F0aW9uQnVpbGRpbmdzKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImZsb29yc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgbGV0IGZsb29ycyA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBidWlsZGluZyBvZiBidWlsZGluZ3MpIHtcclxuICAgICAgICBjb25zdCBidWlsZGluZ0Zsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuaW5kZXgoXCJidWlsZGluZ19pZF9ma1wiKS5nZXRBbGwoYnVpbGRpbmcudXVpZCk7XHJcbiAgICAgICAgZmxvb3JzID0gZmxvb3JzLmNvbmNhdChidWlsZGluZ0Zsb29ycyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCByb29tU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGxldCByb29tcyA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBmbG9vciBvZiBmbG9vcnMpIHtcclxuICAgICAgICBjb25zdCBmbG9vclJvb21zID0gYXdhaXQgcm9vbVN0b3JlLmluZGV4KFwiZmxvb3JfaWRfZmtcIikuZ2V0QWxsKGZsb29yLnV1aWQpO1xyXG4gICAgICAgIHJvb21zID0gcm9vbXMuY29uY2F0KGZsb29yUm9vbXMpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZXhpc3RpbmdSb29tSW5Qcm9qZWN0ID0gcm9vbXMuZmluZChyb29tID0+IHJvb20uc2x1ZyA9PT0gcm9vbVNsdWcpO1xyXG4gICAgaWYgKGV4aXN0aW5nUm9vbUluUHJvamVjdCkgeyAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICBcclxuICAgIFxyXG4gICAgLy8gYWRkIHRoZSByb29tXHJcbiAgICBsZXQgdHggPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgbGV0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IHJvb20gPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGZsb29yX2lkX2ZrOiBTdHJpbmcoZmxvb3JVdWlkKSxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5vdyxcclxuICAgICAgICBuYW1lOiByb29tTmFtZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIHJvb21faWRfZms6IG5ld1Jvb21JRCxcclxuICAgICAgICBzbHVnOiByb29tU2x1ZyxcclxuICAgICAgICB1dWlkOiBuZXdSb29tSUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKHJvb20pO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIHJldHVybiByb29tLnV1aWQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEZsb29yKGJ1aWxkaW5nVXVpZCwgZmxvb3JOYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImZsb29yc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCBuZXdGbG9vcklEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IGZsb29yU2x1ZyA9IGF3YWl0IHV0aWxzLnNsdWdpZnkoZmxvb3JOYW1lKTtcclxuICAgIGNvbnN0IGZsb29yID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBidWlsZGluZ19pZF9mazogU3RyaW5nKGJ1aWxkaW5nVXVpZCksXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogZmxvb3JOYW1lLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSwgXHJcbiAgICAgICAgZmxvb3JfaWRfZms6IG5ld0Zsb29ySUQsXHJcbiAgICAgICAgc2x1ZzogZmxvb3JTbHVnLFxyXG4gICAgICAgIHV1aWQ6IG5ld0Zsb29ySUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKGZsb29yKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gZmxvb3IudXVpZDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkTG9jYXRpb24ocHJvamVjdFV1aWQsIGxvY2F0aW9uTmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJsb2NhdGlvbnNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgbmV3TG9jYXRpb25JRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBjb25zdCBsb2NhdGlvblNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KGxvY2F0aW9uTmFtZSk7XHJcbiAgICBjb25zdCBsb2NhdGlvbiA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogbG9jYXRpb25OYW1lLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSwgXHJcbiAgICAgICAgbG9jYXRpb25faWRfZms6IG5ld0xvY2F0aW9uSUQsXHJcbiAgICAgICAgcHJvamVjdF9pZF9mazogcHJvamVjdFV1aWQsXHJcbiAgICAgICAgc2x1ZzogbG9jYXRpb25TbHVnLFxyXG4gICAgICAgIHV1aWQ6IG5ld0xvY2F0aW9uSUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKGxvY2F0aW9uKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gbG9jYXRpb24udXVpZDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkQnVpbGRpbmcobG9jYXRpb25VdWlkLCBidWlsZGluZ05hbWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwiYnVpbGRpbmdzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGNvbnN0IG5ld0J1aWxkaW5nSUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdTbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShidWlsZGluZ05hbWUpO1xyXG4gICAgY29uc3QgYnVpbGRpbmcgPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGxvY2F0aW9uX2lkX2ZrOiBTdHJpbmcobG9jYXRpb25VdWlkKSxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5vdyxcclxuICAgICAgICBuYW1lOiBidWlsZGluZ05hbWUsXHJcbiAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLCBcclxuICAgICAgICBidWlsZGluZ19pZF9mazogbmV3QnVpbGRpbmdJRCxcclxuICAgICAgICBzbHVnOiBidWlsZGluZ1NsdWcsXHJcbiAgICAgICAgdXVpZDogbmV3QnVpbGRpbmdJRCxcclxuICAgICAgICB2ZXJzaW9uOiBcIjFcIlxyXG4gICAgfTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5hZGQoYnVpbGRpbmcpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIHJldHVybiBidWlsZGluZy51dWlkO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVtb3ZlUm9vbShyb29tVXVpZCkgeyAgICBcclxuICAgIHJvb21VdWlkID0gXCJcIiArIHJvb21VdWlkO1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wicm9vbXNcIiwgXCJwcm9kdWN0c1wiXSwgXCJyZWFkd3JpdGVcIik7XHJcblxyXG4gICAgLy8gUmVtb3ZlIHRoZSByb29tXHJcbiAgICBjb25zb2xlLmxvZygncmVtb3Zpbmcgcm9vbSB1dWlkOiAnLCByb29tVXVpZCk7XHJcbiAgICBjb25zdCByb29tU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgcm9vbVV1aWQudG9TdHJpbmcoKTtcclxuICAgIGNvbnNvbGUubG9nKCd0eXBlb2Y6ICcsdHlwZW9mIHJvb21VdWlkKTtcclxuICAgIGF3YWl0IHJvb21TdG9yZS5kZWxldGUocm9vbVV1aWQpO1xyXG5cclxuICAgIC8vIFJlbW92ZSBhbGwgcHJvZHVjdHMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgcm9vbVxyXG4gICAgY29uc3QgcHJvZHVjdHNTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHByb2R1Y3RzU3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBpbmRleC5nZXRBbGwocm9vbVV1aWQpO1xyXG4gICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgYXdhaXQgcHJvZHVjdHNTdG9yZS5kZWxldGUocHJvZHVjdC51dWlkKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZW1vdmVGbG9vcihmbG9vclV1aWQpIHsgICAgXHJcbiAgICBmbG9vclV1aWQgPSBcIlwiICsgZmxvb3JVdWlkO1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wiZmxvb3JzXCIsIFwicm9vbXNcIiwgXCJwcm9kdWN0c1wiXSwgXCJyZWFkd3JpdGVcIik7XHJcblxyXG4gICAgLy8gUmVtb3ZlIHRoZSBmbG9vclxyXG4gICAgY29uc29sZS5sb2coJ3JlbW92aW5nIGZsb29yIHV1aWQ6ICcgKyBmbG9vclV1aWQpO1xyXG4gICAgY29uc3QgZmxvb3JTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgYXdhaXQgZmxvb3JTdG9yZS5kZWxldGUoZmxvb3JVdWlkKTtcclxuXHJcbiAgICAvLyByZW1vdmUgYWxsIHByb2R1Y3RzIGFzc29jaWF0ZWQgd2l0aCBhbGwgcm9vbXMgd2l0aGluIHRoaXMgZmxvb3IgZmlyc3RcclxuICAgIGNvbnN0IHByb2R1Y3RzU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IHJvb21JbmRleCA9IHByb2R1Y3RzU3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSByb29tU3RvcmUuaW5kZXgoXCJmbG9vcl9pZF9ma1wiKTtcclxuICAgIGNvbnN0IHJvb21zID0gYXdhaXQgaW5kZXguZ2V0QWxsKGZsb29yVXVpZCk7XHJcblxyXG4gICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XHJcbiAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCByb29tSW5kZXguZ2V0QWxsKHJvb20udXVpZCk7XHJcbiAgICAgICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHByb2R1Y3RzU3RvcmUuZGVsZXRlKHByb2R1Y3QudXVpZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIHJlbW92ZSBhbGwgcm9vbXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZmxvb3JcclxuICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgIGF3YWl0IHJvb21TdG9yZS5kZWxldGUocm9vbS51dWlkKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVtb3ZlQnVpbGRpbmcoYnVpbGRpbmdVdWlkKSB7XHJcbiAgICBidWlsZGluZ1V1aWQgPSBTdHJpbmcoYnVpbGRpbmdVdWlkKTtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcImJ1aWxkaW5nc1wiLCBcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIl0sIFwicmVhZHdyaXRlXCIpO1xyXG5cclxuICAgIC8vIFJlbW92ZSB0aGUgYnVpbGRpbmdcclxuICAgIGNvbnNvbGUubG9nKCdyZW1vdmluZyBidWlsZGluZyB1dWlkOiAnICsgYnVpbGRpbmdVdWlkKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGF3YWl0IGJ1aWxkaW5nU3RvcmUuZGVsZXRlKGJ1aWxkaW5nVXVpZCk7XHJcblxyXG4gICAgLy8gcmVtb3ZlIGFsbCBmbG9vcnMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgYnVpbGRpbmdcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBidWlsZGluZ0Zsb29ycyA9IGZsb29ycy5maWx0ZXIoZmxvb3IgPT4gZmxvb3IuYnVpbGRpbmdfaWRfZmsgPT09IGJ1aWxkaW5nVXVpZCk7XHJcblxyXG4gICAgZm9yIChjb25zdCBmbG9vciBvZiBidWlsZGluZ0Zsb29ycykge1xyXG4gICAgICAgIC8vIHJlbW92ZSBhbGwgcHJvZHVjdHMgYXNzb2NpYXRlZCB3aXRoIGFsbCByb29tcyB3aXRoaW4gdGhpcyBmbG9vciBmaXJzdFxyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICAgICAgY29uc3Qgcm9vbUluZGV4ID0gcHJvZHVjdHNTdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcbiAgICAgICAgY29uc3QgaW5kZXggPSByb29tU3RvcmUuaW5kZXgoXCJmbG9vcl9pZF9ma1wiKTtcclxuICAgICAgICBjb25zdCByb29tcyA9IGF3YWl0IGluZGV4LmdldEFsbChmbG9vci51dWlkKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcm9vbUluZGV4LmdldEFsbChyb29tLnV1aWQpO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2YgcHJvZHVjdHMpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHByb2R1Y3RzU3RvcmUuZGVsZXRlKHByb2R1Y3QudXVpZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlbW92ZSBhbGwgcm9vbXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZmxvb3JcclxuICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2Ygcm9vbXMpIHtcclxuICAgICAgICAgICAgYXdhaXQgcm9vbVN0b3JlLmRlbGV0ZShyb29tLnV1aWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVtb3ZlIHRoZSBmbG9vciBpdHNlbGZcclxuICAgICAgICBhd2FpdCBmbG9vclN0b3JlLmRlbGV0ZShmbG9vci51dWlkKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlTmFtZShzdG9yZSwgdXVpZCwgbmV3TmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oc3RvcmUsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgb2JqZWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZSk7XHJcbiAgICB1dWlkID0gU3RyaW5nKHV1aWQpO1xyXG4gICAgY29uc3QgcmVjb3JkID0gYXdhaXQgb2JqZWN0U3RvcmUuZ2V0KHV1aWQpO1xyXG4gICAgcmVjb3JkLm5hbWUgPSBuZXdOYW1lO1xyXG4gICAgcmVjb3JkLnNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KG5ld05hbWUpO1xyXG4gICAgYXdhaXQgb2JqZWN0U3RvcmUucHV0KHJlY29yZCk7XHJcbiAgICBhd2FpdCB0eC5kb25lOyAgICBcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvamVjdFN0cnVjdHVyZShwcm9qZWN0SWQpIHtcclxuICAgIG93bmVyX2lkID0gYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgb3duZXJfaWQgPSBTdHJpbmcob3duZXJfaWQpO1xyXG5cclxuICAgIGNvbnN0IGhpZXJhcmNoeSA9IGF3YWl0IGdldFByb2plY3RIaWVyYXJjaHkob3duZXJfaWQsIHByb2plY3RJZCk7IFxyXG4gICAgbGV0IHJlc3VsdCA9IHt9O1xyXG5cclxuICAgIC8vIEdldCB0aGUgcHJvamVjdCBkZXRhaWxzXHJcbiAgICBjb25zdCBwcm9qZWN0ID0gaGllcmFyY2h5LnByb2plY3RzWzBdO1xyXG4gICAgaWYgKCFwcm9qZWN0KSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAvLyBJbml0aWFsaXplIHByb2plY3QgbGV2ZWxcclxuICAgIHJlc3VsdCA9IHtcclxuICAgICAgICBwcm9qZWN0X25hbWU6IHByb2plY3QubmFtZSxcclxuICAgICAgICBwcm9qZWN0X3NsdWc6IHByb2plY3Quc2x1ZyxcclxuICAgICAgICBwcm9qZWN0X2lkOiBwcm9qZWN0LnV1aWRcclxuICAgIH07XHJcblxyXG4gICAgLy8gR2V0IGxvY2F0aW9ucyBmb3IgdGhpcyBwcm9qZWN0XHJcbiAgICBjb25zdCBwcm9qZWN0TG9jYXRpb25zID0gaGllcmFyY2h5LmxvY2F0aW9uc1xyXG4gICAgICAgIC5maWx0ZXIobG9jID0+IGxvYy5wcm9qZWN0X2lkX2ZrID09PSBwcm9qZWN0LnV1aWQpO1xyXG5cclxuICAgIC8vIEJ1aWxkIGxvY2F0aW9uIGxldmVsXHJcbiAgICBwcm9qZWN0TG9jYXRpb25zLmZvckVhY2gobG9jYXRpb24gPT4ge1xyXG4gICAgICAgIHJlc3VsdFtsb2NhdGlvbi5zbHVnXSA9IHtcclxuICAgICAgICAgICAgbG9jYXRpb25fbmFtZTogbG9jYXRpb24ubmFtZSxcclxuICAgICAgICAgICAgbG9jYXRpb25fc2x1ZzogbG9jYXRpb24uc2x1ZyxcclxuICAgICAgICAgICAgbG9jYXRpb25faWQ6IGxvY2F0aW9uLnV1aWRcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyBHZXQgYnVpbGRpbmdzIGZvciB0aGlzIGxvY2F0aW9uXHJcbiAgICAgICAgY29uc3QgbG9jYXRpb25CdWlsZGluZ3MgPSBoaWVyYXJjaHkuYnVpbGRpbmdzXHJcbiAgICAgICAgICAgIC5maWx0ZXIoYnVpbGQgPT4gYnVpbGQubG9jYXRpb25faWRfZmsgPT09IGxvY2F0aW9uLnV1aWQpO1xyXG5cclxuICAgICAgICAvLyBCdWlsZCBidWlsZGluZyBsZXZlbFxyXG4gICAgICAgIGxvY2F0aW9uQnVpbGRpbmdzLmZvckVhY2goYnVpbGRpbmcgPT4ge1xyXG4gICAgICAgICAgICByZXN1bHRbbG9jYXRpb24uc2x1Z11bYnVpbGRpbmcuc2x1Z10gPSB7XHJcbiAgICAgICAgICAgICAgICBidWlsZGluZ19uYW1lOiBidWlsZGluZy5uYW1lLFxyXG4gICAgICAgICAgICAgICAgYnVpbGRpbmdfc2x1ZzogYnVpbGRpbmcuc2x1ZyxcclxuICAgICAgICAgICAgICAgIGJ1aWxkaW5nX2lkOiBidWlsZGluZy51dWlkXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAvLyBHZXQgZmxvb3JzIGZvciB0aGlzIGJ1aWxkaW5nXHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkaW5nRmxvb3JzID0gaGllcmFyY2h5LmZsb29yc1xyXG4gICAgICAgICAgICAgICAgLmZpbHRlcihmbG9vciA9PiBmbG9vci5idWlsZGluZ19pZF9mayA9PT0gYnVpbGRpbmcudXVpZCk7XHJcblxyXG4gICAgICAgICAgICAvLyBCdWlsZCBmbG9vciBsZXZlbFxyXG4gICAgICAgICAgICBidWlsZGluZ0Zsb29ycy5mb3JFYWNoKGZsb29yID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFtsb2NhdGlvbi5zbHVnXVtidWlsZGluZy5zbHVnXVtmbG9vci5zbHVnXSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBmbG9vcl9uYW1lOiBmbG9vci5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIGZsb29yX3NsdWc6IGZsb29yLnNsdWcsXHJcbiAgICAgICAgICAgICAgICAgICAgZmxvb3JfaWQ6IGZsb29yLnV1aWRcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHJvb21zIGZvciB0aGlzIGZsb29yXHJcbiAgICAgICAgICAgICAgICBjb25zdCBmbG9vclJvb21zID0gaGllcmFyY2h5LnJvb21zXHJcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihyb29tID0+IHJvb20uZmxvb3JfaWRfZmsgPT09IGZsb29yLnV1aWQpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEJ1aWxkIHJvb20gbGV2ZWxcclxuICAgICAgICAgICAgICAgIGZsb29yUm9vbXMuZm9yRWFjaChyb29tID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRbbG9jYXRpb24uc2x1Z11bYnVpbGRpbmcuc2x1Z11bZmxvb3Iuc2x1Z11bcm9vbS5zbHVnXSA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbV9uYW1lOiByb29tLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvb21fc2x1Zzogcm9vbS5zbHVnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByb29tX2lkOiByb29tLnV1aWRcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2plY3RCeVVVSUQodXVpZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9qZWN0c1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgcHJvamVjdCA9IGF3YWl0IHN0b3JlLmdldCh1dWlkKTtcclxuICAgIHJldHVybiBwcm9qZWN0O1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVQcm9qZWN0RGV0YWlscyhwcm9qZWN0RGF0YSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9qZWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5wdXQocHJvamVjdERhdGEpO1xyXG4gICAgYXdhaXQgdHguZG9uZTsgICAgXHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVSb29tRGltZW5zaW9uKHJvb21VdWlkLCBmaWVsZCwgdmFsdWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicm9vbXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCByb29tID0gYXdhaXQgc3RvcmUuZ2V0KHJvb21VdWlkKTtcclxuICAgIHJvb21bZmllbGRdID0gdmFsdWU7XHJcbiAgICBhd2FpdCBzdG9yZS5wdXQocm9vbSk7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjb3B5Um9vbShyb29tVXVpZCwgbmV3Um9vbU5hbWUsIG5ld0Zsb29yVXVpZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4MSA9IGRiLnRyYW5zYWN0aW9uKFwicm9vbXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4MS5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3Qgcm9vbSA9IGF3YWl0IHN0b3JlLmdldChyb29tVXVpZCk7XHJcbiAgICBjb25zdCBuZXdVdWlkID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICBjb25zdCBuZXdSb29tID0geyAuLi5yb29tLCB1dWlkOiBuZXdVdWlkIH07XHJcbiAgICBjb25zb2xlLmxvZygnQ29weWluZyByb29tIHRvIG5ldyByb29tJywgcm9vbVV1aWQsIG5ld1Jvb20udXVpZCk7XHJcbiAgICAvLyBhcHBlbmQgIFwiIC0gY29weVwiIHRvIHJvb20gbmFtZSByb29tIHNsdWcgXHJcbiAgICBuZXdSb29tLm5hbWUgPSBuZXdSb29tTmFtZSB8fCBuZXdSb29tLm5hbWUgKyBcIiAtIENvcHlcIjtcclxuICAgIG5ld1Jvb20uc2x1ZyA9IGF3YWl0IHV0aWxzLnNsdWdpZnkobmV3Um9vbS5uYW1lKTsgIFxyXG4gICAgbmV3Um9vbS5yb29tX2lkX2ZrID0gbmV3VXVpZDtcclxuICAgIG5ld1Jvb20uZmxvb3JfaWRfZmsgPSBuZXdGbG9vclV1aWQgfHwgbmV3Um9vbS5mbG9vcl9pZF9maztcclxuICAgIGRlbGV0ZSBuZXdSb29tLmlkO1xyXG4gICAgYXdhaXQgc3RvcmUuYWRkKG5ld1Jvb20pO1xyXG4gICAgYXdhaXQgdHgxLmRvbmU7XHJcblxyXG4gICAgLy8gbm93IGFsc28gY29weSB0aGUgcHJvZHVjdHMgaW4gdGhlIG9sZCByb29tIHRvIHRoZSBuZXcgcm9vbVxyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBnZXRQcm9kdWN0c0ZvclJvb20ocm9vbVV1aWQpO1xyXG4gICAgY29uc3QgdHgyID0gZGIudHJhbnNhY3Rpb24oXCJwcm9kdWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHByb2R1Y3RTdG9yZSA9IHR4Mi5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgcHJvZHVjdC5yb29tX2lkX2ZrID0gbmV3VXVpZDtcclxuICAgICAgICBwcm9kdWN0LnV1aWQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuICAgICAgICBhd2FpdCBwcm9kdWN0U3RvcmUuYWRkKHByb2R1Y3QpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHR4Mi5kb25lO1xyXG59XHJcblxyXG4vLyBnZXQgYWxsIGZsb29ycyBpbiB0aGlzIHByb2plY3QgXHJcbmFzeW5jIGZ1bmN0aW9uIGdldEZsb29ycyhwcm9qZWN0X2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIl0sIFwicmVhZG9ubHlcIik7XHJcblxyXG4gICAgLy8gR2V0IGxvY2F0aW9ucyByZWxhdGVkIHRvIHRoZSBwcm9qZWN0XHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJsb2NhdGlvbnNcIik7XHJcbiAgICBjb25zdCBsb2NhdGlvbnMgPSBhd2FpdCBsb2NhdGlvblN0b3JlLmluZGV4KFwicHJvamVjdF9pZF9ma1wiKS5nZXRBbGwocHJvamVjdF9pZCk7XHJcblxyXG4gICAgLy8gR2V0IGJ1aWxkaW5ncyByZWxhdGVkIHRvIHRob3NlIGxvY2F0aW9uc1xyXG4gICAgY29uc3QgYnVpbGRpbmdTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgbGV0IGJ1aWxkaW5ncyA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBsb2NhdGlvbiBvZiBsb2NhdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBsb2NhdGlvbkJ1aWxkaW5ncyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuaW5kZXgoXCJsb2NhdGlvbl9pZF9ma1wiKS5nZXRBbGwobG9jYXRpb24udXVpZCk7XHJcbiAgICAgICAgYnVpbGRpbmdzID0gYnVpbGRpbmdzLmNvbmNhdChsb2NhdGlvbkJ1aWxkaW5ncyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2V0IGZsb29ycyB1bmRlciB0aG9zZSBidWlsZGluZ3NcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGxldCBmbG9vcnMgPSBbXTtcclxuICAgIGZvciAoY29uc3QgYnVpbGRpbmcgb2YgYnVpbGRpbmdzKSB7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdGbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmluZGV4KFwiYnVpbGRpbmdfaWRfZmtcIikuZ2V0QWxsKGJ1aWxkaW5nLnV1aWQpO1xyXG4gICAgICAgIGZsb29ycyA9IGZsb29ycy5jb25jYXQoYnVpbGRpbmdGbG9vcnMpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZsb29yQXJyYXkgPSBbXTtcclxuICAgIGZvciAoY29uc3QgZmxvb3Igb2YgZmxvb3JzKSB7XHJcbiAgICAgICAgZmxvb3JBcnJheS5wdXNoKHt1dWlkOiBmbG9vci51dWlkLCBuYW1lOiBmbG9vci5uYW1lfSk7XHJcbiAgICB9ICAgXHJcbiAgICByZXR1cm4gZmxvb3JBcnJheTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZVByb2plY3QocHJvamVjdF9pZCkge1xyXG4gICAgLy8gcmF0aGVyIHRoYW4gZGVsZXRlIGFueXRoaW5nIGZyb20gdGhlIGRhdGFiYXNlLCBpIGp1c3Qgd2FudCB0byBjaGFuZ2UgdGhlIG93bmVyX2lmIG9mIHRoZSBwcm9qZWN0IHRvIHByZXBlbmRdIDk5OSBpbiBmcm9udCBcclxuICAgIC8vIGJ1dCBvbmx5IGluIHRoZSBwcm9qZWN0cyB0YWJsZSwgc28gdGhhdCBpdCBpcyBub3Qgc2hvd24gaW4gdGhlIHByb2plY3QgbGlzdFxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9qZWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBzdG9yZS5nZXQocHJvamVjdF9pZCk7XHJcbiAgICBwcm9qZWN0Lm93bmVyX2lkID0gXCI5OTlcIiArIHByb2plY3Qub3duZXJfaWQ7XHJcbiAgICBhd2FpdCBzdG9yZS5wdXQocHJvamVjdCk7XHJcbiAgICBhd2FpdCB0eC5kb25lOyAgIFxyXG59XHJcblxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGNvcHlQcm9qZWN0KHByb2plY3RfaWQsIHByb2plY3ROYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJwcm9qZWN0c1wiLCBcImxvY2F0aW9uc1wiLCBcImJ1aWxkaW5nc1wiLCBcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIl0sIFwicmVhZHdyaXRlXCIpO1xyXG5cclxuICAgIC8vIENvcHkgdGhlIHByb2plY3RcclxuICAgIGNvbnN0IHByb2plY3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcbiAgICBjb25zdCBwcm9qZWN0ID0gYXdhaXQgcHJvamVjdFN0b3JlLmdldChwcm9qZWN0X2lkKTtcclxuICAgIGNvbnN0IG5ld1Byb2plY3RJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgY29uc3QgbmV3UHJvamVjdCA9IHsgLi4ucHJvamVjdCwgdXVpZDogbmV3UHJvamVjdElELCBuYW1lOiBwcm9qZWN0TmFtZSwgcm9vbV9pZF9mazogbmV3UHJvamVjdElEIH07XHJcbiAgICBhd2FpdCBwcm9qZWN0U3RvcmUuYWRkKG5ld1Byb2plY3QpO1xyXG5cclxuICAgIC8vIENvcHkgdGhlIGxvY2F0aW9uc1xyXG4gICAgY29uc3QgbG9jYXRpb25TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5pbmRleChcInByb2plY3RfaWRfZmtcIikuZ2V0QWxsKHByb2plY3RfaWQpO1xyXG4gICAgZm9yIChjb25zdCBsb2NhdGlvbiBvZiBsb2NhdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBuZXdMb2NhdGlvbklEID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgY29uc3QgbmV3TG9jYXRpb24gPSB7IC4uLmxvY2F0aW9uLCB1dWlkOiBuZXdMb2NhdGlvbklELCBwcm9qZWN0X2lkX2ZrOiBuZXdQcm9qZWN0SUQsIHJvb21faWZfZms6IG5ld0xvY2F0aW9uSUQgfTtcclxuICAgICAgICBhd2FpdCBsb2NhdGlvblN0b3JlLmFkZChuZXdMb2NhdGlvbik7XHJcblxyXG4gICAgICAgIC8vIENvcHkgdGhlIGJ1aWxkaW5nc1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgICAgICBjb25zdCBidWlsZGluZ3MgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmluZGV4KFwibG9jYXRpb25faWRfZmtcIikuZ2V0QWxsKGxvY2F0aW9uLnV1aWQpOyAgICBcclxuICAgICAgICBmb3IgKGNvbnN0IGJ1aWxkaW5nIG9mIGJ1aWxkaW5ncykge1xyXG4gICAgICAgICAgICBjb25zdCBuZXdCdWlsZGluZ0lEID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld0J1aWxkaW5nID0geyAuLi5idWlsZGluZywgdXVpZDogbmV3QnVpbGRpbmdJRCwgbG9jYXRpb25faWRfZms6IG5ld0xvY2F0aW9uSUQsIHJvb21faWRfZms6IG5ld0J1aWxkaW5nSUQgfTtcclxuICAgICAgICAgICAgYXdhaXQgYnVpbGRpbmdTdG9yZS5hZGQobmV3QnVpbGRpbmcpO1xyXG5cclxuICAgICAgICAgICAgLy8gQ29weSB0aGUgZmxvb3JzXHJcbiAgICAgICAgICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgICAgICAgICAgY29uc3QgZmxvb3JzID0gYXdhaXQgZmxvb3JTdG9yZS5pbmRleChcImJ1aWxkaW5nX2lkX2ZrXCIpLmdldEFsbChidWlsZGluZy51dWlkKTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCBmbG9vciBvZiBmbG9vcnMpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0Zsb29ySUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0Zsb29yID0geyAuLi5mbG9vciwgdXVpZDogbmV3Rmxvb3JJRCwgYnVpbGRpbmdfaWRfZms6IG5ld0J1aWxkaW5nSUQsIHJvb21faWRfZms6IG5ld0Zsb29ySUQgfTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGZsb29yU3RvcmUuYWRkKG5ld0Zsb29yKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDb3B5IHRoZSByb29tc1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvb21zID0gYXdhaXQgcm9vbVN0b3JlLmluZGV4KFwiZmxvb3JfaWRfZmtcIikuZ2V0QWxsKGZsb29yLnV1aWQpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3Um9vbUlEID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3Um9vbSA9IHsgLi4ucm9vbSwgdXVpZDogbmV3Um9vbUlELCBmbG9vcl9pZF9mazogbmV3Rmxvb3JJRCwgcm9vbV9pZF9mazogbmV3Um9vbUlEIH07XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgcm9vbVN0b3JlLmFkZChuZXdSb29tKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ29weSB0aGUgcHJvZHVjdHNcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9kdWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcHJvZHVjdFN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKS5nZXRBbGwocm9vbS51dWlkKTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2YgcHJvZHVjdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UHJvZHVjdElEID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Byb2R1Y3QgPSB7IC4uLnByb2R1Y3QsIHV1aWQ6IG5ld1Byb2R1Y3RJRCwgcm9vbV9pZF9mazogbmV3Um9vbUlEIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHByb2R1Y3RTdG9yZS5hZGQobmV3UHJvZHVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gbmV3UHJvamVjdElEO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBhZGROb3RlKHJvb21VdWlkLCBub3RlKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcIm5vdGVzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG4gICAgY29uc3QgbmV3Tm90ZUlEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTsgICAgXHJcbiAgICBjb25zdCBuZXdOb3RlID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5vdyxcclxuICAgICAgICBub3RlOiBub3RlLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSwgXHJcbiAgICAgICAgcm9vbV9pZF9mazogcm9vbVV1aWQsICAgICAgICBcclxuICAgICAgICB1dWlkOiBuZXdOb3RlSUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKG5ld05vdGUpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIHJldHVybiBuZXdOb3RlSUQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZU5vdGVCeVVVSUQobm90ZVV1aWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwibm90ZXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibm90ZXNcIik7XHJcbiAgICBhd2FpdCBzdG9yZS5kZWxldGUobm90ZVV1aWQpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkSW1hZ2Uocm9vbVV1aWQsIGltYWdlKSB7XHJcblxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRVc2VyKHVzZXJfaWQpIHtcclxuICAgIHVzZXJfaWQgPSB1c2VyX2lkKyBcIlwiOyAgICBcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwidXNlcnNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJ1c2Vyc1wiKTtcclxuICAgIHJldHVybiBhd2FpdCBzdG9yZS5nZXQodXNlcl9pZCk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVVzZXIoZm9ybWRhdGEsIHVzZXJfaWQpIHtcclxuICAgIHVzZXJfaWQgPSB1c2VyX2lkICsgXCJcIjtcclxuXHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJ1c2Vyc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJ1c2Vyc1wiKTtcclxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBzdG9yZS5nZXQodXNlcl9pZCk7ICAgICAgIFxyXG5cclxuICAgIHVzZXIubmFtZSA9IGZvcm1kYXRhLm5hbWU7XHJcbiAgICB1c2VyLmNvZGUgPSBmb3JtZGF0YS5jb2RlOyAgICBcclxuICAgIHVzZXIuZW1haWwgPSBmb3JtZGF0YS5lbWFpbDtcclxuICAgIHVzZXIucGFzc3dvcmQgPSBmb3JtZGF0YS5wYXNzd29yZDtcclxuICAgIHVzZXIubGFzdF91cGRhdGVkID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5wdXQodXNlcik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZVBlclJvb20ocHJvamVjdElkKSB7XHJcbiAgICBpZiAoIXByb2plY3RJZCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gUHJvamVjdCBJRCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcInByb2plY3RzXCIsIFwibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCIsIFwicm9vbXNcIiwgXCJwcm9kdWN0c1wiLCBcImltYWdlc1wiLCBcIm5vdGVzXCJdLCBcInJlYWRvbmx5XCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2plY3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJsb2NhdGlvbnNcIik7XHJcbiAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCByb29tU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3QgcHJvZHVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IGltYWdlU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImltYWdlc1wiKTtcclxuICAgIGNvbnN0IG5vdGVTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibm90ZXNcIik7XHJcblxyXG4gICAgY29uc3QgcHJvamVjdCA9IGF3YWl0IHByb2plY3RTdG9yZS5nZXQocHJvamVjdElkKTtcclxuICAgIGlmICghcHJvamVjdCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBub3QgZm91bmQnKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBsb2NhdGlvbnMgPSBhd2FpdCBsb2NhdGlvblN0b3JlLmluZGV4KFwicHJvamVjdF9pZF9ma1wiKS5nZXRBbGwocHJvamVjdElkKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5ncyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBmbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3Qgcm9vbXMgPSBhd2FpdCByb29tU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHByb2R1Y3RTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IGltYWdlcyA9IGF3YWl0IGltYWdlU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBub3RlcyA9IGF3YWl0IG5vdGVTdG9yZS5nZXRBbGwoKTtcclxuXHJcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcclxuXHJcbiAgICByb29tcy5mb3JFYWNoKHJvb20gPT4ge1xyXG4gICAgICAgIGNvbnN0IHJvb21Qcm9kdWN0cyA9IHByb2R1Y3RzLmZpbHRlcihwcm9kdWN0ID0+IHByb2R1Y3Qucm9vbV9pZF9mayA9PT0gcm9vbS51dWlkKTtcclxuICAgICAgICBjb25zdCByb29tSW1hZ2VzID0gaW1hZ2VzLmZpbHRlcihpbWFnZSA9PiBpbWFnZS5yb29tX2lkX2ZrID09PSByb29tLnV1aWQpO1xyXG4gICAgICAgIGNvbnN0IHJvb21Ob3RlcyA9IG5vdGVzLmZpbHRlcihub3RlID0+IG5vdGUucm9vbV9pZF9mayA9PT0gcm9vbS51dWlkKTtcclxuXHJcbiAgICAgICAgY29uc3QgZmxvb3IgPSBmbG9vcnMuZmluZChmbG9vciA9PiBmbG9vci51dWlkID09PSByb29tLmZsb29yX2lkX2ZrKTtcclxuICAgICAgICBjb25zdCBidWlsZGluZyA9IGJ1aWxkaW5ncy5maW5kKGJ1aWxkaW5nID0+IGJ1aWxkaW5nLnV1aWQgPT09IGZsb29yLmJ1aWxkaW5nX2lkX2ZrKTtcclxuICAgICAgICBjb25zdCBsb2NhdGlvbiA9IGxvY2F0aW9ucy5maW5kKGxvY2F0aW9uID0+IGxvY2F0aW9uLnV1aWQgPT09IGJ1aWxkaW5nLmxvY2F0aW9uX2lkX2ZrKTtcclxuXHJcbiAgICAgICAgcm9vbVByb2R1Y3RzLmZvckVhY2gocHJvZHVjdCA9PiB7XHJcbiAgICAgICAgICAgIGlmICghcmVzdWx0W3Jvb20uc2x1Z10pIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFtyb29tLnNsdWddID0gW107XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEkgbmVlZCB0byBlbnN1cmUgdGhhdCB0aGUgcHJvZHVjdCBpcyBub3QgYWxyZWFkeSBpbiB0aGUgYXJyYXkgZm9yIHRoaXMgcm9vbVxyXG4gICAgICAgICAgICBpZiAocmVzdWx0W3Jvb20uc2x1Z10uZmluZChwID0+IHAuc2t1ID09PSBwcm9kdWN0LnNrdSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfSAgIFxyXG5cclxuICAgICAgICAgICAgcmVzdWx0W3Jvb20uc2x1Z10ucHVzaCh7XHJcbiAgICAgICAgICAgICAgICByb29tX3NsdWc6IHJvb20uc2x1ZyxcclxuICAgICAgICAgICAgICAgIHJvb21fbmFtZTogcm9vbS5uYW1lLFxyXG4gICAgICAgICAgICAgICAgcm9vbV93aWR0aDogcm9vbS53aWR0aCxcclxuICAgICAgICAgICAgICAgIHJvb21fbGVuZ3RoOiByb29tLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgIHJvb21faGVpZ2h0OiByb29tLmhlaWdodCxcclxuICAgICAgICAgICAgICAgIGZsb29yX25hbWU6IGZsb29yLm5hbWUsXHJcbiAgICAgICAgICAgICAgICBidWlsZGluZ19uYW1lOiBidWlsZGluZy5uYW1lLFxyXG4gICAgICAgICAgICAgICAgbG9jYXRpb25fbmFtZTogbG9jYXRpb24ubmFtZSxcclxuICAgICAgICAgICAgICAgIHByb2plY3RfbmFtZTogcHJvamVjdC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgcmVmOiBwcm9kdWN0LnJlZixcclxuICAgICAgICAgICAgICAgIHByb2R1Y3RfbmFtZTogcHJvZHVjdC5wcm9kdWN0X25hbWUsXHJcbiAgICAgICAgICAgICAgICBwcm9kdWN0X3NsdWc6IHByb2R1Y3QucHJvZHVjdF9zbHVnLFxyXG4gICAgICAgICAgICAgICAgc2t1OiBwcm9kdWN0LnNrdSxcclxuICAgICAgICAgICAgICAgIGN1c3RvbTogcHJvZHVjdC5jdXN0b20sXHJcbiAgICAgICAgICAgICAgICBvd25lcl9pZDogcHJvZHVjdC5vd25lcl9pZCxcclxuICAgICAgICAgICAgICAgIHByb2plY3RfaWRfZms6IHByb2plY3QudXVpZCxcclxuICAgICAgICAgICAgICAgIHByb2plY3Rfc2x1ZzogcHJvamVjdC5zbHVnLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF92ZXJzaW9uOiBwcm9qZWN0LnZlcnNpb24sXHJcbiAgICAgICAgICAgICAgICBxdHk6IHJvb21Qcm9kdWN0cy5maWx0ZXIocCA9PiBwLnNrdSA9PT0gcHJvZHVjdC5za3UpLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgIGltYWdlX2ZpbGVuYW1lczogcm9vbUltYWdlcy5tYXAoaW1hZ2UgPT4gaW1hZ2Uuc2FmZV9maWxlbmFtZSkuam9pbignfCcpLFxyXG4gICAgICAgICAgICAgICAgcm9vbV9ub3Rlczogcm9vbU5vdGVzLm1hcChub3RlID0+IGAke25vdGUubm90ZX0gKHVwZGF0ZWQ6ICR7bmV3IERhdGUobm90ZS5sYXN0X3VwZGF0ZWQgfHwgbm90ZS5jcmVhdGVkX29uKS50b0xvY2FsZVN0cmluZygpfSlgKS5qb2luKCd8JylcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2dpblVzZXIoZm9ybURhdGEpIHsgICAgXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInVzZXJzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwiZW1haWxcIik7XHJcblxyXG4gICAgLy8gZm9ybURhdGEgaXMgYSBqcyBmb3JtRGF0YSBvYmplY3QgZnJvbSB0aGUgc3VibWl0dGVkIGZvcm1cclxuICAgIC8vIHBhcnNlIHRoZSBlbWFpbCBhbmQgcGFzc3dvcmQgZnJvbSB0aGUgZm9ybSBkYXRhXHJcbiAgICBjb25zdCBmb3JtRGF0YU9iaiA9IHt9O1xyXG4gICAgZm9ybURhdGEuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gKGZvcm1EYXRhT2JqW2tleV0gPSB2YWx1ZSkpOyAgICAgICAgXHJcbiAgICBpZiAoIWZvcm1EYXRhT2JqLm1vZGFsX2Zvcm1fZW1haWwpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbWFpbCBpcyByZXF1aXJlZFwiKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBpbmRleC5nZXQoZm9ybURhdGFPYmoubW9kYWxfZm9ybV9lbWFpbC50b0xvd2VyQ2FzZSgpKTtcclxuXHJcbiAgICBpZiAodXNlciAmJiB1c2VyLnBhc3N3b3JkLnRvTG93ZXJDYXNlKCkgPT09IGZvcm1EYXRhT2JqLm1vZGFsX2Zvcm1fcGFzc3dvcmQudG9Mb3dlckNhc2UoKSkge1xyXG4gICAgICAgIC8vIGRlc3Ryb3kgYWxsIHRoZSBsb2NhbCBzdG9yYWdlIGl0ZW1zXHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XHJcbiAgICAgICAgLy8gc2V0IHRoZSB1c2VyX2lkIGNvb2tpZVxyXG4gICAgICAgIGF3YWl0IHV0aWxzLnNldENvb2tpZSgndXNlcl9pZCcsIHVzZXIudXVpZCwgMzY1KTtcclxuICAgICAgICAvLyBzZXQgdGhlIHVzZXJfbmFtZSBjb29raWVcclxuICAgICAgICBhd2FpdCB1dGlscy5zZXRDb29raWUoJ3VzZXJfbmFtZScsIHVzZXIubmFtZSwgMzY1KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHVzZXI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gICBcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0RmF2b3VyaXRlcyh1c2VyX2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImZhdm91cml0ZXNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmYXZvdXJpdGVzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcIm93bmVyX2lkXCIpO1xyXG4gICAgdXNlcl9pZCA9IFN0cmluZyh1c2VyX2lkKTtcclxuICAgIHJldHVybiBhd2FpdCBpbmRleC5nZXRBbGwodXNlcl9pZCk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEZhdlByb2R1Y3Qoc2t1LCBwcm9kdWN0X25hbWUsIHVzZXJfaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwiZmF2b3VyaXRlc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmYXZvdXJpdGVzXCIpO1xyXG4gICAgY29uc3QgbmV3RmF2SUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3QgbmV3RmF2ID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5vdyxcclxuICAgICAgICBza3U6IHNrdSxcclxuICAgICAgICBwcm9kdWN0X25hbWU6IHByb2R1Y3RfbmFtZSxcclxuICAgICAgICBvd25lcl9pZDogdXNlcl9pZCxcclxuICAgICAgICB1dWlkOiBuZXdGYXZJRCxcclxuICAgICAgICB2ZXJzaW9uOiBcIjFcIlxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBDaGVjayBpZiB0aGUgcHJvZHVjdCBpcyBhbHJlYWR5IGluIHRoZSBmYXZvdXJpdGVzIGZvciB0aGUgc2FtZSB1c2VyX2lkXHJcbiAgICAvLyBtYWtlIHN1cmUgbm90IHRvIHNhdmUgdGggc2FtZSBza3UgZm9yIHRoZSBzYW1lIHVzZXIhICB3ZSBub3cgaGF2ZSBrZXlzIG9uIHRlaCBjb2x1bW5zIFwic2t1XCIgYW5kIFwib3duZXJfaWRcIlxyXG4gICAgY29uc3QgYWxsRmF2cyA9IGF3YWl0IHN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgZXhpc3RpbmdGYXYgPSBhbGxGYXZzLmZpbmQoZmF2ID0+IGZhdi5za3UgPT09IHNrdSAmJiBmYXYub3duZXJfaWQgPT09IHVzZXJfaWQpO1xyXG4gICAgaWYgKGV4aXN0aW5nRmF2KSB7XHJcbiAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdQcm9kdWN0IGFscmVhZHkgaW4gZmF2b3V0aXRlcycsIHtzdGF0dXM6J3dhcm5pbmcnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgICAgICBjb25zb2xlLndhcm4oJ1Byb2R1Y3QgYWxyZWFkeSBpbiBmYXZvdXJpdGVzOicsIGV4aXN0aW5nRmF2KTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKG5ld0Zhdik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgVUlraXQubm90aWZpY2F0aW9uKCdBZGRlZCBmYXZvdXJpdGUgcHJvZHVjdCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgIHJldHVybiBuZXdGYXZJRDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkRmF2b3VyaXRlVG9Sb29tKHNrdSwgcm9vbV9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIC8vIGZpcnN0IGdldCB0aGUgZnVsbCBkYXRhIGFib3V0IHRoZSBwcm9kdWN0IGZyb20gdGhlIFwicHJvZHVjdF9kYXRhXCIgdGFibGUgYnkgc2t1XHJcbiAgICBjb25zdCBwcm9kdWN0RGF0YSA9IGF3YWl0IGdldFByb2R1Y3RzKCk7XHJcbiAgICBjb25zb2xlLmxvZygnUHJvZHVjdCBEYXRhOicsIHByb2R1Y3REYXRhKTsgIFxyXG4gICAgY29uc3QgcCA9IHByb2R1Y3REYXRhLmZpbmQocCA9PiBwLnByb2R1Y3RfY29kZSA9PT0gc2t1KTtcclxuICAgIGlmICghcCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvZHVjdCB3aXRoIFNLVSAke3NrdX0gbm90IGZvdW5kYCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gYnVpbGQgdGhlIHByb2R1Y3QgZGF0YSBvYmplY3QgICAgXHJcbiAgICBjb25zdCBuZXdQcm9kdWN0RGF0YSA9IHtcclxuICAgICAgICBicmFuZDogcC5zaXRlLFxyXG4gICAgICAgIHR5cGU6IHAudHlwZV9zbHVnLFxyXG4gICAgICAgIHByb2R1Y3Rfc2x1ZzogcC5wcm9kdWN0X3NsdWcsXHJcbiAgICAgICAgcHJvZHVjdF9uYW1lOiBwLnByb2R1Y3RfbmFtZSxcclxuICAgICAgICBza3U6IHAucHJvZHVjdF9jb2RlLFxyXG4gICAgICAgIHJvb21faWRfZms6IHJvb21faWQsXHJcbiAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpLFxyXG4gICAgICAgIGN1c3RvbTogMCxcclxuICAgICAgICByZWY6IFwiXCIsXHJcbiAgICAgICAgY3JlYXRlZF9vbjogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICBvcmRlcjogbnVsbCxcclxuICAgICAgICByYW5nZTogbnVsbFxyXG4gICAgfTtcclxuICAgIHRoaXMuc2F2ZVByb2R1Y3RUb1Jvb20obmV3UHJvZHVjdERhdGEpOyAgIFxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZW1vdmVGYXZvdXJpdGUodXVpZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIHV1aWQgPSB1dWlkICsgXCJcIjtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJmYXZvdXJpdGVzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZhdm91cml0ZXNcIik7ICAgIFxyXG4gICAgYXdhaXQgc3RvcmUuZGVsZXRlKHV1aWQpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0SW1hZ2VzRm9yUm9vbShyb29tX2lkKSB7XHJcbiAgICAvLyBnZXQgYWxsIGltYWdlcyBmb3IgdGhpcyByb29tIGFuZCB0aGlzIHVzZXJcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwiaW1hZ2VzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiaW1hZ2VzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcbiAgICBjb25zdCBpbWFnZXMgPSBhd2FpdCBpbmRleC5nZXRBbGwocm9vbV9pZCk7XHJcbiAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0VXNlcklEKClcclxuICAgIHJldHVybiBpbWFnZXMuZmlsdGVyKGltYWdlID0+IGltYWdlLm93bmVyX2lkID09PSB1c2VyX2lkKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2F2ZUltYWdlRm9yUm9vbShyb29tX2lkLCBkYXRhKSAge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJpbWFnZXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiaW1hZ2VzXCIpO1xyXG4gICAgY29uc3QgbmV3SW1hZ2VJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBjb25zdCBuZXdJbWFnZSA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgcm9vbV9pZF9mazogcm9vbV9pZCxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksXHJcbiAgICAgICAgdXVpZDogbmV3SW1hZ2VJRCxcclxuICAgICAgICB2ZXJzaW9uOiBcIjFcIixcclxuICAgICAgICBmaWxlbmFtZTogZGF0YS5maWxlTmFtZSxcclxuICAgICAgICBzYWZlX2ZpbGVuYW1lOiBkYXRhLnNhZmVGaWxlTmFtZVxyXG4gICAgfTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5hZGQobmV3SW1hZ2UpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuICAgIHJldHVybiBuZXdJbWFnZUlEO1xyXG5cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcHVzaFVzZXJEYXRhKHVzZXJfaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICAvLyBnYXRoZXIgYWxsIHRoZSB1c2VyIGRhdGEgZnJvbSB0aGUgaW5kZXhlZERCIGluY2x1c2luZyBhbGwgdGhlIHByb2plY3RzLCBsb2NhdGlvbnMsIGJ1aWxkaW5ncywgZmxvb3JzLCByb29tcywgcHJvZHVjdHMsIGltYWdlcywgbm90ZXMsIGZhdm91cml0ZXNcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wicHJvamVjdHNcIiwgXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCIsIFwiaW1hZ2VzXCIsIFwibm90ZXNcIiwgXCJmYXZvdXJpdGVzXCJdLCBcInJlYWRvbmx5XCIpOyAgXHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgY29uc3QgZmxvb3JTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IHByb2R1Y3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbWFnZVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJpbWFnZXNcIik7XHJcbiAgICBjb25zdCBub3RlU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG4gICAgY29uc3QgZmF2U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZhdm91cml0ZXNcIik7XHJcblxyXG4gICAgY29uc3QgcHJvamVjdHMgPSBhd2FpdCBwcm9qZWN0U3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBsb2NhdGlvbnMgPSBhd2FpdCBsb2NhdGlvblN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdzID0gYXdhaXQgYnVpbGRpbmdTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCByb29tcyA9IGF3YWl0IHJvb21TdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcHJvZHVjdFN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3QgaW1hZ2VzID0gYXdhaXQgaW1hZ2VTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgbm90ZVN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3QgZmF2b3VyaXRlcyA9IGF3YWl0IGZhdlN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG5cclxuICAgIC8vIG5vdyBwdXNoIGFsbCB0aGlzIGRhdGEgdG8gdGhlIHNlcnZlclxyXG4gICAgY29uc3QgdXNlckRhdGEgPSB7XHJcbiAgICAgICAgcHJvamVjdHM6IHByb2plY3RzLFxyXG4gICAgICAgIGxvY2F0aW9uczogbG9jYXRpb25zLFxyXG4gICAgICAgIGJ1aWxkaW5nczogYnVpbGRpbmdzLFxyXG4gICAgICAgIGZsb29yczogZmxvb3JzLFxyXG4gICAgICAgIHJvb21zOiByb29tcyxcclxuICAgICAgICBwcm9kdWN0czogcHJvZHVjdHMsXHJcbiAgICAgICAgaW1hZ2VzOiBpbWFnZXMsXHJcbiAgICAgICAgbm90ZXM6IG5vdGVzLFxyXG4gICAgICAgIGZhdm91cml0ZXM6IGZhdm91cml0ZXNcclxuICAgIH07XHJcblxyXG4gICAgICAgXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9zeW5jX3VzZXJfZGF0YScsIHtcclxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZXJEYXRhKVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCBlcnJvciEgU3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXNwb25zZURhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnUmVzcG9uc2UgRGF0YTonLCByZXNwb25zZURhdGEpO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ1N0YXR1czonLCByZXNwb25zZURhdGEuc3RhdHVzKTsgIC8vIGVycm9yIHwgc3VjY2Vzc1xyXG4gICAgcmV0dXJuKHJlc3BvbnNlRGF0YSk7ICAgIFxyXG59XHJcblxyXG5cclxuLy8gRXhwb3J0IHRoZSBmdW5jdGlvbnNcclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBnZW5lcmF0ZVVVSUQsIFxyXG4gICAgaW5pdERCLFxyXG4gICAgZmV0Y2hBbmRTdG9yZVByb2R1Y3RzLFxyXG4gICAgZmV0Y2hBbmRTdG9yZVVzZXJzLFxyXG4gICAgZ2V0UHJvZHVjdHMsXHJcbiAgICBnZXRQcm9qZWN0cywgICAgXHJcbiAgICBnZXRQcm9qZWN0QnlVVUlELFxyXG4gICAgdXBkYXRlUHJvamVjdERldGFpbHMsXHJcbiAgICBzeW5jRGF0YSxcclxuICAgIHNhdmVQcm9kdWN0VG9Sb29tLFxyXG4gICAgZ2V0UHJvZHVjdHNGb3JSb29tLFxyXG4gICAgZGVsZXRlUHJvZHVjdEZyb21Sb29tLFxyXG4gICAgc2V0U2t1UXR5Rm9yUm9vbSxcclxuICAgIHVwZGF0ZVByb2R1Y3RSZWYsXHJcbiAgICBnZXRQcm9qZWN0U3RydWN0dXJlLFxyXG4gICAgZ2V0Um9vbU1ldGEsXHJcbiAgICB1cGRhdGVOYW1lLFxyXG4gICAgYWRkUm9vbSxcclxuICAgIGFkZEZsb29yLFxyXG4gICAgYWRkQnVpbGRpbmcsXHJcbiAgICBhZGRMb2NhdGlvbixcclxuICAgIHJlbW92ZVJvb20sXHJcbiAgICByZW1vdmVGbG9vcixcclxuICAgIHJlbW92ZUJ1aWxkaW5nLFxyXG4gICAgY3JlYXRlUHJvamVjdCxcclxuICAgIHVwZGF0ZVJvb21EaW1lbnNpb24sXHJcbiAgICBjb3B5Um9vbSxcclxuICAgIGdldEZsb29ycyxcclxuICAgIGNvcHlQcm9qZWN0LFxyXG4gICAgZ2V0Um9vbU5vdGVzLCAgICBcclxuICAgIGFkZE5vdGUsXHJcbiAgICBhZGRJbWFnZSxcclxuICAgIHJlbW92ZU5vdGVCeVVVSUQsXHJcbiAgICBnZXRQcm9kdWN0c0ZvclByb2plY3QsXHJcbiAgICBnZXRVc2VyLFxyXG4gICAgdXBkYXRlVXNlcixcclxuICAgIGdldFNjaGVkdWxlUGVyUm9vbSxcclxuICAgIGxvZ2luVXNlcixcclxuICAgIGFkZEZhdlByb2R1Y3QsXHJcbiAgICBnZXRGYXZvdXJpdGVzLFxyXG4gICAgYWRkRmF2b3VyaXRlVG9Sb29tLFxyXG4gICAgcmVtb3ZlRmF2b3VyaXRlLFxyXG4gICAgZ2V0SW1hZ2VzRm9yUm9vbSxcclxuICAgIHNhdmVJbWFnZUZvclJvb20sXHJcbiAgICBwdXNoVXNlckRhdGEsXHJcbiAgICBwdWxsVXNlckRhdGEsXHJcbiAgICByZW1vdmVQcm9qZWN0XHJcbiAgICAvLyBBZGQgb3RoZXIgZGF0YWJhc2UtcmVsYXRlZCBmdW5jdGlvbnMgaGVyZVxyXG59O1xyXG4iLCJjb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbmNvbnN0IGRiID0gcmVxdWlyZSgnLi4vZGInKTtcclxuY29uc3QgdGFibGVzID0gcmVxdWlyZSgnLi90YWJsZXMnKTtcclxuXHJcblxyXG5cclxuY2xhc3MgU2lkZWJhck1vZHVsZSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLm1lbnVIdG1sID0gJyc7XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gZmFsc2U7ICAgICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBpbml0KCkge1xyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGl6ZWQpIHJldHVybjtcclxuICAgICAgICBNdXN0YWNoZS50YWdzID0gW1wiW1tcIiwgXCJdXVwiXTtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2VuZXJhdGVGYXZvdXJpdGVzKGRhdGEpICB7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIGA8cD5Zb3UgaGF2ZSBub3QgYWRkZWQgYW55IGZhb3V0aXRlIHByb2R1Y3RzIHlldC48L3A+XHJcbiAgICAgICAgICAgIDxwPllvdSBjYW4gYWRkIHByb2R1Y3RzIHRvIHlvdXIgZmF2b3VyaXRlcyBieSBmaXJzdCBhZGRpbmcgYSBwcm9kdWN0IHRvIHRoaXMgcm9vbSB0aGVuIGNsaWNraW5nIHRoZSA8c3BhbiBjbGFzcz1cInByb2R1Y3QtbmFtZVwiIHVrLWljb249XCJpY29uOiBoZWFydDtcIj48L3NwYW4+IGljb24gaW4gdGhlIHRhYmxlLjwvcD5gO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG4gICAgICAgIGxldCBodG1sID0gJyc7XHJcblxyXG4gICAgICAgIC8vIHNvcnQgZmF2b3VyaXRlcyBieSBwcm9kdWN0X25hbWUgYW5kIGFkZCBhbGwgc2t1J3Mgd2l0aCB0aGUgc2FtZSBwcm9kdWN0X25hbWUgdG8gYSBjaGlsZCBvYmplY3QuIFxyXG4gICAgICAgIC8vIFRoaXMgd2lsbCBhbGxvdyB1cyB0byBkaXNwbGF5IHRoZSBwcm9kdWN0X25hbWUgb25jZSBhbmQgYWxsIHNrdSdzIHVuZGVyIGl0LlxyXG4gICAgICAgIGxldCBzb3J0ZWQgPSBkYXRhLnJlZHVjZSgoYWNjLCBpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghYWNjW2l0ZW0ucHJvZHVjdF9uYW1lXSkgeyAgXHJcbiAgICAgICAgICAgICAgICBhY2NbaXRlbS5wcm9kdWN0X25hbWVdID0gW107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYWNjW2l0ZW0ucHJvZHVjdF9uYW1lXS5wdXNoKGl0ZW0pO1xyXG4gICAgICAgICAgICByZXR1cm4gYWNjOyBcclxuICAgICAgICB9LCB7fSk7XHJcblxyXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgc29ydGVkIG9iamVjdCBhbmQgZ2VuZXJhdGUgdGhlIGh0bWwgYXMgYSBsaXN0IHdpdGggcHJvZHVjdF9uYW1lIGFuZCBza3Unc1xyXG4gICAgICAgIE9iamVjdC5rZXlzKHNvcnRlZCkuZm9yRWFjaChrZXkgPT4geyAgICBcclxuICAgICAgICAgICAgaHRtbCArPSBgPGxpIGNsYXNzPVwicHJvZHVjdC1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9kdWN0LW5hbWVcIiB1ay1pY29uPVwiaWNvbjogZm9sZGVyO1wiPjwvc3Bhbj4gXHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9kdWN0LW5hbWVcIj48YSBkYXRhLXByb2R1Y3Q9XCIke2tleX1cIiBocmVmPVwiI1wiPiR7a2V5fTwvYT48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8dWwgY2xhc3M9XCJza3UtbGlzdFwiPmA7XHJcbiAgICAgICAgICAgIHNvcnRlZFtrZXldLmZvckVhY2goaXRlbSA9PiB7ICAgXHJcbiAgICAgICAgICAgICAgICBodG1sICs9IGBcclxuICAgICAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJza3UtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInNrdS1uYW1lXCI+PGEgY2xhc3M9XCJhZGQtZmF2LXRvLXJvb21cIiBkYXRhLXNrdT1cIiR7aXRlbS5za3V9XCIgaHJlZj1cIiNcIj4ke2l0ZW0uc2t1fTwvYT48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJtaW51cy1jaXJjbGVcIiBjbGFzcz1cImFjdGlvbi1pY29uIHJlbW92ZS1wcm9kdWN0LWZyb20tZmF2c1wiIGRhdGEtdXVpZD1cIiR7aXRlbS51dWlkfVwiIGRhdGEtYWN0aW9uPVwicmVtb3ZlXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbGk+YDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGh0bWwgKz0gYDwvdWw+PC9saT5gO1xyXG4gICAgICAgIH0pOyAgXHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIFxyXG4gICAgLy8gXHJcbiAgICAvLyByZW5kZXJGYXZvdXJpdGVzXHJcbiAgICAvLyAgICAgXHJcbiAgICBhc3luYyByZW5kZXJGYXZvdXJpdGVzKHVzZXJfaWQpIHsgICAgICAgIFxyXG4gICAgICAgIHVzZXJfaWQudG9TdHJpbmcoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZhdm91cml0ZXMgPSAgYXdhaXQgZGIuZ2V0RmF2b3VyaXRlcyh1c2VyX2lkKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHNpZGVtZW51SHRtbCA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVGYXZvdXJpdGVzKGZhdm91cml0ZXMpOyAgICAgICAgICAgXHJcblxyXG4gICAgICAgICQoJy5mYXZvdXJpdGVzJykuaHRtbChzaWRlbWVudUh0bWwpO1xyXG5cclxuICAgICAgICAkKCcuYWRkLWZhdi10by1yb29tJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjb25zdCBza3UgPSAkKHRoaXMpLmRhdGEoJ3NrdScpO1xyXG4gICAgICAgICAgICBjb25zdCByb29tX2lkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpOyAgICAgICAgICBcclxuICAgICAgICAgICAgYXdhaXQgZGIuYWRkRmF2b3VyaXRlVG9Sb29tKHNrdSwgcm9vbV9pZCk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignRmF2b3VyaXRlIGFkZGVkIHRvIHJvb20nLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIHRhYmxlcy5yZW5kZXJQcm9kY3RzVGFibGUocm9vbV9pZCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICQoJy5hY3Rpb24taWNvbi5yZW1vdmUtcHJvZHVjdC1mcm9tLWZhdnMnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgKGUpID0+IHsgIC8vYXJyb3cgZnVuY3Rpb24gcHJlc2VydmVzIHRoZSBjb250ZXh0IG9mIHRoaXNcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjb25zdCB1dWlkID0gJChlLmN1cnJlbnRUYXJnZXQpLmRhdGEoJ3V1aWQnKTtcclxuICAgICAgICAgICAgYXdhaXQgZGIucmVtb3ZlRmF2b3VyaXRlKHV1aWQpO1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ0Zhdm91cml0ZSByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlckZhdm91cml0ZXModXNlcl9pZCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9ICAgIFxyXG5cclxuXHJcbiAgICBhc3luYyBnZW5lcmF0ZU5hdk1lbnUoZGF0YSkge1xyXG4gICAgICAgIGlmICghZGF0YSkgcmV0dXJuICc8ZGl2Pk5vIHByb2plY3Qgc3RydWN0dXJlIGF2YWlsYWJsZTwvZGl2Pic7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIGxldCBodG1sID0gJyc7XHJcblxyXG4gICAgICAgIC8vIE1hbmFnZSBwcm9qZWN0IGxpbmtcclxuICAgICAgICBodG1sICs9IGBcclxuICAgICAgICA8bGkgY2xhc3M9XCJwcm9qZWN0LWl0ZW1cIj5cclxuICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBjbGFzcz1cImVkaXQtcHJvamVjdC1saW5rXCIgZGF0YS1pZD1cIiR7ZGF0YS5wcm9qZWN0X2lkfVwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9qZWN0LW5hbWVcIiB1ay1pY29uPVwiaWNvbjogZm9sZGVyO1wiPjwvc3Bhbj4gJHtkYXRhLnByb2plY3RfbmFtZX1cclxuICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgIDwvbGk+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyBsb2NhdGlvbnNcclxuICAgICAgICBPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICdwcm9qZWN0X25hbWUnICYmIGtleSAhPT0gJ3Byb2plY3Rfc2x1ZycgJiYga2V5ICE9PSAncHJvamVjdF9pZCcpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZGF0YVtrZXldO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSB0aGlzLnByb2Nlc3NMb2NhdGlvbihrZXksIGxvY2F0aW9uLCBkYXRhLnByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3NMb2NhdGlvbihzbHVnLCBsb2NhdGlvbiwgcHJvamVjdElkKSB7XHJcbiAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwibG9jYXRpb24taXRlbVwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibG9jYXRpb24taGVhZGVyXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImxvY2F0aW9uLW5hbWVcIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwiaWNvbjogbG9jYXRpb247XCI+PC9zcGFuPiAke2xvY2F0aW9uLmxvY2F0aW9uX25hbWV9XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWljb25zIGxvY2F0aW9uXCI+ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwibWludXMtY2lyY2xlXCIgY2xhc3M9XCJhY3Rpb24taWNvblwiIGRhdGEtaWQ9XCIke2xvY2F0aW9uLmxvY2F0aW9uX2lkfVwiIGRhdGEtYWN0aW9uPVwicmVtb3ZlXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8dWwgY2xhc3M9XCJidWlsZGluZy1saXN0XCI+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyBidWlsZGluZ3NcclxuICAgICAgICBPYmplY3Qua2V5cyhsb2NhdGlvbikuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAnbG9jYXRpb25fbmFtZScgJiYga2V5ICE9PSAnbG9jYXRpb25fc2x1ZycgJiYga2V5ICE9PSAnbG9jYXRpb25faWQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBidWlsZGluZyA9IGxvY2F0aW9uW2tleV07XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IHRoaXMucHJvY2Vzc0J1aWxkaW5nKGtleSwgYnVpbGRpbmcsIHByb2plY3RJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIFwiQWRkIEJ1aWxkaW5nXCIgb3B0aW9uXHJcbiAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJidWlsZGluZy1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZGQtYnVpbGRpbmdcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBkYXRhLWlkPVwiJHtsb2NhdGlvbi5sb2NhdGlvbl9pZH1cIiBkYXRhLWFjdGlvbj1cImFkZFwiPkFkZCBCdWlsZGluZzwvYT5cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2xpPlxyXG4gICAgICAgICAgICA8L3VsPlxyXG4gICAgICAgIDwvbGk+YDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJvY2Vzc0J1aWxkaW5nKHNsdWcsIGJ1aWxkaW5nLCBwcm9qZWN0SWQpIHtcclxuICAgICAgICBsZXQgaHRtbCA9IGBcclxuICAgICAgICA8bGkgY2xhc3M9XCJidWlsZGluZy1pdGVtXCI+XHJcbiAgICAgICAgICAgIDxoNCBjbGFzcz1cImJ1aWxkaW5nLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJidWlsZGluZy1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cImljb246IGhvbWU7XCI+PC9zcGFuPiAke2J1aWxkaW5nLmJ1aWxkaW5nX25hbWV9XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWljb25zIGJ1aWxkaW5nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb24gYnVpbGRpbmdcIiBkYXRhLWlkPVwiJHtidWlsZGluZy5idWlsZGluZ19pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2g0PlxyXG4gICAgICAgICAgICA8dWwgY2xhc3M9XCJmbG9vci1saXN0XCI+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmbG9vcnNcclxuICAgICAgICBPYmplY3Qua2V5cyhidWlsZGluZykuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAnYnVpbGRpbmdfbmFtZScgJiYga2V5ICE9PSAnYnVpbGRpbmdfc2x1ZycgJiYga2V5ICE9PSAnYnVpbGRpbmdfaWQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBmbG9vciA9IGJ1aWxkaW5nW2tleV07XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IHRoaXMucHJvY2Vzc0Zsb29yKGtleSwgZmxvb3IsIHByb2plY3RJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIFwiQWRkIEZsb29yXCIgb3B0aW9uXHJcbiAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJmbG9vci1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZGQtZmxvb3JcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBkYXRhLWlkPVwiJHtidWlsZGluZy5idWlsZGluZ19pZH1cIiBkYXRhLWFjdGlvbj1cImFkZFwiPkFkZCBGbG9vcjwvYT5cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2xpPlxyXG4gICAgICAgICAgICA8L3VsPlxyXG4gICAgICAgIDwvbGk+YDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJvY2Vzc0Zsb29yKHNsdWcsIGZsb29yLCBwcm9qZWN0SWQpIHtcclxuICAgICAgICBsZXQgaHRtbCA9IGBcclxuICAgICAgICA8bGkgY2xhc3M9XCJmbG9vci1pdGVtXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbG9vci1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgZGF0YS1pZD1cIiR7Zmxvb3IuZmxvb3JfaWR9XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbG9vci1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJpY29uOiB0YWJsZTtcIj48L3NwYW4+ICR7Zmxvb3IuZmxvb3JfbmFtZX1cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWljb25zIGZsb29yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb24gZmxvb3JcIiBkYXRhLWlkPVwiJHtmbG9vci5mbG9vcl9pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHVsIGNsYXNzPVwicm9vbS1saXN0XCI+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyByb29tc1xyXG4gICAgICAgIE9iamVjdC5rZXlzKGZsb29yKS5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICdmbG9vcl9uYW1lJyAmJiBrZXkgIT09ICdmbG9vcl9zbHVnJyAmJiBrZXkgIT09ICdmbG9vcl9pZCcpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvb20gPSBmbG9vcltrZXldO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSB0aGlzLnByb2Nlc3NSb29tKGtleSwgcm9vbSwgcHJvamVjdElkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgXCJBZGQgUm9vbVwiIG9wdGlvblxyXG4gICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgPGxpIGNsYXNzPVwicm9vbS1pdGVtIGFkZC1yb29tXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZGQtcm9vbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiIGRhdGEtYWN0aW9uPVwiYWRkXCIgZGF0YS1pZD1cIiR7Zmxvb3IuZmxvb3JfaWR9XCI+QWRkIFJvb208L2E+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9saT5cclxuICAgICAgICAgICAgPC91bD5cclxuICAgICAgICA8L2xpPmA7XHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3NSb29tKHNsdWcsIHJvb20sIHByb2plY3RJZCkge1xyXG4gICAgICAgIHJldHVybiBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwicm9vbS1pdGVtIHZpZXctcm9vbVwiPlxyXG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cInJvb20tbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBjbGFzcz1cInJvb20tbGlua1wiIGRhdGEtaWQ9XCIke3Jvb20ucm9vbV9pZH1cIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwiaWNvbjogbW92ZTtcIj48L3NwYW4+ICR7cm9vbS5yb29tX25hbWV9XHJcbiAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb24gcm9vbVwiIGRhdGEtaWQ9XCIke3Jvb20ucm9vbV9pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICA8L2xpPmA7XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IFNpZGViYXJNb2R1bGUoKTsiLCJjb25zdCBkYiA9IHJlcXVpcmUoJy4uL2RiJyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xyXG5sZXQgc2lkZWJhcjsgLy8gcGxhY2Vob2xkZXIgZm9yIHNpZGViYXIgbW9kdWxlLCBsYXp5IGxvYWRlZCBsYXRlclxyXG5cclxuY2xhc3MgU3luY01vZHVsZSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgLy8gQmluZCBtZXRob2RzIHRoYXQgbmVlZCAndGhpcycgY29udGV4dFxyXG4gICAgICAgIC8vdGhpcy5oYW5kbGVGaWxlVXBsb2FkID0gdGhpcy5oYW5kbGVGaWxlVXBsb2FkLmJpbmQodGhpcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSByZXR1cm47ICAgICAgICBcclxuICAgICAgICBpZiAoIXNpZGViYXIpIHtcclxuICAgICAgICAgICAgc2lkZWJhciA9IHJlcXVpcmUoJy4vc2lkZWJhcicpOyAgLy8gbGF6eSBsb2FkIGl0IHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY2llcywganVzdCB1c2UgY2FsbCBpbml0IHdoZW4gcmVxdWlyZWRcclxuICAgICAgICB9ICAgICAgICBcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuICAgIGFzeW5jIGNsZWFyTG9jYWxTdG9yYWdlKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdZb3UgYXJlIG9mZmxpbmUuIFBsZWFzZSBjb25uZWN0IHRvIHRoZSBpbnRlcm5ldCBhbmQgdHJ5IGFnYWluLicsIHN0YXR1czogJ3dhcm5pbmcnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjAwMCB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgICAgICB1dGlscy5zaG93U3BpbigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuXHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XHJcblxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgdXRpbHMuaGlkZVNwaW4oKTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFVzZXJEYXRhKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdZb3UgYXJlIG9mZmxpbmUuIFBsZWFzZSBjb25uZWN0IHRvIHRoZSBpbnRlcm5ldCBhbmQgdHJ5IGFnYWluLicsIHN0YXR1czogJ3dhcm5pbmcnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjAwMCB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgICAgICB1dGlscy5zaG93U3BpbigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuXHJcbiAgICAgICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRiLnB1bGxVc2VyRGF0YSh1c2VyX2lkKTsgICAgICAgIFxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgdXRpbHMuaGlkZVNwaW4oKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgYXN5bmMgcHVzaEFsbFVzZXJEYXRhKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIC8vIGRldGVjdCBpZiB1c2VyIGlzIG9mZmxpbmVcclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnWW91IGFyZSBvZmZsaW5lLiBQbGVhc2UgY29ubmVjdCB0byB0aGUgaW50ZXJuZXQgYW5kIHRyeSBhZ2Fpbi4nLCBzdGF0dXM6ICd3YXJuaW5nJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdEYXRhIFB1c2ggU3RhcnRlZCAuLi4nLCBzdGF0dXM6ICdwcmltYXJ5JywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDEwMDAgfSk7XHJcbiAgICAgICAgdXRpbHMuc2hvd1NwaW4oKTtcclxuICAgICAgICBcclxuICAgICAgICAkKCcjc3luY2ljb24nKS5hZGRDbGFzcygnYWN0aXZlJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKTtcclxuXHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGIucHVzaFVzZXJEYXRhKHVzZXJfaWQpO1xyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgICAgICAgIFxyXG4gICAgICAgIFxyXG4gICAgICAgIHV0aWxzLmhpZGVTcGluKCk7XHJcbiAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT0gJ2Vycm9yJykge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdUaGVyZSB3YXMgYW4gZXJyb3Igc3luY2luZyB5b3VyIGRhdGEhIFBsZWFzZSB0cnkgYWdhaW4uJywgc3RhdHVzOiAnZGFuZ2VyJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnRGF0YSBQdXNoIENvbXBsZXRlIC4uLicsIHN0YXR1czogJ3N1Y2Nlc3MnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjAwMCB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuXHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTeW5jTW9kdWxlKCk7IiwiY29uc3QgZGIgPSByZXF1aXJlKCcuLi9kYicpO1xyXG5jb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xyXG5sZXQgc2lkZWJhcjsgLy8gcGxhY2Vob2xkZXIgZm9yIHNpZGViYXIgbW9kdWxlLCBsYXp5IGxvYWRlZCBsYXRlclxyXG5cclxuY2xhc3MgVGFibGVzTW9kdWxlIHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuaXNJbml0aWFsaXplZCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMucFRhYmxlID0gbnVsbDtcclxuICAgICAgICAvLyBCaW5kIG1ldGhvZHMgdGhhdCBuZWVkICd0aGlzJyBjb250ZXh0XHJcbiAgICAgICAgdGhpcy5oYW5kbGVGaWxlVXBsb2FkID0gdGhpcy5oYW5kbGVGaWxlVXBsb2FkLmJpbmQodGhpcyk7XHJcbiAgICAgICAgdGhpcy51cGRhdGVJbWFnZXMgPSB0aGlzLnVwZGF0ZUltYWdlcy5iaW5kKHRoaXMpOyAgICAgICAgXHJcbiAgICAgICAgdGhpcy5nZXRSb29tSW1hZ2VzID0gdGhpcy5nZXRSb29tSW1hZ2VzLmJpbmQodGhpcyk7ICAgICAgICBcclxuXHJcbiAgICAgICAgaWYgKCdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdykge1xyXG4gICAgICAgICAgICBsZXQgdG91Y2hTdGFydFggPSAwO1xyXG4gICAgICAgICAgICBsZXQgdG91Y2hFbmRYID0gMDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBlID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd0b3VjaHN0YXJ0Jyk7XHJcbiAgICAgICAgICAgICAgICB0b3VjaFN0YXJ0WCA9IGUuY2hhbmdlZFRvdWNoZXNbMF0uc2NyZWVuWDtcclxuICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBlID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd0b3VjaGVuZCcpO1xyXG4gICAgICAgICAgICAgICAgdG91Y2hFbmRYID0gZS5jaGFuZ2VkVG91Y2hlc1swXS5zY3JlZW5YO1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlU3dpcGUoKTtcclxuICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgaGFuZGxlU3dpcGUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzd2lwZVRocmVzaG9sZCA9IDEwMDsgLy8gbWluaW11bSBkaXN0YW5jZSBmb3Igc3dpcGVcclxuICAgICAgICAgICAgICAgIGNvbnN0IGVkZ2VUaHJlc2hvbGQgPSAyNDA7ICAgLy8gcGl4ZWxzIGZyb20gbGVmdCBlZGdlIHRvIHN0YXJ0IHN3aXBlXHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICh0b3VjaFN0YXJ0WCA8IGVkZ2VUaHJlc2hvbGQgJiYgKHRvdWNoRW5kWCAtIHRvdWNoU3RhcnRYKSA+IHN3aXBlVGhyZXNob2xkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1N3aXBlIHJpZ2h0IGZyb20gbGVmdCBlZGdlJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gU3dpcGUgcmlnaHQgZnJvbSBsZWZ0IGVkZ2VcclxuICAgICAgICAgICAgICAgICAgICBVSWtpdC5vZmZjYW52YXMoJyNvZmZjYW52YXMtc2lkZWJhcicpLnNob3coKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGluaXQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNJbml0aWFsaXplZCkgcmV0dXJuO1xyXG4gICAgICAgIE11c3RhY2hlLnRhZ3MgPSBbXCJbW1wiLCBcIl1dXCJdOyAgICAgICAgICAgICAgICBcclxuICAgICAgICBpZiAoIXNpZGViYXIpIHtcclxuICAgICAgICAgICAgc2lkZWJhciA9IHJlcXVpcmUoJy4vc2lkZWJhcicpOyAgLy8gbGF6eSBsb2FkIGl0IHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY2llcywganVzdCB1c2UgY2FsbCBpbml0IHdoZW4gcmVxdWlyZWRcclxuICAgICAgICB9ICAgICAgICBcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgdXBkYXRlU2t1c0Ryb3Bkb3duKHByb2R1Y3QpIHtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICBjb25zdCBza3VzID0gYXdhaXQgdGhpcy5nZXRTa3VzRm9yUHJvZHVjdChwcm9kdWN0KTsgICAgICAgIFxyXG4gICAgICAgIHRoaXMucmVuZGVyU2t1c0Ryb3Bkb3duKHNrdXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHJlbmRlclNrdXNEcm9wZG93bihza3VzKSB7XHJcbiAgICAgICAgaWYgKCFza3VzIHx8ICFza3VzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdObyBza3UgZGF0YSBwcm92aWRlZCcpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgb3B0aW9uc0h0bWwgPSAnPG9wdGlvbiB2YWx1ZT1cIlwiPlNlbGVjdCBTS1U8L29wdGlvbj4nO1xyXG4gICAgICAgIHNrdXMuZm9yRWFjaChza3UgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb25zSHRtbCArPSBgPG9wdGlvbiB2YWx1ZT1cIiR7c2t1LnNsdWd9XCI+JHtza3UubmFtZX08L29wdGlvbj5gO1xyXG4gICAgICAgIH0pOyBcclxuICAgICAgICAkKCcjZm9ybV9za3UnKS5odG1sKG9wdGlvbnNIdG1sKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRTa3VzRm9yUHJvZHVjdCh1c2VyX3Byb2R1Y3QpIHtcclxuICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGRiLmdldFByb2R1Y3RzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHByb2R1Y3RzXHJcbiAgICAgICAgICAgIC5maWx0ZXIocHJvZHVjdCA9PiBwcm9kdWN0LnByb2R1Y3Rfc2x1ZyA9PT0gdXNlcl9wcm9kdWN0KVxyXG4gICAgICAgICAgICAucmVkdWNlKChhY2MsIHByb2R1Y3QpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICghYWNjLnNvbWUoaXRlbSA9PiBpdGVtLnNsdWcgPT09IHByb2R1Y3QucHJvZHVjdF9zbHVnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNsdWc6IHByb2R1Y3QucHJvZHVjdF9jb2RlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvZHVjdC5wcm9kdWN0X2NvZGUgXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgICAgICAgICB9LCBbXSkgICAgICAgICAgICBcclxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xyXG4gICAgfSAgICAgICBcclxuICAgIFxyXG4gICAgYXN5bmMgdXBkYXRlUHJvZHVjdHNEcm9wZG93bih0eXBlKSB7XHJcbiAgICAgICAgdGhpcy5pbml0KCk7XHJcbiAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCB0aGlzLmdldFByb2R1Y3RzRm9yVHlwZSh0eXBlKTsgICAgICAgIFxyXG4gICAgICAgIHRoaXMucmVuZGVyUHJvZHVjdHNEcm9wZG93bihwcm9kdWN0cyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgcmVuZGVyUHJvZHVjdHNEcm9wZG93bihwcm9kdWN0cykge1xyXG4gICAgICAgIGlmICghcHJvZHVjdHMgfHwgIXByb2R1Y3RzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdObyBwcm9kdWN0cyBkYXRhIHByb3ZpZGVkJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBvcHRpb25zSHRtbCA9ICc8b3B0aW9uIHZhbHVlPVwiXCI+U2VsZWN0IFByb2R1Y3Q8L29wdGlvbj4nO1xyXG4gICAgICAgIHByb2R1Y3RzLmZvckVhY2gocHJvZHVjdCA9PiB7XHJcbiAgICAgICAgICAgIG9wdGlvbnNIdG1sICs9IGA8b3B0aW9uIHZhbHVlPVwiJHtwcm9kdWN0LnNsdWd9XCI+JHtwcm9kdWN0Lm5hbWV9PC9vcHRpb24+YDtcclxuICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgICAgICQoJyNmb3JtX3Byb2R1Y3QnKS5odG1sKG9wdGlvbnNIdG1sKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRQcm9kdWN0c0ZvclR5cGUodHlwZSkge1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgZGIuZ2V0UHJvZHVjdHMoKTtcclxuICAgICAgICBjb25zdCBzaXRlID0gJCgnI2Zvcm1fYnJhbmQnKS52YWwoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHByb2R1Y3RzXHJcbiAgICAgICAgICAgIC5maWx0ZXIocHJvZHVjdCA9PiBwcm9kdWN0LnR5cGVfc2x1ZyA9PT0gdHlwZSAmJiBwcm9kdWN0LnNpdGUgPT09IHNpdGUgKVxyXG4gICAgICAgICAgICAucmVkdWNlKChhY2MsIHByb2R1Y3QpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFhY2Muc29tZShpdGVtID0+IGl0ZW0uc2x1ZyA9PT0gcHJvZHVjdC5wcm9kdWN0X3NsdWcpKSB7XHJcbiAgICAgICAgICAgICAgICBhY2MucHVzaCh7IFxyXG4gICAgICAgICAgICAgICAgc2x1ZzogcHJvZHVjdC5wcm9kdWN0X3NsdWcsIFxyXG4gICAgICAgICAgICAgICAgbmFtZTogcHJvZHVjdC5wcm9kdWN0X3NsdWcucmVwbGFjZSgvXnhjaXRlLS9pLCAnJykudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpLnRyaW0oKS5yZXBsYWNlKC8tL2csICcgJylcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBhY2M7XHJcbiAgICAgICAgICAgIH0sIFtdKSAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcbiAgICB9ICAgIFxyXG5cclxuICAgIGFzeW5jIHVwZGF0ZVR5cGVzRHJvcGRvd24oYnJhbmQpIHtcclxuICAgICAgICB0aGlzLmluaXQoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHR5cGVzID0gYXdhaXQgdGhpcy5nZXRUeXBlc0ZvckJyYW5kKGJyYW5kKTsgICAgICAgIFxyXG4gICAgICAgIHRoaXMucmVuZGVyVHlwZXNEcm9wZG93bih0eXBlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0VHlwZXNGb3JCcmFuZChicmFuZCkge1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgZGIuZ2V0UHJvZHVjdHMoKTtcclxuICAgICAgICByZXR1cm4gcHJvZHVjdHNcclxuICAgICAgICAgICAgLmZpbHRlcihwcm9kdWN0ID0+IHByb2R1Y3Quc2l0ZSA9PT0gYnJhbmQpXHJcbiAgICAgICAgICAgIC5yZWR1Y2UoKGFjYywgcHJvZHVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFhY2Muc29tZShpdGVtID0+IGl0ZW0uc2x1ZyA9PT0gcHJvZHVjdC50eXBlX3NsdWcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWNjLnB1c2goeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2x1ZzogcHJvZHVjdC50eXBlX3NsdWcsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9kdWN0LnR5cGVfbmFtZSBcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XHJcbiAgICAgICAgICAgIH0sIFtdKVxyXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgcmVuZGVyVHlwZXNEcm9wZG93bih0eXBlcykge1xyXG4gICAgICAgIGlmICghdHlwZXMgfHwgIXR5cGVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdObyB0eXBlcyBkYXRhIHByb3ZpZGVkJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gJCgnI29wdGlvbnMnKTtcclxuICAgICAgICBpZiAoIXRlbXBsYXRlLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUZW1wbGF0ZSAjb3B0aW9ucyBub3QgZm91bmQnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IG9wdGlvbnNIdG1sID0gJzxvcHRpb24gdmFsdWU9XCJcIj5TZWxlY3QgVHlwZTwvb3B0aW9uPic7XHJcbiAgICAgICAgdHlwZXMuZm9yRWFjaCh0eXBlID0+IHtcclxuICAgICAgICAgICAgb3B0aW9uc0h0bWwgKz0gYDxvcHRpb24gdmFsdWU9XCIke3R5cGUuc2x1Z31cIj4ke3R5cGUubmFtZX08L29wdGlvbj5gO1xyXG4gICAgICAgIH0pOyAgICAgICAgXHJcbiAgICAgICAgJCgnI2Zvcm1fdHlwZScpLmh0bWwob3B0aW9uc0h0bWwpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHVwZGF0ZVByb2plY3RDbGljayh1dWlkKSB7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKCd1cGRhdGVQcm9qZWN0Q2xpY2snLCB1dWlkKTtcclxuXHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmdQcm9qZWN0ID0gYXdhaXQgZGIuZ2V0UHJvamVjdEJ5VVVJRCh1dWlkKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coJ2V4aXN0aW5nUHJvamVjdCcsIGV4aXN0aW5nUHJvamVjdCk7XHJcblxyXG4gICAgICAgIGlmICghZXhpc3RpbmdQcm9qZWN0KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb2plY3Qgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHByb2plY3REYXRhID0ge1xyXG4gICAgICAgICAgICB1dWlkOiB1dWlkLFxyXG4gICAgICAgICAgICBwcm9qZWN0X2lkOiAkKCcjZm9ybV9lZGl0X3Byb2plY3RfaWQnKS52YWwoKSB8fCBleGlzdGluZ1Byb2plY3QucHJvamVjdF9pZCxcclxuICAgICAgICAgICAgcm9vbV9pZF9mazogZXhpc3RpbmdQcm9qZWN0LnJvb21faWRfZmssIC8vIGxlZ2FjeVxyXG4gICAgICAgICAgICBuYW1lOiAkKCcjZm9ybV9lZGl0X3Byb2plY3RfbmFtZScpLnZhbCgpIHx8IGV4aXN0aW5nUHJvamVjdC5uYW1lLFxyXG4gICAgICAgICAgICBzbHVnOiBhd2FpdCB1dGlscy5zbHVnaWZ5KCQoJyNmb3JtX2VkaXRfcHJvamVjdF9uYW1lJykudmFsKCkpIHx8IGV4aXN0aW5nUHJvamVjdC5zbHVnLFxyXG4gICAgICAgICAgICBlbmdpbmVlcjogJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X2VuZ2luZWVyJykudmFsKCkgfHwgZXhpc3RpbmdQcm9qZWN0LmVuZ2luZWVyLFxyXG4gICAgICAgICAgICBwcm9qZWN0X3ZlcnNpb246ICQoJyNmb3JtX2VkaXRfcHJvamVjdF92ZXJzaW9uJykudmFsKCkgfHwgZXhpc3RpbmdQcm9qZWN0LnByb2plY3RfdmVyc2lvbixcclxuICAgICAgICAgICAgbGFzdF91cGRhdGVkOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICAgICAgY3JlYXRlZF9vbjogZXhpc3RpbmdQcm9qZWN0LmNyZWF0ZWRfb24sXHJcbiAgICAgICAgICAgIG93bmVyX2lkOiBleGlzdGluZ1Byb2plY3Qub3duZXJfaWQsXHJcbiAgICAgICAgICAgIGNlZjogZXhpc3RpbmdQcm9qZWN0LmNlZiAvLyB1bnVzZWRcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZygndXBkYXRlUHJvamVjdENsaWNrJywgcHJvamVjdERhdGEpO1xyXG5cclxuXHJcbiAgICAgICAgYXdhaXQgZGIudXBkYXRlUHJvamVjdERldGFpbHMocHJvamVjdERhdGEpO1xyXG5cclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe1xyXG4gICAgICAgICAgICBtZXNzYWdlOiAnUHJvamVjdCBVcGRhdGVkJyxcclxuICAgICAgICAgICAgc3RhdHVzOiAnc3VjY2VzcycsXHJcbiAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiAxNTAwXHJcbiAgICB9KTsgICAgICAgIFxyXG4gICAgICBcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGFkZFNwZWNpYWxUb1Jvb21DbGljaygpIHtcclxuICAgICAgICAvLyB0byBzYXZlIGR1cGxpY2F0aW9uIGp1c3QgYnVpbGQgdGhlIHByb2R1Y3QgZGF0YSBvYmplY3QgYW5kIGNhbGwgdGhlIGFkZFByb2R1Y3RUb1Jvb21DbGljayBtZXRob2RcclxuICAgICAgICBjb25zdCBwcm9kdWN0RGF0YSA9IHtcclxuICAgICAgICAgICAgYnJhbmQ6ICQoJyNmb3JtX2N1c3RvbV9icmFuZCcpLnZhbCgpLFxyXG4gICAgICAgICAgICB0eXBlOiAkKCcjZm9ybV9jdXN0b21fdHlwZScpLnZhbCgpLFxyXG4gICAgICAgICAgICBwcm9kdWN0X3NsdWc6IGF3YWl0IHV0aWxzLnNsdWdpZnkoJCgnI2Zvcm1fY3VzdG9tX3Byb2R1Y3QnKS52YWwoKSksXHJcbiAgICAgICAgICAgIHByb2R1Y3RfbmFtZTogJCgnI2Zvcm1fY3VzdG9tX3Byb2R1Y3QnKS52YWwoKSxcclxuICAgICAgICAgICAgc2t1OiAkKCcjZm9ybV9jdXN0b21fc2t1JykudmFsKCksICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJvb21faWRfZms6ICQoJyNtX3Jvb21faWQnKS52YWwoKSxcclxuICAgICAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpLFxyXG4gICAgICAgICAgICBjdXN0b206ICQoJyNmb3JtX2N1c3RvbV9mbGFnJykudmFsKCksXHJcbiAgICAgICAgICAgIHJlZjogXCJcIixcclxuICAgICAgICAgICAgY3JlYXRlZF9vbjogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgICAgIGxhc3RfdXBkYXRlZDogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgICAgIG9yZGVyOiBudWxsLFxyXG4gICAgICAgICAgICByYW5nZTogbnVsbFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgLy9VSWtpdC5tb2RhbCgnI2FkZC1zcGVjaWFsJykuaGlkZSgpO1xyXG4gICAgICAgIHRoaXMuZG9BZGRQcm9kdWN0KHByb2R1Y3REYXRhKTsgICBcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBhZGRQcm9kdWN0VG9Sb29tQ2xpY2soKSB7XHJcblxyXG4gICAgICAgIC8vIGJ1aWxkIHRoZSBwcm9kdWN0IGRhdGEgb2JqZWN0ICAgIFxyXG4gICAgICAgIGNvbnN0IHByb2R1Y3REYXRhID0ge1xyXG4gICAgICAgICAgICBicmFuZDogJCgnI2Zvcm1fYnJhbmQnKS52YWwoKSxcclxuICAgICAgICAgICAgdHlwZTogJCgnI2Zvcm1fdHlwZScpLnZhbCgpLFxyXG4gICAgICAgICAgICBwcm9kdWN0X3NsdWc6ICQoJyNmb3JtX3Byb2R1Y3QnKS52YWwoKSxcclxuICAgICAgICAgICAgcHJvZHVjdF9uYW1lOiAkKCcjZm9ybV9wcm9kdWN0IG9wdGlvbjpzZWxlY3RlZCcpLnRleHQoKSxcclxuICAgICAgICAgICAgc2t1OiAkKCcjZm9ybV9za3UnKS52YWwoKSB8fCAkKCcjZm9ybV9wcm9kdWN0JykudmFsKCksXHJcbiAgICAgICAgICAgIHJvb21faWRfZms6ICQoJyNtX3Jvb21faWQnKS52YWwoKSxcclxuICAgICAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpLFxyXG4gICAgICAgICAgICBjdXN0b206IDAsXHJcbiAgICAgICAgICAgIHJlZjogXCJcIixcclxuICAgICAgICAgICAgY3JlYXRlZF9vbjogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgICAgIGxhc3RfdXBkYXRlZDogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgICAgIG9yZGVyOiBudWxsLFxyXG4gICAgICAgICAgICByYW5nZTogbnVsbFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpcy5kb0FkZFByb2R1Y3QocHJvZHVjdERhdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGRvQWRkUHJvZHVjdChwcm9kdWN0RGF0YSkge1xyXG5cclxuICAgICAgICBpZiAoICFwcm9kdWN0RGF0YS5wcm9kdWN0X3NsdWcgKSB7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQWxsIGZpZWxkcyBhcmUgcmVxdWlyZWQnLFxyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnZGFuZ2VyJyxcclxuICAgICAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICAgICAgdGltZW91dDogMTUwMFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXRpbHMuc2hvd1NwaW4oKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgZGIuc2F2ZVByb2R1Y3RUb1Jvb20ocHJvZHVjdERhdGEpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5yZWZyZXNoVGFibGVEYXRhKCk7XHJcblxyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe1xyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1Byb2R1Y3QgYWRkZWQgdG8gcm9vbScsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdzdWNjZXNzJyxcclxuICAgICAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICAgICAgdGltZW91dDogMTUwMFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHV0aWxzLmhpZGVTcGluKCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0UXR5RGlhbG9nKHByb2R1Y3REYXRhLnNrdSwgMSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNhdmluZyBwcm9kdWN0IHRvIHJvb206JywgZXJyKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdFcnJvciBzYXZpbmcgcHJvZHVjdCB0byByb29tJyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogJ2RhbmdlcicsXHJcbiAgICAgICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDE1MDBcclxuICAgICAgICAgICAgfSk7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHV0aWxzLmhpZGVTcGluKCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyBHcm91cCBwcm9kdWN0cyBieSBTS1UgYW5kIGNvdW50IG9jY3VycmVuY2VzXHJcbiAgICBhc3luYyBncm91cFByb2R1Y3RzQnlTS1UocHJvZHVjdHMpIHtcclxuICAgICAgICBjb25zdCBncm91cGVkUHJvZHVjdHMgPSBwcm9kdWN0cy5yZWR1Y2UoKGFjYywgcHJvZHVjdCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWFjY1twcm9kdWN0LnNrdV0pIHtcclxuICAgICAgICAgICAgICAgIGFjY1twcm9kdWN0LnNrdV0gPSB7IC4uLnByb2R1Y3QsIHF0eTogMCB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGFjY1twcm9kdWN0LnNrdV0ucXR5ICs9IDE7XHJcbiAgICAgICAgICAgIHJldHVybiBhY2M7XHJcbiAgICAgICAgfSwge30pO1xyXG5cclxuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhncm91cGVkUHJvZHVjdHMpO1xyXG4gICAgfSAgICBcclxuXHJcblxyXG4gICAgYXN5bmMgYWRkRmF2RGlhbG9nKHNrdSwgcHJvZHVjdF9uYW1lKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5pbml0KCk7ICAvLyBjYWxsIGluaXQgYXMgd2UnbGwgbmVlZCB0aGUgc2lkZWJhciBtb2R1bGUgdG8gYmUgbG9hZGVkXHJcblxyXG4gICAgICAgICQoJ3NwYW4ucGxhY2Vfc2t1JykuaHRtbChza3UpO1xyXG4gICAgICAgICQoJ2lucHV0I2RlbF9za3UnKS52YWwoc2t1KTtcclxuICAgICAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcblxyXG4gICAgICAgIGF3YWl0IGRiLmFkZEZhdlByb2R1Y3Qoc2t1LCBwcm9kdWN0X25hbWUsIHVzZXJfaWQpOyAgICAgICBcclxuICAgICAgICBhd2FpdCBzaWRlYmFyLnJlbmRlckZhdm91cml0ZXModXNlcl9pZCk7ICAgICAgIFxyXG4gICAgfVxyXG5cclxuXHJcblxyXG4gICAgYXN5bmMgcmVtb3ZlU2t1RGlhbG9nKHNrdSkge1xyXG4gICAgICAgIC8vIG9wZW4gdGhlIGRlbC1za3UgbW9kYWwgYW5kIHBhc3MgdGhlIHNrdSB0byBiZSBkZWxldGVkXHJcbiAgICAgICAgJCgnc3Bhbi5wbGFjZV9za3UnKS5odG1sKHNrdSk7XHJcbiAgICAgICAgJCgnaW5wdXQjZGVsX3NrdScpLnZhbChza3UpO1xyXG5cclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2RlbC1za3UnLCB7IHN0YWNrIDogdHJ1ZSB9KS5zaG93KCk7ICAgICAgICBcclxuXHJcbiAgICAgICAgJCgnI2Zvcm0tc3VibWl0LWRlbC1za3UnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyAoZSkgPT4ge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNrdSA9ICQoJyNkZWxfc2t1JykudmFsKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJvb21faWQgPSAkKCcjbV9yb29tX2lkJykudmFsKCk7ICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGF3YWl0IGRiLmRlbGV0ZVByb2R1Y3RGcm9tUm9vbShza3UsIHJvb21faWQpO1xyXG4gICAgICAgICAgICB0aGlzLnJlZnJlc2hUYWJsZURhdGEoKTtcclxuICAgICAgICAgICAgVUlraXQubW9kYWwoJyNkZWwtc2t1JykuaGlkZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9KTsgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzZXRRdHlEaWFsb2coc2t1LCBxdHkpIHtcclxuICAgICAgICAvLyBvcGVuIHRoZSBkZWwtc2t1IG1vZGFsIGFuZCBwYXNzIHRoZSBza3UgdG8gYmUgZGVsZXRlZFxyXG4gICAgICAgICQoJ3NwYW4ucGxhY2Vfc2t1JykuaHRtbChza3UpO1xyXG4gICAgICAgICQoJ2lucHV0I3NldF9xdHlfc2t1JykudmFsKHNrdSk7XHJcbiAgICAgICAgJCgnaW5wdXQjc2V0X3F0eV9xdHknKS52YWwocXR5KTtcclxuXHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNzZXQtcXR5JywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpOyAgICBcclxuICAgICAgICBVSWtpdC51dGlsLm9uKCcjc2V0LXF0eScsICdzaG93bicsICgpID0+IHtcclxuICAgICAgICAgICAgJCgnI3NldF9xdHlfcXR5JykuZm9jdXMoKS5zZWxlY3QoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuXHJcbiAgICAgICAgJCgnI2Zvcm0tc3VibWl0LXNldC1xdHknKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyAoZSkgPT4ge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHF0eSA9ICQoJyNzZXRfcXR5X3F0eScpLnZhbCgpO1xyXG4gICAgICAgICAgICBjb25zdCBza3UgPSAkKCcjc2V0X3F0eV9za3UnKS52YWwoKTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbV9pZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGF3YWl0IGRiLnNldFNrdVF0eUZvclJvb20ocXR5LCBza3UsIHJvb21faWQpO1xyXG4gICAgICAgICAgICB0aGlzLnJlZnJlc2hUYWJsZURhdGEoKTtcclxuICAgICAgICAgICAgVUlraXQubW9kYWwoJyNzZXQtcXR5JykuaGlkZSgpOyAgICAgICAgICAgIFxyXG4gICAgICAgIH0pOyAgICAgIFxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBhc3luYyByZWZyZXNoVGFibGVEYXRhKHJvb21JRCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdSZWZyZXNoaW5nIHRhYmxlIGRhdGEgZm9yIHJvb206Jywgcm9vbUlEKTtcclxuICAgICAgICBsZXQgcm9vbUlEVG9Vc2UgPSByb29tSUQgfHwgJCgnI21fcm9vbV9pZCcpLnZhbCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgYWxsUHJvZHVjdHNJblJvb20gPSBhd2FpdCBkYi5nZXRQcm9kdWN0c0ZvclJvb20ocm9vbUlEVG9Vc2UpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZ3JvdXBlZFByb2R1Y3RzID0gYXdhaXQgdGhpcy5ncm91cFByb2R1Y3RzQnlTS1UoYWxsUHJvZHVjdHNJblJvb20pO1xyXG4gICAgICAgIHRoaXMucFRhYmxlLnNldERhdGEoZ3JvdXBlZFByb2R1Y3RzKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyByZW5kZXJQcm9kY3RzVGFibGUocm9vbUlEKSB7XHJcblxyXG4gICAgICAgIGxldCByb29tSURUb1VzZSA9IHJvb21JRCB8fCAkKCcjbV9yb29tX2lkJykudmFsKCk7XHJcbiAgICAgICAgY29uc3QgYWxsUHJvZHVjdHNJblJvb20gPSBhd2FpdCBkYi5nZXRQcm9kdWN0c0ZvclJvb20ocm9vbUlEVG9Vc2UpO1xyXG4gICAgICAgIGNvbnN0IGdyb3VwZWRQcm9kdWN0cyA9IGF3YWl0IHRoaXMuZ3JvdXBQcm9kdWN0c0J5U0tVKGFsbFByb2R1Y3RzSW5Sb29tKTtcclxuXHJcbiAgICAgICAgdGhpcy5wVGFibGUgPSBuZXcgVGFidWxhdG9yKFwiI3B0YWJsZVwiLCB7XHJcbiAgICAgICAgICAgIGRhdGE6IGdyb3VwZWRQcm9kdWN0cywgICAgICAgICAgICBcclxuICAgICAgICAgICAgbG9hZGVyOiBmYWxzZSxcclxuICAgICAgICAgICAgbGF5b3V0OiBcImZpdENvbHVtbnNcIixcclxuICAgICAgICAgICAgZGF0YUxvYWRlckVycm9yOiBcIlRoZXJlIHdhcyBhbiBlcnJvciBsb2FkaW5nIHRoZSBkYXRhXCIsXHJcbiAgICAgICAgICAgIGluaXRpYWxTb3J0OltcclxuICAgICAgICAgICAgICAgIHtjb2x1bW46XCJwcm9kdWN0X3NsdWdcIiwgZGlyOlwiYXNjXCJ9LCAvL3NvcnQgYnkgdGhpcyBmaXJzdFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb2x1bW5zOiBbe1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcInByb2R1Y3RfaWRcIixcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogXCJ1dWlkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwicHJvZHVjdF9zbHVnXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IFwicHJvZHVjdF9zbHVnXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiU0tVXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IFwic2t1XCIsICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBzb3J0ZXI6XCJzdHJpbmdcIixcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIlByb2R1Y3RcIixcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogXCJwcm9kdWN0X25hbWVcIixcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIlJlZlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBcInJlZlwiLCAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBlZGl0b3I6IFwiaW5wdXRcIixcclxuICAgICAgICAgICAgICAgICAgICBlZGl0b3JQYXJhbXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXNrOiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RDb250ZW50czogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudEF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heGxlbmd0aDogXCI3XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiUXR5XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IFwicXR5XCIsICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIGNlbGxDbGljazogKGUsIGNlbGwpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRRdHlEaWFsb2coY2VsbC5nZXRSb3coKS5nZXREYXRhKCkuc2t1LCBjZWxsLmdldFJvdygpLmdldERhdGEoKS5xdHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyU29ydDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0dGVyOiB1dGlscy5pY29uRmF2LFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiA0MCxcclxuICAgICAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJjZW50ZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBjZWxsQ2xpY2s6IChlLCBjZWxsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkRmF2RGlhbG9nKGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnNrdSwgY2VsbC5nZXRSb3coKS5nZXREYXRhKCkucHJvZHVjdF9uYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJTb3J0OiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBmb3JtYXR0ZXI6IHV0aWxzLmljb25YLFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiA0MCxcclxuICAgICAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJjZW50ZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBjZWxsQ2xpY2s6IChlLCBjZWxsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlU2t1RGlhbG9nKGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnNrdSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLnBUYWJsZS5vbihcImNlbGxFZGl0ZWRcIiwgZnVuY3Rpb24gKGNlbGwpIHsgICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3Qgc2t1ID0gY2VsbC5nZXRSb3coKS5nZXREYXRhKCkuc2t1O1xyXG4gICAgICAgICAgICBjb25zdCByb29tX2lkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpO1xyXG4gICAgICAgICAgICBjb25zdCByZWYgPSBjZWxsLmdldFJvdygpLmdldERhdGEoKS5yZWYgICAgICAgICAgICBcclxuICAgICAgICAgICAgZGIudXBkYXRlUHJvZHVjdFJlZihyb29tX2lkLCBza3UsIHJlZik7ICAgICAgICAgXHJcbiAgICAgICAgfSk7ICAgICAgICBcclxuXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgaGFuZGxlRmlsZVVwbG9hZChldmVudCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQaWNrZXIgPSBldmVudC50YXJnZXQ7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWZpbGVQaWNrZXIgfHwgIWZpbGVQaWNrZXIuZmlsZXMgfHwgIWZpbGVQaWNrZXIuZmlsZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGZpbGUgc2VsZWN0ZWQuJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBmaWxlUGlja2VyLmZpbGVzWzBdO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU2VsZWN0ZWQgZmlsZTonLCBmaWxlKTtcclxuXHJcbiAgICAgICAgICAgIFVJa2l0Lm1vZGFsKCQoJyN1cGxvYWQtcHJvZ3Jlc3MnKSkuc2hvdygpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGZpbGUpIHtcclxuICAgICAgICAgICAgICAgIHZhciBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdpbWFnZScsIGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd1c2VyX2lkJywgYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJykpO1xyXG4gICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdyb29tX2lkJywgJCgnI21fcm9vbV9pZCcpLnZhbCgpKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgICAgICB4aHIub3BlbihcIlBPU1RcIiwgXCJodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9pbWFnZV91cGxvYWRcIiwgdHJ1ZSkgICAgO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIE1vbml0b3IgcHJvZ3Jlc3MgZXZlbnRzXHJcbiAgICAgICAgICAgICAgICB4aHIudXBsb2FkLmFkZEV2ZW50TGlzdGVuZXIoXCJwcm9ncmVzc1wiLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlLmxlbmd0aENvbXB1dGFibGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBlcmNlbnRhZ2UgPSAoZS5sb2FkZWQgLyBlLnRvdGFsKSAqIDEwMDsgLy8gQ2FsY3VsYXRlIHBlcmNlbnRhZ2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KGBVcGxvYWRpbmc6ICR7TWF0aC5yb3VuZChwZXJjZW50YWdlKX0lYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJy51ay1wcm9ncmVzcycpLnZhbChwZXJjZW50YWdlKTsgLy8gVXBkYXRlIHByb2dyZXNzIGJhclxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBVc2UgYXJyb3cgZnVuY3Rpb24gdG8gcHJlc2VydmUgJ3RoaXMnIGNvbnRleHRcclxuICAgICAgICAgICAgICAgIHhoci5vbmxvYWQgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHhoci5zdGF0dXMgPT09IDIwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRmlsZSB1cGxvYWRlZCBzdWNjZXNzZnVsbHk6JywgcmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KCdVcGxvYWQgY29tcGxldGUhJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcudWstcHJvZ3Jlc3MnKS52YWwoMTAwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyN1cGxvYWQtcHJvZ3Jlc3MgI2Nsb3NlLXByb2dyZXNzJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVJbWFnZXMocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmlsZSB1cGxvYWQgZmFpbGVkOicsIHJlc3BvbnNlLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KCdVcGxvYWQgZmFpbGVkOiAnICsgcmVzcG9uc2UubWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjdXBsb2FkLXByb2dyZXNzICNjbG9zZS1wcm9ncmVzcycpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWxlIHVwbG9hZCBmYWlsZWQuIFN0YXR1czonLCB4aHIuc3RhdHVzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KCdVcGxvYWQgZmFpbGVkLiBQbGVhc2UgdHJ5IGFnYWluLicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCcjdXBsb2FkLXByb2dyZXNzICNjbG9zZS1wcm9ncmVzcycpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgZXJyb3JzXHJcbiAgICAgICAgICAgICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWxlIHVwbG9hZCBmYWlsZWQgZHVlIHRvIGEgbmV0d29yayBlcnJvci4nKTtcclxuICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoJ05ldHdvcmsgZXJyb3Igb2NjdXJyZWQgZHVyaW5nIHVwbG9hZC4nKTtcclxuICAgICAgICAgICAgICAgICAgICAkKCcjdXBsb2FkLXByb2dyZXNzICNjbG9zZS1wcm9ncmVzcycpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIHhoci50aW1lb3V0ID0gMTIwMDAwOyAvLyBTZXQgdGltZW91dCB0byAyIG1pbnV0ZXNcclxuICAgICAgICAgICAgICAgIHhoci5vbnRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmlsZSB1cGxvYWQgdGltZWQgb3V0LicpO1xyXG4gICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dCgnVXBsb2FkIHRpbWVkIG91dC4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcclxuICAgICAgICAgICAgICAgICAgICAkKCcjdXBsb2FkLXByb2dyZXNzICNjbG9zZS1wcm9ncmVzcycpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIHhoci5zZW5kKGZvcm1EYXRhKTsgLy8gU2VuZCB0aGUgZm9ybSBkYXRhXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ05vIGZpbGUgc2VsZWN0ZWQuJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVXBsb2FkIGVycm9yOicsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9ICAgIFxyXG4gICAgXHJcbiAgICBhc3luYyB1cGRhdGVJbWFnZXMocmVzcG9uc2UpIHsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGRiLnNhdmVJbWFnZUZvclJvb20oJCgnI21fcm9vbV9pZCcpLnZhbCgpLCByZXNwb25zZSk7ICAgICAgICBcclxuICAgICAgICBhd2FpdCB0aGlzLmdldFJvb21JbWFnZXMoKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRSb29tSW1hZ2VzKCkge1xyXG4gICAgICAgIGNvbnN0IGltYWdlcyA9IGF3YWl0IGRiLmdldEltYWdlc0ZvclJvb20oJCgnI21fcm9vbV9pZCcpLnZhbCgpKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnZ2V0IHJvb20gaW1hZ2VzOicsIGltYWdlcyk7XHJcbiAgICAgICAgY29uc3QgaHRtbCA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVJbWFnZXMoaW1hZ2VzKTtcclxuICAgICAgICAkKCcjaW1hZ2VzLnJvb21faW1hZ2VzJykuaHRtbChodG1sKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZW5lcmF0ZUltYWdlcyhpbWFnZXMpIHtcclxuICAgICAgICBsZXQgaHRtbCA9IGA8ZGl2IGNsYXNzPVwidWstd2lkdGgtMS0xXCIgdWstbGlnaHRib3g9XCJhbmltYXRpb246IHNsaWRlXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cInVrLWdyaWQtc21hbGwgdWstY2hpbGQtd2lkdGgtMS0yIHVrLWNoaWxkLXdpZHRoLTEtMkBzIHVrLWNoaWxkLXdpZHRoLTEtM0BtIHVrLWNoaWxkLXdpZHRoLTEtNEBsIHVrLWZsZXgtY2VudGVyIHVrLXRleHQtY2VudGVyIFwiIHVrLWdyaWQ+YDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgaW1hZ2VzLmZvckVhY2goaW1hZ2UgPT4ge1xyXG4gICAgICAgICAgICBodG1sICs9IGA8ZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidWstY2FyZCB1ay1jYXJkLWRlZmF1bHQgdWstY2FyZC1ib2R5IHVrLXBhZGRpbmctcmVtb3ZlXCI+XHJcbiAgICAgICAgICAgICAgICA8YSBocmVmPVwiaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay91cGxvYWRzLyR7aW1hZ2Uuc2FmZV9maWxlbmFtZX1cIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbWFnZWJnXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay91cGxvYWRzLyR7aW1hZ2Uuc2FmZV9maWxlbmFtZX0pO1wiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+YDtcclxuICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgaHRtbCArPSBgPC9kaXY+PC9kaXY+YDtcclxuXHJcbiAgICAgICAgcmV0dXJuKGh0bWwpO1xyXG4gICAgfVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IFRhYmxlc01vZHVsZSgpOyIsImNsYXNzIFV0aWxzTW9kdWxlIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnVXRpbHNNb2R1bGUgY29uc3RydWN0b3InKTtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSBmYWxzZTsgICBcclxuXHJcbiAgICAgICAgdGhpcy51aWQgPSB0aGlzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG5cclxuICAgICAgICB0aGlzLmNoZWNrTG9naW4oKTsgICAgICAgIFxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuaWNvblBsdXMgPSBmdW5jdGlvbihjZWxsLCBmb3JtYXR0ZXJQYXJhbXMsIG9uUmVuZGVyZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICc8aSBjbGFzcz1cImZhLXNvbGlkIGZhLWNpcmNsZS1wbHVzXCI+PC9pPic7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLmljb25NaW51cyA9IGZ1bmN0aW9uKGNlbGwsIGZvcm1hdHRlclBhcmFtcywgb25SZW5kZXJlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJzxpIGNsYXNzPVwiZmEtc29saWQgZmEtY2lyY2xlLW1pbnVzXCI+PC9pPic7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLmljb25YID0gZnVuY3Rpb24oY2VsbCwgZm9ybWF0dGVyUGFyYW1zLCBvblJlbmRlcmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnPHNwYW4gY2xhc3M9XCJpY29uIHJlZFwiIHVrLWljb249XCJpY29uOiB0cmFzaDsgcmF0aW86IDEuM1wiIHRpdGxlPVwiRGVsZXRlXCI+PC9zcGFuPic7XHJcbiAgICAgICAgfTsgICAgXHJcbiAgICAgICAgdGhpcy5pY29uQ29weSA9IGZ1bmN0aW9uKGNlbGwsIGZvcm1hdHRlclBhcmFtcywgb25SZW5kZXJlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJzxzcGFuIGNsYXNzPVwiaWNvblwiIHVrLWljb249XCJpY29uOiBjb3B5OyByYXRpbzogMS4zXCIgdGl0bGU9XCJEdXBsaWNhdGVcIj48L3NwYW4+JztcclxuICAgICAgICB9OyAgICAgXHJcbiAgICAgICAgdGhpcy5pY29uRmF2ID0gZnVuY3Rpb24oY2VsbCwgZm9ybWF0dGVyUGFyYW1zLCBvblJlbmRlcmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnPHNwYW4gY2xhc3M9XCJpY29uIHJlZFwiIHVrLWljb249XCJpY29uOiBoZWFydDsgcmF0aW86IDEuM1wiIHRpdGxlPVwiRmF2b3VyaXRlXCI+PC9zcGFuPic7XHJcbiAgICAgICAgfTsgICBcclxuICAgICAgICBcclxuICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxvZ2luID0gVUlraXQubW9kYWwoJy5sb2dpbm1vZGFsJywge1xyXG4gICAgICAgICAgICBiZ0Nsb3NlIDogZmFsc2UsXHJcbiAgICAgICAgICAgIGVzY0Nsb3NlIDogZmFsc2VcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSByZXR1cm47XHJcbiAgICAgICAgTXVzdGFjaGUudGFncyA9IFtcIltbXCIsIFwiXV1cIl07XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gdHJ1ZTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIFxyXG4gICAgYXN5bmMgY2hlY2tMb2dpbigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQ2hlY2tpbmcgYXV0aGVudGljYXRpb24gLi4uJyk7XHJcbiAgICAgICAgY29uc3QgZGIgPSByZXF1aXJlKCcuLi9kYicpOyAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB0aGlzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG4gICAgXHJcbiAgICAgICAgaWYgKHVzZXJfaWQgPT0gXCJcIikge1xyXG4gICAgICAgICAgICBVSWtpdC5tb2RhbCgnLmxvZ2lubW9kYWwnKS5zaG93KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgJCgnI21fdXNlcl9pZCcpLnZhbCh1c2VyX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IHRoYXQgPSB0aGlzO1xyXG4gICAgXHJcbiAgICAgICAgJChcIiNmb3JtLWxvZ2luXCIpLm9mZihcInN1Ym1pdFwiKS5vbihcInN1Ym1pdFwiLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgJCgnLmxvZ2luLWVycm9yJykuaGlkZSgpO1xyXG4gICAgICAgICAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNmb3JtLWxvZ2luXCIpOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgZGIubG9naW5Vc2VyKG5ldyBGb3JtRGF0YShmb3JtKSk7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodXNlciAhPT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgICQoJyNtX3VzZXJfaWQnKS52YWwodXNlci51dWlkKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQuc2V0Q29va2llKCd1c2VyX2lkJywgdXNlci51dWlkKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQuc2V0Q29va2llKCd1c2VyX25hbWUnLCB1c2VyLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgZGIuc3luY0RhdGEodXNlci51dWlkKTsgIFxyXG4gICAgXHJcbiAgICAgICAgICAgICAgICBVSWtpdC5tb2RhbCgkKCcjbG9naW4nKSkuaGlkZSgpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXNlIHJlcGxhY2Ugc3RhdGUgaW5zdGVhZCBvZiByZWRpcmVjdFxyXG4gICAgICAgICAgICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCAnJywgJy8nKTtcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgJCgnLmxvZ2luLWVycm9yIHAnKS5odG1sKFwiVGhlcmUgd2FzIGFuIGVycm9yIGxvZ2dpbmcgaW4uIFBsZWFzZSB0cnkgYWdhaW4uXCIpO1xyXG4gICAgICAgICAgICAgICAgJCgnLmxvZ2luLWVycm9yJykuc2hvdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9nb3V0KCkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuZGVsZXRlQ29va2llKCd1c2VyX2lkJyk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5kZWxldGVDb29raWUoJ3VzZXJfbmFtZScpO1xyXG4gICAgICAgIC8vIFVzZSByZXBsYWNlIHN0YXRlIGluc3RlYWQgb2YgcmVkaXJlY3RcclxuICAgICAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoe30sICcnLCAnLz90PScpO1xyXG4gICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGRlbGV0ZUNvb2tpZShjbmFtZSkge1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgIGQuc2V0VGltZShkLmdldFRpbWUoKSAtICgyNCAqIDYwICogNjAgKiAxMDAwKSk7XHJcbiAgICAgICAgbGV0IGV4cGlyZXMgPSBcImV4cGlyZXM9XCIgKyBkLnRvVVRDU3RyaW5nKCk7XHJcbiAgICAgICAgZG9jdW1lbnQuY29va2llID0gY25hbWUgKyBcIj07XCIgKyBleHBpcmVzICsgXCI7cGF0aD0vXCI7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2V0Q29va2llKGNuYW1lLCBjdmFsdWUsIGV4ZGF5cykge1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgIGQuc2V0VGltZShkLmdldFRpbWUoKSArIChleGRheXMgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XHJcbiAgICAgICAgbGV0IGV4cGlyZXMgPSBcImV4cGlyZXM9XCIrZC50b1VUQ1N0cmluZygpO1xyXG4gICAgICAgIGRvY3VtZW50LmNvb2tpZSA9IGNuYW1lICsgXCI9XCIgKyBjdmFsdWUgKyBcIjtcIiArIGV4cGlyZXMgKyBcIjtwYXRoPS9cIjtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRDb29raWUoY25hbWUpIHtcclxuICAgICAgICBsZXQgbmFtZSA9IGNuYW1lICsgXCI9XCI7XHJcbiAgICAgICAgbGV0IGNhID0gZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7XHJcbiAgICAgICAgZm9yKGxldCBpID0gMDsgaSA8IGNhLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBjID0gY2FbaV07XHJcbiAgICAgICAgICAgIHdoaWxlIChjLmNoYXJBdCgwKSA9PSAnICcpIHtcclxuICAgICAgICAgICAgICAgIGMgPSBjLnN1YnN0cmluZygxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoYy5pbmRleE9mKG5hbWUpID09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjLnN1YnN0cmluZyhuYW1lLmxlbmd0aCwgYy5sZW5ndGgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBhc3luYyBnZXRVc2VySUQoKSB7XHJcbiAgICAgICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHRoaXMuZ2V0Q29va2llKCd1c2VyX2lkJyk7ICAgICAgICBcclxuICAgICAgICBpZiAodXNlcl9pZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdXNlcl9pZC50b1N0cmluZygpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIHNob3cgbG9naW4gbW9kYWwgd2l0aCBVSWtpdFxyXG4gICAgICAgICAgICB0aGlzLmNoZWNrTG9naW4oKTtcclxuICAgICAgICAgICAgLy8gVUlraXQubW9kYWwoJyNsb2dpbicpLnNob3coKTtcclxuICAgICAgICAgICAgLy8gcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0gICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuICAgIGFzeW5jIHNob3dTcGluKCkge1xyXG4gICAgICAgICQoJyNzcGlubmVyJykuZmFkZUluKCdmYXN0Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgaGlkZVNwaW4oKSB7XHJcbiAgICAgICAgJCgnI3NwaW5uZXInKS5mYWRlT3V0KCdmYXN0Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZm9ybWF0RGF0ZVRpbWUgKGRhdGUpIHtcclxuICAgICAgICBjb25zdCBwYWQgPSAobnVtKSA9PiBudW0udG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpO1xyXG4gICAgICAgIHJldHVybiBgJHtkYXRlLmdldEZ1bGxZZWFyKCl9LSR7cGFkKGRhdGUuZ2V0TW9udGgoKSArIDEpfS0ke3BhZChkYXRlLmdldERhdGUoKSl9ICR7cGFkKGRhdGUuZ2V0SG91cnMoKSl9OiR7cGFkKGRhdGUuZ2V0TWludXRlcygpKX06JHtwYWQoZGF0ZS5nZXRTZWNvbmRzKCkpfWA7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2V0Q29va2llKGNuYW1lLCBjdmFsdWUsIGV4ZGF5cykge1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgIGQuc2V0VGltZShkLmdldFRpbWUoKSArIChleGRheXMgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XHJcbiAgICAgICAgbGV0IGV4cGlyZXMgPSBcImV4cGlyZXM9XCIrZC50b1VUQ1N0cmluZygpO1xyXG4gICAgICAgIGRvY3VtZW50LmNvb2tpZSA9IGNuYW1lICsgXCI9XCIgKyBjdmFsdWUgKyBcIjtcIiArIGV4cGlyZXMgKyBcIjtwYXRoPS9cIjtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRDb29raWUoY25hbWUpIHtcclxuICAgICAgICBsZXQgbmFtZSA9IGNuYW1lICsgXCI9XCI7XHJcbiAgICAgICAgbGV0IGNhID0gZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7XHJcbiAgICAgICAgZm9yKGxldCBpID0gMDsgaSA8IGNhLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBjID0gY2FbaV07XHJcbiAgICAgICAgICAgIHdoaWxlIChjLmNoYXJBdCgwKSA9PSAnICcpIHtcclxuICAgICAgICAgICAgICAgIGMgPSBjLnN1YnN0cmluZygxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoYy5pbmRleE9mKG5hbWUpID09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjLnN1YnN0cmluZyhuYW1lLmxlbmd0aCwgYy5sZW5ndGgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfSAgIFxyXG4gICAgXHJcbiAgICBhc3luYyBzbHVnaWZ5KHRleHQpIHtcclxuICAgICAgICAvLyBtYWtlIGEgc2x1ZyBvZiB0aGlzIHRleHRcclxuICAgICAgICByZXR1cm4gdGV4dC50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkudHJpbSgpXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICctJykgICAgICAgICAgIC8vIFJlcGxhY2Ugc3BhY2VzIHdpdGggLVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvW15cXHdcXC1dKy9nLCAnJykgICAgICAgLy8gUmVtb3ZlIGFsbCBub24td29yZCBjaGFyc1xyXG4gICAgICAgICAgICAucmVwbGFjZSgvXFwtXFwtKy9nLCAnLScpOyAgICAgICAgLy8gUmVwbGFjZSBtdWx0aXBsZSAtIHdpdGggc2luZ2xlIC1cclxuICAgIH1cclxuICAgIGFzeW5jIGRlc2x1Z2lmeSh0ZXh0KSB7XHJcbiAgICAgICAgLy8gbWFrZSBodW1hbiByZWFkYWJsZSB0ZXh0IGZyb20gc2x1ZyAgIFxyXG4gICAgICAgIHJldHVybiB0ZXh0LnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS50cmltKClcclxuICAgICAgICAgICAgLnJlcGxhY2UoLy0vZywgJyAnKTsgICAgICAgICAgIC8vIFJlcGxhY2UgLSB3aXRoIHNwYWNlICAgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldEFwcFZlcnNpb24oKSB7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZygnZ2V0dGluZyB2ZXJzaW9uJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gV2FpdCBmb3Igc2VydmljZSB3b3JrZXIgcmVnaXN0cmF0aW9uXHJcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlYWR5O1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdnb3QgcmVnaXN0cmF0aW9uOicsIHJlZ2lzdHJhdGlvbik7XHJcbiAgICBcclxuICAgICAgICAgICAgaWYgKCFyZWdpc3RyYXRpb24uYWN0aXZlKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGFjdGl2ZSBzZXJ2aWNlIHdvcmtlciBmb3VuZCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvblByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZUhhbmRsZXI7XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBtZXNzYWdlSGFuZGxlcik7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1ZlcnNpb24gcmVxdWVzdCB0aW1lZCBvdXQnKSk7XHJcbiAgICAgICAgICAgICAgICB9LCAxMDAwMCk7XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VIYW5kbGVyID0gKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnVXRpbHMgcmVjZWl2ZWQgU1cgbWVzc2FnZTonLCBldmVudC5kYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnQuZGF0YT8udHlwZSA9PT0gJ0NBQ0hFX1ZFUlNJT04nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IGV2ZW50LmRhdGEudmVyc2lvbi5zcGxpdCgnLXYnKVsxXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0V4dHJhY3RlZCB2ZXJzaW9uOicsIHZlcnNpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHZlcnNpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIC8vIEFkZCBtZXNzYWdlIGxpc3RlbmVyIGJlZm9yZSBzZW5kaW5nIG1lc3NhZ2VcclxuICAgICAgICAgICAgICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBtZXNzYWdlSGFuZGxlcik7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIFNlbmQgbWVzc2FnZSB0byBzZXJ2aWNlIHdvcmtlclxyXG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnVXRpbHMgc2VuZGluZyBnZXRDYWNoZVZlcnNpb24gbWVzc2FnZScpO1xyXG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLmFjdGl2ZS5wb3N0TWVzc2FnZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0dFVF9WRVJTSU9OJyxcclxuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIFxyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gYXdhaXQgdmVyc2lvblByb21pc2U7XHJcbiAgICAgICAgICAgIHJldHVybiBgMS4wLiR7dmVyc2lvbn1gO1xyXG4gICAgXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgLy9jb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIGFwcCB2ZXJzaW9uOicsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuICdOb3Qgc2V0JztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgY2xlYXJTZXJ2aWNlV29ya2VyQ2FjaGUoKSB7XHJcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9ucyA9IGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmdldFJlZ2lzdHJhdGlvbnMoKTtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChyZWdpc3RyYXRpb25zLm1hcChyZWcgPT4gcmVnLnVucmVnaXN0ZXIoKSkpO1xyXG4gICAgICAgIGNvbnN0IGNhY2hlS2V5cyA9IGF3YWl0IGNhY2hlcy5rZXlzKCk7XHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoY2FjaGVLZXlzLm1hcChrZXkgPT4gY2FjaGVzLmRlbGV0ZShrZXkpKSk7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZygnU2VydmljZSBXb3JrZXIgYW5kIGNhY2hlcyBjbGVhcmVkJyk7XHJcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIG1ha2VpZChsZW5ndGgpIHtcclxuICAgICAgICBsZXQgcmVzdWx0ID0gJyc7XHJcbiAgICAgICAgY29uc3QgY2hhcmFjdGVycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSc7XHJcbiAgICAgICAgY29uc3QgY2hhcmFjdGVyc0xlbmd0aCA9IGNoYXJhY3RlcnMubGVuZ3RoO1xyXG4gICAgICAgIGxldCBjb3VudGVyID0gMDtcclxuICAgICAgICB3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXN1bHQgKz0gY2hhcmFjdGVycy5jaGFyQXQoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcmFjdGVyc0xlbmd0aCkpO1xyXG4gICAgICAgICAgICBjb3VudGVyICs9IDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG5cclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBVdGlsc01vZHVsZSgpOyIsImNvbnN0IE11c3RhY2hlID0gcmVxdWlyZSgnbXVzdGFjaGUnKTtcclxuY29uc3QgZGIgPSByZXF1aXJlKCcuL2RiJyk7XHJcbmNvbnN0IHNzdCA9IHJlcXVpcmUoJy4vc3N0Jyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3V0aWxzJyk7XHJcbmNvbnN0IENBQ0hFX05BTUUgPSAnc3N0LWNhY2hlLXYzMCc7IFxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKHBhdGgpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgL3ZpZXdzLyR7cGF0aH0uaHRtbGApO1xyXG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcignTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdGZXRjaGluZyBmcm9tIGNhY2hlOicsIGVycm9yKTtcclxuICAgICAgICBjb25zdCBjYWNoZSA9IGF3YWl0IGNhY2hlcy5vcGVuKENBQ0hFX05BTUUpO1xyXG4gICAgICAgIGNvbnN0IGNhY2hlZFJlc3BvbnNlID0gYXdhaXQgY2FjaGUubWF0Y2goYC92aWV3cy8ke3BhdGh9Lmh0bWxgKTtcclxuICAgICAgICBpZiAoY2FjaGVkUmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGNhY2hlZFJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICAgICAgaXNSb3V0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG59XHJcblxyXG5sZXQgaXNSb3V0aW5nID0gZmFsc2U7XHJcblxyXG5hc3luYyBmdW5jdGlvbiByb3V0ZXIocGF0aCwgcHJvamVjdF9pZCkge1xyXG4gICAgaWYgKGlzUm91dGluZykgcmV0dXJuO1xyXG4gICAgaXNSb3V0aW5nID0gdHJ1ZTtcclxuICAgIFxyXG4gICAgYXdhaXQgdXRpbHMuY2hlY2tMb2dpbigpO1xyXG5cclxuICAgIC8vIFVwZGF0ZSBicm93c2VyIFVSTCB3aXRob3V0IHJlbG9hZFxyXG4gICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHt9LCAnJywgYC8ke3BhdGh9YCk7XHJcbiAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgICAgbGV0IHRlbXBsYXRlO1xyXG4gICAgICAgIHN3aXRjaChwYXRoKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ3RhYmxlcyc6ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGUgPSBhd2FpdCBsb2FkVGVtcGxhdGUoJ3RhYmxlcycpO1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHN0b3JlZCBwcm9qZWN0IGRhdGFcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByb2plY3REYXRhID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBNdXN0YWNoZS5yZW5kZXIodGVtcGxhdGUsIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdUYWJsZXMgUGFnZScsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdDogcHJvamVjdERhdGEsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdF9pZDogcHJvamVjdF9pZFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAkKCcjcGFnZScpLmh0bWwocmVuZGVyZWQpO1xyXG4gICAgICAgICAgICAgICAgc3N0Lmdsb2JhbEJpbmRzKCk7XHJcbiAgICAgICAgICAgICAgICBzc3QudGFibGVzRnVuY3Rpb25zKHByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NjaGVkdWxlJzpcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlID0gYXdhaXQgbG9hZFRlbXBsYXRlKCdzY2hlZHVsZScpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWRTY2hlZHVsZSA9IE11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgeyBcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1NjaGVkdWxlIFBhZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICdUaGlzIGlzIHRoZSBzY2hlZHVsZSBwYWdlIGNvbnRlbnQnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICQoJyNwYWdlJykuaHRtbChyZW5kZXJlZFNjaGVkdWxlKTtcclxuICAgICAgICAgICAgICAgIHNzdC5nbG9iYWxCaW5kcygpO1xyXG4gICAgICAgICAgICAgICAgc3N0LnNjaGVkdWxlRnVuY3Rpb25zKCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnYWNjb3VudCc6XHJcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZSA9IGF3YWl0IGxvYWRUZW1wbGF0ZSgnYWNjb3VudCcpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWRBY2NvdW50ID0gTXVzdGFjaGUucmVuZGVyKHRlbXBsYXRlLCB7IFxyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnQWNjb3VudCBQYWdlJyxcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiAnVGhpcyBpcyB0aGUgYWNjb3VudCBwYWdlIGNvbnRlbnQnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICQoJyNwYWdlJykuaHRtbChyZW5kZXJlZEFjY291bnQpO1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBzc3QuZ2xvYmFsQmluZHMoKTtcclxuICAgICAgICAgICAgICAgICAgICBzc3QuYWNjb3VudEZ1bmN0aW9ucygpO1xyXG4gICAgICAgICAgICAgICAgfSwgNTAwKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrOyAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlID0gYXdhaXQgbG9hZFRlbXBsYXRlKCdob21lJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJlZEhvbWUgPSBNdXN0YWNoZS5yZW5kZXIodGVtcGxhdGUsIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdEYXNoYm9hcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICdZb3VyIHByb2plY3RzIGFyZSBsaXN0ZWQgYmVsb3cnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICQoJyNwYWdlJykuaHRtbChyZW5kZXJlZEhvbWUpO1xyXG4gICAgICAgICAgICAgICAgc3N0Lmdsb2JhbEJpbmRzKCk7XHJcbiAgICAgICAgICAgICAgICBzc3QuaG9tZUZ1bmN0aW9ucygpO1xyXG4gICAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignUm91dGluZyBlcnJvcjonLCBlcnJvcik7XHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpOyAgICAgICAgXHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIGlzUm91dGluZyA9IGZhbHNlO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyBIYW5kbGUgYnJvd3NlciBiYWNrL2ZvcndhcmQgYnV0dG9uc1xyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWVcclxuICAgICAgICAuc3BsaXQoJy8nKVxyXG4gICAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0Lmxlbmd0aCA+IDApO1xyXG4gICAgcm91dGVyKHBhdGhQYXJ0c1swXSB8fCAnaG9tZScsIHBhdGhQYXJ0c1sxXSk7XHJcbn0pO1xyXG5cclxuLy9tb2R1bGUuZXhwb3J0cyA9IHJvdXRlcjtcclxud2luZG93LnJvdXRlciA9IHJvdXRlcjtcclxuIiwiY29uc3QgZGIgPSByZXF1aXJlKCcuL2RiJyk7IFxyXG5jb25zdCB0YWJsZXMgPSByZXF1aXJlKCcuL21vZHVsZXMvdGFibGVzJyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3V0aWxzJyk7XHJcbmNvbnN0IHNpZGViYXIgPSByZXF1aXJlKCcuL21vZHVsZXMvc2lkZWJhcicpO1xyXG5jb25zdCBzeW5jID0gcmVxdWlyZSgnLi9tb2R1bGVzL3N5bmMnKTtcclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdsb2JhbEJpbmRzKCkge1xyXG5cclxuICAgIGNvbnN0IGN1cnJlbnRQcm9qZWN0ID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTtcclxuICAgIGlmICghY3VycmVudFByb2plY3QucHJvamVjdF9pZCkge1xyXG4gICAgICAgICQoJy50YWJsZXNfbGluaywuc2NoZWR1bGVfbGluaycpLmhpZGUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgJCgnLnRhYmxlc19saW5rLC5zY2hlZHVsZV9saW5rJykuc2hvdygpO1xyXG4gICAgfSAgICBcclxuXHJcbiAgICAkKCcjc3luY2ljb24nKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBzeW5jLnB1c2hBbGxVc2VyRGF0YSgpO1xyXG4gICAgfSk7XHJcbiAgICAkKCcjc3luY2ljb24nKS5vbigndG91Y2hlbmQnKS5vbigndG91Y2hlbmQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgJCgnI3N5bmNpY29uJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpOyBcclxuICAgICAgICB9LCAxMDAwKTtcclxuICAgIH0pO1xyXG5cclxufVxyXG5cclxuLypcclxuKiAgIFRhYmxlcyBwYWdlIGZ1bmN0aW9uc1xyXG4qL1xyXG5hc3luYyBmdW5jdGlvbiB0YWJsZXNGdW5jdGlvbnMocHJvamVjdF9pZCkge1xyXG4gICAgdGFibGVzLmluaXQoKTsgICAgICBcclxuXHJcbiAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IGN1cnJlbnRQcm9qZWN0ID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTtcclxuICAgIGlmIChjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkKSB7XHJcbiAgICAgICAgcHJvamVjdF9pZCA9IGN1cnJlbnRQcm9qZWN0LnByb2plY3RfaWQ7XHJcbiAgICB9ICAgICAgICBcclxuXHJcbiAgICBjb25zb2xlLmxvZygnUnVubmluZyB0YWJsZXMgZnVuY3Rpb25zIGZvciBwcm9qZWN0OicsIHByb2plY3RfaWQpO1xyXG5cclxuICAgIFxyXG5cclxuICAgIC8vJCgnI2RlYnVnJykuaHRtbChjdXJyZW50UHJvamVjdC5wcm9qZWN0X25hbWUpO1xyXG4gICAgJCgnLnRhYmxlc19saW5rJykuc2hvdygpO1xyXG4gICAgVUlraXQub2ZmY2FudmFzKCcudGFibGVzLXNpZGUnKS5zaG93KCk7XHJcblxyXG4gICAgLy8gSW5pdGlhbCBsb2FkIHdpdGggZGVmYXVsdCBicmFuZFxyXG4gICAgYXdhaXQgdGFibGVzLnVwZGF0ZVR5cGVzRHJvcGRvd24oJzEnKTtcclxuICAgIFxyXG4gICAgLy8gSGFuZGxlIGJyYW5kIGNoYW5nZXNcclxuICAgICQoJyNmb3JtX2JyYW5kJykub24oJ2NoYW5nZScsIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGF3YWl0IHRhYmxlcy51cGRhdGVUeXBlc0Ryb3Bkb3duKCQodGhpcykudmFsKCkpO1xyXG4gICAgfSk7XHJcbiAgICAvLyBIYW5kbGUgdHlwZSBjaGFuZ2VzXHJcbiAgICAkKCcjZm9ybV90eXBlJykub24oJ2NoYW5nZScsIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGF3YWl0IHRhYmxlcy51cGRhdGVQcm9kdWN0c0Ryb3Bkb3duKCQodGhpcykudmFsKCkpO1xyXG4gICAgfSk7XHJcbiAgICAvLyBIYW5kbGUgcHJvZHVjdCBjaGFuZ2VzXHJcbiAgICAkKCcjZm9ybV9wcm9kdWN0Jykub24oJ2NoYW5nZScsIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGF3YWl0IHRhYmxlcy51cGRhdGVTa3VzRHJvcGRvd24oJCh0aGlzKS52YWwoKSk7XHJcbiAgICB9KTsgICAgXHJcblxyXG4gICAgLy8gYWRkIHByb2RjdXQgdG8gcm9vbVxyXG4gICAgJCgnI2J0bl9hZGRfcHJvZHVjdCcpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGF3YWl0IHRhYmxlcy5hZGRQcm9kdWN0VG9Sb29tQ2xpY2soKTsgICAgICAgXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgU3BlY2lhbCB0byByb29tXHJcbiAgICAkKCcjYnRuX2FkZF9zcGVjaWFsJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIC8vVUlraXQubW9kYWwoJyNhZGQtc3BlY2lhbCcpLnJlbW92ZSgpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjYWRkLXNwZWNpYWwnLCB7IHN0YWNrIDogdHJ1ZSB9KS5zaG93KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAkKCcjYWRkLWltYWdlJykub24oJ2NoYW5nZScsIHRhYmxlcy5oYW5kbGVGaWxlVXBsb2FkKTtcclxuICAgICQoJyN1cGxvYWQtcHJvZ3Jlc3MgI2Nsb3NlLXByb2dyZXNzJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCQoJyN1cGxvYWQtcHJvZ3Jlc3MnKSkuaGlkZSgpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuXHJcbiAgICBhd2FpdCB0YWJsZXMucmVuZGVyUHJvZGN0c1RhYmxlKCk7XHJcblxyXG4gICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgXHJcbiAgICBhd2FpdCBzaWRlYmFyLnJlbmRlckZhdm91cml0ZXModXNlcl9pZCk7XHJcblxyXG5cclxuICAgIC8vIGxvYWRSb29tRGF0YSBmb3IgdGhlIGZpcnN0IG1lbnRpb25lZCByb29tIGlkIGluIHRoZSBzaWRlYmFyXHJcbiAgICBjb25zdCBmaXJzdFJvb21JZCA9ICQoJyNsb2NhdGlvbnMgLnJvb20tbGluaycpLmZpcnN0KCkuZGF0YSgnaWQnKTsgICAgXHJcbiAgICBhd2FpdCBsb2FkUm9vbURhdGEoZmlyc3RSb29tSWQpO1xyXG4gICAgYXdhaXQgbG9hZFJvb21Ob3RlcyhmaXJzdFJvb21JZCk7XHJcbiAgICBhd2FpdCBsb2FkUm9vbUltYWdlcyhmaXJzdFJvb21JZCk7XHJcblxyXG4gICAgLy8gbmFtZSBsYWJlbHMgKHJlbmFtZSlcclxuICAgICQoJ3NwYW4ubmFtZScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdOYW1lIGNsaWNrZWQ6JywgJCh0aGlzKS5kYXRhKCdpZCcpKTsgICAgXHJcbiAgICAgICAgY29uc3Qgc3RvcmUgPSAkKHRoaXMpLmRhdGEoJ3RibCcpO1xyXG4gICAgICAgIGNvbnN0IHV1aWQgPSAkKHRoaXMpLmRhdGEoJ2lkJyk7XHJcbiAgICAgICAgY29uc3QgbmFtZSA9ICQodGhpcykudGV4dCgpO1xyXG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xyXG4gICAgICAgIC8vIGNhbGwgdGhlIG1vZGFsIHRvIHVwZGF0ZSB0aGUgbmFtZVxyXG4gICAgICAgIFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0Pk5ldyBuYW1lPC9oND4nLCBuYW1lKS50aGVuKGFzeW5jIGZ1bmN0aW9uKG5ld05hbWUpIHtcclxuICAgICAgICAgICAgaWYgKG5ld05hbWUpIHsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBkYi51cGRhdGVOYW1lKHN0b3JlLCB1dWlkLCBuZXdOYW1lKTtcclxuICAgICAgICAgICAgICAgICQodGhhdCkudGV4dChuZXdOYW1lKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgLy8gcHJvamVjdF9pZCAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICAvLyByb29tIGRpbWVuc2lvbiBmaWVsZHNcclxuICAgICQoJy5yb29tZGltJykub2ZmKCdibHVyJykub24oJ2JsdXInLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgY29uc3Qgcm9vbVV1aWQgPSAkKCcjbV9yb29tX2lkJykudmFsKCk7XHJcbiAgICAgICAgY29uc3QgZmllbGQgPSAkKHRoaXMpLmRhdGEoJ2ZpZWxkJyk7XHJcbiAgICAgICAgY29uc3QgdmFsdWUgPSAkKHRoaXMpLnZhbCgpO1xyXG4gICAgICAgIGF3YWl0IGRiLnVwZGF0ZVJvb21EaW1lbnNpb24ocm9vbVV1aWQsIGZpZWxkLCB2YWx1ZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBhZGQgc3BlY2lhbCB0byByb29tXHJcbiAgICAkKCcjZm9ybS1hZGQtc3BlY2lhbCcpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYXdhaXQgdGFibGVzLmFkZFNwZWNpYWxUb1Jvb21DbGljaygpOyAgICAgICAgIFxyXG4gICAgICAgICQoJyNmb3JtLWFkZC1zcGVjaWFsJykudHJpZ2dlcihcInJlc2V0XCIpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjYWRkLXNwZWNpYWwnKS5oaWRlKCk7IFxyXG4gICAgfSk7ICAgICBcclxuXHJcbiAgICAvLyBvcGVuIGNvcHkgcm9vbSBtb2RhbFxyXG4gICAgJCgnI2NvcHlfcm9vbScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICBcclxuICAgICAgICBjb25zdCBmbG9vcnMgPSBhd2FpdCBkYi5nZXRGbG9vcnMocHJvamVjdF9pZCk7XHJcbiAgICAgICAgbGV0IGZsb29yT3B0aW9ucyA9IGZsb29ycy5tYXAoZmxvb3IgPT4gYDxvcHRpb24gdmFsdWU9XCIke2Zsb29yLnV1aWR9XCI+JHtmbG9vci5uYW1lfTwvb3B0aW9uPmApLmpvaW4oJycpO1xyXG4gICAgICAgICQoJyNjb3B5LXJvb20tbW9kYWwgc2VsZWN0I21vZGFsX2Zvcm1fZmxvb3InKS5odG1sKGZsb29yT3B0aW9ucyk7XHJcblxyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjY29weS1yb29tLW1vZGFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpOyAgICAgICBcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGNvcHkgcm9vbSBtb2RhbCBzdWJtaXR0ZWRcclxuICAgICQoJyNmb3JtLWNvcHktcm9vbScpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3Qgcm9vbVV1aWQgPSAkKCcjbV9yb29tX2lkJykudmFsKCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBuZXdSb29tTmFtZSA9ICQoJyNtb2RhbF9mb3JtX25ld19uYW1lJykudmFsKCk7XHJcbiAgICAgICAgY29uc3QgbmV3Rmxvb3JVdWlkID0gJCgnI21vZGFsX2Zvcm1fZmxvb3InKS5maW5kKFwiOnNlbGVjdGVkXCIpLnZhbCgpO1xyXG5cclxuICAgICAgICBjb25zdCBuZXdSb29tVXVpZCA9IGF3YWl0IGRiLmNvcHlSb29tKHJvb21VdWlkLCBuZXdSb29tTmFtZSwgbmV3Rmxvb3JVdWlkKTtcclxuICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkXHJcbiAgICAgICAgYXdhaXQgbG9hZFJvb21EYXRhKG5ld1Jvb21VdWlkKTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2NvcHktcm9vbS1tb2RhbCcpLmhpZGUoKTsgXHJcbiAgICB9KTsgICAgXHJcblxyXG4gICAgLy8gYWRkIG5vdGUgYnV0dG9uIGNsaWNrXHJcbiAgICAkKCcjYWRkLW5vdGUnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAkKCcjZWRpdF9ub3RlX3V1aWQnKS52YWwoJycpO1xyXG4gICAgICAgICQoJyNtb2RhbF9mb3JtX25vdGUnKS52YWwoJycpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjYWRkLW5vdGUtbW9kYWwnLCB7IHN0YWNrIDogdHJ1ZSB9KS5zaG93KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBhZGQgbm90ZSBtb2RhbCBzdWJtaXR0ZWRcclxuICAgICQoJyNmb3JtLWFkZC1ub3RlJykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zdCBlZGl0Tm90ZVV1aWQgPSAkKCcjZWRpdF9ub3RlX3V1aWQnKS52YWwoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHJvb21VdWlkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3Qgbm90ZSA9ICQoJyNtb2RhbF9mb3JtX25vdGUnKS52YWwoKTsgICAgICAgIFxyXG5cclxuICAgICAgICAvLyBlZGl0aW5nLCBqdXN0IGRlbGV0ZSB0aGUgb2xkIG9uZSBhbmQgcmVjcmVhdGUgKGRvZXMgbWVhbiB0aGUgY3JlYXRlZCBkYXRlIHdpbGwgYWxzbyBiZSB1cGRhdGVkKVxyXG4gICAgICAgIGlmIChlZGl0Tm90ZVV1aWQgIT0gXCJcIikge1xyXG4gICAgICAgICAgICBhd2FpdCBkYi5yZW1vdmVOb3RlQnlVVUlEKGVkaXROb3RlVXVpZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhd2FpdCBkYi5hZGROb3RlKHJvb21VdWlkLCBub3RlKTtcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbURhdGEocm9vbVV1aWQpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tTm90ZXMocm9vbVV1aWQpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjYWRkLW5vdGUtbW9kYWwnKS5oaWRlKCk7IFxyXG4gICAgfSk7ICAgIFxyXG5cclxufVxyXG4vKiBcclxuICAgIC8vIEVuZCB0YWJsZXNGdW5jdGlvbnMgXHJcbiovXHJcblxyXG5cclxuLypcclxuKiAgIEhvbWUgcGFnZSBmdW5jdGlvbnNcclxuKi9cclxuY29uc3QgaG9tZUZ1bmN0aW9ucyA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCdSdW5uaW5nIGhvbWUgZnVuY3Rpb25zIHYyJyk7XHJcblxyXG4gICAgbGV0IGRlZmVycmVkUHJvbXB0O1xyXG4gICAgY29uc3QgaW5zdGFsbEJ1dHRvbiA9ICQoJyNpbnN0YWxsQnV0dG9uJyk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZWluc3RhbGxwcm9tcHQnLCAoZSkgPT4ge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgICAgICAgIFxyXG4gICAgICAgIC8vIFN0YXNoIHRoZSBldmVudCBzbyBpdCBjYW4gYmUgdHJpZ2dlcmVkIGxhdGVyXHJcbiAgICAgICAgZGVmZXJyZWRQcm9tcHQgPSBlO1xyXG4gICAgICAgIC8vIFNob3cgdGhlIGluc3RhbGwgYnV0dG9uXHJcbiAgICAgICAgY29uc29sZS5sb2coJ2JlZm9yZWluc3RhbGxwcm9tcHQgZmlyZWQnKTtcclxuICAgICAgICBpbnN0YWxsQnV0dG9uLnNob3coKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGluc3RhbGxCdXR0b24ub24oJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGlmICghZGVmZXJyZWRQcm9tcHQpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBTaG93IHRoZSBpbnN0YWxsIHByb21wdFxyXG4gICAgICAgIGRlZmVycmVkUHJvbXB0LnByb21wdCgpO1xyXG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSB1c2VyIHRvIHJlc3BvbmQgdG8gdGhlIHByb21wdFxyXG4gICAgICAgIGNvbnN0IHsgb3V0Y29tZSB9ID0gYXdhaXQgZGVmZXJyZWRQcm9tcHQudXNlckNob2ljZTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgVXNlciByZXNwb25zZSB0byB0aGUgaW5zdGFsbCBwcm9tcHQ6ICR7b3V0Y29tZX1gKTtcclxuICAgICAgICAvLyBXZSd2ZSB1c2VkIHRoZSBwcm9tcHQsIGFuZCBjYW4ndCB1c2UgaXQgYWdhaW4sIGRpc2NhcmQgaXRcclxuICAgICAgICBkZWZlcnJlZFByb21wdCA9IG51bGw7XHJcbiAgICAgICAgLy8gSGlkZSB0aGUgaW5zdGFsbCBidXR0b25cclxuICAgICAgICBpbnN0YWxsQnV0dG9uLmhpZGUoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdhcHBpbnN0YWxsZWQnLCAoZXZ0KSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0FwcGxpY2F0aW9uIGluc3RhbGxlZCcpO1xyXG4gICAgICAgIGluc3RhbGxCdXR0b24uaGlkZSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy9VSWtpdC5vZmZjYW52YXMoJy50YWJsZXMtc2lkZScpLmhpZGUoKTtcclxuXHJcblxyXG4gICAgdmFyIGRhc2hUYWJsZSA9IHJlbmRlclByb2plY3RzVGFibGUoKTtcclxuICAgIC8vZGFzaFRhYmxlLnNldERhdGEoZGF0YSk7XHJcblxyXG4gICAgJCgnI2J0bi1jcmVhdGUtcHJvamVjdCcpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICQoJyNmb3JtLWNyZWF0ZS1wcm9qZWN0JykudHJpZ2dlcihcInJlc2V0XCIpOyAgICAgICAgXHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNjcmVhdGUtcHJvamVjdCcsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTtcclxuICAgICAgICAkKCcjZm9ybV9wcm9qZWN0X25hbWUnKS5mb2N1cygpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuICAgIC8qIEFkZCBwcm9qZWN0IHJlbGF0ZWQgYmluZHMgKi9cclxuICAgICQoJyNmb3JtX3Byb2plY3RfbmFtZScpLm9mZignZm9jdXMnKS5vbignZm9jdXMnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgJCgnI2Zvcm1fbG9jYXRpb24nKS5hdHRyKHsnZGlzYWJsZWQnOidkaXNhYmxlZCd9KTtcclxuICAgICAgICAkKCcjZm9ybV9idWlsZGluZycpLmF0dHIoeydkaXNhYmxlZCc6J2Rpc2FibGVkJ30pO1xyXG4gICAgfSk7XHJcbiAgICAkKCcjZm9ybV9wcm9qZWN0X25hbWUnKS5vZmYoJ2JsdXInKS5vbignYmx1cicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS52YWwoKSAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgICQoJyNmb3JtX2xvY2F0aW9uJykucmVtb3ZlQXR0cignZGlzYWJsZWQnKS5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgJCgnI2Zvcm1fbG9jYXRpb24nKS5vZmYoJ2JsdXInKS5vbignYmx1cicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS52YWwoKSAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgICQoJyNmb3JtX2J1aWxkaW5nJykucmVtb3ZlQXR0cignZGlzYWJsZWQnKS5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgJCgnI2Zvcm1fYnVpbGRpbmcnKS5vZmYoJ2JsdXInKS5vbignYmx1cicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS52YWwoKSAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgICQoJyNmb3JtX2Zsb29yJykucmVtb3ZlQXR0cignZGlzYWJsZWQnKS5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyAgIFxyXG4gICAgJCgnI2Zvcm1fZmxvb3InKS5vZmYoJ2JsdXInKS5vbignYmx1cicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS52YWwoKSAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgICQoJyNmb3JtX3Jvb20nKS5yZW1vdmVBdHRyKCdkaXNhYmxlZCcpLmZvY3VzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7ICAgICBcclxuICAgIFxyXG4gICAgJCgnI2Zvcm0tY3JlYXRlLXByb2plY3QnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNyZWF0ZVByb2plY3QoKTsgICAgICAgICAgICAgIFxyXG4gICAgfSk7ICAgICAgICBcclxuXHJcblxyXG59O1xyXG4vKiBcclxuICAgIC8vIEVORCBob21lRnVuY3Rpb25zIFxyXG4qL1xyXG5cclxuXHJcbi8qXHJcbiogICBTY2hlZHVsZSBmdW5jdGlvbnNcclxuKi9cclxuY29uc3Qgc2NoZWR1bGVGdW5jdGlvbnMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zb2xlLmxvZygnUnVubmluZyBzY2hlZHVsZSBmdW5jdGlvbnMgdjInKTtcclxuICAgIC8vVUlraXQub2ZmY2FudmFzKCcudGFibGVzLXNpZGUnKS5oaWRlKCk7XHJcblxyXG4gICAgbGV0IHByb2plY3RJZCA9ICQoJyNtX3Byb2plY3RfaWQnKS52YWwoKTtcclxuICAgIGlmIChwcm9qZWN0SWQgPT0gXCJcIikge1xyXG4gICAgICAgIC8vIGdldCBmcm9tIGxvY2FsIHN0b3JhZ2VcclxuICAgICAgICBjb25zdCBjdXJyZW50UHJvamVjdCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JykgfHwgJ3t9Jyk7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRQcm9qZWN0LnByb2plY3RfaWQpIHtcclxuICAgICAgICAgICAgcHJvamVjdElkID0gY3VycmVudFByb2plY3QucHJvamVjdF9pZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdObyBwcm9qZWN0IGlkIGZvdW5kJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcGRhdGEgPSBhd2FpdCBkYi5nZXRQcm9qZWN0QnlVVUlEKHByb2plY3RJZCk7XHJcblxyXG4gICAgJCgnI21fcHJvamVjdF9zbHVnJykudmFsKHBkYXRhLnNsdWcpO1xyXG4gICAgJCgnI21fcHJvamVjdF92ZXJzaW9uJykudmFsKHBkYXRhLnZlcnNpb24pO1xyXG5cclxuICAgICQoJyNpbmZvX3Byb2plY3RfbmFtZScpLmh0bWwocGRhdGEubmFtZSk7XHJcbiAgICAkKCcjaW5mb19wcm9qZWN0X2lkJykuaHRtbChwZGF0YS5wcm9qZWN0X2lkKTsgICAgXHJcbiAgICAkKCcjaW5mb19lbmdpbmVlcicpLmh0bWwocGRhdGEuZW5naW5lZXIpO1xyXG4gICAgJCgnI2luZm9fZGF0ZScpLmh0bWwobmV3IERhdGUocGRhdGEubGFzdF91cGRhdGVkKS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJykpO1xyXG5cclxuICAgIGNvbnN0IHNkYXRhID0gYXdhaXQgZGIuZ2V0UHJvZHVjdHNGb3JQcm9qZWN0KHByb2plY3RJZCk7XHJcblxyXG4gICAgbGV0IHRhYmxlZGF0YSA9IHNkYXRhLm1hcChwcm9kdWN0ID0+ICh7XHJcbiAgICAgICAgdXVpZDogcHJvZHVjdC51dWlkLFxyXG4gICAgICAgIHByb2R1Y3Rfc2x1ZzogcHJvZHVjdC5wcm9kdWN0X3NsdWcsXHJcbiAgICAgICAgcHJvZHVjdF9uYW1lOiBwcm9kdWN0LnByb2R1Y3RfbmFtZSwgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgcmVmOiBwcm9kdWN0LnJlZixcclxuICAgICAgICBxdHk6IHByb2R1Y3QucXR5LFxyXG4gICAgICAgIHNrdTogcHJvZHVjdC5za3UgICAgICAgIFxyXG4gICAgfSkpOyAgICAgICBcclxuXHJcbiAgICB2YXIgc1RhYmxlID0gbmV3IFRhYnVsYXRvcihcIiNzdGFibGVcIiwge1xyXG4gICAgICAgIGRhdGE6IHRhYmxlZGF0YSxcclxuICAgICAgICBsYXlvdXQ6IFwiZml0Q29sdW1uc1wiLFxyXG4gICAgICAgIGxvYWRlcjogZmFsc2UsXHJcbiAgICAgICAgZGF0YUxvYWRlckVycm9yOiBcIlRoZXJlIHdhcyBhbiBlcnJvciBsb2FkaW5nIHRoZSBkYXRhXCIsXHJcbiAgICAgICAgZG93bmxvYWRFbmNvZGVyOiBmdW5jdGlvbihmaWxlQ29udGVudHMsIG1pbWVUeXBlKXtcclxuICAgICAgICAgICAgZ2VuZXJhdGVEYXRhU2hlZXRzKGZpbGVDb250ZW50cyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb2x1bW5zOiBbe1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiaWRcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInV1aWRcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlByb2R1Y3RcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2R1Y3RfbmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgaG96QWxpZ246IFwibGVmdFwiLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUXR5XCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJxdHlcIiwgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJsZWZ0XCIsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlNLVVwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwic2t1XCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogXCI1MCVcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJSZWZcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInJlZlwiLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSwgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICAkKCcjZ2VuX2RhdGFzaGVldHMsI2dlbl9zY2hlZHVsZXNfY29uZmlybScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGlmICgkKCcjaW5jbHVkZV9zY2hlZHVsZScpLmlzKCc6Y2hlY2tlZCcpID09IGZhbHNlICYmXHJcbiAgICAgICAgICAgICQoJyNpbmNsdWRlX2RhdGFzaGVldHMnKS5pcygnOmNoZWNrZWQnKSA9PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgYWxlcnQoJ05vdGhpbmcgdG8gZ2VuZXJhdGUsIHBsZWFzZSBzZWxlY3QgYW4gb3B0aW9uJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4oZmFsc2UpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdHJpZ2dlciB0aGUgICBkb3dubG9hZCwgd2hpY2ggaXMgaW50ZXJjZXB0ZWQgYW5kIHRyaWdnZXJzXHJcbiAgICAgICAgLy8gZ2VuZXJhdGVEYXRhU2hlZXRzKClcclxuICAgICAgICBzVGFibGUuZG93bmxvYWQoXCJqc29uXCIsIFwiZGF0YS5qc29uXCIsIHt9LCBcInZpc2libGVcIik7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgJCgnI2Zvcm0tc3VibWl0LWZvbGlvLXByb2dyZXNzJykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGRhdGEuc2x1ZztcclxuICAgICAgICBpZiAocGRhdGEudmVyc2lvbiA+IDEpIHtcclxuICAgICAgICAgICAgZmlsZW5hbWUgPSBmaWxlbmFtZStcIi12XCIgKyBwZGF0YS52ZXJzaW9uO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGJ1c3RlciA9IHV0aWxzLm1ha2VpZCgxMCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJCgnI2ZvbGlvLXByb2dyZXNzJykpLmhpZGUoKTtcclxuICAgICAgICB3aW5kb3cub3BlbihcImh0dHBzOi8vc3RhZ2luZy50YW1saXRlLmNvLnVrL3BkZm1lcmdlL1wiK2ZpbGVuYW1lK1wiLnBkZj90PVwiK2J1c3RlciwgJ19ibGFuaycpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuXHJcbn1cclxuLypcclxuKiAvLyBFbmQgU2NoZWR1bGUgZnVuY3Rpb25zXHJcbiovXHJcblxyXG5cclxuLypcclxuKiBBY2NvdW50IFBhZ2UgZnVuY3Rpb25zXHJcbiovXHJcbmNvbnN0IGFjY291bnRGdW5jdGlvbnMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zb2xlLmxvZygnUnVubmluZyBhY2NvdW50IGZ1bmN0aW9ucyB2MicpO1xyXG4gICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGRiLmdldFVzZXIodXNlcl9pZCk7ICAgXHJcbiAgICBcclxuICAgIGlmICghdXNlcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2Vycm9yIGdldHRpbmcgdWVlciBkZXRhaWxzJyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgICQoJyNuYW1lJykudmFsKHVzZXIubmFtZSk7XHJcbiAgICAkKCcjZW1haWwnKS52YWwodXNlci5lbWFpbCk7XHJcbiAgICAkKCcjcGFzc3dvcmQnKS52YWwodXNlci5wYXNzd29yZCk7XHJcbiAgICAkKCcjY29kZScpLnZhbCh1c2VyLmNvZGUpO1xyXG5cclxuICAgICQoJyNidG5fcHVsbF91c2VyX2RhdGEnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBhd2FpdCBzeW5jLmdldFVzZXJEYXRhKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAkKCcjYnRuX2NsZWFyX2xvY2FsX3N0b3JhZ2UnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBhd2FpdCB1dGlscy5jbGVhclNlcnZpY2VXb3JrZXJDYWNoZSgpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuICAgICQoJyNidG5fbG9nb3V0Jykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYXdhaXQgdXRpbHMubG9nb3V0KCk7XHJcbiAgICB9KTsgICAgICBcclxuXHJcbiAgICAkKCcjZm9ybS11cGRhdGUtYWNjb3VudCcpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZygnVXBkYXRlIGFjY291bnQgY2xpY2tlZCcpO1xyXG4gICAgICAgIC8vIGJ1aWxkIHRoZSB1c2VyIG9iamVjdCBmcm9tIHN1Ym1pdHRlZCBmb3JtIGZpZWxkc1xyXG4gICAgICAgIGNvbnN0IGZvcm1kYXRhID0geyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBuYW1lOiAkKCcjbmFtZScpLnZhbCgpLFxyXG4gICAgICAgICAgICBlbWFpbDogJCgnI2VtYWlsJykudmFsKCksXHJcbiAgICAgICAgICAgIHBhc3N3b3JkOiAkKCcjcGFzc3dvcmQnKS52YWwoKSxcclxuICAgICAgICAgICAgY29kZTogJCgnI2NvZGUnKS52YWwoKVxyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgICAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcbiAgICAgICAgYXdhaXQgZGIudXBkYXRlVXNlcihmb3JtZGF0YSwgdXNlcl9pZCk7XHJcbiAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdBY2NvdW50IHVwZGF0ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICB9KTtcclxuXHJcbn1cclxuLypcclxuKiAvLyBFbmQgYWNjb3VudCBwYWdlIGZ1bmN0aW9uc1xyXG4qL1xyXG5cclxuXHJcblxyXG4vKlxyXG4qIEdlbmVyYXRlIERhdGEgU2hlZXRzIHJlbGF0ZWQgZnVuY3Rpb25zXHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlRGF0YVNoZWV0cyhkYXRhKSB7XHJcbiAgICBVSWtpdC5tb2RhbCgkKCcjZm9saW8tcHJvZ3Jlc3MnKSkuc2hvdygpO1xyXG4gICAgY29uc3Qgc2NoZWR1bGVfdHlwZSA9ICQoJ2lucHV0W25hbWU9c2NoZWR1bGVfdHlwZV06Y2hlY2tlZCcpLnZhbCgpO1xyXG4gICAgY29uc3QgcHJvamVjdF9pZCA9ICQoJ2lucHV0I21fcHJvamVjdF9pZCcpLnZhbCgpIHx8IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JykpLnByb2plY3RfaWQ7XHJcbiAgICBpZiAoc2NoZWR1bGVfdHlwZSA9PSBcImJ5X3Byb2plY3RcIikge1xyXG4gICAgICAgIGpzb25EYXRhID0gZGF0YTsgLy8gdGhlIHNjaGVkdWxlIHRhYmxlIGRhdGEgZm9yIGEgZnVsbCBwcm9qZWN0IHNjaGVkdWxlXHJcbiAgICAgICAgY2FsbEdlblNoZWV0cyhzY2hlZHVsZV90eXBlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdHJ5IHsgICAgICAgICAgICBcclxuICAgICAgICAgICAganNvbkRhdGEgPSBhd2FpdCBkYi5nZXRTY2hlZHVsZVBlclJvb20ocHJvamVjdF9pZCk7IC8vIFdhaXQgZm9yIHRoZSBkYXRhXHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ2pzb25EYXRhJywganNvbkRhdGEpO1xyXG4gICAgICAgICAgICBjYWxsR2VuU2hlZXRzKHNjaGVkdWxlX3R5cGUpOyAvLyBDYWxsIHdpdGggdGhlIHJlc29sdmVkIGRhdGFcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgZmV0Y2hpbmcgc2NoZWR1bGUgcGVyIHJvb206XCIsIGVycm9yKTtcclxuICAgICAgICAgICAgYWxlcnQoXCJGYWlsZWQgdG8gZmV0Y2ggc2NoZWR1bGUgZGF0YS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjYWxsR2VuU2hlZXRzKHNjaGVkdWxlX3R5cGUpIHtcclxuICAgICQoJy51ay1wcm9ncmVzcycpLnZhbCgxMCk7XHJcbiAgICAkKCcjZG93bmxvYWRfZGF0YXNoZWV0cycpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dChcIkdhdGhlcmluZyBEYXRhIC4uLlwiKTtcclxuXHJcbiAgICAkLmFqYXgoe1xyXG4gICAgICAgIHVybDogXCJodHRwczovL3N0YWdpbmcudGFtbGl0ZS5jby51ay9jaV9pbmRleC5waHAvZG93bmxvYWRfc2NoZWR1bGVcIixcclxuICAgICAgICB0eXBlOiBcIlBPU1RcIixcclxuICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgIHByb2plY3Rfc2x1ZzogJCgnI21fcHJvamVjdF9zbHVnJykudmFsKCksXHJcbiAgICAgICAgICAgIHByb2plY3RfdmVyc2lvbjogJCgnI21fcHJvamVjdF92ZXJzaW9uJykudmFsKCksXHJcbiAgICAgICAgICAgIGluZm9fcHJvamVjdF9uYW1lOiAkKCcjaW5mb19wcm9qZWN0X25hbWUnKS50ZXh0KCksXHJcbiAgICAgICAgICAgIGluZm9fcHJvamVjdF9pZDogJCgnI2luZm9fcHJvamVjdF9pZCcpLnRleHQoKSxcclxuICAgICAgICAgICAgaW5mb19lbmdpbmVlcjogJCgnI2luZm9fZW5naW5lZXInKS50ZXh0KCksXHJcbiAgICAgICAgICAgIGluZm9fZGF0ZTogJCgnI2luZm9fZGF0ZScpLnRleHQoKSxcclxuICAgICAgICAgICAgaW5jbHVkZV9zY2hlZHVsZTogJCgnI2luY2x1ZGVfc2NoZWR1bGUnKS5pcygnOmNoZWNrZWQnKSxcclxuICAgICAgICAgICAgaW5jbHVkZV9kYXRhc2hlZXRzOiAkKCcjaW5jbHVkZV9kYXRhc2hlZXRzJykuaXMoJzpjaGVja2VkJyksXHJcbiAgICAgICAgICAgIHNjaGVkdWxlX3R5cGU6IHNjaGVkdWxlX3R5cGUsXHJcbiAgICAgICAgICAgIHNrdXM6IGpzb25EYXRhLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgeGhyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyB3aW5kb3cuWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgICAgICAgICAgbGV0IGxhc3RQcm9jZXNzZWRJbmRleCA9IDA7XHJcbiAgICAgICAgICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VUZXh0ID0geGhyLnJlc3BvbnNlVGV4dC50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IHJlc3BvbnNlVGV4dC5zcGxpdCgnXFxuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IGxhc3RQcm9jZXNzZWRJbmRleDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldLnRyaW0oKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhsaW5lKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWxpbmUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZSA9IEpTT04ucGFyc2UobGluZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cGRhdGUuc3RlcCAmJiB1cGRhdGUudG90YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBlcmNlbnRhZ2UgPSAodXBkYXRlLnN0ZXAgLyAodXBkYXRlLnRvdGFsIC0gMSkpICogMTAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KHVwZGF0ZS5tZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJy51ay1wcm9ncmVzcycpLnZhbChwZXJjZW50YWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlLmNvbXBsZXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnUHJvY2Vzc2luZyBjb21wbGV0ZTonLCB1cGRhdGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnLnVrLXByb2dyZXNzJykudmFsKDEwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQodXBkYXRlLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI2Rvd25sb2FkX2RhdGFzaGVldHMnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJTa2lwcGluZyBpbnZhbGlkIEpTT04gbGluZTpcIiwgbGluZSwgZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGFzdFByb2Nlc3NlZEluZGV4ID0gbGluZXMubGVuZ3RoO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICByZXR1cm4geGhyO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3VjY2VzczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uICh4aHIsIHN0YXR1cywgZXJyb3IpIHtcclxuICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gXCJ0aW1lb3V0XCIpIHtcclxuICAgICAgICAgICAgICAgIGFsZXJ0KFwiVGhlIHJlcXVlc3QgdGltZWQgb3V0LiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLlwiKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIHRvZG86IHRoaXMgaXMgYWN0dWFsbHkgZmlyaW5nIGJ1dCBhbGwgd29ya3Mgb2ssIGRlYnVnXHJcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUuZXJyb3IoXCJBbiBlcnJvciBvY2N1cnJlZDpcIiwgc3RhdHVzLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHRpbWVvdXQ6IDMxMDAwMCwgLy8gMzEwIHNlY29uZHMgKDUgbWludXRlcyArIGJ1ZmZlcilcclxuICAgIH0pO1xyXG59XHJcbi8qXHJcbiogLy8gZW5kIEdlbmVyYXRlIERhdGEgU2hlZXRzXHJcbiovXHJcblxyXG5cclxuXHJcbi8qXHJcbiogR2V0IGFsbCBwcm9qZWN0cyAoZm9yIHRoaXMgdXNlcikgYW5kIHJlbmRlciB0aGUgdGFibGVcclxuKi9cclxuYXN5bmMgZnVuY3Rpb24gcmVuZGVyUHJvamVjdHNUYWJsZSgpIHtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0cyA9IGF3YWl0IGRiLmdldFByb2plY3RzKGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpKTtcclxuICAgIGxldCB0YWJsZWRhdGEgPSBwcm9qZWN0cy5tYXAocHJvamVjdCA9PiAoe1xyXG4gICAgICAgIHByb2plY3RfbmFtZTogcHJvamVjdC5uYW1lLFxyXG4gICAgICAgIHByb2plY3Rfc2x1ZzogcHJvamVjdC5zbHVnLFxyXG4gICAgICAgIHZlcnNpb246IHByb2plY3QudmVyc2lvbixcclxuICAgICAgICBwcm9qZWN0X2lkOiBwcm9qZWN0LnV1aWQsXHJcbiAgICAgICAgcHJvamVjdF9yZWY6IHByb2plY3QucHJvamVjdF9pZCxcclxuICAgICAgICBjcmVhdGVkOiBuZXcgRGF0ZShwcm9qZWN0LmNyZWF0ZWRfb24pLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InKSxcclxuICAgICAgICBwcm9kdWN0czogcHJvamVjdC5wcm9kdWN0c19jb3VudFxyXG4gICAgfSkpOyAgICAgXHJcblxyXG4gICAgdmFyIGRhc2hUYWJsZSA9IG5ldyBUYWJ1bGF0b3IoXCIjZGFzaGJvYXJkX3Byb2plY3RzXCIsIHtcclxuICAgICAgICBkYXRhOiB0YWJsZWRhdGEsICAgICAgICAgICAgXHJcbiAgICAgICAgbG9hZGVyOiBmYWxzZSxcclxuICAgICAgICBsYXlvdXQ6IFwiZml0Q29sdW1uc1wiLFxyXG4gICAgICAgIGRhdGFMb2FkZXJFcnJvcjogXCJUaGVyZSB3YXMgYW4gZXJyb3IgbG9hZGluZyB0aGUgZGF0YVwiLFxyXG4gICAgICAgIGluaXRpYWxTb3J0OltcclxuICAgICAgICAgICAge2NvbHVtbjpcInByb2plY3RfbmFtZVwiLCBkaXI6XCJhc2NcIn0sIFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29sdW1uczogW3tcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcInByb2plY3RfaWRcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3RfaWRcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcInByb2plY3Rfc2x1Z1wiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwicHJvamVjdF9zbHVnXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJQcm9qZWN0IE5hbWVcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3RfbmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgZm9ybWF0dGVyOiBcImxpbmtcIixcclxuICAgICAgICAgICAgICAgIHNvcnRlcjpcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGhlYWRlclNvcnRTdGFydGluZ0RpcjpcImRlc2NcIixcclxuICAgICAgICAgICAgICAgIGZvcm1hdHRlclBhcmFtczp7XHJcbiAgICAgICAgICAgICAgICAgICAgbGFiZWxGaWVsZDogXCJwcm9qZWN0X25hbWVcIixcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IFwiX3NlbGZcIixcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IFwiI1wiLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjQwJVwiLFxyXG4gICAgICAgICAgICAgICAgY2VsbENsaWNrOiBmdW5jdGlvbihlLCBjZWxsKSB7ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0RGF0YSA9IGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpOyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JywgSlNPTi5zdHJpbmdpZnkocHJvamVjdERhdGEpKTtcclxuICAgICAgICAgICAgICAgICAgICAkKCcjbV9wcm9qZWN0X2lkJykudmFsKHByb2plY3REYXRhLnByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5yb3V0ZXIoJ3RhYmxlcycsIHByb2plY3REYXRhLnByb2plY3RfaWQpOyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlByb2plY3QgSURcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3RfcmVmXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogXCIyMCVcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUHJvZHVjdHNcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2R1Y3RzXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogMTIwLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUmV2XCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJ2ZXJzaW9uXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogODAsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJDcmVhdGVkXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJjcmVhdGVkXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogXCIyMCVcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaGVhZGVyU29ydDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZXI6IHV0aWxzLmljb25Db3B5LFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMTAlXCIsXHJcbiAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJjZW50ZXJcIixcclxuICAgICAgICAgICAgICAgIGNlbGxDbGljazogZnVuY3Rpb24gKGUsIGNlbGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb3B5UHJvamVjdChjZWxsLmdldFJvdygpLmdldERhdGEoKS5wcm9qZWN0X2lkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaGVhZGVyU29ydDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZXI6IHV0aWxzLmljb25YLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMTAlXCIsXHJcbiAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJjZW50ZXJcIixcclxuICAgICAgICAgICAgICAgIGNlbGxDbGljazogZnVuY3Rpb24gKGUsIGNlbGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGVQcm9qZWN0KGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICB9KTsgICAgXHJcbn1cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuLy8gXHJcbi8vIHJlbmRlclNpZGViYXJcclxuLy8gXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbmRlclNpZGViYXIocHJvamVjdF9pZCkge1xyXG4gICAgcHJvamVjdF9pZC50b1N0cmluZygpO1xyXG4gICAgY29uc29sZS5sb2coJ1JlbmRlcmluZyBzaWRlYmFyIGZvciBwcm9qZWN0OicsIHByb2plY3RfaWQpO1xyXG5cclxuICAgIGNvbnN0IHByb2plY3RTdHJ1Y3R1cmUgPSBhd2FpdCBkYi5nZXRQcm9qZWN0U3RydWN0dXJlKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICAgICBcclxuICAgIGNvbnN0IHNpZGVtZW51SHRtbCA9IGF3YWl0IHNpZGViYXIuZ2VuZXJhdGVOYXZNZW51KHByb2plY3RTdHJ1Y3R1cmUpOyAgIFxyXG5cclxuICAgICQoJy5sb2NhdGlvbnMnKS5odG1sKHNpZGVtZW51SHRtbCk7XHJcblxyXG4gICAgLyogUHJvamVjdCBDbGljayAtIGxvYWQgcHJvamVjdCBkYXRhICovXHJcbiAgICAkKCdhLmVkaXQtcHJvamVjdC1saW5rJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYXdhaXQgbG9hZFByb2plY3REYXRhKHByb2plY3RfaWQpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuXHJcblxyXG4gICAgLyogUm9vbSBDbGljayAtIGxvYWQgcm9vbSBkYXRhICovXHJcbiAgICAkKCdhLnJvb20tbGluaycpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tRGF0YSgkKHRoaXMpLmRhdGEoJ2lkJykpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tTm90ZXMoJCh0aGlzKS5kYXRhKCdpZCcpKTtcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbUltYWdlcygkKHRoaXMpLmRhdGEoJ2lkJykpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuICAgIC8qIEFkZCBSb29tIENsaWNrIC0gYWRkIGEgbmV3IHJvb20gKi9cclxuICAgICQoJ3NwYW4uYWRkLXJvb20gYScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IGZsb29yVXVpZCA9ICQodGhpcykuZGF0YSgnaWQnKTsgICBcclxuICAgICAgICBjb25zdCByb29tTmFtZSA9IGF3YWl0IFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0PkVudGVyIHRoZSByb29tIG5hbWU8L2g0PicpO1xyXG4gICAgICAgIGlmIChyb29tTmFtZSkge1xyXG4gICAgICAgICAgICBjb25zdCByb29tVXVpZCA9IGF3YWl0IGRiLmFkZFJvb20oZmxvb3JVdWlkLCByb29tTmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChyb29tVXVpZCkge1xyXG4gICAgICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdSb29tIGFkZGVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdBIHJvb20gb2YgdGhlIHNhbWUgbmFtZSBhbHJlYWR5IGV4aXN0cy4nLCBzdGF0dXM6ICdkYW5nZXInLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjUwMCB9KTsgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLyogQWRkIEZMb29yIENsaWNrIC0gYWRkIGEgbmV3IGZsb29yICovXHJcbiAgICAkKCdzcGFuLmFkZC1mbG9vciBhJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdVdWlkID0gJCh0aGlzKS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgIGNvbnN0IGZsb29yTmFtZSA9IGF3YWl0IFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0PkVudGVyIHRoZSBmbG9vciBuYW1lPC9oND4nKTtcclxuICAgICAgICBpZiAoZmxvb3JOYW1lKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZsb29yVXVpZCA9IGF3YWl0IGRiLmFkZEZsb29yKGJ1aWxkaW5nVXVpZCwgZmxvb3JOYW1lKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdGbG9vciBhZGRlZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgICAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgXHJcbiAgICAgICAgfSAgIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLyogQWRkIGJ1aWxkaW5nIENsaWNrIC0gYWRkIGEgbmV3IGJ1aWxkaW5nICovXHJcbiAgICAkKCdzcGFuLmFkZC1idWlsZGluZyBhJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICBcclxuICAgICAgICBjb25zdCBsb2NhdGlvblV1aWQgPSAkKHRoaXMpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdOYW1lID0gYXdhaXQgVUlraXQubW9kYWwucHJvbXB0KCc8aDQ+RW50ZXIgdGhlIGJ1aWxkaW5nIG5hbWU8L2g0PicpO1xyXG4gICAgICAgIGlmIChidWlsZGluZ05hbWUpIHtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRpbmdVdWlkID0gYXdhaXQgZGIuYWRkQnVpbGRpbmcobG9jYXRpb25VdWlkLCBidWlsZGluZ05hbWUpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignYnVpbGRpbmcgYWRkZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgICAgIH0gICBcclxuICAgIH0pOyAgICAgXHJcbiAgICBcclxuICAgICQoJ2xpLnJvb20taXRlbSBzcGFuLmFjdGlvbi1pY29uLnJvb20nKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgICAgICAgICAgICBcclxuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcclxuICAgICAgICBjb25zdCBtc2cgPSAnPGg0IGNsYXNzPVwicmVkXCI+V2FybmluZzwvaDQ+PHA+VGhpcyB3aWxsIHJlbW92ZSB0aGUgcm9vbSBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aGUgcm9vbSE8L3AnO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbVV1aWQgPSAkKHRoYXQpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZW1vdmluZyByb29tOicsIHJvb21VdWlkKTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbU5hbWUgPSBhd2FpdCBkYi5yZW1vdmVSb29tKHJvb21VdWlkKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmVtb3ZlZCByb29tOicsIHJvb21OYW1lKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdSb29tIHJlbW92ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IC8vIHByb2plY3RfaWQgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NhbmNlbGxlZC4nKVxyXG4gICAgICAgIH0pOyAgICAgICAgXHJcbiAgICB9KTsgICBcclxuICAgIFxyXG4gICAgJCgnbGkuZmxvb3ItaXRlbSBzcGFuLmFjdGlvbi1pY29uLmZsb29yJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgY29uc3QgbXNnID0gJzxoNCBjbGFzcz1cInJlZFwiPldhcm5pbmc8L2g0PjxwPlRoaXMgd2lsbCByZW1vdmUgdGhlIGZsb29yLCByb29tcyBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aG9zZSByb29tcyE8L3AnO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgY29uc3QgZmxvb3JVdWlkID0gJCh0aGF0KS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgICAgICBjb25zdCBmbG9vck5hbWUgPSBhd2FpdCBkYi5yZW1vdmVGbG9vcihmbG9vclV1aWQpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignRmxvb3IgYW5kIHJvb21zIHJlbW92ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IC8vIHByb2plY3RfaWQgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NhbmNlbGxlZC4nKVxyXG4gICAgICAgIH0pOyAgICAgICAgXHJcbiAgICB9KTsgICAgICAgICAgXHJcblxyXG4gICAgJCgnbGkuYnVpbGRpbmctaXRlbSBzcGFuLmFjdGlvbi1pY29uLmJ1aWxkaW5nJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgY29uc3QgbXNnID0gJzxoNCBjbGFzcz1cInJlZFwiPldhcm5pbmc8L2g0PjxwPlRoaXMgd2lsbCByZW1vdmUgdGhlIGJ1aWxkaW5nLCBhbGwgZmxvb3IsIHJvb21zIGFuZCA8Yj5BTEwgcHJvZHVjdHM8L2I+IGluIHRob3NlIHJvb21zITwvcCc7XHJcbiAgICAgICAgVUlraXQubW9kYWwuY29uZmlybShtc2cpLnRoZW4oIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZGluZ1V1aWQgPSAkKHRoYXQpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkaW5nTmFtZSA9IGF3YWl0IGRiLnJlbW92ZUJ1aWxkaW5nKGJ1aWxkaW5nVXVpZCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdidWlsZGluZywgZmxvb3JzIGFuZCByb29tcyByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW5jZWxsZWQuJylcclxuICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgfSk7ICBcclxuICAgICAgXHJcblxyXG4gICAgLy8gdXBkYXRlIHByb2plY3QgZGV0YWlsc1xyXG4gICAgJCgnI2Zvcm0tdXBkYXRlLXByb2plY3QnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9pZCA9ICQoJyNtX3Byb2plY3RfaWQnKS52YWwoKTtcclxuICAgICAgICBhd2FpdCB0YWJsZXMudXBkYXRlUHJvamVjdENsaWNrKHByb2plY3RfaWQpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNlZGl0LXByb2plY3QtbW9kYWwnKS5oaWRlKCk7IFxyXG4gICAgfSk7ICAgICBcclxuXHJcbn1cclxuLy8gXHJcbi8vIEVuZCByZW5kZXJTaWRlYmFyXHJcbi8vIFxyXG5cclxuXHJcbi8qIFxyXG4qIENyZWF0ZSBQcm9qZWN0XHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVByb2plY3QoKSB7XHJcbiAgICBjb25zdCBwcm9qZWN0X25hbWUgPSAkKCcjZm9ybV9wcm9qZWN0X25hbWUnKS52YWwoKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uID0gJCgnI2Zvcm1fbG9jYXRpb24nKS52YWwoKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nID0gJCgnI2Zvcm1fYnVpbGRpbmcnKS52YWwoKTtcclxuICAgIGNvbnN0IGZsb29yID0gJCgnI2Zvcm1fZmxvb3InKS52YWwoKTtcclxuICAgIGNvbnN0IHJvb20gPSAkKCcjZm9ybV9yb29tJykudmFsKCk7XHJcbiAgICBjb25zdCBwcm9qZWN0X2lkID0gYXdhaXQgZGIuY3JlYXRlUHJvamVjdChwcm9qZWN0X25hbWUsIGxvY2F0aW9uLCBidWlsZGluZywgZmxvb3IsIHJvb20pOyAgICBcclxuICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgYXdhaXQgcmVuZGVyUHJvamVjdHNUYWJsZSgpO1xyXG4gICAgVUlraXQubW9kYWwoJyNjcmVhdGUtcHJvamVjdCcpLmhpZGUoKTtcclxufVxyXG5cclxuLyogXHJcbiogQ29weSBQcm9qZWN0XHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIGNvcHlQcm9qZWN0KHByb2plY3RfaWQpIHtcclxuICAgIGNvbnN0IHByb2plY3REYXRhID0gYXdhaXQgZGIuZ2V0UHJvamVjdEJ5VVVJRChwcm9qZWN0X2lkKTtcclxuICAgIGNvbnN0IHByb2plY3ROYW1lID0gYXdhaXQgVUlraXQubW9kYWwucHJvbXB0KCc8aDQ+RW50ZXIgdGhlIG5ldyBwcm9qZWN0IG5hbWU8L2g0PicsIHByb2plY3REYXRhLm5hbWUgKyAnIC0gQ29weScpO1xyXG4gICAgaWYgKHByb2plY3ROYW1lKSB7XHJcbiAgICAgICAgY29uc3QgbmV3UHJvamVjdElkID0gYXdhaXQgZGIuY29weVByb2plY3QocHJvamVjdF9pZCwgcHJvamVjdE5hbWUpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclByb2plY3RzVGFibGUoKTtcclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ1Byb2plY3QgY29waWVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBkZWxldGVQcm9qZWN0KHByb2plY3RfaWQpIHtcclxuICAgIGNvbnN0IG1zZyA9ICc8aDQgY2xhc3M9XCJyZWRcIj5XYXJuaW5nPC9oND48cD5UaGlzIHdpbGwgcmVtb3ZlIHRoZSBwcm9qZWN0LCBhbGwgZmxvb3JzLCByb29tcyBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aG9zZSByb29tcyE8L3A+JztcclxuICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICBhd2FpdCBkYi5yZW1vdmVQcm9qZWN0KHByb2plY3RfaWQpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclByb2plY3RzVGFibGUoKTtcclxuICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpO1xyXG4gICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignUHJvamVjdCByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgfSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDYW5jZWxsZWQuJylcclxuICAgIH0pOyAgICAgICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRQcm9qZWN0RGF0YShwcm9qZWN0SWQpIHsgICAgXHJcbiAgICAkKCcjbV9wcm9qZWN0X2lkJykudmFsKHByb2plY3RJZCk7XHJcbiAgICBpZiAoIXByb2plY3RJZCkgcmV0dXJuO1xyXG4gICAgcHJvamVjdElkID0gcHJvamVjdElkLnRvU3RyaW5nKCk7XHJcbiAgICBjb25zdCBwcm9qZWN0RGF0YSA9IGF3YWl0IGRiLmdldFByb2plY3RCeVVVSUQocHJvamVjdElkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50UHJvamVjdCcsIEpTT04uc3RyaW5naWZ5KHByb2plY3REYXRhKSk7XHJcblxyXG4gICAgJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X25hbWUnKS52YWwocHJvamVjdERhdGEubmFtZSk7XHJcbiAgICAkKCcjZm9ybV9lZGl0X3Byb2plY3RfaWQnKS52YWwocHJvamVjdERhdGEucHJvamVjdF9pZCk7XHJcbiAgICAkKCcjZm9ybV9lZGl0X3Byb2plY3RfZW5naW5lZXInKS52YWwocHJvamVjdERhdGEuZW5naW5lZXIpOyAgICBcclxuICAgICQoJyNmb3JtX2VkaXRfcHJvamVjdF92ZXJzaW9uJykudmFsKHByb2plY3REYXRhLnZlcnNpb24pO1xyXG5cclxuICAgIFVJa2l0Lm1vZGFsKCcjZWRpdC1wcm9qZWN0LW1vZGFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpO1xyXG59ICAgIFxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRSb29tRGF0YShyb29tSWQpIHtcclxuICAgICQoJyNtX3Jvb21faWQnKS52YWwocm9vbUlkKTsgICBcclxuICAgIGlmICghcm9vbUlkKSByZXR1cm47ICAgICBcclxuICAgIHJvb21JZCA9IHJvb21JZC50b1N0cmluZygpO1xyXG4gICAgcm9vbUlkID0gXCJcIiArIHJvb21JZDtcclxuICAgIC8vIGdldCB0aGUgbmFtZXMgZm9yIHRoZSBsb2NhdGlvbiwgYnVpbGRpbmcsIGZsb29yIGFuZCByb29tIGJhc2VkIG9uIHRoaXMgcm9vbUlkLlxyXG4gICAgY29uc3Qgcm9vbU1ldGEgPSBhd2FpdCBkYi5nZXRSb29tTWV0YShyb29tSWQpOyAgICAgICAgXHJcbiAgICAkKCcubmFtZS5sb2NhdGlvbl9uYW1lJykuaHRtbChyb29tTWV0YS5sb2NhdGlvbi5uYW1lKS5hdHRyKCdkYXRhLWlkJywgcm9vbU1ldGEubG9jYXRpb24udXVpZCk7XHJcbiAgICAkKCcubmFtZS5idWlsZGluZ19uYW1lJykuaHRtbChyb29tTWV0YS5idWlsZGluZy5uYW1lKS5hdHRyKCdkYXRhLWlkJywgcm9vbU1ldGEuYnVpbGRpbmcudXVpZCk7XHJcbiAgICAkKCcubmFtZS5mbG9vcl9uYW1lJykuaHRtbChyb29tTWV0YS5mbG9vci5uYW1lKS5hdHRyKCdkYXRhLWlkJywgcm9vbU1ldGEuZmxvb3IudXVpZCk7XHJcbiAgICAkKCcubmFtZS5yb29tX25hbWUnKS5odG1sKHJvb21NZXRhLnJvb20ubmFtZSkuYXR0cignZGF0YS1pZCcsIHJvb21NZXRhLnJvb20udXVpZCk7XHJcblxyXG4gICAgJCgnI3Jvb21faGVpZ2h0JykudmFsKHJvb21NZXRhLnJvb20uaGVpZ2h0KTtcclxuICAgICQoJyNyb29tX3dpZHRoJykudmFsKHJvb21NZXRhLnJvb20ud2lkdGgpO1xyXG4gICAgJCgnI3Jvb21fbGVuZ3RoJykudmFsKHJvb21NZXRhLnJvb20ubGVuZ3RoKTtcclxuXHJcbiAgICBhd2FpdCB0YWJsZXMucmVmcmVzaFRhYmxlRGF0YShyb29tSWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2FkUm9vbU5vdGVzKHJvb21JZCkge1xyXG4gICAgJCgnI21fcm9vbV9pZCcpLnZhbChyb29tSWQpOyAgIFxyXG4gICAgaWYgKCFyb29tSWQpIHJldHVybjsgICAgICAgICBcclxuICAgIHJvb21JZCA9IFwiXCIgKyByb29tSWQ7XHJcbiAgICBcclxuICAgIGNvbnN0IHJvb21Ob3RlcyA9IGF3YWl0IGRiLmdldFJvb21Ob3Rlcyhyb29tSWQpOyAgXHJcbiAgICAvLyBpdGVyYXRlIHRoZSBub3RlcyBhbmQgYnVpbGQgaHRtbCB0byBkaXNwbGF5IHRoZW0gYXMgYSBsaXN0LiBhbHNvIGFkZCBhIGRlbGV0ZSBpY29uIHRvIGVhY2ggbm90ZSBhbmQgc2hvdCB0aGUgZGF0ZSBjcmVhdGVkIGluIGRkLW1tLXl5eSBmb3JtYXRcclxuICAgIGxldCBub3Rlc0h0bWwgPSByb29tTm90ZXMubWFwKG5vdGUgPT4gXHJcbiAgICAgICAgYDxsaSBjbGFzcz1cIm5vdGVcIj5cclxuICAgICAgICA8cCBjbGFzcz1cIm5vdGUtZGF0ZVwiPiR7bmV3IERhdGUobm90ZS5jcmVhdGVkX29uKS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJyl9PC9wPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJub3RlLWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgPHNwYW4gZGF0YS11dWlkPVwiJHtub3RlLnV1aWR9XCIgY2xhc3M9XCJpY29uIGVkaXRfbm90ZVwiIHVrLWljb249XCJpY29uOiBmaWxlLWVkaXQ7IHJhdGlvOiAxXCIgdGl0bGU9XCJFZGl0XCI+PC9zcGFuPiAgICBcclxuICAgICAgICAgICAgPHNwYW4gZGF0YS11dWlkPVwiJHtub3RlLnV1aWR9XCIgY2xhc3M9XCJpY29uIHJlZCBkZWxldGVfbm90ZVwiIHVrLWljb249XCJpY29uOiB0cmFzaDsgcmF0aW86IDFcIiB0aXRsZT1cIkRlbGV0ZVwiPjwvc3Bhbj4gICAgICAgICAgICBcclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPHAgY2xhc3M9XCJub3RlLXRleHQgJHtub3RlLnV1aWR9XCI+JHtub3RlLm5vdGV9PC9wPlxyXG4gICAgICAgIDwvbGk+YCkuam9pbignJyk7XHJcbiAgICAkKCcjcm9vbV9ub3RlcycpLmh0bWwobm90ZXNIdG1sKTtcclxuXHJcblxyXG4gICAgJCgnLm5vdGUtYWN0aW9ucyAuZWRpdF9ub3RlJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3Qgbm90ZVV1aWQgPSAkKHRoaXMpLmRhdGEoJ3V1aWQnKTtcclxuICAgICAgICBjb25zdCBub3RlVGV4dCA9ICQoYC5ub3RlLXRleHQuJHtub3RlVXVpZH1gKS50ZXh0KCk7XHJcbiAgICAgICAgJCgnI2VkaXRfbm90ZV91dWlkJykudmFsKG5vdGVVdWlkKTtcclxuICAgICAgICAkKCcjbW9kYWxfZm9ybV9ub3RlJykudmFsKG5vdGVUZXh0KTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2FkZC1ub3RlLW1vZGFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpOyAgICAgICBcclxuICAgIH0pOyAgICAgIFxyXG5cclxuXHJcbiAgICAkKCcubm90ZS1hY3Rpb25zIC5kZWxldGVfbm90ZScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IG5vdGVVdWlkID0gJCh0aGlzKS5kYXRhKCd1dWlkJyk7XHJcbiAgICAgICAgVUlraXQubW9kYWwuY29uZmlybSgnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSB0aGlzIG5vdGU/JykudGhlbihhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgYXdhaXQgZGIucmVtb3ZlTm90ZUJ5VVVJRChub3RlVXVpZCk7XHJcbiAgICAgICAgICAgIGF3YWl0IGxvYWRSb29tTm90ZXMoJCgnI21fcm9vbV9pZCcpLnZhbCgpKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdOb3RlIERlbGV0ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRGVsZXRlIG5vdGUgY2FuY2VsbGVkLicpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7ICAgIFxyXG4gICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRSb29tSW1hZ2VzKHJvb21JZCkge1xyXG4gICAgJCgnI21fcm9vbV9pZCcpLnZhbChyb29tSWQpOyAgIFxyXG4gICAgaWYgKCFyb29tSWQpIHJldHVybjsgICAgICAgICBcclxuICAgIHJvb21JZCA9IFwiXCIgKyByb29tSWQ7XHJcblxyXG4gICAgYXdhaXQgdGFibGVzLmdldFJvb21JbWFnZXMoKTtcclxuICAgXHJcbn1cclxuXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBnbG9iYWxCaW5kcyxcclxuICAgIGhvbWVGdW5jdGlvbnMsXHJcbiAgICB0YWJsZXNGdW5jdGlvbnMsXHJcbiAgICBzY2hlZHVsZUZ1bmN0aW9ucyxcclxuICAgIGFjY291bnRGdW5jdGlvbnMgXHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgaW5zdGFuY2VPZkFueSA9IChvYmplY3QsIGNvbnN0cnVjdG9ycykgPT4gY29uc3RydWN0b3JzLnNvbWUoKGMpID0+IG9iamVjdCBpbnN0YW5jZW9mIGMpO1xuXG5sZXQgaWRiUHJveHlhYmxlVHlwZXM7XG5sZXQgY3Vyc29yQWR2YW5jZU1ldGhvZHM7XG4vLyBUaGlzIGlzIGEgZnVuY3Rpb24gdG8gcHJldmVudCBpdCB0aHJvd2luZyB1cCBpbiBub2RlIGVudmlyb25tZW50cy5cbmZ1bmN0aW9uIGdldElkYlByb3h5YWJsZVR5cGVzKCkge1xuICAgIHJldHVybiAoaWRiUHJveHlhYmxlVHlwZXMgfHxcbiAgICAgICAgKGlkYlByb3h5YWJsZVR5cGVzID0gW1xuICAgICAgICAgICAgSURCRGF0YWJhc2UsXG4gICAgICAgICAgICBJREJPYmplY3RTdG9yZSxcbiAgICAgICAgICAgIElEQkluZGV4LFxuICAgICAgICAgICAgSURCQ3Vyc29yLFxuICAgICAgICAgICAgSURCVHJhbnNhY3Rpb24sXG4gICAgICAgIF0pKTtcbn1cbi8vIFRoaXMgaXMgYSBmdW5jdGlvbiB0byBwcmV2ZW50IGl0IHRocm93aW5nIHVwIGluIG5vZGUgZW52aXJvbm1lbnRzLlxuZnVuY3Rpb24gZ2V0Q3Vyc29yQWR2YW5jZU1ldGhvZHMoKSB7XG4gICAgcmV0dXJuIChjdXJzb3JBZHZhbmNlTWV0aG9kcyB8fFxuICAgICAgICAoY3Vyc29yQWR2YW5jZU1ldGhvZHMgPSBbXG4gICAgICAgICAgICBJREJDdXJzb3IucHJvdG90eXBlLmFkdmFuY2UsXG4gICAgICAgICAgICBJREJDdXJzb3IucHJvdG90eXBlLmNvbnRpbnVlLFxuICAgICAgICAgICAgSURCQ3Vyc29yLnByb3RvdHlwZS5jb250aW51ZVByaW1hcnlLZXksXG4gICAgICAgIF0pKTtcbn1cbmNvbnN0IHRyYW5zYWN0aW9uRG9uZU1hcCA9IG5ldyBXZWFrTWFwKCk7XG5jb25zdCB0cmFuc2Zvcm1DYWNoZSA9IG5ldyBXZWFrTWFwKCk7XG5jb25zdCByZXZlcnNlVHJhbnNmb3JtQ2FjaGUgPSBuZXcgV2Vha01hcCgpO1xuZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdW5saXN0ZW4gPSAoKSA9PiB7XG4gICAgICAgICAgICByZXF1ZXN0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3N1Y2Nlc3MnLCBzdWNjZXNzKTtcbiAgICAgICAgICAgIHJlcXVlc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKHdyYXAocmVxdWVzdC5yZXN1bHQpKTtcbiAgICAgICAgICAgIHVubGlzdGVuKCk7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgICAgICAgICAgdW5saXN0ZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdzdWNjZXNzJywgc3VjY2Vzcyk7XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvcik7XG4gICAgfSk7XG4gICAgLy8gVGhpcyBtYXBwaW5nIGV4aXN0cyBpbiByZXZlcnNlVHJhbnNmb3JtQ2FjaGUgYnV0IGRvZXNuJ3QgZXhpc3QgaW4gdHJhbnNmb3JtQ2FjaGUuIFRoaXNcbiAgICAvLyBpcyBiZWNhdXNlIHdlIGNyZWF0ZSBtYW55IHByb21pc2VzIGZyb20gYSBzaW5nbGUgSURCUmVxdWVzdC5cbiAgICByZXZlcnNlVHJhbnNmb3JtQ2FjaGUuc2V0KHByb21pc2UsIHJlcXVlc3QpO1xuICAgIHJldHVybiBwcm9taXNlO1xufVxuZnVuY3Rpb24gY2FjaGVEb25lUHJvbWlzZUZvclRyYW5zYWN0aW9uKHR4KSB7XG4gICAgLy8gRWFybHkgYmFpbCBpZiB3ZSd2ZSBhbHJlYWR5IGNyZWF0ZWQgYSBkb25lIHByb21pc2UgZm9yIHRoaXMgdHJhbnNhY3Rpb24uXG4gICAgaWYgKHRyYW5zYWN0aW9uRG9uZU1hcC5oYXModHgpKVxuICAgICAgICByZXR1cm47XG4gICAgY29uc3QgZG9uZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdW5saXN0ZW4gPSAoKSA9PiB7XG4gICAgICAgICAgICB0eC5yZW1vdmVFdmVudExpc3RlbmVyKCdjb21wbGV0ZScsIGNvbXBsZXRlKTtcbiAgICAgICAgICAgIHR4LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgdHgucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBlcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGNvbXBsZXRlID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgdW5saXN0ZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICByZWplY3QodHguZXJyb3IgfHwgbmV3IERPTUV4Y2VwdGlvbignQWJvcnRFcnJvcicsICdBYm9ydEVycm9yJykpO1xuICAgICAgICAgICAgdW5saXN0ZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgdHguYWRkRXZlbnRMaXN0ZW5lcignY29tcGxldGUnLCBjb21wbGV0ZSk7XG4gICAgICAgIHR4LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICB0eC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGVycm9yKTtcbiAgICB9KTtcbiAgICAvLyBDYWNoZSBpdCBmb3IgbGF0ZXIgcmV0cmlldmFsLlxuICAgIHRyYW5zYWN0aW9uRG9uZU1hcC5zZXQodHgsIGRvbmUpO1xufVxubGV0IGlkYlByb3h5VHJhcHMgPSB7XG4gICAgZ2V0KHRhcmdldCwgcHJvcCwgcmVjZWl2ZXIpIHtcbiAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIElEQlRyYW5zYWN0aW9uKSB7XG4gICAgICAgICAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciB0cmFuc2FjdGlvbi5kb25lLlxuICAgICAgICAgICAgaWYgKHByb3AgPT09ICdkb25lJylcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnNhY3Rpb25Eb25lTWFwLmdldCh0YXJnZXQpO1xuICAgICAgICAgICAgLy8gTWFrZSB0eC5zdG9yZSByZXR1cm4gdGhlIG9ubHkgc3RvcmUgaW4gdGhlIHRyYW5zYWN0aW9uLCBvciB1bmRlZmluZWQgaWYgdGhlcmUgYXJlIG1hbnkuXG4gICAgICAgICAgICBpZiAocHJvcCA9PT0gJ3N0b3JlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWNlaXZlci5vYmplY3RTdG9yZU5hbWVzWzFdXG4gICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIDogcmVjZWl2ZXIub2JqZWN0U3RvcmUocmVjZWl2ZXIub2JqZWN0U3RvcmVOYW1lc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gRWxzZSB0cmFuc2Zvcm0gd2hhdGV2ZXIgd2UgZ2V0IGJhY2suXG4gICAgICAgIHJldHVybiB3cmFwKHRhcmdldFtwcm9wXSk7XG4gICAgfSxcbiAgICBzZXQodGFyZ2V0LCBwcm9wLCB2YWx1ZSkge1xuICAgICAgICB0YXJnZXRbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBoYXModGFyZ2V0LCBwcm9wKSB7XG4gICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBJREJUcmFuc2FjdGlvbiAmJlxuICAgICAgICAgICAgKHByb3AgPT09ICdkb25lJyB8fCBwcm9wID09PSAnc3RvcmUnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3AgaW4gdGFyZ2V0O1xuICAgIH0sXG59O1xuZnVuY3Rpb24gcmVwbGFjZVRyYXBzKGNhbGxiYWNrKSB7XG4gICAgaWRiUHJveHlUcmFwcyA9IGNhbGxiYWNrKGlkYlByb3h5VHJhcHMpO1xufVxuZnVuY3Rpb24gd3JhcEZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAvLyBEdWUgdG8gZXhwZWN0ZWQgb2JqZWN0IGVxdWFsaXR5ICh3aGljaCBpcyBlbmZvcmNlZCBieSB0aGUgY2FjaGluZyBpbiBgd3JhcGApLCB3ZVxuICAgIC8vIG9ubHkgY3JlYXRlIG9uZSBuZXcgZnVuYyBwZXIgZnVuYy5cbiAgICAvLyBDdXJzb3IgbWV0aG9kcyBhcmUgc3BlY2lhbCwgYXMgdGhlIGJlaGF2aW91ciBpcyBhIGxpdHRsZSBtb3JlIGRpZmZlcmVudCB0byBzdGFuZGFyZCBJREIuIEluXG4gICAgLy8gSURCLCB5b3UgYWR2YW5jZSB0aGUgY3Vyc29yIGFuZCB3YWl0IGZvciBhIG5ldyAnc3VjY2Vzcycgb24gdGhlIElEQlJlcXVlc3QgdGhhdCBnYXZlIHlvdSB0aGVcbiAgICAvLyBjdXJzb3IuIEl0J3Mga2luZGEgbGlrZSBhIHByb21pc2UgdGhhdCBjYW4gcmVzb2x2ZSB3aXRoIG1hbnkgdmFsdWVzLiBUaGF0IGRvZXNuJ3QgbWFrZSBzZW5zZVxuICAgIC8vIHdpdGggcmVhbCBwcm9taXNlcywgc28gZWFjaCBhZHZhbmNlIG1ldGhvZHMgcmV0dXJucyBhIG5ldyBwcm9taXNlIGZvciB0aGUgY3Vyc29yIG9iamVjdCwgb3JcbiAgICAvLyB1bmRlZmluZWQgaWYgdGhlIGVuZCBvZiB0aGUgY3Vyc29yIGhhcyBiZWVuIHJlYWNoZWQuXG4gICAgaWYgKGdldEN1cnNvckFkdmFuY2VNZXRob2RzKCkuaW5jbHVkZXMoZnVuYykpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAvLyBDYWxsaW5nIHRoZSBvcmlnaW5hbCBmdW5jdGlvbiB3aXRoIHRoZSBwcm94eSBhcyAndGhpcycgY2F1c2VzIElMTEVHQUwgSU5WT0NBVElPTiwgc28gd2UgdXNlXG4gICAgICAgICAgICAvLyB0aGUgb3JpZ2luYWwgb2JqZWN0LlxuICAgICAgICAgICAgZnVuYy5hcHBseSh1bndyYXAodGhpcyksIGFyZ3MpO1xuICAgICAgICAgICAgcmV0dXJuIHdyYXAodGhpcy5yZXF1ZXN0KTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgIC8vIENhbGxpbmcgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uIHdpdGggdGhlIHByb3h5IGFzICd0aGlzJyBjYXVzZXMgSUxMRUdBTCBJTlZPQ0FUSU9OLCBzbyB3ZSB1c2VcbiAgICAgICAgLy8gdGhlIG9yaWdpbmFsIG9iamVjdC5cbiAgICAgICAgcmV0dXJuIHdyYXAoZnVuYy5hcHBseSh1bndyYXAodGhpcyksIGFyZ3MpKTtcbiAgICB9O1xufVxuZnVuY3Rpb24gdHJhbnNmb3JtQ2FjaGFibGVWYWx1ZSh2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiB3cmFwRnVuY3Rpb24odmFsdWUpO1xuICAgIC8vIFRoaXMgZG9lc24ndCByZXR1cm4sIGl0IGp1c3QgY3JlYXRlcyBhICdkb25lJyBwcm9taXNlIGZvciB0aGUgdHJhbnNhY3Rpb24sXG4gICAgLy8gd2hpY2ggaXMgbGF0ZXIgcmV0dXJuZWQgZm9yIHRyYW5zYWN0aW9uLmRvbmUgKHNlZSBpZGJPYmplY3RIYW5kbGVyKS5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJREJUcmFuc2FjdGlvbilcbiAgICAgICAgY2FjaGVEb25lUHJvbWlzZUZvclRyYW5zYWN0aW9uKHZhbHVlKTtcbiAgICBpZiAoaW5zdGFuY2VPZkFueSh2YWx1ZSwgZ2V0SWRiUHJveHlhYmxlVHlwZXMoKSkpXG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodmFsdWUsIGlkYlByb3h5VHJhcHMpO1xuICAgIC8vIFJldHVybiB0aGUgc2FtZSB2YWx1ZSBiYWNrIGlmIHdlJ3JlIG5vdCBnb2luZyB0byB0cmFuc2Zvcm0gaXQuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gd3JhcCh2YWx1ZSkge1xuICAgIC8vIFdlIHNvbWV0aW1lcyBnZW5lcmF0ZSBtdWx0aXBsZSBwcm9taXNlcyBmcm9tIGEgc2luZ2xlIElEQlJlcXVlc3QgKGVnIHdoZW4gY3Vyc29yaW5nKSwgYmVjYXVzZVxuICAgIC8vIElEQiBpcyB3ZWlyZCBhbmQgYSBzaW5nbGUgSURCUmVxdWVzdCBjYW4geWllbGQgbWFueSByZXNwb25zZXMsIHNvIHRoZXNlIGNhbid0IGJlIGNhY2hlZC5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJREJSZXF1ZXN0KVxuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdCh2YWx1ZSk7XG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSB0cmFuc2Zvcm1lZCB0aGlzIHZhbHVlIGJlZm9yZSwgcmV1c2UgdGhlIHRyYW5zZm9ybWVkIHZhbHVlLlxuICAgIC8vIFRoaXMgaXMgZmFzdGVyLCBidXQgaXQgYWxzbyBwcm92aWRlcyBvYmplY3QgZXF1YWxpdHkuXG4gICAgaWYgKHRyYW5zZm9ybUNhY2hlLmhhcyh2YWx1ZSkpXG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1DYWNoZS5nZXQodmFsdWUpO1xuICAgIGNvbnN0IG5ld1ZhbHVlID0gdHJhbnNmb3JtQ2FjaGFibGVWYWx1ZSh2YWx1ZSk7XG4gICAgLy8gTm90IGFsbCB0eXBlcyBhcmUgdHJhbnNmb3JtZWQuXG4gICAgLy8gVGhlc2UgbWF5IGJlIHByaW1pdGl2ZSB0eXBlcywgc28gdGhleSBjYW4ndCBiZSBXZWFrTWFwIGtleXMuXG4gICAgaWYgKG5ld1ZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICB0cmFuc2Zvcm1DYWNoZS5zZXQodmFsdWUsIG5ld1ZhbHVlKTtcbiAgICAgICAgcmV2ZXJzZVRyYW5zZm9ybUNhY2hlLnNldChuZXdWYWx1ZSwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3VmFsdWU7XG59XG5jb25zdCB1bndyYXAgPSAodmFsdWUpID0+IHJldmVyc2VUcmFuc2Zvcm1DYWNoZS5nZXQodmFsdWUpO1xuXG4vKipcbiAqIE9wZW4gYSBkYXRhYmFzZS5cbiAqXG4gKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBkYXRhYmFzZS5cbiAqIEBwYXJhbSB2ZXJzaW9uIFNjaGVtYSB2ZXJzaW9uLlxuICogQHBhcmFtIGNhbGxiYWNrcyBBZGRpdGlvbmFsIGNhbGxiYWNrcy5cbiAqL1xuZnVuY3Rpb24gb3BlbkRCKG5hbWUsIHZlcnNpb24sIHsgYmxvY2tlZCwgdXBncmFkZSwgYmxvY2tpbmcsIHRlcm1pbmF0ZWQgfSA9IHt9KSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKG5hbWUsIHZlcnNpb24pO1xuICAgIGNvbnN0IG9wZW5Qcm9taXNlID0gd3JhcChyZXF1ZXN0KTtcbiAgICBpZiAodXBncmFkZSkge1xuICAgICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ3VwZ3JhZGVuZWVkZWQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHVwZ3JhZGUod3JhcChyZXF1ZXN0LnJlc3VsdCksIGV2ZW50Lm9sZFZlcnNpb24sIGV2ZW50Lm5ld1ZlcnNpb24sIHdyYXAocmVxdWVzdC50cmFuc2FjdGlvbiksIGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChibG9ja2VkKSB7XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignYmxvY2tlZCcsIChldmVudCkgPT4gYmxvY2tlZChcbiAgICAgICAgLy8gQ2FzdGluZyBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0LURPTS1saWItZ2VuZXJhdG9yL3B1bGwvMTQwNVxuICAgICAgICBldmVudC5vbGRWZXJzaW9uLCBldmVudC5uZXdWZXJzaW9uLCBldmVudCkpO1xuICAgIH1cbiAgICBvcGVuUHJvbWlzZVxuICAgICAgICAudGhlbigoZGIpID0+IHtcbiAgICAgICAgaWYgKHRlcm1pbmF0ZWQpXG4gICAgICAgICAgICBkYi5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsICgpID0+IHRlcm1pbmF0ZWQoKSk7XG4gICAgICAgIGlmIChibG9ja2luZykge1xuICAgICAgICAgICAgZGIuYWRkRXZlbnRMaXN0ZW5lcigndmVyc2lvbmNoYW5nZScsIChldmVudCkgPT4gYmxvY2tpbmcoZXZlbnQub2xkVmVyc2lvbiwgZXZlbnQubmV3VmVyc2lvbiwgZXZlbnQpKTtcbiAgICAgICAgfVxuICAgIH0pXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7IH0pO1xuICAgIHJldHVybiBvcGVuUHJvbWlzZTtcbn1cbi8qKlxuICogRGVsZXRlIGEgZGF0YWJhc2UuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgZGF0YWJhc2UuXG4gKi9cbmZ1bmN0aW9uIGRlbGV0ZURCKG5hbWUsIHsgYmxvY2tlZCB9ID0ge30pIHtcbiAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLmRlbGV0ZURhdGFiYXNlKG5hbWUpO1xuICAgIGlmIChibG9ja2VkKSB7XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignYmxvY2tlZCcsIChldmVudCkgPT4gYmxvY2tlZChcbiAgICAgICAgLy8gQ2FzdGluZyBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0LURPTS1saWItZ2VuZXJhdG9yL3B1bGwvMTQwNVxuICAgICAgICBldmVudC5vbGRWZXJzaW9uLCBldmVudCkpO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcChyZXF1ZXN0KS50aGVuKCgpID0+IHVuZGVmaW5lZCk7XG59XG5cbmNvbnN0IHJlYWRNZXRob2RzID0gWydnZXQnLCAnZ2V0S2V5JywgJ2dldEFsbCcsICdnZXRBbGxLZXlzJywgJ2NvdW50J107XG5jb25zdCB3cml0ZU1ldGhvZHMgPSBbJ3B1dCcsICdhZGQnLCAnZGVsZXRlJywgJ2NsZWFyJ107XG5jb25zdCBjYWNoZWRNZXRob2RzID0gbmV3IE1hcCgpO1xuZnVuY3Rpb24gZ2V0TWV0aG9kKHRhcmdldCwgcHJvcCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIElEQkRhdGFiYXNlICYmXG4gICAgICAgICEocHJvcCBpbiB0YXJnZXQpICYmXG4gICAgICAgIHR5cGVvZiBwcm9wID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoY2FjaGVkTWV0aG9kcy5nZXQocHJvcCkpXG4gICAgICAgIHJldHVybiBjYWNoZWRNZXRob2RzLmdldChwcm9wKTtcbiAgICBjb25zdCB0YXJnZXRGdW5jTmFtZSA9IHByb3AucmVwbGFjZSgvRnJvbUluZGV4JC8sICcnKTtcbiAgICBjb25zdCB1c2VJbmRleCA9IHByb3AgIT09IHRhcmdldEZ1bmNOYW1lO1xuICAgIGNvbnN0IGlzV3JpdGUgPSB3cml0ZU1ldGhvZHMuaW5jbHVkZXModGFyZ2V0RnVuY05hbWUpO1xuICAgIGlmIChcbiAgICAvLyBCYWlsIGlmIHRoZSB0YXJnZXQgZG9lc24ndCBleGlzdCBvbiB0aGUgdGFyZ2V0LiBFZywgZ2V0QWxsIGlzbid0IGluIEVkZ2UuXG4gICAgISh0YXJnZXRGdW5jTmFtZSBpbiAodXNlSW5kZXggPyBJREJJbmRleCA6IElEQk9iamVjdFN0b3JlKS5wcm90b3R5cGUpIHx8XG4gICAgICAgICEoaXNXcml0ZSB8fCByZWFkTWV0aG9kcy5pbmNsdWRlcyh0YXJnZXRGdW5jTmFtZSkpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gYXN5bmMgZnVuY3Rpb24gKHN0b3JlTmFtZSwgLi4uYXJncykge1xuICAgICAgICAvLyBpc1dyaXRlID8gJ3JlYWR3cml0ZScgOiB1bmRlZmluZWQgZ3ppcHBzIGJldHRlciwgYnV0IGZhaWxzIGluIEVkZ2UgOihcbiAgICAgICAgY29uc3QgdHggPSB0aGlzLnRyYW5zYWN0aW9uKHN0b3JlTmFtZSwgaXNXcml0ZSA/ICdyZWFkd3JpdGUnIDogJ3JlYWRvbmx5Jyk7XG4gICAgICAgIGxldCB0YXJnZXQgPSB0eC5zdG9yZTtcbiAgICAgICAgaWYgKHVzZUluZGV4KVxuICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LmluZGV4KGFyZ3Muc2hpZnQoKSk7XG4gICAgICAgIC8vIE11c3QgcmVqZWN0IGlmIG9wIHJlamVjdHMuXG4gICAgICAgIC8vIElmIGl0J3MgYSB3cml0ZSBvcGVyYXRpb24sIG11c3QgcmVqZWN0IGlmIHR4LmRvbmUgcmVqZWN0cy5cbiAgICAgICAgLy8gTXVzdCByZWplY3Qgd2l0aCBvcCByZWplY3Rpb24gZmlyc3QuXG4gICAgICAgIC8vIE11c3QgcmVzb2x2ZSB3aXRoIG9wIHZhbHVlLlxuICAgICAgICAvLyBNdXN0IGhhbmRsZSBib3RoIHByb21pc2VzIChubyB1bmhhbmRsZWQgcmVqZWN0aW9ucylcbiAgICAgICAgcmV0dXJuIChhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICB0YXJnZXRbdGFyZ2V0RnVuY05hbWVdKC4uLmFyZ3MpLFxuICAgICAgICAgICAgaXNXcml0ZSAmJiB0eC5kb25lLFxuICAgICAgICBdKSlbMF07XG4gICAgfTtcbiAgICBjYWNoZWRNZXRob2RzLnNldChwcm9wLCBtZXRob2QpO1xuICAgIHJldHVybiBtZXRob2Q7XG59XG5yZXBsYWNlVHJhcHMoKG9sZFRyYXBzKSA9PiAoe1xuICAgIC4uLm9sZFRyYXBzLFxuICAgIGdldDogKHRhcmdldCwgcHJvcCwgcmVjZWl2ZXIpID0+IGdldE1ldGhvZCh0YXJnZXQsIHByb3ApIHx8IG9sZFRyYXBzLmdldCh0YXJnZXQsIHByb3AsIHJlY2VpdmVyKSxcbiAgICBoYXM6ICh0YXJnZXQsIHByb3ApID0+ICEhZ2V0TWV0aG9kKHRhcmdldCwgcHJvcCkgfHwgb2xkVHJhcHMuaGFzKHRhcmdldCwgcHJvcCksXG59KSk7XG5cbmNvbnN0IGFkdmFuY2VNZXRob2RQcm9wcyA9IFsnY29udGludWUnLCAnY29udGludWVQcmltYXJ5S2V5JywgJ2FkdmFuY2UnXTtcbmNvbnN0IG1ldGhvZE1hcCA9IHt9O1xuY29uc3QgYWR2YW5jZVJlc3VsdHMgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgaXR0clByb3hpZWRDdXJzb3JUb09yaWdpbmFsUHJveHkgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgY3Vyc29ySXRlcmF0b3JUcmFwcyA9IHtcbiAgICBnZXQodGFyZ2V0LCBwcm9wKSB7XG4gICAgICAgIGlmICghYWR2YW5jZU1ldGhvZFByb3BzLmluY2x1ZGVzKHByb3ApKVxuICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtwcm9wXTtcbiAgICAgICAgbGV0IGNhY2hlZEZ1bmMgPSBtZXRob2RNYXBbcHJvcF07XG4gICAgICAgIGlmICghY2FjaGVkRnVuYykge1xuICAgICAgICAgICAgY2FjaGVkRnVuYyA9IG1ldGhvZE1hcFtwcm9wXSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgYWR2YW5jZVJlc3VsdHMuc2V0KHRoaXMsIGl0dHJQcm94aWVkQ3Vyc29yVG9PcmlnaW5hbFByb3h5LmdldCh0aGlzKVtwcm9wXSguLi5hcmdzKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWNoZWRGdW5jO1xuICAgIH0sXG59O1xuYXN5bmMgZnVuY3Rpb24qIGl0ZXJhdGUoLi4uYXJncykge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby10aGlzLWFzc2lnbm1lbnRcbiAgICBsZXQgY3Vyc29yID0gdGhpcztcbiAgICBpZiAoIShjdXJzb3IgaW5zdGFuY2VvZiBJREJDdXJzb3IpKSB7XG4gICAgICAgIGN1cnNvciA9IGF3YWl0IGN1cnNvci5vcGVuQ3Vyc29yKC4uLmFyZ3MpO1xuICAgIH1cbiAgICBpZiAoIWN1cnNvcilcbiAgICAgICAgcmV0dXJuO1xuICAgIGN1cnNvciA9IGN1cnNvcjtcbiAgICBjb25zdCBwcm94aWVkQ3Vyc29yID0gbmV3IFByb3h5KGN1cnNvciwgY3Vyc29ySXRlcmF0b3JUcmFwcyk7XG4gICAgaXR0clByb3hpZWRDdXJzb3JUb09yaWdpbmFsUHJveHkuc2V0KHByb3hpZWRDdXJzb3IsIGN1cnNvcik7XG4gICAgLy8gTWFwIHRoaXMgZG91YmxlLXByb3h5IGJhY2sgdG8gdGhlIG9yaWdpbmFsLCBzbyBvdGhlciBjdXJzb3IgbWV0aG9kcyB3b3JrLlxuICAgIHJldmVyc2VUcmFuc2Zvcm1DYWNoZS5zZXQocHJveGllZEN1cnNvciwgdW53cmFwKGN1cnNvcikpO1xuICAgIHdoaWxlIChjdXJzb3IpIHtcbiAgICAgICAgeWllbGQgcHJveGllZEN1cnNvcjtcbiAgICAgICAgLy8gSWYgb25lIG9mIHRoZSBhZHZhbmNpbmcgbWV0aG9kcyB3YXMgbm90IGNhbGxlZCwgY2FsbCBjb250aW51ZSgpLlxuICAgICAgICBjdXJzb3IgPSBhd2FpdCAoYWR2YW5jZVJlc3VsdHMuZ2V0KHByb3hpZWRDdXJzb3IpIHx8IGN1cnNvci5jb250aW51ZSgpKTtcbiAgICAgICAgYWR2YW5jZVJlc3VsdHMuZGVsZXRlKHByb3hpZWRDdXJzb3IpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIGlzSXRlcmF0b3JQcm9wKHRhcmdldCwgcHJvcCkge1xuICAgIHJldHVybiAoKHByb3AgPT09IFN5bWJvbC5hc3luY0l0ZXJhdG9yICYmXG4gICAgICAgIGluc3RhbmNlT2ZBbnkodGFyZ2V0LCBbSURCSW5kZXgsIElEQk9iamVjdFN0b3JlLCBJREJDdXJzb3JdKSkgfHxcbiAgICAgICAgKHByb3AgPT09ICdpdGVyYXRlJyAmJiBpbnN0YW5jZU9mQW55KHRhcmdldCwgW0lEQkluZGV4LCBJREJPYmplY3RTdG9yZV0pKSk7XG59XG5yZXBsYWNlVHJhcHMoKG9sZFRyYXBzKSA9PiAoe1xuICAgIC4uLm9sZFRyYXBzLFxuICAgIGdldCh0YXJnZXQsIHByb3AsIHJlY2VpdmVyKSB7XG4gICAgICAgIGlmIChpc0l0ZXJhdG9yUHJvcCh0YXJnZXQsIHByb3ApKVxuICAgICAgICAgICAgcmV0dXJuIGl0ZXJhdGU7XG4gICAgICAgIHJldHVybiBvbGRUcmFwcy5nZXQodGFyZ2V0LCBwcm9wLCByZWNlaXZlcik7XG4gICAgfSxcbiAgICBoYXModGFyZ2V0LCBwcm9wKSB7XG4gICAgICAgIHJldHVybiBpc0l0ZXJhdG9yUHJvcCh0YXJnZXQsIHByb3ApIHx8IG9sZFRyYXBzLmhhcyh0YXJnZXQsIHByb3ApO1xuICAgIH0sXG59KSk7XG5cbmV4cG9ydHMuZGVsZXRlREIgPSBkZWxldGVEQjtcbmV4cG9ydHMub3BlbkRCID0gb3BlbkRCO1xuZXhwb3J0cy51bndyYXAgPSB1bndyYXA7XG5leHBvcnRzLndyYXAgPSB3cmFwO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuICB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuICAoZ2xvYmFsID0gZ2xvYmFsIHx8IHNlbGYsIGdsb2JhbC5NdXN0YWNoZSA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuICAvKiFcbiAgICogbXVzdGFjaGUuanMgLSBMb2dpYy1sZXNzIHt7bXVzdGFjaGV9fSB0ZW1wbGF0ZXMgd2l0aCBKYXZhU2NyaXB0XG4gICAqIGh0dHA6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanNcbiAgICovXG5cbiAgdmFyIG9iamVjdFRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIGlzQXJyYXlQb2x5ZmlsbCAob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdFRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICBmdW5jdGlvbiBpc0Z1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3JlIGNvcnJlY3QgdHlwZW9mIHN0cmluZyBoYW5kbGluZyBhcnJheVxuICAgKiB3aGljaCBub3JtYWxseSByZXR1cm5zIHR5cGVvZiAnb2JqZWN0J1xuICAgKi9cbiAgZnVuY3Rpb24gdHlwZVN0ciAob2JqKSB7XG4gICAgcmV0dXJuIGlzQXJyYXkob2JqKSA/ICdhcnJheScgOiB0eXBlb2Ygb2JqO1xuICB9XG5cbiAgZnVuY3Rpb24gZXNjYXBlUmVnRXhwIChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1tcXC1cXFtcXF17fSgpKis/LixcXFxcXFxeJHwjXFxzXS9nLCAnXFxcXCQmJyk7XG4gIH1cblxuICAvKipcbiAgICogTnVsbCBzYWZlIHdheSBvZiBjaGVja2luZyB3aGV0aGVyIG9yIG5vdCBhbiBvYmplY3QsXG4gICAqIGluY2x1ZGluZyBpdHMgcHJvdG90eXBlLCBoYXMgYSBnaXZlbiBwcm9wZXJ0eVxuICAgKi9cbiAgZnVuY3Rpb24gaGFzUHJvcGVydHkgKG9iaiwgcHJvcE5hbWUpIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgKHByb3BOYW1lIGluIG9iaik7XG4gIH1cblxuICAvKipcbiAgICogU2FmZSB3YXkgb2YgZGV0ZWN0aW5nIHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiB0aGluZyBpcyBhIHByaW1pdGl2ZSBhbmRcbiAgICogd2hldGhlciBpdCBoYXMgdGhlIGdpdmVuIHByb3BlcnR5XG4gICAqL1xuICBmdW5jdGlvbiBwcmltaXRpdmVIYXNPd25Qcm9wZXJ0eSAocHJpbWl0aXZlLCBwcm9wTmFtZSkge1xuICAgIHJldHVybiAoXG4gICAgICBwcmltaXRpdmUgIT0gbnVsbFxuICAgICAgJiYgdHlwZW9mIHByaW1pdGl2ZSAhPT0gJ29iamVjdCdcbiAgICAgICYmIHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eVxuICAgICAgJiYgcHJpbWl0aXZlLmhhc093blByb3BlcnR5KHByb3BOYW1lKVxuICAgICk7XG4gIH1cblxuICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2lzc3Vlcy5hcGFjaGUub3JnL2ppcmEvYnJvd3NlL0NPVUNIREItNTc3XG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg5XG4gIHZhciByZWdFeHBUZXN0ID0gUmVnRXhwLnByb3RvdHlwZS50ZXN0O1xuICBmdW5jdGlvbiB0ZXN0UmVnRXhwIChyZSwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIHJlZ0V4cFRlc3QuY2FsbChyZSwgc3RyaW5nKTtcbiAgfVxuXG4gIHZhciBub25TcGFjZVJlID0gL1xcUy87XG4gIGZ1bmN0aW9uIGlzV2hpdGVzcGFjZSAoc3RyaW5nKSB7XG4gICAgcmV0dXJuICF0ZXN0UmVnRXhwKG5vblNwYWNlUmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgZW50aXR5TWFwID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjMzk7JyxcbiAgICAnLyc6ICcmI3gyRjsnLFxuICAgICdgJzogJyYjeDYwOycsXG4gICAgJz0nOiAnJiN4M0Q7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwgKHN0cmluZykge1xuICAgIHJldHVybiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC9bJjw+XCInYD1cXC9dL2csIGZ1bmN0aW9uIGZyb21FbnRpdHlNYXAgKHMpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXBbc107XG4gICAgfSk7XG4gIH1cblxuICB2YXIgd2hpdGVSZSA9IC9cXHMqLztcbiAgdmFyIHNwYWNlUmUgPSAvXFxzKy87XG4gIHZhciBlcXVhbHNSZSA9IC9cXHMqPS87XG4gIHZhciBjdXJseVJlID0gL1xccypcXH0vO1xuICB2YXIgdGFnUmUgPSAvI3xcXF58XFwvfD58XFx7fCZ8PXwhLztcblxuICAvKipcbiAgICogQnJlYWtzIHVwIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHN0cmluZyBpbnRvIGEgdHJlZSBvZiB0b2tlbnMuIElmIHRoZSBgdGFnc2BcbiAgICogYXJndW1lbnQgaXMgZ2l2ZW4gaGVyZSBpdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvIHN0cmluZyB2YWx1ZXM6IHRoZVxuICAgKiBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy4gWyBcIjwlXCIsIFwiJT5cIiBdKS4gT2ZcbiAgICogY291cnNlLCB0aGUgZGVmYXVsdCBpcyB0byB1c2UgbXVzdGFjaGVzIChpLmUuIG11c3RhY2hlLnRhZ3MpLlxuICAgKlxuICAgKiBBIHRva2VuIGlzIGFuIGFycmF5IHdpdGggYXQgbGVhc3QgNCBlbGVtZW50cy4gVGhlIGZpcnN0IGVsZW1lbnQgaXMgdGhlXG4gICAqIG11c3RhY2hlIHN5bWJvbCB0aGF0IHdhcyB1c2VkIGluc2lkZSB0aGUgdGFnLCBlLmcuIFwiI1wiIG9yIFwiJlwiLiBJZiB0aGUgdGFnXG4gICAqIGRpZCBub3QgY29udGFpbiBhIHN5bWJvbCAoaS5lLiB7e215VmFsdWV9fSkgdGhpcyBlbGVtZW50IGlzIFwibmFtZVwiLiBGb3JcbiAgICogYWxsIHRleHQgdGhhdCBhcHBlYXJzIG91dHNpZGUgYSBzeW1ib2wgdGhpcyBlbGVtZW50IGlzIFwidGV4dFwiLlxuICAgKlxuICAgKiBUaGUgc2Vjb25kIGVsZW1lbnQgb2YgYSB0b2tlbiBpcyBpdHMgXCJ2YWx1ZVwiLiBGb3IgbXVzdGFjaGUgdGFncyB0aGlzIGlzXG4gICAqIHdoYXRldmVyIGVsc2Ugd2FzIGluc2lkZSB0aGUgdGFnIGJlc2lkZXMgdGhlIG9wZW5pbmcgc3ltYm9sLiBGb3IgdGV4dCB0b2tlbnNcbiAgICogdGhpcyBpcyB0aGUgdGV4dCBpdHNlbGYuXG4gICAqXG4gICAqIFRoZSB0aGlyZCBhbmQgZm91cnRoIGVsZW1lbnRzIG9mIHRoZSB0b2tlbiBhcmUgdGhlIHN0YXJ0IGFuZCBlbmQgaW5kaWNlcyxcbiAgICogcmVzcGVjdGl2ZWx5LCBvZiB0aGUgdG9rZW4gaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUb2tlbnMgdGhhdCBhcmUgdGhlIHJvb3Qgbm9kZSBvZiBhIHN1YnRyZWUgY29udGFpbiB0d28gbW9yZSBlbGVtZW50czogMSkgYW5cbiAgICogYXJyYXkgb2YgdG9rZW5zIGluIHRoZSBzdWJ0cmVlIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlIGF0XG4gICAqIHdoaWNoIHRoZSBjbG9zaW5nIHRhZyBmb3IgdGhhdCBzZWN0aW9uIGJlZ2lucy5cbiAgICpcbiAgICogVG9rZW5zIGZvciBwYXJ0aWFscyBhbHNvIGNvbnRhaW4gdHdvIG1vcmUgZWxlbWVudHM6IDEpIGEgc3RyaW5nIHZhbHVlIG9mXG4gICAqIGluZGVuZGF0aW9uIHByaW9yIHRvIHRoYXQgdGFnIGFuZCAyKSB0aGUgaW5kZXggb2YgdGhhdCB0YWcgb24gdGhhdCBsaW5lIC1cbiAgICogZWcgYSB2YWx1ZSBvZiAyIGluZGljYXRlcyB0aGUgcGFydGlhbCBpcyB0aGUgdGhpcmQgdGFnIG9uIHRoaXMgbGluZS5cbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgaWYgKCF0ZW1wbGF0ZSlcbiAgICAgIHJldHVybiBbXTtcbiAgICB2YXIgbGluZUhhc05vblNwYWNlID0gZmFsc2U7XG4gICAgdmFyIHNlY3Rpb25zID0gW107ICAgICAvLyBTdGFjayB0byBob2xkIHNlY3Rpb24gdG9rZW5zXG4gICAgdmFyIHRva2VucyA9IFtdOyAgICAgICAvLyBCdWZmZXIgdG8gaG9sZCB0aGUgdG9rZW5zXG4gICAgdmFyIHNwYWNlcyA9IFtdOyAgICAgICAvLyBJbmRpY2VzIG9mIHdoaXRlc3BhY2UgdG9rZW5zIG9uIHRoZSBjdXJyZW50IGxpbmVcbiAgICB2YXIgaGFzVGFnID0gZmFsc2U7ICAgIC8vIElzIHRoZXJlIGEge3t0YWd9fSBvbiB0aGUgY3VycmVudCBsaW5lP1xuICAgIHZhciBub25TcGFjZSA9IGZhbHNlOyAgLy8gSXMgdGhlcmUgYSBub24tc3BhY2UgY2hhciBvbiB0aGUgY3VycmVudCBsaW5lP1xuICAgIHZhciBpbmRlbnRhdGlvbiA9ICcnOyAgLy8gVHJhY2tzIGluZGVudGF0aW9uIGZvciB0YWdzIHRoYXQgdXNlIGl0XG4gICAgdmFyIHRhZ0luZGV4ID0gMDsgICAgICAvLyBTdG9yZXMgYSBjb3VudCBvZiBudW1iZXIgb2YgdGFncyBlbmNvdW50ZXJlZCBvbiBhIGxpbmVcblxuICAgIC8vIFN0cmlwcyBhbGwgd2hpdGVzcGFjZSB0b2tlbnMgYXJyYXkgZm9yIHRoZSBjdXJyZW50IGxpbmVcbiAgICAvLyBpZiB0aGVyZSB3YXMgYSB7eyN0YWd9fSBvbiBpdCBhbmQgb3RoZXJ3aXNlIG9ubHkgc3BhY2UuXG4gICAgZnVuY3Rpb24gc3RyaXBTcGFjZSAoKSB7XG4gICAgICBpZiAoaGFzVGFnICYmICFub25TcGFjZSkge1xuICAgICAgICB3aGlsZSAoc3BhY2VzLmxlbmd0aClcbiAgICAgICAgICBkZWxldGUgdG9rZW5zW3NwYWNlcy5wb3AoKV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGFjZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgaGFzVGFnID0gZmFsc2U7XG4gICAgICBub25TcGFjZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBvcGVuaW5nVGFnUmUsIGNsb3NpbmdUYWdSZSwgY2xvc2luZ0N1cmx5UmU7XG4gICAgZnVuY3Rpb24gY29tcGlsZVRhZ3MgKHRhZ3NUb0NvbXBpbGUpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFnc1RvQ29tcGlsZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHRhZ3NUb0NvbXBpbGUgPSB0YWdzVG9Db21waWxlLnNwbGl0KHNwYWNlUmUsIDIpO1xuXG4gICAgICBpZiAoIWlzQXJyYXkodGFnc1RvQ29tcGlsZSkgfHwgdGFnc1RvQ29tcGlsZS5sZW5ndGggIT09IDIpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzOiAnICsgdGFnc1RvQ29tcGlsZSk7XG5cbiAgICAgIG9wZW5pbmdUYWdSZSA9IG5ldyBSZWdFeHAoZXNjYXBlUmVnRXhwKHRhZ3NUb0NvbXBpbGVbMF0pICsgJ1xcXFxzKicpO1xuICAgICAgY2xvc2luZ1RhZ1JlID0gbmV3IFJlZ0V4cCgnXFxcXHMqJyArIGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzFdKSk7XG4gICAgICBjbG9zaW5nQ3VybHlSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAoJ30nICsgdGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgIH1cblxuICAgIGNvbXBpbGVUYWdzKHRhZ3MgfHwgbXVzdGFjaGUudGFncyk7XG5cbiAgICB2YXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRlbXBsYXRlKTtcblxuICAgIHZhciBzdGFydCwgdHlwZSwgdmFsdWUsIGNociwgdG9rZW4sIG9wZW5TZWN0aW9uO1xuICAgIHdoaWxlICghc2Nhbm5lci5lb3MoKSkge1xuICAgICAgc3RhcnQgPSBzY2FubmVyLnBvcztcblxuICAgICAgLy8gTWF0Y2ggYW55IHRleHQgYmV0d2VlbiB0YWdzLlxuICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChvcGVuaW5nVGFnUmUpO1xuXG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgdmFsdWVMZW5ndGg7ICsraSkge1xuICAgICAgICAgIGNociA9IHZhbHVlLmNoYXJBdChpKTtcblxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoY2hyKSkge1xuICAgICAgICAgICAgc3BhY2VzLnB1c2godG9rZW5zLmxlbmd0aCk7XG4gICAgICAgICAgICBpbmRlbnRhdGlvbiArPSBjaHI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICAgIGxpbmVIYXNOb25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgICBpbmRlbnRhdGlvbiArPSAnICc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdG9rZW5zLnB1c2goWyAndGV4dCcsIGNociwgc3RhcnQsIHN0YXJ0ICsgMSBdKTtcbiAgICAgICAgICBzdGFydCArPSAxO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIHdoaXRlc3BhY2Ugb24gdGhlIGN1cnJlbnQgbGluZS5cbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxuJykge1xuICAgICAgICAgICAgc3RyaXBTcGFjZSgpO1xuICAgICAgICAgICAgaW5kZW50YXRpb24gPSAnJztcbiAgICAgICAgICAgIHRhZ0luZGV4ID0gMDtcbiAgICAgICAgICAgIGxpbmVIYXNOb25TcGFjZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgb3BlbmluZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihvcGVuaW5nVGFnUmUpKVxuICAgICAgICBicmVhaztcblxuICAgICAgaGFzVGFnID0gdHJ1ZTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdHlwZS5cbiAgICAgIHR5cGUgPSBzY2FubmVyLnNjYW4odGFnUmUpIHx8ICduYW1lJztcbiAgICAgIHNjYW5uZXIuc2Nhbih3aGl0ZVJlKTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdmFsdWUuXG4gICAgICBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAneycpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nQ3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgICAgdHlwZSA9ICcmJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIGNsb3NpbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4oY2xvc2luZ1RhZ1JlKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCB0YWcgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgICAgaWYgKHR5cGUgPT0gJz4nKSB7XG4gICAgICAgIHRva2VuID0gWyB0eXBlLCB2YWx1ZSwgc3RhcnQsIHNjYW5uZXIucG9zLCBpbmRlbnRhdGlvbiwgdGFnSW5kZXgsIGxpbmVIYXNOb25TcGFjZSBdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdG9rZW4gPSBbIHR5cGUsIHZhbHVlLCBzdGFydCwgc2Nhbm5lci5wb3MgXTtcbiAgICAgIH1cbiAgICAgIHRhZ0luZGV4Kys7XG4gICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG5cbiAgICAgIGlmICh0eXBlID09PSAnIycgfHwgdHlwZSA9PT0gJ14nKSB7XG4gICAgICAgIHNlY3Rpb25zLnB1c2godG9rZW4pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnLycpIHtcbiAgICAgICAgLy8gQ2hlY2sgc2VjdGlvbiBuZXN0aW5nLlxuICAgICAgICBvcGVuU2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuXG4gICAgICAgIGlmICghb3BlblNlY3Rpb24pXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbm9wZW5lZCBzZWN0aW9uIFwiJyArIHZhbHVlICsgJ1wiIGF0ICcgKyBzdGFydCk7XG5cbiAgICAgICAgaWYgKG9wZW5TZWN0aW9uWzFdICE9PSB2YWx1ZSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgb3BlblNlY3Rpb25bMV0gKyAnXCIgYXQgJyArIHN0YXJ0KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ25hbWUnIHx8IHR5cGUgPT09ICd7JyB8fCB0eXBlID09PSAnJicpIHtcbiAgICAgICAgbm9uU3BhY2UgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnPScpIHtcbiAgICAgICAgLy8gU2V0IHRoZSB0YWdzIGZvciB0aGUgbmV4dCB0aW1lIGFyb3VuZC5cbiAgICAgICAgY29tcGlsZVRhZ3ModmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHN0cmlwU3BhY2UoKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gb3BlbiBzZWN0aW9ucyB3aGVuIHdlJ3JlIGRvbmUuXG4gICAgb3BlblNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgIGlmIChvcGVuU2VjdGlvbilcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBvcGVuU2VjdGlvblsxXSArICdcIiBhdCAnICsgc2Nhbm5lci5wb3MpO1xuXG4gICAgcmV0dXJuIG5lc3RUb2tlbnMoc3F1YXNoVG9rZW5zKHRva2VucykpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbWJpbmVzIHRoZSB2YWx1ZXMgb2YgY29uc2VjdXRpdmUgdGV4dCB0b2tlbnMgaW4gdGhlIGdpdmVuIGB0b2tlbnNgIGFycmF5XG4gICAqIHRvIGEgc2luZ2xlIHRva2VuLlxuICAgKi9cbiAgZnVuY3Rpb24gc3F1YXNoVG9rZW5zICh0b2tlbnMpIHtcbiAgICB2YXIgc3F1YXNoZWRUb2tlbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbiwgbGFzdFRva2VuO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgaWYgKHRva2VuWzBdID09PSAndGV4dCcgJiYgbGFzdFRva2VuICYmIGxhc3RUb2tlblswXSA9PT0gJ3RleHQnKSB7XG4gICAgICAgICAgbGFzdFRva2VuWzFdICs9IHRva2VuWzFdO1xuICAgICAgICAgIGxhc3RUb2tlblszXSA9IHRva2VuWzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNxdWFzaGVkVG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgICAgIGxhc3RUb2tlbiA9IHRva2VuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNxdWFzaGVkVG9rZW5zO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1zIHRoZSBnaXZlbiBhcnJheSBvZiBgdG9rZW5zYCBpbnRvIGEgbmVzdGVkIHRyZWUgc3RydWN0dXJlIHdoZXJlXG4gICAqIHRva2VucyB0aGF0IHJlcHJlc2VudCBhIHNlY3Rpb24gaGF2ZSB0d28gYWRkaXRpb25hbCBpdGVtczogMSkgYW4gYXJyYXkgb2ZcbiAgICogYWxsIHRva2VucyB0aGF0IGFwcGVhciBpbiB0aGF0IHNlY3Rpb24gYW5kIDIpIHRoZSBpbmRleCBpbiB0aGUgb3JpZ2luYWxcbiAgICogdGVtcGxhdGUgdGhhdCByZXByZXNlbnRzIHRoZSBlbmQgb2YgdGhhdCBzZWN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gbmVzdFRva2VucyAodG9rZW5zKSB7XG4gICAgdmFyIG5lc3RlZFRva2VucyA9IFtdO1xuICAgIHZhciBjb2xsZWN0b3IgPSBuZXN0ZWRUb2tlbnM7XG4gICAgdmFyIHNlY3Rpb25zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIHNlY3Rpb247XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgIHN3aXRjaCAodG9rZW5bMF0pIHtcbiAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgIGNhc2UgJ14nOlxuICAgICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBjb2xsZWN0b3IgPSB0b2tlbls0XSA9IFtdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG4gICAgICAgICAgc2VjdGlvbls1XSA9IHRva2VuWzJdO1xuICAgICAgICAgIGNvbGxlY3RvciA9IHNlY3Rpb25zLmxlbmd0aCA+IDAgPyBzZWN0aW9uc1tzZWN0aW9ucy5sZW5ndGggLSAxXVs0XSA6IG5lc3RlZFRva2VucztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lc3RlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHNpbXBsZSBzdHJpbmcgc2Nhbm5lciB0aGF0IGlzIHVzZWQgYnkgdGhlIHRlbXBsYXRlIHBhcnNlciB0byBmaW5kXG4gICAqIHRva2VucyBpbiB0ZW1wbGF0ZSBzdHJpbmdzLlxuICAgKi9cbiAgZnVuY3Rpb24gU2Nhbm5lciAoc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gICAgdGhpcy50YWlsID0gc3RyaW5nO1xuICAgIHRoaXMucG9zID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFpbCBpcyBlbXB0eSAoZW5kIG9mIHN0cmluZykuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5lb3MgPSBmdW5jdGlvbiBlb3MgKCkge1xuICAgIHJldHVybiB0aGlzLnRhaWwgPT09ICcnO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmllcyB0byBtYXRjaCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBSZXR1cm5zIHRoZSBtYXRjaGVkIHRleHQgaWYgaXQgY2FuIG1hdGNoLCB0aGUgZW1wdHkgc3RyaW5nIG90aGVyd2lzZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW4gPSBmdW5jdGlvbiBzY2FuIChyZSkge1xuICAgIHZhciBtYXRjaCA9IHRoaXMudGFpbC5tYXRjaChyZSk7XG5cbiAgICBpZiAoIW1hdGNoIHx8IG1hdGNoLmluZGV4ICE9PSAwKVxuICAgICAgcmV0dXJuICcnO1xuXG4gICAgdmFyIHN0cmluZyA9IG1hdGNoWzBdO1xuXG4gICAgdGhpcy50YWlsID0gdGhpcy50YWlsLnN1YnN0cmluZyhzdHJpbmcubGVuZ3RoKTtcbiAgICB0aGlzLnBvcyArPSBzdHJpbmcubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHN0cmluZztcbiAgfTtcblxuICAvKipcbiAgICogU2tpcHMgYWxsIHRleHQgdW50aWwgdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYmUgbWF0Y2hlZC4gUmV0dXJuc1xuICAgKiB0aGUgc2tpcHBlZCBzdHJpbmcsIHdoaWNoIGlzIHRoZSBlbnRpcmUgdGFpbCBpZiBubyBtYXRjaCBjYW4gYmUgbWFkZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW5VbnRpbCA9IGZ1bmN0aW9uIHNjYW5VbnRpbCAocmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnRhaWwuc2VhcmNoKHJlKSwgbWF0Y2g7XG5cbiAgICBzd2l0Y2ggKGluZGV4KSB7XG4gICAgICBjYXNlIC0xOlxuICAgICAgICBtYXRjaCA9IHRoaXMudGFpbDtcbiAgICAgICAgdGhpcy50YWlsID0gJyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAwOlxuICAgICAgICBtYXRjaCA9ICcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIG1hdGNoID0gdGhpcy50YWlsLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoaW5kZXgpO1xuICAgIH1cblxuICAgIHRoaXMucG9zICs9IG1hdGNoLmxlbmd0aDtcblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHJlbmRlcmluZyBjb250ZXh0IGJ5IHdyYXBwaW5nIGEgdmlldyBvYmplY3QgYW5kXG4gICAqIG1haW50YWluaW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBwYXJlbnQgY29udGV4dC5cbiAgICovXG4gIGZ1bmN0aW9uIENvbnRleHQgKHZpZXcsIHBhcmVudENvbnRleHQpIHtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuY2FjaGUgPSB7ICcuJzogdGhpcy52aWV3IH07XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnRDb250ZXh0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgY29udGV4dCB1c2luZyB0aGUgZ2l2ZW4gdmlldyB3aXRoIHRoaXMgY29udGV4dFxuICAgKiBhcyB0aGUgcGFyZW50LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIHB1c2ggKHZpZXcpIHtcbiAgICByZXR1cm4gbmV3IENvbnRleHQodmlldywgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBnaXZlbiBuYW1lIGluIHRoaXMgY29udGV4dCwgdHJhdmVyc2luZ1xuICAgKiB1cCB0aGUgY29udGV4dCBoaWVyYXJjaHkgaWYgdGhlIHZhbHVlIGlzIGFic2VudCBpbiB0aGlzIGNvbnRleHQncyB2aWV3LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gbG9va3VwIChuYW1lKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcblxuICAgIHZhciB2YWx1ZTtcbiAgICBpZiAoY2FjaGUuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgIHZhbHVlID0gY2FjaGVbbmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjb250ZXh0ID0gdGhpcywgaW50ZXJtZWRpYXRlVmFsdWUsIG5hbWVzLCBpbmRleCwgbG9va3VwSGl0ID0gZmFsc2U7XG5cbiAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgIGlmIChuYW1lLmluZGV4T2YoJy4nKSA+IDApIHtcbiAgICAgICAgICBpbnRlcm1lZGlhdGVWYWx1ZSA9IGNvbnRleHQudmlldztcbiAgICAgICAgICBuYW1lcyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBpbmRleCA9IDA7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBVc2luZyB0aGUgZG90IG5vdGlvbiBwYXRoIGluIGBuYW1lYCwgd2UgZGVzY2VuZCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAqIG5lc3RlZCBvYmplY3RzLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVG8gYmUgY2VydGFpbiB0aGF0IHRoZSBsb29rdXAgaGFzIGJlZW4gc3VjY2Vzc2Z1bCwgd2UgaGF2ZSB0b1xuICAgICAgICAgICAqIGNoZWNrIGlmIHRoZSBsYXN0IG9iamVjdCBpbiB0aGUgcGF0aCBhY3R1YWxseSBoYXMgdGhlIHByb3BlcnR5XG4gICAgICAgICAgICogd2UgYXJlIGxvb2tpbmcgZm9yLiBXZSBzdG9yZSB0aGUgcmVzdWx0IGluIGBsb29rdXBIaXRgLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVGhpcyBpcyBzcGVjaWFsbHkgbmVjZXNzYXJ5IGZvciB3aGVuIHRoZSB2YWx1ZSBoYXMgYmVlbiBzZXQgdG9cbiAgICAgICAgICAgKiBgdW5kZWZpbmVkYCBhbmQgd2Ugd2FudCB0byBhdm9pZCBsb29raW5nIHVwIHBhcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIEluIHRoZSBjYXNlIHdoZXJlIGRvdCBub3RhdGlvbiBpcyB1c2VkLCB3ZSBjb25zaWRlciB0aGUgbG9va3VwXG4gICAgICAgICAgICogdG8gYmUgc3VjY2Vzc2Z1bCBldmVuIGlmIHRoZSBsYXN0IFwib2JqZWN0XCIgaW4gdGhlIHBhdGggaXNcbiAgICAgICAgICAgKiBub3QgYWN0dWFsbHkgYW4gb2JqZWN0IGJ1dCBhIHByaW1pdGl2ZSAoZS5nLiwgYSBzdHJpbmcsIG9yIGFuXG4gICAgICAgICAgICogaW50ZWdlciksIGJlY2F1c2UgaXQgaXMgc29tZXRpbWVzIHVzZWZ1bCB0byBhY2Nlc3MgYSBwcm9wZXJ0eVxuICAgICAgICAgICAqIG9mIGFuIGF1dG9ib3hlZCBwcmltaXRpdmUsIHN1Y2ggYXMgdGhlIGxlbmd0aCBvZiBhIHN0cmluZy5cbiAgICAgICAgICAgKiovXG4gICAgICAgICAgd2hpbGUgKGludGVybWVkaWF0ZVZhbHVlICE9IG51bGwgJiYgaW5kZXggPCBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gbmFtZXMubGVuZ3RoIC0gMSlcbiAgICAgICAgICAgICAgbG9va3VwSGl0ID0gKFxuICAgICAgICAgICAgICAgIGhhc1Byb3BlcnR5KGludGVybWVkaWF0ZVZhbHVlLCBuYW1lc1tpbmRleF0pXG4gICAgICAgICAgICAgICAgfHwgcHJpbWl0aXZlSGFzT3duUHJvcGVydHkoaW50ZXJtZWRpYXRlVmFsdWUsIG5hbWVzW2luZGV4XSlcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaW50ZXJtZWRpYXRlVmFsdWUgPSBpbnRlcm1lZGlhdGVWYWx1ZVtuYW1lc1tpbmRleCsrXV07XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGludGVybWVkaWF0ZVZhbHVlID0gY29udGV4dC52aWV3W25hbWVdO1xuXG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogT25seSBjaGVja2luZyBhZ2FpbnN0IGBoYXNQcm9wZXJ0eWAsIHdoaWNoIGFsd2F5cyByZXR1cm5zIGBmYWxzZWAgaWZcbiAgICAgICAgICAgKiBgY29udGV4dC52aWV3YCBpcyBub3QgYW4gb2JqZWN0LiBEZWxpYmVyYXRlbHkgb21pdHRpbmcgdGhlIGNoZWNrXG4gICAgICAgICAgICogYWdhaW5zdCBgcHJpbWl0aXZlSGFzT3duUHJvcGVydHlgIGlmIGRvdCBub3RhdGlvbiBpcyBub3QgdXNlZC5cbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIENvbnNpZGVyIHRoaXMgZXhhbXBsZTpcbiAgICAgICAgICAgKiBgYGBcbiAgICAgICAgICAgKiBNdXN0YWNoZS5yZW5kZXIoXCJUaGUgbGVuZ3RoIG9mIGEgZm9vdGJhbGwgZmllbGQgaXMge3sjbGVuZ3RofX17e2xlbmd0aH19e3svbGVuZ3RofX0uXCIsIHtsZW5ndGg6IFwiMTAwIHlhcmRzXCJ9KVxuICAgICAgICAgICAqIGBgYFxuICAgICAgICAgICAqXG4gICAgICAgICAgICogSWYgd2Ugd2VyZSB0byBjaGVjayBhbHNvIGFnYWluc3QgYHByaW1pdGl2ZUhhc093blByb3BlcnR5YCwgYXMgd2UgZG9cbiAgICAgICAgICAgKiBpbiB0aGUgZG90IG5vdGF0aW9uIGNhc2UsIHRoZW4gcmVuZGVyIGNhbGwgd291bGQgcmV0dXJuOlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogXCJUaGUgbGVuZ3RoIG9mIGEgZm9vdGJhbGwgZmllbGQgaXMgOS5cIlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogcmF0aGVyIHRoYW4gdGhlIGV4cGVjdGVkOlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogXCJUaGUgbGVuZ3RoIG9mIGEgZm9vdGJhbGwgZmllbGQgaXMgMTAwIHlhcmRzLlwiXG4gICAgICAgICAgICoqL1xuICAgICAgICAgIGxvb2t1cEhpdCA9IGhhc1Byb3BlcnR5KGNvbnRleHQudmlldywgbmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9va3VwSGl0KSB7XG4gICAgICAgICAgdmFsdWUgPSBpbnRlcm1lZGlhdGVWYWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRleHQgPSBjb250ZXh0LnBhcmVudDtcbiAgICAgIH1cblxuICAgICAgY2FjaGVbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwodGhpcy52aWV3KTtcblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQSBXcml0ZXIga25vd3MgaG93IHRvIHRha2UgYSBzdHJlYW0gb2YgdG9rZW5zIGFuZCByZW5kZXIgdGhlbSB0byBhXG4gICAqIHN0cmluZywgZ2l2ZW4gYSBjb250ZXh0LiBJdCBhbHNvIG1haW50YWlucyBhIGNhY2hlIG9mIHRlbXBsYXRlcyB0b1xuICAgKiBhdm9pZCB0aGUgbmVlZCB0byBwYXJzZSB0aGUgc2FtZSB0ZW1wbGF0ZSB0d2ljZS5cbiAgICovXG4gIGZ1bmN0aW9uIFdyaXRlciAoKSB7XG4gICAgdGhpcy50ZW1wbGF0ZUNhY2hlID0ge1xuICAgICAgX2NhY2hlOiB7fSxcbiAgICAgIHNldDogZnVuY3Rpb24gc2V0IChrZXksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlW2tleV0gPSB2YWx1ZTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCAoa2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZVtrZXldO1xuICAgICAgfSxcbiAgICAgIGNsZWFyOiBmdW5jdGlvbiBjbGVhciAoKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlID0ge307XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhpcyB3cml0ZXIuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICBpZiAodHlwZW9mIHRoaXMudGVtcGxhdGVDYWNoZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMudGVtcGxhdGVDYWNoZS5jbGVhcigpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIGB0ZW1wbGF0ZWAgYWNjb3JkaW5nIHRvIHRoZSBnaXZlbiBgdGFnc2Agb3JcbiAgICogYG11c3RhY2hlLnRhZ3NgIGlmIGB0YWdzYCBpcyBvbWl0dGVkLCAgYW5kIHJldHVybnMgdGhlIGFycmF5IG9mIHRva2Vuc1xuICAgKiB0aGF0IGlzIGdlbmVyYXRlZCBmcm9tIHRoZSBwYXJzZS5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLnRlbXBsYXRlQ2FjaGU7XG4gICAgdmFyIGNhY2hlS2V5ID0gdGVtcGxhdGUgKyAnOicgKyAodGFncyB8fCBtdXN0YWNoZS50YWdzKS5qb2luKCc6Jyk7XG4gICAgdmFyIGlzQ2FjaGVFbmFibGVkID0gdHlwZW9mIGNhY2hlICE9PSAndW5kZWZpbmVkJztcbiAgICB2YXIgdG9rZW5zID0gaXNDYWNoZUVuYWJsZWQgPyBjYWNoZS5nZXQoY2FjaGVLZXkpIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKHRva2VucyA9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRva2VucyA9IHBhcnNlVGVtcGxhdGUodGVtcGxhdGUsIHRhZ3MpO1xuICAgICAgaXNDYWNoZUVuYWJsZWQgJiYgY2FjaGUuc2V0KGNhY2hlS2V5LCB0b2tlbnMpO1xuICAgIH1cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBIaWdoLWxldmVsIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHdpdGhcbiAgICogdGhlIGdpdmVuIGB2aWV3YC5cbiAgICpcbiAgICogVGhlIG9wdGlvbmFsIGBwYXJ0aWFsc2AgYXJndW1lbnQgbWF5IGJlIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgKiBuYW1lcyBhbmQgdGVtcGxhdGVzIG9mIHBhcnRpYWxzIHRoYXQgYXJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLiBJdCBtYXlcbiAgICogYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBsb2FkIHBhcnRpYWwgdGVtcGxhdGVzIG9uIHRoZSBmbHlcbiAgICogdGhhdCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudDogdGhlIG5hbWUgb2YgdGhlIHBhcnRpYWwuXG4gICAqXG4gICAqIElmIHRoZSBvcHRpb25hbCBgY29uZmlnYCBhcmd1bWVudCBpcyBnaXZlbiBoZXJlLCB0aGVuIGl0IHNob3VsZCBiZSBhblxuICAgKiBvYmplY3Qgd2l0aCBhIGB0YWdzYCBhdHRyaWJ1dGUgb3IgYW4gYGVzY2FwZWAgYXR0cmlidXRlIG9yIGJvdGguXG4gICAqIElmIGFuIGFycmF5IGlzIHBhc3NlZCwgdGhlbiBpdCB3aWxsIGJlIGludGVycHJldGVkIHRoZSBzYW1lIHdheSBhc1xuICAgKiBhIGB0YWdzYCBhdHRyaWJ1dGUgb24gYSBgY29uZmlnYCBvYmplY3QuXG4gICAqXG4gICAqIFRoZSBgdGFnc2AgYXR0cmlidXRlIG9mIGEgYGNvbmZpZ2Agb2JqZWN0IG11c3QgYmUgYW4gYXJyYXkgd2l0aCB0d29cbiAgICogc3RyaW5nIHZhbHVlczogdGhlIG9wZW5pbmcgYW5kIGNsb3NpbmcgdGFncyB1c2VkIGluIHRoZSB0ZW1wbGF0ZSAoZS5nLlxuICAgKiBbIFwiPCVcIiwgXCIlPlwiIF0pLiBUaGUgZGVmYXVsdCBpcyB0byBtdXN0YWNoZS50YWdzLlxuICAgKlxuICAgKiBUaGUgYGVzY2FwZWAgYXR0cmlidXRlIG9mIGEgYGNvbmZpZ2Agb2JqZWN0IG11c3QgYmUgYSBmdW5jdGlvbiB3aGljaFxuICAgKiBhY2NlcHRzIGEgc3RyaW5nIGFzIGlucHV0IGFuZCBvdXRwdXRzIGEgc2FmZWx5IGVzY2FwZWQgc3RyaW5nLlxuICAgKiBJZiBhbiBgZXNjYXBlYCBmdW5jdGlvbiBpcyBub3QgcHJvdmlkZWQsIHRoZW4gYW4gSFRNTC1zYWZlIHN0cmluZ1xuICAgKiBlc2NhcGluZyBmdW5jdGlvbiBpcyB1c2VkIGFzIHRoZSBkZWZhdWx0LlxuICAgKi9cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIgKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscywgY29uZmlnKSB7XG4gICAgdmFyIHRhZ3MgPSB0aGlzLmdldENvbmZpZ1RhZ3MoY29uZmlnKTtcbiAgICB2YXIgdG9rZW5zID0gdGhpcy5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gICAgdmFyIGNvbnRleHQgPSAodmlldyBpbnN0YW5jZW9mIENvbnRleHQpID8gdmlldyA6IG5ldyBDb250ZXh0KHZpZXcsIHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRva2VucywgY29udGV4dCwgcGFydGlhbHMsIHRlbXBsYXRlLCBjb25maWcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb3ctbGV2ZWwgbWV0aG9kIHRoYXQgcmVuZGVycyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgdXNpbmdcbiAgICogdGhlIGdpdmVuIGBjb250ZXh0YCBhbmQgYHBhcnRpYWxzYC5cbiAgICpcbiAgICogTm90ZTogVGhlIGBvcmlnaW5hbFRlbXBsYXRlYCBpcyBvbmx5IGV2ZXIgdXNlZCB0byBleHRyYWN0IHRoZSBwb3J0aW9uXG4gICAqIG9mIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSB0aGF0IHdhcyBjb250YWluZWQgaW4gYSBoaWdoZXItb3JkZXIgc2VjdGlvbi5cbiAgICogSWYgdGhlIHRlbXBsYXRlIGRvZXNuJ3QgdXNlIGhpZ2hlci1vcmRlciBzZWN0aW9ucywgdGhpcyBhcmd1bWVudCBtYXlcbiAgICogYmUgb21pdHRlZC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyVG9rZW5zID0gZnVuY3Rpb24gcmVuZGVyVG9rZW5zICh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpIHtcbiAgICB2YXIgYnVmZmVyID0gJyc7XG5cbiAgICB2YXIgdG9rZW4sIHN5bWJvbCwgdmFsdWU7XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgIHN5bWJvbCA9IHRva2VuWzBdO1xuXG4gICAgICBpZiAoc3ltYm9sID09PSAnIycpIHZhbHVlID0gdGhpcy5yZW5kZXJTZWN0aW9uKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ14nKSB2YWx1ZSA9IHRoaXMucmVuZGVySW52ZXJ0ZWQodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnPicpIHZhbHVlID0gdGhpcy5yZW5kZXJQYXJ0aWFsKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgY29uZmlnKTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJyYnKSB2YWx1ZSA9IHRoaXMudW5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnbmFtZScpIHZhbHVlID0gdGhpcy5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQsIGNvbmZpZyk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICd0ZXh0JykgdmFsdWUgPSB0aGlzLnJhd1ZhbHVlKHRva2VuKTtcblxuICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIGJ1ZmZlciArPSB2YWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyU2VjdGlvbiA9IGZ1bmN0aW9uIHJlbmRlclNlY3Rpb24gKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBidWZmZXIgPSAnJztcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcmVuZGVyIGFuIGFyYml0cmFyeSB0ZW1wbGF0ZVxuICAgIC8vIGluIHRoZSBjdXJyZW50IGNvbnRleHQgYnkgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLlxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlciAodGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBzZWxmLnJlbmRlcih0ZW1wbGF0ZSwgY29udGV4dCwgcGFydGlhbHMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuXG4gICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBmb3IgKHZhciBqID0gMCwgdmFsdWVMZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGogPCB2YWx1ZUxlbmd0aDsgKytqKSB7XG4gICAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlW2pdKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgYnVmZmVyICs9IHRoaXMucmVuZGVyVG9rZW5zKHRva2VuWzRdLCBjb250ZXh0LnB1c2godmFsdWUpLCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICBpZiAodHlwZW9mIG9yaWdpbmFsVGVtcGxhdGUgIT09ICdzdHJpbmcnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zIHdpdGhvdXQgdGhlIG9yaWdpbmFsIHRlbXBsYXRlJyk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHBvcnRpb24gb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgdGhlIHNlY3Rpb24gY29udGFpbnMuXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCBvcmlnaW5hbFRlbXBsYXRlLnNsaWNlKHRva2VuWzNdLCB0b2tlbls1XSksIHN1YlJlbmRlcik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJJbnZlcnRlZCA9IGZ1bmN0aW9uIHJlbmRlckludmVydGVkICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZykge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcblxuICAgIC8vIFVzZSBKYXZhU2NyaXB0J3MgZGVmaW5pdGlvbiBvZiBmYWxzeS4gSW5jbHVkZSBlbXB0eSBhcnJheXMuXG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8xODZcbiAgICBpZiAoIXZhbHVlIHx8IChpc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApKVxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRva2VuWzRdLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLmluZGVudFBhcnRpYWwgPSBmdW5jdGlvbiBpbmRlbnRQYXJ0aWFsIChwYXJ0aWFsLCBpbmRlbnRhdGlvbiwgbGluZUhhc05vblNwYWNlKSB7XG4gICAgdmFyIGZpbHRlcmVkSW5kZW50YXRpb24gPSBpbmRlbnRhdGlvbi5yZXBsYWNlKC9bXiBcXHRdL2csICcnKTtcbiAgICB2YXIgcGFydGlhbEJ5TmwgPSBwYXJ0aWFsLnNwbGl0KCdcXG4nKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRpYWxCeU5sLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocGFydGlhbEJ5TmxbaV0ubGVuZ3RoICYmIChpID4gMCB8fCAhbGluZUhhc05vblNwYWNlKSkge1xuICAgICAgICBwYXJ0aWFsQnlObFtpXSA9IGZpbHRlcmVkSW5kZW50YXRpb24gKyBwYXJ0aWFsQnlObFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhcnRpYWxCeU5sLmpvaW4oJ1xcbicpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyUGFydGlhbCA9IGZ1bmN0aW9uIHJlbmRlclBhcnRpYWwgKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgY29uZmlnKSB7XG4gICAgaWYgKCFwYXJ0aWFscykgcmV0dXJuO1xuICAgIHZhciB0YWdzID0gdGhpcy5nZXRDb25maWdUYWdzKGNvbmZpZyk7XG5cbiAgICB2YXIgdmFsdWUgPSBpc0Z1bmN0aW9uKHBhcnRpYWxzKSA/IHBhcnRpYWxzKHRva2VuWzFdKSA6IHBhcnRpYWxzW3Rva2VuWzFdXTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgdmFyIGxpbmVIYXNOb25TcGFjZSA9IHRva2VuWzZdO1xuICAgICAgdmFyIHRhZ0luZGV4ID0gdG9rZW5bNV07XG4gICAgICB2YXIgaW5kZW50YXRpb24gPSB0b2tlbls0XTtcbiAgICAgIHZhciBpbmRlbnRlZFZhbHVlID0gdmFsdWU7XG4gICAgICBpZiAodGFnSW5kZXggPT0gMCAmJiBpbmRlbnRhdGlvbikge1xuICAgICAgICBpbmRlbnRlZFZhbHVlID0gdGhpcy5pbmRlbnRQYXJ0aWFsKHZhbHVlLCBpbmRlbnRhdGlvbiwgbGluZUhhc05vblNwYWNlKTtcbiAgICAgIH1cbiAgICAgIHZhciB0b2tlbnMgPSB0aGlzLnBhcnNlKGluZGVudGVkVmFsdWUsIHRhZ3MpO1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRva2VucywgY29udGV4dCwgcGFydGlhbHMsIGluZGVudGVkVmFsdWUsIGNvbmZpZyk7XG4gICAgfVxuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUudW5lc2NhcGVkVmFsdWUgPSBmdW5jdGlvbiB1bmVzY2FwZWRWYWx1ZSAodG9rZW4sIGNvbnRleHQpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpXG4gICAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5lc2NhcGVkVmFsdWUgPSBmdW5jdGlvbiBlc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0LCBjb25maWcpIHtcbiAgICB2YXIgZXNjYXBlID0gdGhpcy5nZXRDb25maWdFc2NhcGUoY29uZmlnKSB8fCBtdXN0YWNoZS5lc2NhcGU7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGVzY2FwZSA9PT0gbXVzdGFjaGUuZXNjYXBlKSA/IFN0cmluZyh2YWx1ZSkgOiBlc2NhcGUodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmF3VmFsdWUgPSBmdW5jdGlvbiByYXdWYWx1ZSAodG9rZW4pIHtcbiAgICByZXR1cm4gdG9rZW5bMV07XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5nZXRDb25maWdUYWdzID0gZnVuY3Rpb24gZ2V0Q29uZmlnVGFncyAoY29uZmlnKSB7XG4gICAgaWYgKGlzQXJyYXkoY29uZmlnKSkge1xuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG4gICAgZWxzZSBpZiAoY29uZmlnICYmIHR5cGVvZiBjb25maWcgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gY29uZmlnLnRhZ3M7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5nZXRDb25maWdFc2NhcGUgPSBmdW5jdGlvbiBnZXRDb25maWdFc2NhcGUgKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgdHlwZW9mIGNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIWlzQXJyYXkoY29uZmlnKSkge1xuICAgICAgcmV0dXJuIGNvbmZpZy5lc2NhcGU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gIH07XG5cbiAgdmFyIG11c3RhY2hlID0ge1xuICAgIG5hbWU6ICdtdXN0YWNoZS5qcycsXG4gICAgdmVyc2lvbjogJzQuMi4wJyxcbiAgICB0YWdzOiBbICd7eycsICd9fScgXSxcbiAgICBjbGVhckNhY2hlOiB1bmRlZmluZWQsXG4gICAgZXNjYXBlOiB1bmRlZmluZWQsXG4gICAgcGFyc2U6IHVuZGVmaW5lZCxcbiAgICByZW5kZXI6IHVuZGVmaW5lZCxcbiAgICBTY2FubmVyOiB1bmRlZmluZWQsXG4gICAgQ29udGV4dDogdW5kZWZpbmVkLFxuICAgIFdyaXRlcjogdW5kZWZpbmVkLFxuICAgIC8qKlxuICAgICAqIEFsbG93cyBhIHVzZXIgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgY2FjaGluZyBzdHJhdGVneSwgYnkgcHJvdmlkaW5nIGFuXG4gICAgICogb2JqZWN0IHdpdGggc2V0LCBnZXQgYW5kIGNsZWFyIG1ldGhvZHMuIFRoaXMgY2FuIGFsc28gYmUgdXNlZCB0byBkaXNhYmxlXG4gICAgICogdGhlIGNhY2hlIGJ5IHNldHRpbmcgaXQgdG8gdGhlIGxpdGVyYWwgYHVuZGVmaW5lZGAuXG4gICAgICovXG4gICAgc2V0IHRlbXBsYXRlQ2FjaGUgKGNhY2hlKSB7XG4gICAgICBkZWZhdWx0V3JpdGVyLnRlbXBsYXRlQ2FjaGUgPSBjYWNoZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGRlZmF1bHQgb3Igb3ZlcnJpZGRlbiBjYWNoaW5nIG9iamVjdCBmcm9tIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICAgKi9cbiAgICBnZXQgdGVtcGxhdGVDYWNoZSAoKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdFdyaXRlci50ZW1wbGF0ZUNhY2hlO1xuICAgIH1cbiAgfTtcblxuICAvLyBBbGwgaGlnaC1sZXZlbCBtdXN0YWNoZS4qIGZ1bmN0aW9ucyB1c2UgdGhpcyB3cml0ZXIuXG4gIHZhciBkZWZhdWx0V3JpdGVyID0gbmV3IFdyaXRlcigpO1xuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgbXVzdGFjaGUuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uIGNsZWFyQ2FjaGUgKCkge1xuICAgIHJldHVybiBkZWZhdWx0V3JpdGVyLmNsZWFyQ2FjaGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIHRlbXBsYXRlIGluIHRoZSBkZWZhdWx0IHdyaXRlciBhbmQgcmV0dXJucyB0aGVcbiAgICogYXJyYXkgb2YgdG9rZW5zIGl0IGNvbnRhaW5zLiBEb2luZyB0aGlzIGFoZWFkIG9mIHRpbWUgYXZvaWRzIHRoZSBuZWVkIHRvXG4gICAqIHBhcnNlIHRlbXBsYXRlcyBvbiB0aGUgZmx5IGFzIHRoZXkgYXJlIHJlbmRlcmVkLlxuICAgKi9cbiAgbXVzdGFjaGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbmRlcnMgdGhlIGB0ZW1wbGF0ZWAgd2l0aCB0aGUgZ2l2ZW4gYHZpZXdgLCBgcGFydGlhbHNgLCBhbmQgYGNvbmZpZ2BcbiAgICogdXNpbmcgdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgbXVzdGFjaGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMsIGNvbmZpZykge1xuICAgIGlmICh0eXBlb2YgdGVtcGxhdGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHRlbXBsYXRlISBUZW1wbGF0ZSBzaG91bGQgYmUgYSBcInN0cmluZ1wiICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnYnV0IFwiJyArIHR5cGVTdHIodGVtcGxhdGUpICsgJ1wiIHdhcyBnaXZlbiBhcyB0aGUgZmlyc3QgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdhcmd1bWVudCBmb3IgbXVzdGFjaGUjcmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyknKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5yZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzLCBjb25maWcpO1xuICB9O1xuXG4gIC8vIEV4cG9ydCB0aGUgZXNjYXBpbmcgZnVuY3Rpb24gc28gdGhhdCB0aGUgdXNlciBtYXkgb3ZlcnJpZGUgaXQuXG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMjQ0XG4gIG11c3RhY2hlLmVzY2FwZSA9IGVzY2FwZUh0bWw7XG5cbiAgLy8gRXhwb3J0IHRoZXNlIG1haW5seSBmb3IgdGVzdGluZywgYnV0IGFsc28gZm9yIGFkdmFuY2VkIHVzYWdlLlxuICBtdXN0YWNoZS5TY2FubmVyID0gU2Nhbm5lcjtcbiAgbXVzdGFjaGUuQ29udGV4dCA9IENvbnRleHQ7XG4gIG11c3RhY2hlLldyaXRlciA9IFdyaXRlcjtcblxuICByZXR1cm4gbXVzdGFjaGU7XG5cbn0pKSk7XG4iXX0=

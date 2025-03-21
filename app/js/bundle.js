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
const CONFIG = {
    CACHE_NAME: 'sst-cache-v32',
    API_ENDPOINTS: {
        PRODUCTS: 'https://sst.tamlite.co.uk/api/get_all_products_neat',
        USER_DATA: 'https://sst.tamlite.co.uk/api/get_all_user_data',
        SYNC_USER_DATA: 'https://sst.tamlite.co.uk/api/sync_user_data',
        USERS: 'https://sst.tamlite.co.uk/api/get_all_users_neat',
        LAST_PUSHED: 'https://sst.tamlite.co.uk/api/get_last_pushed',
        SYNC_USER_ACCOUNT: 'https://sst.tamlite.co.uk/api/update_user_account'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else if (typeof self !== 'undefined') {
    self.CONFIG = CONFIG;
}
},{}],3:[function(require,module,exports){
const { openDB } = require('idb');
const utils = require('./modules/utils');
const CONFIG = require('./config');


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
            const response = await fetch(CONFIG.API_ENDPOINTS.PRODUCTS);

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
            const response = await fetch(CONFIG.API_ENDPOINTS.USERS);

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
        const response = await fetch(CONFIG.API_ENDPOINTS.LAST_PUSHED, {
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
        const response = await fetch(CONFIG.API_ENDPOINTS.USER_DATA, {
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
            // also update just this user record from data.users to the users table where data.id = users.uuid
            // this will update the user record with the latest data from the server
            const user = data.users[0];
            user.uuid = data.users[0].id;            
            const tx = db.transaction("users", "readwrite");
            const store = tx.objectStore("users");
            store.put(user);
            tx.done;

            UIkit.notification({message: 'Data Fetch Complete ...', status: 'success', pos: 'bottom-center', timeout: 1500 });            
            console.log("Data synced to IndexedDB successfully.");
            setTimeout(() => {
                window.location.reload();
            }, 1500);            

            return(true);            
        }
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

    // this has also got to save to online db at this time actually, 
    const response = await fetch(CONFIG.API_ENDPOINTS.SYNC_USER_ACCOUNT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    // console.log('Response Data:', responseData);
    // console.log('Status:', responseData.status);  // error | success
    return(responseData);  
    return user;    
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

       
    const response = await fetch(CONFIG.API_ENDPOINTS.SYNC_USER_DATA, {
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

},{"./config":2,"./modules/utils":7,"idb":10}],4:[function(require,module,exports){
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
        // if offline show message
        if (!navigator.onLine) {
            UIkit.notification({message: 'You are offline. Please connect to the internet and try again.', status: 'warning', pos: 'bottom-center', timeout: 2000 });
            return;
        }

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
            this.checkLogin();
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
        // if offline show message
        if (!navigator.onLine) {
            UIkit.notification({message: 'You are offline. Please connect to the internet and try again.', status: 'warning', pos: 'bottom-center', timeout: 2000 });
            return;
        }

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
const sst = require('./sst');
const utils = require('./modules/utils');
const CONFIG = require('./config');

async function loadTemplate(path) {
    try {
        const response = await fetch(`/views/${path}.html`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.text();
    } catch (error) {
        console.warn('Fetching from cache:', error);
        const cache = await caches.open(CONFIG.CACHE_NAME); // Use CONFIG.CACHE_NAME in your cache operations
        
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

},{"./config":2,"./modules/utils":7,"./sst":9,"mustache":11}],9:[function(require,module,exports){
const Mustache = require('mustache');
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


    // if offline, prevent this happening - disable the button
    if (!navigator.onLine) {
        $('#btn_push_user_data').prop("disabled", true);
    }    
    $('#btn_clear_local_storage').off('click').on('click', async function(e) {
        e.preventDefault();
        await utils.clearServiceWorkerCache();
    });    

    // if offline, disable the logout button
    if (!navigator.onLine) {
        $('#btn_logout').prop("disabled", true);
    }    
    $('#btn_logout').off('click').on('click', async function(e) {
        e.preventDefault();
        await utils.logout();
    });      

    if (!navigator.onLine) {
        $('#form-update-account').prop("disabled", true);
    } 

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

},{"./db":3,"./modules/sidebar":4,"./modules/sync":5,"./modules/tables":6,"./modules/utils":7,"mustache":11}],10:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvanMvYXBwLmpzIiwiYXBwL2pzL2NvbmZpZy5qcyIsImFwcC9qcy9kYi5qcyIsImFwcC9qcy9tb2R1bGVzL3NpZGViYXIuanMiLCJhcHAvanMvbW9kdWxlcy9zeW5jLmpzIiwiYXBwL2pzL21vZHVsZXMvdGFibGVzLmpzIiwiYXBwL2pzL21vZHVsZXMvdXRpbHMuanMiLCJhcHAvanMvcm91dGVyLmpzIiwiYXBwL2pzL3NzdC5qcyIsIm5vZGVfbW9kdWxlcy9pZGIvYnVpbGQvaW5kZXguY2pzIiwibm9kZV9tb2R1bGVzL211c3RhY2hlL211c3RhY2hlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzM4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3o1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImxldCByZWdpc3RyYXRpb247XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZWdpc3RlclNlcnZpY2VXb3JrZXIoKSB7XHJcbiAgICBpZiAoJ3NlcnZpY2VXb3JrZXInIGluIG5hdmlnYXRvcikge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbiA9IGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcvc3cuanMnKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlcnZpY2VXb3JrZXIgcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWwnKTtcclxuICAgICAgICAgICAgY2hlY2tGb3JVcGRhdGVzKCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQ6JywgZXJyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIFBlcmlvZGljIHVwZGF0ZSBjaGVja2VyXHJcbmZ1bmN0aW9uIGNoZWNrRm9yVXBkYXRlcygpIHtcclxuICAgIC8vIENoZWNrIGltbWVkaWF0ZWx5IG9uIHBhZ2UgbG9hZFxyXG4gICAgaWYgKHJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgIHJlZ2lzdHJhdGlvbi51cGRhdGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBUaGVuIGNoZWNrIGV2ZXJ5IDMwIG1pbnV0ZXNcclxuICAgIHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICBpZiAocmVnaXN0cmF0aW9uKSB7XHJcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi51cGRhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9LCAzMCAqIDYwICogMTAwMCk7XHJcbn1cclxuXHJcbi8vIFN0b3JlIHVwZGF0ZSBzdGF0ZSBpbiBsb2NhbFN0b3JhZ2VcclxuZnVuY3Rpb24gc2V0VXBkYXRlQXZhaWxhYmxlKHZhbHVlKSB7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndXBkYXRlQXZhaWxhYmxlJywgdmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc1VwZGF0ZUF2YWlsYWJsZSgpIHtcclxuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndXBkYXRlQXZhaWxhYmxlJykgPT09ICd0cnVlJztcclxufVxyXG5cclxuLy8gTW9kaWZpZWQgc2hvd1VwZGF0ZUJhciBmdW5jdGlvblxyXG5mdW5jdGlvbiBzaG93VXBkYXRlQmFyKCkge1xyXG4gICAgLy8gT25seSBzaG93IGlmIHdlIGhhdmVuJ3QgYWxyZWFkeSBzaG93biBpdFxyXG4gICAgaWYgKCFpc1VwZGF0ZUF2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgc2V0VXBkYXRlQXZhaWxhYmxlKHRydWUpO1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZU5vdGlmaWNhdGlvbiA9IFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdBIG5ldyB2ZXJzaW9uIGlzIGF2YWlsYWJsZS48YnI+Q2xpY2sgaGVyZSB0byB1cGRhdGUuJyxcclxuICAgICAgICAgICAgc3RhdHVzOiAncHJpbWFyeScsXHJcbiAgICAgICAgICAgIHBvczogJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiAwLFxyXG4gICAgICAgICAgICBvbmNsaWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVOb3RpZmljYXRpb24uY2xvc2UoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgbG9hZGluZ05vdGlmaWNhdGlvbiA9IFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VwZGF0aW5nLi4uJyxcclxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICd3YXJuaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbj8ud2FpdGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi53YWl0aW5nLnBvc3RNZXNzYWdlKCdza2lwV2FpdGluZycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIENoZWNrIGZvciBzdG9yZWQgdXBkYXRlIHN0YXRlIG9uIHBhZ2UgbG9hZFxyXG5mdW5jdGlvbiBjaGVja1N0b3JlZFVwZGF0ZVN0YXRlKCkge1xyXG4gICAgaWYgKGlzVXBkYXRlQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICBzaG93VXBkYXRlQmFyKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIEluaXRpYWxpemVcclxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XHJcbiAgICBjb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbiAgICBjb25zdCBkYiA9IHJlcXVpcmUoJy4vZGInKTsgLy8gSW1wb3J0IHRoZSBkYiBtb2R1bGUgICAgXHJcbiAgICBjb25zdCBzc3QgPSByZXF1aXJlKCcuL3NzdCcpOyAvLyBJbXBvcnQgdGhlIGRiIG1vZHVsZVxyXG4gICAgY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21vZHVsZXMvdXRpbHMnKTtcclxuICAgICAgICBcclxuICAgIGNvbnNvbGUubG9nKFwiTW91bnRlZCBBcHAuLi5cIik7XHJcbiAgICAvL2NvbnN0IHVzZXJfaWQgPSB1dGlscy5nZXRVc2VySUQoKTtcclxuXHJcbiAgICAkKCdhW2hyZWZePVwiL1wiXScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cignaHJlZicpLnN1YnN0cmluZygxKTsgICAgICAgIFxyXG4gICAgICAgIHdpbmRvdy5yb3V0ZXIocGF0aCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmVnaXN0ZXJTZXJ2aWNlV29ya2VyKCk7XHJcbiAgICBjaGVja1N0b3JlZFVwZGF0ZVN0YXRlKCk7XHJcblxyXG4gICAgLy8gQ2xlYXIgdXBkYXRlIGZsYWcgYWZ0ZXIgc3VjY2Vzc2Z1bCB1cGRhdGVcclxuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCAoKSA9PiB7XHJcbiAgICAgICAgc2V0VXBkYXRlQXZhaWxhYmxlKGZhbHNlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExpc3RlbiBmb3IgdXBkYXRlIGV2ZW50c1xyXG4gICAgaWYgKHJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgIHJlZ2lzdHJhdGlvbi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVmb3VuZCcsICgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbmV3V29ya2VyID0gcmVnaXN0cmF0aW9uLmluc3RhbGxpbmc7XHJcbiAgICAgICAgICAgIG5ld1dvcmtlci5hZGRFdmVudExpc3RlbmVyKCdzdGF0ZWNoYW5nZScsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChuZXdXb3JrZXIuc3RhdGUgPT09ICdpbnN0YWxsZWQnICYmIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBzaG93VXBkYXRlQmFyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBvbmxpbmUvb2ZmbGluZSBzdGF0dXNcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvbmxpbmUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKCdBcHAgaXMgb25saW5lJyk7XHJcbiAgICAgICAgZGIuZmV0Y2hBbmRTdG9yZVByb2R1Y3RzKCk7XHJcbiAgICAgICAgLy9kYi5mZXRjaEFuZFN0b3JlVXNlcnMoKTtcclxuICAgICAgICAvL2RiLnN5bmNEYXRhKHV0aWxzLmdldFVzZXJJRCgpKTtcclxuXHJcbiAgICAgICAgJCgnI2J0bl91cGRhdGVfYWNjb3VudCcpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgJCgnI2J0bl9wdXNoX3VzZXJfZGF0YScpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgJCgnI2J0bl9wdWxsX3VzZXJfZGF0YScpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgJCgnI2J0bl9jbGVhcl9sb2NhbF9zdG9yYWdlJykucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKTtcclxuICAgICAgICAkKCcjYnRuX2xvZ291dCcpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgJCgnI2J0bl9sb2dvdXQnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICQoJy5zeW5jaWNvbicpLmNzcyh7J29wYWNpdHknOiAnMTAwJSd9KTtcclxuXHJcbiAgICB9KTtcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb2ZmbGluZScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdBcHAgaXMgb2ZmbGluZSAtIHVzaW5nIGNhY2hlZCBkYXRhJyk7XHJcbiAgICAgICAgJCgnI2J0bl91cGRhdGVfYWNjb3VudCcpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICAgICAkKCcjYnRuX3B1c2hfdXNlcl9kYXRhJykucHJvcChcImRpc2FibGVkXCIsIHRydWUpO1xyXG4gICAgICAgICQoJyNidG5fcHVsbF91c2VyX2RhdGEnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgJCgnI2J0bl9jbGVhcl9sb2NhbF9zdG9yYWdlJykucHJvcChcImRpc2FibGVkXCIsIHRydWUpOyAgICAgICAgXHJcbiAgICAgICAgJCgnI2J0bl9sb2dvdXQnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgJCgnI2J0bl9sb2dvdXQnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgJCgnLnN5bmNpY29uJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpLmNzcyh7J29wYWNpdHknOiAnMjAlJ30pO1xyXG5cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEluaXRpYWxpemUgYXBwXHJcbiAgICBhc3luYyBmdW5jdGlvbiBpbml0QXBwKCkge1xyXG4gICAgICAgIGF3YWl0IGRiLmluaXREQigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChuYXZpZ2F0b3Iub25MaW5lKSB7ICAgIFxyXG4gICAgICAgICAgICBhd2FpdCBkYi5mZXRjaEFuZFN0b3JlUHJvZHVjdHMoKTsgXHJcbiAgICAgICAgICAgIGF3YWl0IGRiLmZldGNoQW5kU3RvcmVVc2VycygpO1xyXG4gICAgICAgICAgICAvL2F3YWl0IGRiLnN5bmNEYXRhKGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEdldCBjdXJyZW50IHBhdGggYW5kIHJvdXRlXHJcbiAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lXHJcbiAgICAgICAgICAgIC5zcGxpdCgnLycpXHJcbiAgICAgICAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0Lmxlbmd0aCA+IDApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHByb2plY3RJZCA9IHBhdGhQYXJ0c1sxXSB8fCAnJztcclxuICAgICAgICB3aW5kb3cucm91dGVyKHBhdGhQYXJ0c1swXSB8fCAnaG9tZScsIHByb2plY3RJZCk7XHJcblxyXG4gICAgICAgIC8vIFNldCB0aGUgcHJvamVjdCBpZCBpbiB0aGUgaGlkZGVuIGlucHV0XHJcbiAgICAgICAgaWYgKHByb2plY3RJZCkge1xyXG4gICAgICAgICAgICAkKCcjbV9wcm9qZWN0X2lkJykudmFsKHByb2plY3RJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBpbml0QXBwKCk7XHJcbn0pO1xyXG5cclxuLy8gSGFuZGxlIHJlbG9hZCBhZnRlciB1cGRhdGVcclxubGV0IHJlZnJlc2hpbmcgPSBmYWxzZTtcclxubmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignY29udHJvbGxlcmNoYW5nZScsICgpID0+IHtcclxuICAgIGlmICghcmVmcmVzaGluZykge1xyXG4gICAgICAgIHJlZnJlc2hpbmcgPSB0cnVlO1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgIH1cclxufSk7IiwiY29uc3QgQ09ORklHID0ge1xyXG4gICAgQ0FDSEVfTkFNRTogJ3NzdC1jYWNoZS12MzInLFxyXG4gICAgQVBJX0VORFBPSU5UUzoge1xyXG4gICAgICAgIFBST0RVQ1RTOiAnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2FsbF9wcm9kdWN0c19uZWF0JyxcclxuICAgICAgICBVU0VSX0RBVEE6ICdodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9nZXRfYWxsX3VzZXJfZGF0YScsXHJcbiAgICAgICAgU1lOQ19VU0VSX0RBVEE6ICdodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9zeW5jX3VzZXJfZGF0YScsXHJcbiAgICAgICAgVVNFUlM6ICdodHRwczovL3NzdC50YW1saXRlLmNvLnVrL2FwaS9nZXRfYWxsX3VzZXJzX25lYXQnLFxyXG4gICAgICAgIExBU1RfUFVTSEVEOiAnaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvZ2V0X2xhc3RfcHVzaGVkJyxcclxuICAgICAgICBTWU5DX1VTRVJfQUNDT1VOVDogJ2h0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvYXBpL3VwZGF0ZV91c2VyX2FjY291bnQnXHJcbiAgICB9XHJcbn07XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcclxuICAgIG1vZHVsZS5leHBvcnRzID0gQ09ORklHO1xyXG59IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgc2VsZi5DT05GSUcgPSBDT05GSUc7XHJcbn0iLCJjb25zdCB7IG9wZW5EQiB9ID0gcmVxdWlyZSgnaWRiJyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3V0aWxzJyk7XHJcbmNvbnN0IENPTkZJRyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XHJcblxyXG5cclxuY29uc3QgREJfTkFNRSA9ICdzc3RfZGF0YWJhc2UnO1xyXG5jb25zdCBEQl9WRVJTSU9OID0gMTg7XHJcbmNvbnN0IFNUT1JFX05BTUUgPSAncHJvZHVjdF9kYXRhJztcclxuXHJcbi8vIEN1c3RvbSBmdW5jdGlvbiB0byBnZW5lcmF0ZSBVVUlEc1xyXG5mdW5jdGlvbiBnZW5lcmF0ZVVVSUQoKSB7XHJcbiAgICByZXR1cm4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbihjKSB7XHJcbiAgICAgICAgY29uc3QgciA9IE1hdGgucmFuZG9tKCkgKiAxNiB8IDAsIHYgPSBjID09ICd4JyA/IHIgOiAociAmIDB4MyB8IDB4OCk7XHJcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBpbml0REIoKSB7ICAgIFxyXG4gICAgcmV0dXJuIGF3YWl0IG9wZW5EQihEQl9OQU1FLCBEQl9WRVJTSU9OLCB7XHJcbiAgICAgICAgdXBncmFkZShkYikge1xyXG4gICAgICAgICAgICAvLyBDaGVjayBhbmQgY3JlYXRlIGV4aXN0aW5nIHN0b3JlIGZvciBwcm9kdWN0c1xyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoU1RPUkVfTkFNRSkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBvYmplY3Qgc3RvcmUgZm9yIHByb2R1Y3RzLi4uJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFNUT1JFX05BTUUsIHsga2V5UGF0aDogJ3Byb2R1Y3RfY29kZScgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnc2l0ZScsICdzaXRlJywgeyB1bmlxdWU6IGZhbHNlIH0pOyAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJwcm9qZWN0c1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcInByb2plY3RzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwibG9jYXRpb25zXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcInByb2plY3RfaWRfZmtcIiwgXCJwcm9qZWN0X2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJidWlsZGluZ3NcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwibG9jYXRpb25faWRfZmtcIiwgXCJsb2NhdGlvbl9pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwiZmxvb3JzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwiZmxvb3JzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcImJ1aWxkaW5nX2lkX2ZrXCIsIFwiYnVpbGRpbmdfaWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pOyBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJyb29tc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcInJvb21zXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcImZsb29yX2lkX2ZrXCIsIFwiZmxvb3JfaWRfZmtcIiwgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pOyBcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdyb29tX2lkX2ZrJywgJ3Jvb21faWRfZmsnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwicHJvZHVjdHNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJyb29tX2lkX2ZrXCIsIFwicm9vbV9pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwiZmF2b3VyaXRlc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcImZhdm91cml0ZXNcIiwgeyBrZXlQYXRoOiBcInV1aWRcIiB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KFwic2t1X293bmVyXCIsIFtcInNrdVwiLCBcIm93bmVyX2lkXCJdLCB7IHVuaXF1ZTogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTsgXHJcbiAgICAgICAgICAgIH0gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwibm90ZXNcIikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJub3Rlc1wiLCB7IGtleVBhdGg6IFwidXVpZFwiIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoXCJyb29tX2lkX2ZrXCIsIFwicm9vbV9pZF9ma1wiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleCgnb3duZXJfaWQnLCAnb3duZXJfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgICAgIH0gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFwiaW1hZ2VzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwiaW1hZ2VzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5jcmVhdGVJbmRleChcInJvb21faWRfZmtcIiwgXCJyb29tX2lkX2ZrXCIsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLmNyZWF0ZUluZGV4KCdvd25lcl9pZCcsICdvd25lcl9pZCcsIHsgdW5pcXVlOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfSAgIFxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoXCJ1c2Vyc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZShcInVzZXJzXCIsIHsga2V5UGF0aDogXCJ1dWlkXCIgfSk7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ2VtYWlsJywgJ2VtYWlsJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuY3JlYXRlSW5kZXgoJ293bmVyX2lkJywgJ293bmVyX2lkJywgeyB1bmlxdWU6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICB9ICAgICAgICAgICAgXHJcblxyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJJbmRleGVkREIgaW5pdGlhbGl6ZWQgd2l0aCBVVUlEcyBhbmQgb3duZXJfaWQgaW5kZXhlcy5cIik7XHJcbiAgICAgICAgfSxcclxuICAgIH0pO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBmZXRjaEFuZFN0b3JlUHJvZHVjdHMoKSB7XHJcbiAgICBjb25zdCBpc0VtcHR5ID0gYXdhaXQgaXNQcm9kdWN0c1RhYmxlRW1wdHkoKTtcclxuICAgIGlmIChpc0VtcHR5KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIHByb2R1Y3RzIGZyb20gQVBJLi4uJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goQ09ORklHLkFQSV9FTkRQT0lOVFMuUFJPRFVDVFMpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQIGVycm9yISBTdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcclxuICAgICAgICAgICAgYXdhaXQgc2F2ZVByb2R1Y3RzKHByb2R1Y3RzKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Byb2R1Y3RzIGZldGNoZWQgYW5kIHNhdmVkIHRvIEluZGV4ZWREQicpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIHByb2R1Y3QgZGF0YTonLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnUHJvZHVjdCBkYXRhIGlzIHByZXNlbnQgaW4gaW5kZXhlZERCLCBza2lwcGluZyBmZXRjaC4nKTtcclxuICAgIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hBbmRTdG9yZVVzZXJzKCkge1xyXG4gICAgY29uc3QgaXNFbXB0eSA9IGF3YWl0IGlzVXNlcnNUYWJsZUVtcHR5KCk7XHJcbiAgICBpZiAoaXNFbXB0eSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBwcm9kdWN0cyBmcm9tIEFQSS4uLicpO1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKENPTkZJRy5BUElfRU5EUE9JTlRTLlVTRVJTKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCBlcnJvciEgU3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgdXNlcnMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHNhdmVVc2Vycyh1c2Vycyk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQXV0aCBzYXZlZCB0byBJbmRleGVkREInKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBhdXRoIGRhdGE6JywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0F1dGggZGF0YSBpcyBwcmVzZW50IGluIGluZGV4ZWREQiwgc2tpcHBpbmcgZmV0Y2guJyk7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBwdWxsVXNlckRhdGEob3duZXJfaWQpIHtcclxuICAgIGlmICghb3duZXJfaWQpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBvd25lcl9pZCBwcm92aWRlZCBmb3IgZGF0YSBzeW5jJyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSAgICBcclxuICAgIG93bmVyX2lkID0gb3duZXJfaWQrXCJcIjsgLy8gZW5zdXJlIGl0J3MgYSBzdHJpbmdcclxuICAgIGNvbnN0IHVzZXJEYXRhID0ge1widXNlcl9pZFwiOiBvd25lcl9pZH07IC8vIFVzZSB0aGUgb3duZXJfaWQgdmFyaWFibGVcclxuXHJcbiAgICAvLyB1c2VyIGhhcyBwcm9qZWN0cywgb2ZmZXIgdG8gcHVsbCBmcm9tIGFuZCBzaG93IHRoZSBwdXNoZWQgZGF0ZSBvbiB0aGUgdXNlciB0YWJsZSBmb3IgaW5mb3JtYXRpb25cclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChDT05GSUcuQVBJX0VORFBPSU5UUy5MQVNUX1BVU0hFRCwge1xyXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXHJcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZXJEYXRhKVxyXG4gICAgICAgIH0pOyAgICBcclxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7IHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gKTsgfVxyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7IFxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwicHVzaGVkOiBcIiwgZGF0YS5wdXNoZWQpOyBcclxuICAgICAgICBjb25zdCBsYXN0UHVzaGVkID0gbmV3IERhdGUoZGF0YS5wdXNoZWQpO1xyXG4gICAgICAgIGNvbnN0IGxhc3RQdXNoZWRTdHIgPSBsYXN0UHVzaGVkLnRvTG9jYWxlU3RyaW5nKCk7XHJcbiAgICAgICAgY29uc3QgbGFzdFB1c2hlZEVwb2NoID0gbGFzdFB1c2hlZC5nZXRUaW1lKCk7XHJcbiAgICAgICAgY29uc3QgbGFzdFB1c2hlZEVwb2NoU3RyID0gbGFzdFB1c2hlZEVwb2NoLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgLy8gb2ZmZXIgYSB1aWtpdCBjb25maXJtIGRpYWxvZyB0byBwdWxsbCBkYXRhLCBzaG93aW5nIHRoZSBsYXN0IHB1c2hlZCBkYXRlIGFuZCB0aW1lXHJcbiAgICAgICAgY29uc3Qgc3RyID0gYDxoND5Zb3VyIGxhc3QgcHVzaCB0byB0aGUgc2VydmVyIHdhcyA8YnI+PGI+JHtsYXN0UHVzaGVkU3RyfTwvYj48L2g0PiA8cD5Xb3VsZCB5b3UgbGlrZSB0byBwdWxsIHRoaXMgZGF0YT88L3A+YFxyXG4gICAgICAgICtgPHAgc3R5bGU9XCJjb2xvcjogcmVkOyBmb250LXdlaWdodDogYm9sZFwiPjxzbWFsbD5DbGlja2luZyBPSyB3aWxsIG92ZXJ3cml0ZSBhbnkgbG9jYWwgY2hhbmdlcyBzaW5jZSB0aGlzIGRhdGUuPC9zbWFsbD5gO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0oc3RyKS50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ29uZmlybWVkLicpXHJcbiAgICAgICAgICAgIHN5bmNEYXRhKG93bmVyX2lkLCB0cnVlKTsgICAgICBcclxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZWplY3RlZC4nKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICB9IGNhdGNoIChlcnJvcikgeyBjb25zb2xlLmVycm9yKFwiRGF0YSBzeW5jIGZhaWxlZDpcIiwgZXJyb3IpOyB9ICAgICAgICBcclxuICAgICAgICBcclxuICAgIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc3luY0RhdGEob3duZXJfaWQsIGZvcmNlID0gZmFsc2UpIHtcclxuICAgIGlmICghb3duZXJfaWQpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBvd25lcl9pZCBwcm92aWRlZCBmb3IgZGF0YSBzeW5jJyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSAgICBcclxuICAgIG93bmVyX2lkID0gb3duZXJfaWQrXCJcIjsgLy8gZW5zdXJlIGl0J3MgYSBzdHJpbmdcclxuICAgIGNvbnN0IHVzZXJEYXRhID0ge1widXNlcl9pZFwiOiBvd25lcl9pZH07IC8vIFVzZSB0aGUgb3duZXJfaWQgdmFyaWFibGVcclxuXHJcbiAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnV29udCBzeW5jIGFzIG9mZmxpbmUnKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICAvL2NvbnN0IGlzRW1wdHkgPSBhd2FpdCBpc0RhdGFiYXNlRW1wdHkoKTsgIC8vIG5haCBJIHRoaW5rIHdlJ2xsIGdyYWIgSlVTVCB0aGUgdXNlciBkYXRhIElGIHRoZWVyIGlzIG5vbmUgYWxyZWFkeVxyXG4gICAgY29uc3QgaGFzUHJvamVjdHMgPSBhd2FpdCBnZXRQcm9qZWN0cyhvd25lcl9pZCk7ICAgIFxyXG5cclxuICAgIC8vIHVzZXIgaGFzIHByb2plY3RzLCBvZmZlciB0byBwdWxsIGZyb20gYW5kIHNob3cgdGhlIHB1c2hlZCBkYXRlIG9uIHRoZSB1c2VyIHRhYmxlIGZvciBpbmZvcm1hdGlvblxyXG4gICAgaWYgKGhhc1Byb2plY3RzLmxlbmd0aCA+IDAgJiYgIWZvcmNlKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0xvY2FsIFByb2plY3RzIGV4aXN0LiBOb3QgZm9yY2luZy4gRG9udCBzeW5jLicpOyAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChmb3JjZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdmb3JjaW5nIHVzZXJkYXRhIFBVTEwnKTtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChDT05GSUcuQVBJX0VORFBPSU5UUy5VU0VSX0RBVEEsIHtcclxuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXNlckRhdGEpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGRiUmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKERCX05BTUUsIERCX1ZFUlNJT04pO1xyXG4gICAgICAgIGRiUmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xyXG4gICAgICAgICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IGRiLnRyYW5zYWN0aW9uKFxyXG4gICAgICAgICAgICAgICAgW1wicHJvamVjdHNcIiwgXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCIsIFwiZmF2b3VyaXRlc1wiLCBcIm5vdGVzXCIsIFwiaW1hZ2VzXCJdLFxyXG4gICAgICAgICAgICAgICAgXCJyZWFkd3JpdGVcIiApO1xyXG5cclxuICAgICAgICAgICAgICAgIFtcInByb2plY3RzXCIsIFwibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCIsIFwicm9vbXNcIiwgXCJwcm9kdWN0c1wiLCBcImZhdm91cml0ZXNcIiwgXCJub3Rlc1wiLCBcImltYWdlc1wiXS5mb3JFYWNoKFxyXG4gICAgICAgICAgICAgICAgKHN0b3JlTmFtZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoc3RvcmVOYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICBzdG9yZS5jbGVhcigpOyAgLy8gQ2xlYXIgZXhpc3RpbmcgZGF0YVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IHNpbmdsZSBvYmplY3QgdG8gYXJyYXkgaWYgbmVlZGVkXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KGRhdGFbc3RvcmVOYW1lXSkgPyBkYXRhW3N0b3JlTmFtZV0gOiBbZGF0YVtzdG9yZU5hbWVdXTtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0gfHwgIWl0ZW0uaWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYE1pc3NpbmcgSUQgaW4gJHtzdG9yZU5hbWV9OmAsIGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS51dWlkID0gaXRlbS5pZDsgIC8vIE1hcCAnaWQnIHRvICd1dWlkJyBmb3IgSW5kZXhlZERCXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLm93bmVyX2lkID0gb3duZXJfaWQgKyBcIlwiOyAvLyBBZGQgb3duZXJfaWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucm9vbV9pZF9mayA9IGl0ZW0ucm9vbV9pZF9mayB8fCBpdGVtLnV1aWQ7IC8vIHRvZG86IGNoZWNrIGlmIHRoaXMgaXMgY29ycmVjdCAoZGlmZmVyZW50IGZvciBwcm9kdWN0cywgbm90ZXMsIGltYWdlcylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBpdGVtLmlkOyAgICAgICAgLy8gUmVtb3ZlIHRoZSBvcmlnaW5hbCAnaWQnIGZpZWxkIHRvIGF2b2lkIGNvbmZsaWN0c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmUucHV0KGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIC8vIHVwZGF0ZSB0aGUgdXNlcnMgdGFibGUgXCJwdWxsZWRcIiBjb2x1bW4gd2l0aCBkdXJyZW50IGRhdGV0aW1lXHJcbiAgICAgICAgICAgIHNldFB1bGxlZChvd25lcl9pZCk7XHJcbiAgICAgICAgICAgIC8vIGFsc28gdXBkYXRlIGp1c3QgdGhpcyB1c2VyIHJlY29yZCBmcm9tIGRhdGEudXNlcnMgdG8gdGhlIHVzZXJzIHRhYmxlIHdoZXJlIGRhdGEuaWQgPSB1c2Vycy51dWlkXHJcbiAgICAgICAgICAgIC8vIHRoaXMgd2lsbCB1cGRhdGUgdGhlIHVzZXIgcmVjb3JkIHdpdGggdGhlIGxhdGVzdCBkYXRhIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICAgICAgICBjb25zdCB1c2VyID0gZGF0YS51c2Vyc1swXTtcclxuICAgICAgICAgICAgdXNlci51dWlkID0gZGF0YS51c2Vyc1swXS5pZDsgICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInVzZXJzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dCh1c2VyKTtcclxuICAgICAgICAgICAgdHguZG9uZTtcclxuXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7bWVzc2FnZTogJ0RhdGEgRmV0Y2ggQ29tcGxldGUgLi4uJywgc3RhdHVzOiAnc3VjY2VzcycsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAxNTAwIH0pOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkRhdGEgc3luY2VkIHRvIEluZGV4ZWREQiBzdWNjZXNzZnVsbHkuXCIpO1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgICAgICAgICAgfSwgMTUwMCk7ICAgICAgICAgICAgXHJcblxyXG4gICAgICAgICAgICByZXR1cm4odHJ1ZSk7ICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiRGF0YSBzeW5jIGZhaWxlZDpcIiwgZXJyb3IpO1xyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzZXRQdWxsZWQob3duZXJfaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwidXNlcnNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgc3RvcmUuZ2V0KG93bmVyX2lkKTsgICAgICAgIFxyXG4gICAgdXNlci5wdWxsZWQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgYXdhaXQgc3RvcmUucHV0KHVzZXIpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gaXNEYXRhYmFzZUVtcHR5KCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHByb2plY3RDb3VudCA9IGF3YWl0IGRiLmNvdW50KCdwcm9qZWN0cycpO1xyXG4gICAgY29uc3QgbG9jYXRpb25Db3VudCA9IGF3YWl0IGRiLmNvdW50KCdsb2NhdGlvbnMnKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nQ291bnQgPSBhd2FpdCBkYi5jb3VudCgnYnVpbGRpbmdzJyk7XHJcbiAgICBjb25zdCBmbG9vckNvdW50ID0gYXdhaXQgZGIuY291bnQoJ2Zsb29ycycpO1xyXG4gICAgY29uc3Qgcm9vbUNvdW50ID0gYXdhaXQgZGIuY291bnQoJ3Jvb21zJyk7XHJcbiAgICBjb25zdCBwcm9kdWN0Q291bnQgPSBhd2FpdCBkYi5jb3VudCgncHJvZHVjdHMnKTtcclxuXHJcbiAgICByZXR1cm4gcHJvamVjdENvdW50ID09PSAwICYmIGxvY2F0aW9uQ291bnQgPT09IDAgJiYgYnVpbGRpbmdDb3VudCA9PT0gMCAmJiBmbG9vckNvdW50ID09PSAwICYmIHJvb21Db3VudCA9PT0gMCAmJiBwcm9kdWN0Q291bnQgPT09IDA7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGlzUHJvZHVjdHNUYWJsZUVtcHR5KCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IGNvdW50ID0gYXdhaXQgZGIuY291bnQoU1RPUkVfTkFNRSk7XHJcbiAgICByZXR1cm4gY291bnQgPT09IDA7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGlzVXNlcnNUYWJsZUVtcHR5KCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IGNvdW50ID0gYXdhaXQgZGIuY291bnQoJ3VzZXJzJyk7XHJcbiAgICByZXR1cm4gY291bnQgPT09IDA7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHNhdmVQcm9kdWN0cyhkYXRhKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihTVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNUT1JFX05BTUUpO1xyXG5cclxuICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBkYXRhKSB7XHJcbiAgICAgICAgYXdhaXQgc3RvcmUucHV0KHByb2R1Y3QpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICBjb25zb2xlLmxvZygnUHJvZHVjdHMgc3RvcmVkIGluIEluZGV4ZWREQicpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzYXZlVXNlcnMoZGF0YSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ3VzZXJzJywgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgndXNlcnMnKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHVzZXIgb2YgZGF0YSkge1xyXG4gICAgICAgIGF3YWl0IHN0b3JlLnB1dCh1c2VyKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgY29uc29sZS5sb2coJ0F1dGggc3RvcmVkIGluIEluZGV4ZWREQicpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9kdWN0cygpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNUT1JFX05BTUUsICdyZWFkb25seScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShTVE9SRV9OQU1FKTsgICAgXHJcbiAgICByZXR1cm4gYXdhaXQgc3RvcmUuZ2V0QWxsKCk7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVQcm9qZWN0KHByb2plY3RfbmFtZSwgbG9jYXRpb24sIGJ1aWxkaW5nLCBmbG9vciwgcm9vbSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9qZWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IG5ld1Byb2plY3RJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBjb25zdCBwcm9qZWN0U2x1ZyA9IGF3YWl0IHV0aWxzLnNsdWdpZnkocHJvamVjdF9uYW1lKTtcclxuICAgIGNvbnN0IHByb2plY3QgPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIG5hbWU6IHByb2plY3RfbmFtZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIHByb2plY3RfaWRfZms6IG5ld1Byb2plY3RJRCxcclxuICAgICAgICBzbHVnOiBwcm9qZWN0U2x1ZyxcclxuICAgICAgICB1dWlkOiBuZXdQcm9qZWN0SUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKHByb2plY3QpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuXHJcbiAgICBjb25zdCBsb2NhdGlvbklEID0gYXdhaXQgYWRkTG9jYXRpb24obmV3UHJvamVjdElELCBsb2NhdGlvbik7XHJcbiAgICBjb25zdCBidWlsZGluZ0lEID0gYXdhaXQgYWRkQnVpbGRpbmcobG9jYXRpb25JRCwgYnVpbGRpbmcpO1xyXG4gICAgY29uc3QgZmxvb3JJRCA9IGF3YWl0IGFkZEZsb29yKGJ1aWxkaW5nSUQsIGZsb29yKTtcclxuICAgIGNvbnN0IHJvb21JRCA9IGF3YWl0IGFkZFJvb20oZmxvb3JJRCwgcm9vbSk7XHJcblxyXG4gICAgcmV0dXJuIHByb2plY3QudXVpZDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvamVjdHModXNlcl9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gZGIudHJhbnNhY3Rpb24oJ3Byb2plY3RzJywgJ3JlYWRvbmx5Jyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKCdwcm9qZWN0cycpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleCgnb3duZXJfaWQnKTtcclxuICAgIHVzZXJfaWQgPSB1c2VyX2lkICsgXCJcIjtcclxuICAgIHJldHVybiBhd2FpdCBpbmRleC5nZXRBbGwodXNlcl9pZCk7ICAgIFxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9qZWN0SGllcmFyY2h5KG93bmVyX2lkLCBwcm9qZWN0X2lkKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcIkZldGNoaW5nIGZyb20gSW5kZXhlZERCIGZvciBwcm9qZWN0X2lkOlwiLCBwcm9qZWN0X2lkKTtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBvd25lcl9pZCA9IFN0cmluZyhvd25lcl9pZCk7XHJcblxyXG4gICAgbGV0IHByb2plY3RzID0gYXdhaXQgZGIuZ2V0QWxsRnJvbUluZGV4KCdwcm9qZWN0cycsICdvd25lcl9pZCcsIG93bmVyX2lkKTtcclxuXHJcbiAgICAvLyBGaWx0ZXIgcHJvamVjdHMgYnkgcHJvamVjdF9pZFxyXG4gICAgaWYgKHByb2plY3RfaWQpIHtcclxuICAgICAgICBwcm9qZWN0cyA9IHByb2plY3RzLmZpbHRlcihwcm9qZWN0ID0+IHByb2plY3QudXVpZCA9PT0gcHJvamVjdF9pZCk7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJGaWx0ZXJlZCBQcm9qZWN0czpcIiwgcHJvamVjdHMpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnTm8gcHJvamVjdCBJRCwgZ2V0dGluZyBhbGwgcHJvamVjdHMnKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHByb2plY3RzOiBwcm9qZWN0cyB8fCBbXSxcclxuICAgICAgICBsb2NhdGlvbnM6IGF3YWl0IGRiLmdldEFsbEZyb21JbmRleCgnbG9jYXRpb25zJywgJ293bmVyX2lkJywgb3duZXJfaWQpIHx8IFtdLFxyXG4gICAgICAgIGJ1aWxkaW5nczogYXdhaXQgZGIuZ2V0QWxsRnJvbUluZGV4KCdidWlsZGluZ3MnLCAnb3duZXJfaWQnLCBvd25lcl9pZCkgfHwgW10sXHJcbiAgICAgICAgZmxvb3JzOiBhd2FpdCBkYi5nZXRBbGxGcm9tSW5kZXgoJ2Zsb29ycycsICdvd25lcl9pZCcsIG93bmVyX2lkKSB8fCBbXSxcclxuICAgICAgICByb29tczogYXdhaXQgZGIuZ2V0QWxsRnJvbUluZGV4KCdyb29tcycsICdvd25lcl9pZCcsIG93bmVyX2lkKSB8fCBbXVxyXG4gICAgfTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvZHVjdHNGb3JSb29tKHJvb21JZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9kdWN0c1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7ICAgICBcclxuICAgIHJvb21JZCA9IFN0cmluZyhyb29tSWQpO1xyXG4gICAgcmV0dXJuIGF3YWl0IGluZGV4LmdldEFsbChyb29tSWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9kdWN0c0ZvclByb2plY3QocHJvamVjdElkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgcHJvamVjdElkID0gU3RyaW5nKHByb2plY3RJZCk7ICAgXHJcblxyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJwcm9kdWN0c1wiLCBcInJvb21zXCIsIFwiZmxvb3JzXCIsIFwiYnVpbGRpbmdzXCIsIFwibG9jYXRpb25zXCIsIFwicHJvamVjdHNcIl0sIFwicmVhZG9ubHlcIik7XHJcblxyXG4gICAgY29uc3QgcHJvZHVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJsb2NhdGlvbnNcIik7XHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG5cclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcHJvZHVjdFN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3Qgcm9vbXMgPSBhd2FpdCByb29tU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBmbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdzID0gYXdhaXQgYnVpbGRpbmdTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBwcm9qZWN0cyA9IGF3YWl0IHByb2plY3RTdG9yZS5nZXRBbGwoKTtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0UHJvZHVjdHMgPSBwcm9kdWN0cy5maWx0ZXIocHJvZHVjdCA9PiB7XHJcbiAgICAgICAgY29uc3Qgcm9vbSA9IHJvb21zLmZpbmQocm9vbSA9PiByb29tLnV1aWQgPT09IHByb2R1Y3Qucm9vbV9pZF9mayk7XHJcbiAgICAgICAgaWYgKCFyb29tKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgZmxvb3IgPSBmbG9vcnMuZmluZChmbG9vciA9PiBmbG9vci51dWlkID09PSByb29tLmZsb29yX2lkX2ZrKTtcclxuICAgICAgICBpZiAoIWZsb29yKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmcgPSBidWlsZGluZ3MuZmluZChidWlsZGluZyA9PiBidWlsZGluZy51dWlkID09PSBmbG9vci5idWlsZGluZ19pZF9mayk7XHJcbiAgICAgICAgaWYgKCFidWlsZGluZykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGxvY2F0aW9uID0gbG9jYXRpb25zLmZpbmQobG9jYXRpb24gPT4gbG9jYXRpb24udXVpZCA9PT0gYnVpbGRpbmcubG9jYXRpb25faWRfZmspO1xyXG4gICAgICAgIGNvbnN0IHByb2plY3QgPSBwcm9qZWN0cy5maW5kKHByb2plY3QgPT4gcHJvamVjdC51dWlkID09PSBsb2NhdGlvbi5wcm9qZWN0X2lkX2ZrKTtcclxuICAgICAgICByZXR1cm4gcHJvamVjdCAmJiBwcm9qZWN0LnV1aWQgPT09IHByb2plY3RJZDtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IHByb2plY3RQcm9kdWN0cy5yZWR1Y2UoKGFjYywgcHJvZHVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nUHJvZHVjdCA9IGFjYy5maW5kKHAgPT4gcC5za3UgPT09IHByb2R1Y3Quc2t1KTtcclxuICAgICAgICBpZiAoZXhpc3RpbmdQcm9kdWN0KSB7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nUHJvZHVjdC5xdHkgKz0gMTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCByb29tID0gcm9vbXMuZmluZChyb29tID0+IHJvb20udXVpZCA9PT0gcHJvZHVjdC5yb29tX2lkX2ZrKTtcclxuICAgICAgICAgICAgY29uc3QgZmxvb3IgPSBmbG9vcnMuZmluZChmbG9vciA9PiBmbG9vci51dWlkID09PSByb29tLmZsb29yX2lkX2ZrKTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRpbmcgPSBidWlsZGluZ3MuZmluZChidWlsZGluZyA9PiBidWlsZGluZy51dWlkID09PSBmbG9vci5idWlsZGluZ19pZF9mayk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gbG9jYXRpb25zLmZpbmQobG9jYXRpb24gPT4gbG9jYXRpb24udXVpZCA9PT0gYnVpbGRpbmcubG9jYXRpb25faWRfZmspO1xyXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0ID0gcHJvamVjdHMuZmluZChwcm9qZWN0ID0+IHByb2plY3QudXVpZCA9PT0gbG9jYXRpb24ucHJvamVjdF9pZF9mayk7XHJcblxyXG4gICAgICAgICAgICBhY2MucHVzaCh7XHJcbiAgICAgICAgICAgICAgICByZWY6IHByb2R1Y3QucmVmLFxyXG4gICAgICAgICAgICAgICAgcHJvZHVjdF9uYW1lOiBwcm9kdWN0LnByb2R1Y3RfbmFtZSxcclxuICAgICAgICAgICAgICAgIHByb2R1Y3Rfc2x1ZzogcHJvZHVjdC5wcm9kdWN0X3NsdWcsXHJcbiAgICAgICAgICAgICAgICBza3U6IHByb2R1Y3Quc2t1LFxyXG4gICAgICAgICAgICAgICAgY3VzdG9tOiBwcm9kdWN0LmN1c3RvbSxcclxuICAgICAgICAgICAgICAgIG93bmVyX2lkOiBwcm9kdWN0Lm93bmVyX2lkLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9pZF9mazogcHJvamVjdC51dWlkLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9zbHVnOiBwcm9qZWN0LnNsdWcsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X3ZlcnNpb246IHByb2plY3QudmVyc2lvbixcclxuICAgICAgICAgICAgICAgIHF0eTogMVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGFjYztcclxuICAgIH0sIFtdKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG5cclxufVxyXG5cclxuY29uc3Qgc2F2ZVByb2R1Y3RUb1Jvb20gPSBhc3luYyAocHJvZHVjdCkgPT4ge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJwcm9kdWN0c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuXHJcbiAgICAvLyBFbnN1cmUgdGhlIHByb2R1Y3QgaGFzIGEgdXVpZCBhbmQgcm9vbV9pZF9ma1xyXG4gICAgaWYgKCFwcm9kdWN0LnV1aWQpIHtcclxuICAgICAgICBwcm9kdWN0LnV1aWQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuICAgIH1cclxuICAgIGlmICghcHJvZHVjdC5yb29tX2lkX2ZrKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicm9vbV9pZF9mayBpcyByZXF1aXJlZFwiKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCBzdG9yZS5hZGQocHJvZHVjdCk7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgY29uc29sZS5sb2coJ1Byb2R1Y3QgYWRkZWQgdG8gcm9vbTonLCBwcm9kdWN0KTtcclxufTtcclxuXHJcbmNvbnN0IGRlbGV0ZVByb2R1Y3RGcm9tUm9vbSA9IGFzeW5jIChza3UsIHJvb21faWQpID0+IHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tX2lkKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHByb2R1Y3Qgb2YgcHJvZHVjdHMpIHtcclxuICAgICAgICBpZiAocHJvZHVjdC5za3UgPT09IHNrdSkge1xyXG4gICAgICAgICAgICBhd2FpdCBzdG9yZS5kZWxldGUocHJvZHVjdC51dWlkKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Byb2R1Y3QgZGVsZXRlZCBmcm9tIHJvb206JywgcHJvZHVjdCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5jb25zdCBzZXRTa3VRdHlGb3JSb29tID0gYXN5bmMgKHF0eSwgc2t1LCByb29tX2lkKSA9PiB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInByb2R1Y3RzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcblxyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBpbmRleC5nZXRBbGwocm9vbV9pZCk7XHJcbiAgICBjb25zdCBwcm9kdWN0ID0gcHJvZHVjdHMuZmluZChwID0+IHAuc2t1ID09PSBza3UpO1xyXG5cclxuICAgIC8vIFJlbW92ZSBhbGwgZXhpc3RpbmcgcHJvZHVjdHMgd2l0aCB0aGUgZ2l2ZW4gU0tVIGluIHRoZSBzcGVjaWZpZWQgcm9vbVxyXG4gICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgaWYgKHByb2R1Y3Quc2t1ID09PSBza3UpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdEZWxldGluZyBwcm9kdWN0OicsIHByb2R1Y3QpO1xyXG4gICAgICAgICAgICBhd2FpdCBzdG9yZS5kZWxldGUocHJvZHVjdC51dWlkKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmUtYWRkIHRoZSBwcm9kdWN0cyB3aXRoIHRoZSBzcGVjaWZpZWQgcXVhbnRpdHlcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcXR5OyBpKyspIHtcclxuICAgICAgICBjb25zdCBuZXdQcm9kdWN0ID0geyAuLi5wcm9kdWN0LCB1dWlkOiBnZW5lcmF0ZVVVSUQoKSB9O1xyXG4gICAgICAgIGF3YWl0IHN0b3JlLmFkZChuZXdQcm9kdWN0KTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbmNvbnN0IHVwZGF0ZVByb2R1Y3RSZWYgPSBhc3luYyAocm9vbV9pZCwgc2t1LCByZWYpID0+IHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvZHVjdHNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tX2lkKTtcclxuICAgIGNvbnN0IHByb2R1Y3QgPSBwcm9kdWN0cy5maW5kKHAgPT4gcC5za3UgPT09IHNrdSk7ICAgIFxyXG5cclxuICAgIGlmIChwcm9kdWN0KSB7XHJcbiAgICAgICAgcHJvZHVjdC5yZWYgPSByZWY7XHJcbiAgICAgICAgYXdhaXQgc3RvcmUucHV0KHByb2R1Y3QpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdQcm9kdWN0IG5vdCBmb3VuZCBmb3IgU0tVOicsIHNrdSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IGdldFJvb21NZXRhID0gYXN5bmMgKHJvb21JZCkgPT4ge1xyXG4gICAgcm9vbUlkID0gU3RyaW5nKHJvb21JZCk7XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcbiAgICBjb25zdCByb29tID0gYXdhaXQgaW5kZXguZ2V0KHJvb21JZCk7ICAgIFxyXG4gICAgaWYgKCFyb29tKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSb29tIHdpdGggaWQgJHtyb29tSWR9IG5vdCBmb3VuZGApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImZsb29yc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3QgZmxvb3IgPSBhd2FpdCBmbG9vclN0b3JlLmdldChyb29tLmZsb29yX2lkX2ZrKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImJ1aWxkaW5nc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgY29uc3QgYnVpbGRpbmcgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmdldChmbG9vci5idWlsZGluZ19pZF9mayk7XHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJsb2NhdGlvbnNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uID0gYXdhaXQgbG9jYXRpb25TdG9yZS5nZXQoYnVpbGRpbmcubG9jYXRpb25faWRfZmspO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2NhdGlvbjogeyBuYW1lOiBsb2NhdGlvbi5uYW1lLCB1dWlkOiBsb2NhdGlvbi51dWlkIH0sXHJcbiAgICAgICAgYnVpbGRpbmc6IHsgbmFtZTogYnVpbGRpbmcubmFtZSwgdXVpZDogYnVpbGRpbmcudXVpZCB9LFxyXG4gICAgICAgIGZsb29yOiB7IG5hbWU6IGZsb29yLm5hbWUsIHV1aWQ6IGZsb29yLnV1aWQgfSxcclxuICAgICAgICByb29tOiB7IG5hbWU6IHJvb20ubmFtZSwgdXVpZDogcm9vbS51dWlkLCBoZWlnaHQ6IHJvb20uaGVpZ2h0LCB3aWR0aDogcm9vbS53aWR0aCwgbGVuZ3RoOiByb29tLmxlbmd0aCB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0Um9vbU5vdGVzKHJvb21JZCkge1xyXG4gICAgcm9vbUlkID0gU3RyaW5nKHJvb21JZCk7XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJub3Rlc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBzdG9yZS5pbmRleChcInJvb21faWRfZmtcIik7XHJcbiAgICBjb25zdCBub3RlcyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tSWQpO1xyXG4gICAgbm90ZXMuc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5jcmVhdGVkX29uKSAtIG5ldyBEYXRlKGEuY3JlYXRlZF9vbikpO1xyXG4gICAgcmV0dXJuIG5vdGVzO1xyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkUm9vbShmbG9vclV1aWQsIHJvb21OYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgbGV0IHR4MSA9IGRiLnRyYW5zYWN0aW9uKFwicm9vbXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBsZXQgc3RvcmUxID0gdHgxLm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBsZXQgbmV3Um9vbUlEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IHJvb21TbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShyb29tTmFtZSk7XHJcbiAgICAvLyBpIG5lZWQgdG8gY2hlY2sgaWYgdGhpcyByb29tIGFscmVhZHkgZXhpc3RzIGluIHRoaXMgcHJvamVjdFxyXG4gICAgY29uc3QgZXhpc3RpbmdSb29tcyA9IGF3YWl0IHN0b3JlMS5nZXRBbGwoKTtcclxuICAgIGNvbnNvbGUubG9nKCdFeGlzdGluZyByb29tczonLCBleGlzdGluZ1Jvb21zKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nUm9vbSA9IGV4aXN0aW5nUm9vbXMuZmluZChyb29tID0+IHJvb20uc2x1ZyA9PSByb29tU2x1ZyAmJiByb29tLmZsb29yX2lkX2ZrID09IGZsb29yVXVpZCk7XHJcbiAgICBjb25zb2xlLmxvZygnRXhpc3Rpbmcgcm9vbTonLCBleGlzdGluZ1Jvb20pO1xyXG4gICAgaWYgKGV4aXN0aW5nUm9vbSkgeyAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmYWxzZTsgICBcclxuICAgIH1cclxuICAgIC8vIGlmIHRoZSByb29tIGV4aXN0cyBBTllXSEVSRSBpbiB0aGlzIFBST0pFQ1RcclxuICAgIGNvbnN0IGN1cnJlbnRQcm9qZWN0ID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTsgICAgXHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSBkYi50cmFuc2FjdGlvbihcInByb2plY3RzXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBwcm9qZWN0U3RvcmUuZ2V0KFN0cmluZyhjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkKSk7ICAgIFxyXG4gICAgXHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJsb2NhdGlvbnNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuaW5kZXgoXCJwcm9qZWN0X2lkX2ZrXCIpLmdldEFsbChwcm9qZWN0LnV1aWQpO1xyXG4gICBcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSBkYi50cmFuc2FjdGlvbihcImJ1aWxkaW5nc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwiYnVpbGRpbmdzXCIpO1xyXG4gICAgbGV0IGJ1aWxkaW5ncyA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBsb2NhdGlvbiBvZiBsb2NhdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBsb2NhdGlvbkJ1aWxkaW5ncyA9IGF3YWl0IGJ1aWxkaW5nU3RvcmUuaW5kZXgoXCJsb2NhdGlvbl9pZF9ma1wiKS5nZXRBbGwobG9jYXRpb24udXVpZCk7XHJcbiAgICAgICAgYnVpbGRpbmdzID0gYnVpbGRpbmdzLmNvbmNhdChsb2NhdGlvbkJ1aWxkaW5ncyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJmbG9vcnNcIiwgXCJyZWFkb25seVwiKS5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGxldCBmbG9vcnMgPSBbXTtcclxuICAgIGZvciAoY29uc3QgYnVpbGRpbmcgb2YgYnVpbGRpbmdzKSB7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdGbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmluZGV4KFwiYnVpbGRpbmdfaWRfZmtcIikuZ2V0QWxsKGJ1aWxkaW5nLnV1aWQpO1xyXG4gICAgICAgIGZsb29ycyA9IGZsb29ycy5jb25jYXQoYnVpbGRpbmdGbG9vcnMpO1xyXG4gICAgfVxyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBsZXQgcm9vbXMgPSBbXTtcclxuICAgIGZvciAoY29uc3QgZmxvb3Igb2YgZmxvb3JzKSB7XHJcbiAgICAgICAgY29uc3QgZmxvb3JSb29tcyA9IGF3YWl0IHJvb21TdG9yZS5pbmRleChcImZsb29yX2lkX2ZrXCIpLmdldEFsbChmbG9vci51dWlkKTtcclxuICAgICAgICByb29tcyA9IHJvb21zLmNvbmNhdChmbG9vclJvb21zKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGV4aXN0aW5nUm9vbUluUHJvamVjdCA9IHJvb21zLmZpbmQocm9vbSA9PiByb29tLnNsdWcgPT09IHJvb21TbHVnKTtcclxuICAgIGlmIChleGlzdGluZ1Jvb21JblByb2plY3QpIHsgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgXHJcbiAgICBcclxuICAgIC8vIGFkZCB0aGUgcm9vbVxyXG4gICAgbGV0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyb29tc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGxldCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCByb29tID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBmbG9vcl9pZF9mazogU3RyaW5nKGZsb29yVXVpZCksXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogcm9vbU5hbWUsXHJcbiAgICAgICAgb3duZXJfaWQ6IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLCBcclxuICAgICAgICByb29tX2lkX2ZrOiBuZXdSb29tSUQsXHJcbiAgICAgICAgc2x1Zzogcm9vbVNsdWcsXHJcbiAgICAgICAgdXVpZDogbmV3Um9vbUlELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChyb29tKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gcm9vbS51dWlkO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBhZGRGbG9vcihidWlsZGluZ1V1aWQsIGZsb29yTmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJmbG9vcnNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmxvb3JzXCIpO1xyXG4gICAgY29uc3QgbmV3Rmxvb3JJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBjb25zdCBmbG9vclNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KGZsb29yTmFtZSk7XHJcbiAgICBjb25zdCBmbG9vciA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgYnVpbGRpbmdfaWRfZms6IFN0cmluZyhidWlsZGluZ1V1aWQpLFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIG5hbWU6IGZsb29yTmFtZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIGZsb29yX2lkX2ZrOiBuZXdGbG9vcklELFxyXG4gICAgICAgIHNsdWc6IGZsb29yU2x1ZyxcclxuICAgICAgICB1dWlkOiBuZXdGbG9vcklELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChmbG9vcik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIGZsb29yLnV1aWQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZExvY2F0aW9uKHByb2plY3RVdWlkLCBsb2NhdGlvbk5hbWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwibG9jYXRpb25zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IG5ld0xvY2F0aW9uSUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTkpLnJlcGxhY2UoJ1QnLCAnICcpO1xyXG4gICAgY29uc3QgbG9jYXRpb25TbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShsb2NhdGlvbk5hbWUpO1xyXG4gICAgY29uc3QgbG9jYXRpb24gPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIG5hbWU6IGxvY2F0aW9uTmFtZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIGxvY2F0aW9uX2lkX2ZrOiBuZXdMb2NhdGlvbklELFxyXG4gICAgICAgIHByb2plY3RfaWRfZms6IHByb2plY3RVdWlkLFxyXG4gICAgICAgIHNsdWc6IGxvY2F0aW9uU2x1ZyxcclxuICAgICAgICB1dWlkOiBuZXdMb2NhdGlvbklELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChsb2NhdGlvbik7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIGxvY2F0aW9uLnV1aWQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEJ1aWxkaW5nKGxvY2F0aW9uVXVpZCwgYnVpbGRpbmdOYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImJ1aWxkaW5nc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBjb25zdCBuZXdCdWlsZGluZ0lEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU2x1ZyA9IGF3YWl0IHV0aWxzLnNsdWdpZnkoYnVpbGRpbmdOYW1lKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBsb2NhdGlvbl9pZF9mazogU3RyaW5nKGxvY2F0aW9uVXVpZCksXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbmFtZTogYnVpbGRpbmdOYW1lLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSwgXHJcbiAgICAgICAgYnVpbGRpbmdfaWRfZms6IG5ld0J1aWxkaW5nSUQsXHJcbiAgICAgICAgc2x1ZzogYnVpbGRpbmdTbHVnLFxyXG4gICAgICAgIHV1aWQ6IG5ld0J1aWxkaW5nSUQsXHJcbiAgICAgICAgdmVyc2lvbjogXCIxXCJcclxuICAgIH07XHJcblxyXG4gICAgYXdhaXQgc3RvcmUuYWRkKGJ1aWxkaW5nKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gYnVpbGRpbmcudXVpZDtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZVJvb20ocm9vbVV1aWQpIHsgICAgXHJcbiAgICByb29tVXVpZCA9IFwiXCIgKyByb29tVXVpZDtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcInJvb21zXCIsIFwicHJvZHVjdHNcIl0sIFwicmVhZHdyaXRlXCIpO1xyXG5cclxuICAgIC8vIFJlbW92ZSB0aGUgcm9vbVxyXG4gICAgY29uc29sZS5sb2coJ3JlbW92aW5nIHJvb20gdXVpZDogJywgcm9vbVV1aWQpO1xyXG4gICAgY29uc3Qgcm9vbVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIHJvb21VdWlkLnRvU3RyaW5nKCk7XHJcbiAgICBjb25zb2xlLmxvZygndHlwZW9mOiAnLHR5cGVvZiByb29tVXVpZCk7XHJcbiAgICBhd2FpdCByb29tU3RvcmUuZGVsZXRlKHJvb21VdWlkKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgYWxsIHByb2R1Y3RzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJvb21cclxuICAgIGNvbnN0IHByb2R1Y3RzU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBwcm9kdWN0c1N0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgaW5kZXguZ2V0QWxsKHJvb21VdWlkKTtcclxuICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgIGF3YWl0IHByb2R1Y3RzU3RvcmUuZGVsZXRlKHByb2R1Y3QudXVpZCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVtb3ZlRmxvb3IoZmxvb3JVdWlkKSB7ICAgIFxyXG4gICAgZmxvb3JVdWlkID0gXCJcIiArIGZsb29yVXVpZDtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIl0sIFwicmVhZHdyaXRlXCIpO1xyXG5cclxuICAgIC8vIFJlbW92ZSB0aGUgZmxvb3JcclxuICAgIGNvbnNvbGUubG9nKCdyZW1vdmluZyBmbG9vciB1dWlkOiAnICsgZmxvb3JVdWlkKTtcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGF3YWl0IGZsb29yU3RvcmUuZGVsZXRlKGZsb29yVXVpZCk7XHJcblxyXG4gICAgLy8gcmVtb3ZlIGFsbCBwcm9kdWN0cyBhc3NvY2lhdGVkIHdpdGggYWxsIHJvb21zIHdpdGhpbiB0aGlzIGZsb29yIGZpcnN0XHJcbiAgICBjb25zdCBwcm9kdWN0c1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCByb29tSW5kZXggPSBwcm9kdWN0c1N0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gcm9vbVN0b3JlLmluZGV4KFwiZmxvb3JfaWRfZmtcIik7XHJcbiAgICBjb25zdCByb29tcyA9IGF3YWl0IGluZGV4LmdldEFsbChmbG9vclV1aWQpO1xyXG5cclxuICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcm9vbUluZGV4LmdldEFsbChyb29tLnV1aWQpO1xyXG4gICAgICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgICAgICBhd2FpdCBwcm9kdWN0c1N0b3JlLmRlbGV0ZShwcm9kdWN0LnV1aWQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyByZW1vdmUgYWxsIHJvb21zIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZsb29yXHJcbiAgICBmb3IgKGNvbnN0IHJvb20gb2Ygcm9vbXMpIHtcclxuICAgICAgICBhd2FpdCByb29tU3RvcmUuZGVsZXRlKHJvb20udXVpZCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZUJ1aWxkaW5nKGJ1aWxkaW5nVXVpZCkge1xyXG4gICAgYnVpbGRpbmdVdWlkID0gU3RyaW5nKGJ1aWxkaW5nVXVpZCk7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCJdLCBcInJlYWR3cml0ZVwiKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgdGhlIGJ1aWxkaW5nXHJcbiAgICBjb25zb2xlLmxvZygncmVtb3ZpbmcgYnVpbGRpbmcgdXVpZDogJyArIGJ1aWxkaW5nVXVpZCk7XHJcbiAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBhd2FpdCBidWlsZGluZ1N0b3JlLmRlbGV0ZShidWlsZGluZ1V1aWQpO1xyXG5cclxuICAgIC8vIHJlbW92ZSBhbGwgZmxvb3JzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGJ1aWxkaW5nXHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCBmbG9vcnMgPSBhd2FpdCBmbG9vclN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdGbG9vcnMgPSBmbG9vcnMuZmlsdGVyKGZsb29yID0+IGZsb29yLmJ1aWxkaW5nX2lkX2ZrID09PSBidWlsZGluZ1V1aWQpO1xyXG5cclxuICAgIGZvciAoY29uc3QgZmxvb3Igb2YgYnVpbGRpbmdGbG9vcnMpIHtcclxuICAgICAgICAvLyByZW1vdmUgYWxsIHByb2R1Y3RzIGFzc29jaWF0ZWQgd2l0aCBhbGwgcm9vbXMgd2l0aGluIHRoaXMgZmxvb3IgZmlyc3RcclxuICAgICAgICBjb25zdCBwcm9kdWN0c1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgICAgICBjb25zdCByb29tU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgICAgIGNvbnN0IHJvb21JbmRleCA9IHByb2R1Y3RzU3RvcmUuaW5kZXgoXCJyb29tX2lkX2ZrXCIpO1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gcm9vbVN0b3JlLmluZGV4KFwiZmxvb3JfaWRfZmtcIik7XHJcbiAgICAgICAgY29uc3Qgcm9vbXMgPSBhd2FpdCBpbmRleC5nZXRBbGwoZmxvb3IudXVpZCk7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHJvb21JbmRleC5nZXRBbGwocm9vbS51dWlkKTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBwcm9kdWN0c1N0b3JlLmRlbGV0ZShwcm9kdWN0LnV1aWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyByZW1vdmUgYWxsIHJvb21zIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZsb29yXHJcbiAgICAgICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHJvb21TdG9yZS5kZWxldGUocm9vbS51dWlkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlbW92ZSB0aGUgZmxvb3IgaXRzZWxmXHJcbiAgICAgICAgYXdhaXQgZmxvb3JTdG9yZS5kZWxldGUoZmxvb3IudXVpZCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZU5hbWUoc3RvcmUsIHV1aWQsIG5ld05hbWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKHN0b3JlLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IG9iamVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmUpO1xyXG4gICAgdXVpZCA9IFN0cmluZyh1dWlkKTtcclxuICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IG9iamVjdFN0b3JlLmdldCh1dWlkKTtcclxuICAgIHJlY29yZC5uYW1lID0gbmV3TmFtZTtcclxuICAgIHJlY29yZC5zbHVnID0gYXdhaXQgdXRpbHMuc2x1Z2lmeShuZXdOYW1lKTtcclxuICAgIGF3YWl0IG9iamVjdFN0b3JlLnB1dChyZWNvcmQpO1xyXG4gICAgYXdhaXQgdHguZG9uZTsgICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFByb2plY3RTdHJ1Y3R1cmUocHJvamVjdElkKSB7XHJcbiAgICBvd25lcl9pZCA9IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpLCBcclxuICAgIG93bmVyX2lkID0gU3RyaW5nKG93bmVyX2lkKTtcclxuXHJcbiAgICBjb25zdCBoaWVyYXJjaHkgPSBhd2FpdCBnZXRQcm9qZWN0SGllcmFyY2h5KG93bmVyX2lkLCBwcm9qZWN0SWQpOyBcclxuICAgIGxldCByZXN1bHQgPSB7fTtcclxuXHJcbiAgICAvLyBHZXQgdGhlIHByb2plY3QgZGV0YWlsc1xyXG4gICAgY29uc3QgcHJvamVjdCA9IGhpZXJhcmNoeS5wcm9qZWN0c1swXTtcclxuICAgIGlmICghcHJvamVjdCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgLy8gSW5pdGlhbGl6ZSBwcm9qZWN0IGxldmVsXHJcbiAgICByZXN1bHQgPSB7XHJcbiAgICAgICAgcHJvamVjdF9uYW1lOiBwcm9qZWN0Lm5hbWUsXHJcbiAgICAgICAgcHJvamVjdF9zbHVnOiBwcm9qZWN0LnNsdWcsXHJcbiAgICAgICAgcHJvamVjdF9pZDogcHJvamVjdC51dWlkXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIEdldCBsb2NhdGlvbnMgZm9yIHRoaXMgcHJvamVjdFxyXG4gICAgY29uc3QgcHJvamVjdExvY2F0aW9ucyA9IGhpZXJhcmNoeS5sb2NhdGlvbnNcclxuICAgICAgICAuZmlsdGVyKGxvYyA9PiBsb2MucHJvamVjdF9pZF9mayA9PT0gcHJvamVjdC51dWlkKTtcclxuXHJcbiAgICAvLyBCdWlsZCBsb2NhdGlvbiBsZXZlbFxyXG4gICAgcHJvamVjdExvY2F0aW9ucy5mb3JFYWNoKGxvY2F0aW9uID0+IHtcclxuICAgICAgICByZXN1bHRbbG9jYXRpb24uc2x1Z10gPSB7XHJcbiAgICAgICAgICAgIGxvY2F0aW9uX25hbWU6IGxvY2F0aW9uLm5hbWUsXHJcbiAgICAgICAgICAgIGxvY2F0aW9uX3NsdWc6IGxvY2F0aW9uLnNsdWcsXHJcbiAgICAgICAgICAgIGxvY2F0aW9uX2lkOiBsb2NhdGlvbi51dWlkXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gR2V0IGJ1aWxkaW5ncyBmb3IgdGhpcyBsb2NhdGlvblxyXG4gICAgICAgIGNvbnN0IGxvY2F0aW9uQnVpbGRpbmdzID0gaGllcmFyY2h5LmJ1aWxkaW5nc1xyXG4gICAgICAgICAgICAuZmlsdGVyKGJ1aWxkID0+IGJ1aWxkLmxvY2F0aW9uX2lkX2ZrID09PSBsb2NhdGlvbi51dWlkKTtcclxuXHJcbiAgICAgICAgLy8gQnVpbGQgYnVpbGRpbmcgbGV2ZWxcclxuICAgICAgICBsb2NhdGlvbkJ1aWxkaW5ncy5mb3JFYWNoKGJ1aWxkaW5nID0+IHtcclxuICAgICAgICAgICAgcmVzdWx0W2xvY2F0aW9uLnNsdWddW2J1aWxkaW5nLnNsdWddID0ge1xyXG4gICAgICAgICAgICAgICAgYnVpbGRpbmdfbmFtZTogYnVpbGRpbmcubmFtZSxcclxuICAgICAgICAgICAgICAgIGJ1aWxkaW5nX3NsdWc6IGJ1aWxkaW5nLnNsdWcsXHJcbiAgICAgICAgICAgICAgICBidWlsZGluZ19pZDogYnVpbGRpbmcudXVpZFxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLy8gR2V0IGZsb29ycyBmb3IgdGhpcyBidWlsZGluZ1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZGluZ0Zsb29ycyA9IGhpZXJhcmNoeS5mbG9vcnNcclxuICAgICAgICAgICAgICAgIC5maWx0ZXIoZmxvb3IgPT4gZmxvb3IuYnVpbGRpbmdfaWRfZmsgPT09IGJ1aWxkaW5nLnV1aWQpO1xyXG5cclxuICAgICAgICAgICAgLy8gQnVpbGQgZmxvb3IgbGV2ZWxcclxuICAgICAgICAgICAgYnVpbGRpbmdGbG9vcnMuZm9yRWFjaChmbG9vciA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbbG9jYXRpb24uc2x1Z11bYnVpbGRpbmcuc2x1Z11bZmxvb3Iuc2x1Z10gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmxvb3JfbmFtZTogZmxvb3IubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBmbG9vcl9zbHVnOiBmbG9vci5zbHVnLFxyXG4gICAgICAgICAgICAgICAgICAgIGZsb29yX2lkOiBmbG9vci51dWlkXHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEdldCByb29tcyBmb3IgdGhpcyBmbG9vclxyXG4gICAgICAgICAgICAgICAgY29uc3QgZmxvb3JSb29tcyA9IGhpZXJhcmNoeS5yb29tc1xyXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIocm9vbSA9PiByb29tLmZsb29yX2lkX2ZrID09PSBmbG9vci51dWlkKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBCdWlsZCByb29tIGxldmVsXHJcbiAgICAgICAgICAgICAgICBmbG9vclJvb21zLmZvckVhY2gocm9vbSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2xvY2F0aW9uLnNsdWddW2J1aWxkaW5nLnNsdWddW2Zsb29yLnNsdWddW3Jvb20uc2x1Z10gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvb21fbmFtZTogcm9vbS5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByb29tX3NsdWc6IHJvb20uc2x1ZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbS51dWlkXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9qZWN0QnlVVUlEKHV1aWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBzdG9yZS5nZXQodXVpZCk7XHJcbiAgICByZXR1cm4gcHJvamVjdDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlUHJvamVjdERldGFpbHMocHJvamVjdERhdGEpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcblxyXG4gICAgYXdhaXQgc3RvcmUucHV0KHByb2plY3REYXRhKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7ICAgIFxyXG59XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlUm9vbURpbWVuc2lvbihyb29tVXVpZCwgZmllbGQsIHZhbHVlKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3Qgcm9vbSA9IGF3YWl0IHN0b3JlLmdldChyb29tVXVpZCk7XHJcbiAgICByb29tW2ZpZWxkXSA9IHZhbHVlO1xyXG4gICAgYXdhaXQgc3RvcmUucHV0KHJvb20pO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gY29weVJvb20ocm9vbVV1aWQsIG5ld1Jvb21OYW1lLCBuZXdGbG9vclV1aWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eDEgPSBkYi50cmFuc2FjdGlvbihcInJvb21zXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eDEub2JqZWN0U3RvcmUoXCJyb29tc1wiKTtcclxuICAgIGNvbnN0IHJvb20gPSBhd2FpdCBzdG9yZS5nZXQocm9vbVV1aWQpO1xyXG4gICAgY29uc3QgbmV3VXVpZCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgY29uc3QgbmV3Um9vbSA9IHsgLi4ucm9vbSwgdXVpZDogbmV3VXVpZCB9O1xyXG4gICAgY29uc29sZS5sb2coJ0NvcHlpbmcgcm9vbSB0byBuZXcgcm9vbScsIHJvb21VdWlkLCBuZXdSb29tLnV1aWQpO1xyXG4gICAgLy8gYXBwZW5kICBcIiAtIGNvcHlcIiB0byByb29tIG5hbWUgcm9vbSBzbHVnIFxyXG4gICAgbmV3Um9vbS5uYW1lID0gbmV3Um9vbU5hbWUgfHwgbmV3Um9vbS5uYW1lICsgXCIgLSBDb3B5XCI7XHJcbiAgICBuZXdSb29tLnNsdWcgPSBhd2FpdCB1dGlscy5zbHVnaWZ5KG5ld1Jvb20ubmFtZSk7ICBcclxuICAgIG5ld1Jvb20ucm9vbV9pZF9mayA9IG5ld1V1aWQ7XHJcbiAgICBuZXdSb29tLmZsb29yX2lkX2ZrID0gbmV3Rmxvb3JVdWlkIHx8IG5ld1Jvb20uZmxvb3JfaWRfZms7XHJcbiAgICBkZWxldGUgbmV3Um9vbS5pZDtcclxuICAgIGF3YWl0IHN0b3JlLmFkZChuZXdSb29tKTtcclxuICAgIGF3YWl0IHR4MS5kb25lO1xyXG5cclxuICAgIC8vIG5vdyBhbHNvIGNvcHkgdGhlIHByb2R1Y3RzIGluIHRoZSBvbGQgcm9vbSB0byB0aGUgbmV3IHJvb21cclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgZ2V0UHJvZHVjdHNGb3JSb29tKHJvb21VdWlkKTtcclxuICAgIGNvbnN0IHR4MiA9IGRiLnRyYW5zYWN0aW9uKFwicHJvZHVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBwcm9kdWN0U3RvcmUgPSB0eDIub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBwcm9kdWN0cykge1xyXG4gICAgICAgIHByb2R1Y3Qucm9vbV9pZF9mayA9IG5ld1V1aWQ7XHJcbiAgICAgICAgcHJvZHVjdC51dWlkID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgYXdhaXQgcHJvZHVjdFN0b3JlLmFkZChwcm9kdWN0KTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eDIuZG9uZTtcclxufVxyXG5cclxuLy8gZ2V0IGFsbCBmbG9vcnMgaW4gdGhpcyBwcm9qZWN0IFxyXG5hc3luYyBmdW5jdGlvbiBnZXRGbG9vcnMocHJvamVjdF9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wibG9jYXRpb25zXCIsIFwiYnVpbGRpbmdzXCIsIFwiZmxvb3JzXCJdLCBcInJlYWRvbmx5XCIpO1xyXG5cclxuICAgIC8vIEdldCBsb2NhdGlvbnMgcmVsYXRlZCB0byB0aGUgcHJvamVjdFxyXG4gICAgY29uc3QgbG9jYXRpb25TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibG9jYXRpb25zXCIpO1xyXG4gICAgY29uc3QgbG9jYXRpb25zID0gYXdhaXQgbG9jYXRpb25TdG9yZS5pbmRleChcInByb2plY3RfaWRfZmtcIikuZ2V0QWxsKHByb2plY3RfaWQpO1xyXG5cclxuICAgIC8vIEdldCBidWlsZGluZ3MgcmVsYXRlZCB0byB0aG9zZSBsb2NhdGlvbnNcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGxldCBidWlsZGluZ3MgPSBbXTtcclxuICAgIGZvciAoY29uc3QgbG9jYXRpb24gb2YgbG9jYXRpb25zKSB7XHJcbiAgICAgICAgY29uc3QgbG9jYXRpb25CdWlsZGluZ3MgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmluZGV4KFwibG9jYXRpb25faWRfZmtcIikuZ2V0QWxsKGxvY2F0aW9uLnV1aWQpO1xyXG4gICAgICAgIGJ1aWxkaW5ncyA9IGJ1aWxkaW5ncy5jb25jYXQobG9jYXRpb25CdWlsZGluZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEdldCBmbG9vcnMgdW5kZXIgdGhvc2UgYnVpbGRpbmdzXHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBsZXQgZmxvb3JzID0gW107XHJcbiAgICBmb3IgKGNvbnN0IGJ1aWxkaW5nIG9mIGJ1aWxkaW5ncykge1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nRmxvb3JzID0gYXdhaXQgZmxvb3JTdG9yZS5pbmRleChcImJ1aWxkaW5nX2lkX2ZrXCIpLmdldEFsbChidWlsZGluZy51dWlkKTtcclxuICAgICAgICBmbG9vcnMgPSBmbG9vcnMuY29uY2F0KGJ1aWxkaW5nRmxvb3JzKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmbG9vckFycmF5ID0gW107XHJcbiAgICBmb3IgKGNvbnN0IGZsb29yIG9mIGZsb29ycykge1xyXG4gICAgICAgIGZsb29yQXJyYXkucHVzaCh7dXVpZDogZmxvb3IudXVpZCwgbmFtZTogZmxvb3IubmFtZX0pO1xyXG4gICAgfSAgIFxyXG4gICAgcmV0dXJuIGZsb29yQXJyYXk7XHJcbn1cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiByZW1vdmVQcm9qZWN0KHByb2plY3RfaWQpIHtcclxuICAgIC8vIHJhdGhlciB0aGFuIGRlbGV0ZSBhbnl0aGluZyBmcm9tIHRoZSBkYXRhYmFzZSwgaSBqdXN0IHdhbnQgdG8gY2hhbmdlIHRoZSBvd25lcl9pZiBvZiB0aGUgcHJvamVjdCB0byBwcmVwZW5kXSA5OTkgaW4gZnJvbnQgXHJcbiAgICAvLyBidXQgb25seSBpbiB0aGUgcHJvamVjdHMgdGFibGUsIHNvIHRoYXQgaXQgaXMgbm90IHNob3duIGluIHRoZSBwcm9qZWN0IGxpc3RcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicHJvamVjdHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcbiAgICBjb25zdCBwcm9qZWN0ID0gYXdhaXQgc3RvcmUuZ2V0KHByb2plY3RfaWQpO1xyXG4gICAgcHJvamVjdC5vd25lcl9pZCA9IFwiOTk5XCIgKyBwcm9qZWN0Lm93bmVyX2lkO1xyXG4gICAgYXdhaXQgc3RvcmUucHV0KHByb2plY3QpO1xyXG4gICAgYXdhaXQgdHguZG9uZTsgICBcclxufVxyXG5cclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBjb3B5UHJvamVjdChwcm9qZWN0X2lkLCBwcm9qZWN0TmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wicHJvamVjdHNcIiwgXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCJdLCBcInJlYWR3cml0ZVwiKTtcclxuXHJcbiAgICAvLyBDb3B5IHRoZSBwcm9qZWN0XHJcbiAgICBjb25zdCBwcm9qZWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2plY3RzXCIpO1xyXG4gICAgY29uc3QgcHJvamVjdCA9IGF3YWl0IHByb2plY3RTdG9yZS5nZXQocHJvamVjdF9pZCk7XHJcbiAgICBjb25zdCBuZXdQcm9qZWN0SUQgPSBnZW5lcmF0ZVVVSUQoKTtcclxuICAgIGNvbnN0IG5ld1Byb2plY3QgPSB7IC4uLnByb2plY3QsIHV1aWQ6IG5ld1Byb2plY3RJRCwgbmFtZTogcHJvamVjdE5hbWUsIHJvb21faWRfZms6IG5ld1Byb2plY3RJRCB9O1xyXG4gICAgYXdhaXQgcHJvamVjdFN0b3JlLmFkZChuZXdQcm9qZWN0KTtcclxuXHJcbiAgICAvLyBDb3B5IHRoZSBsb2NhdGlvbnNcclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuaW5kZXgoXCJwcm9qZWN0X2lkX2ZrXCIpLmdldEFsbChwcm9qZWN0X2lkKTtcclxuICAgIGZvciAoY29uc3QgbG9jYXRpb24gb2YgbG9jYXRpb25zKSB7XHJcbiAgICAgICAgY29uc3QgbmV3TG9jYXRpb25JRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgIGNvbnN0IG5ld0xvY2F0aW9uID0geyAuLi5sb2NhdGlvbiwgdXVpZDogbmV3TG9jYXRpb25JRCwgcHJvamVjdF9pZF9mazogbmV3UHJvamVjdElELCByb29tX2lmX2ZrOiBuZXdMb2NhdGlvbklEIH07XHJcbiAgICAgICAgYXdhaXQgbG9jYXRpb25TdG9yZS5hZGQobmV3TG9jYXRpb24pO1xyXG5cclxuICAgICAgICAvLyBDb3B5IHRoZSBidWlsZGluZ3NcclxuICAgICAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdzID0gYXdhaXQgYnVpbGRpbmdTdG9yZS5pbmRleChcImxvY2F0aW9uX2lkX2ZrXCIpLmdldEFsbChsb2NhdGlvbi51dWlkKTsgICAgXHJcbiAgICAgICAgZm9yIChjb25zdCBidWlsZGluZyBvZiBidWlsZGluZ3MpIHtcclxuICAgICAgICAgICAgY29uc3QgbmV3QnVpbGRpbmdJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgICAgICBjb25zdCBuZXdCdWlsZGluZyA9IHsgLi4uYnVpbGRpbmcsIHV1aWQ6IG5ld0J1aWxkaW5nSUQsIGxvY2F0aW9uX2lkX2ZrOiBuZXdMb2NhdGlvbklELCByb29tX2lkX2ZrOiBuZXdCdWlsZGluZ0lEIH07XHJcbiAgICAgICAgICAgIGF3YWl0IGJ1aWxkaW5nU3RvcmUuYWRkKG5ld0J1aWxkaW5nKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENvcHkgdGhlIGZsb29yc1xyXG4gICAgICAgICAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICAgICAgICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuaW5kZXgoXCJidWlsZGluZ19pZF9ma1wiKS5nZXRBbGwoYnVpbGRpbmcudXVpZCk7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmxvb3Igb2YgZmxvb3JzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdGbG9vcklEID0gZ2VuZXJhdGVVVUlEKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdGbG9vciA9IHsgLi4uZmxvb3IsIHV1aWQ6IG5ld0Zsb29ySUQsIGJ1aWxkaW5nX2lkX2ZrOiBuZXdCdWlsZGluZ0lELCByb29tX2lkX2ZrOiBuZXdGbG9vcklEIH07XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBmbG9vclN0b3JlLmFkZChuZXdGbG9vcik7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ29weSB0aGUgcm9vbXNcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByb29tcyA9IGF3YWl0IHJvb21TdG9yZS5pbmRleChcImZsb29yX2lkX2ZrXCIpLmdldEFsbChmbG9vci51dWlkKTtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Jvb21JRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Jvb20gPSB7IC4uLnJvb20sIHV1aWQ6IG5ld1Jvb21JRCwgZmxvb3JfaWRfZms6IG5ld0Zsb29ySUQsIHJvb21faWRfZms6IG5ld1Jvb21JRCB9O1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHJvb21TdG9yZS5hZGQobmV3Um9vbSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIENvcHkgdGhlIHByb2R1Y3RzXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvZHVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IHByb2R1Y3RTdG9yZS5pbmRleChcInJvb21faWRfZmtcIikuZ2V0QWxsKHJvb20udXVpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwcm9kdWN0IG9mIHByb2R1Y3RzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Byb2R1Y3RJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQcm9kdWN0ID0geyAuLi5wcm9kdWN0LCB1dWlkOiBuZXdQcm9kdWN0SUQsIHJvb21faWRfZms6IG5ld1Jvb21JRCB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwcm9kdWN0U3RvcmUuYWRkKG5ld1Byb2R1Y3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIG5ld1Byb2plY3RJRDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkTm90ZShyb29tVXVpZCwgbm90ZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJub3Rlc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJub3Rlc1wiKTtcclxuICAgIGNvbnN0IG5ld05vdGVJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7ICAgIFxyXG4gICAgY29uc3QgbmV3Tm90ZSA9IHtcclxuICAgICAgICBjcmVhdGVkX29uOiBub3csXHJcbiAgICAgICAgbGFzdF91cGRhdGVkOiBub3csXHJcbiAgICAgICAgbm90ZTogbm90ZSxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0VXNlcklEKCksIFxyXG4gICAgICAgIHJvb21faWRfZms6IHJvb21VdWlkLCAgICAgICAgXHJcbiAgICAgICAgdXVpZDogbmV3Tm90ZUlELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChuZXdOb3RlKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICByZXR1cm4gbmV3Tm90ZUlEO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZW1vdmVOb3RlQnlVVUlEKG5vdGVVdWlkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcIm5vdGVzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcIm5vdGVzXCIpO1xyXG4gICAgYXdhaXQgc3RvcmUuZGVsZXRlKG5vdGVVdWlkKTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGFkZEltYWdlKHJvb21VdWlkLCBpbWFnZSkge1xyXG5cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0VXNlcih1c2VyX2lkKSB7XHJcbiAgICB1c2VyX2lkID0gdXNlcl9pZCsgXCJcIjsgICAgXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcInVzZXJzXCIsIFwicmVhZG9ubHlcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICByZXR1cm4gYXdhaXQgc3RvcmUuZ2V0KHVzZXJfaWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVVc2VyKGZvcm1kYXRhLCB1c2VyX2lkKSB7XHJcbiAgICB1c2VyX2lkID0gdXNlcl9pZCArIFwiXCI7XHJcblxyXG5cclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwidXNlcnNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwidXNlcnNcIik7XHJcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgc3RvcmUuZ2V0KHVzZXJfaWQpOyAgICAgICBcclxuXHJcbiAgICB1c2VyLm5hbWUgPSBmb3JtZGF0YS5uYW1lO1xyXG4gICAgdXNlci5jb2RlID0gZm9ybWRhdGEuY29kZTsgICAgXHJcbiAgICB1c2VyLmVtYWlsID0gZm9ybWRhdGEuZW1haWw7XHJcbiAgICB1c2VyLnBhc3N3b3JkID0gZm9ybWRhdGEucGFzc3dvcmQ7XHJcbiAgICB1c2VyLmxhc3RfdXBkYXRlZCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcblxyXG4gICAgYXdhaXQgc3RvcmUucHV0KHVzZXIpO1xyXG4gICAgYXdhaXQgdHguZG9uZTtcclxuXHJcbiAgICAvLyB0aGlzIGhhcyBhbHNvIGdvdCB0byBzYXZlIHRvIG9ubGluZSBkYiBhdCB0aGlzIHRpbWUgYWN0dWFsbHksIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChDT05GSUcuQVBJX0VORFBPSU5UUy5TWU5DX1VTRVJfQUNDT1VOVCwge1xyXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXNlcilcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgZXJyb3IhIFN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2VEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ1Jlc3BvbnNlIERhdGE6JywgcmVzcG9uc2VEYXRhKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdTdGF0dXM6JywgcmVzcG9uc2VEYXRhLnN0YXR1cyk7ICAvLyBlcnJvciB8IHN1Y2Nlc3NcclxuICAgIHJldHVybihyZXNwb25zZURhdGEpOyAgXHJcbiAgICByZXR1cm4gdXNlcjsgICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldFNjaGVkdWxlUGVyUm9vbShwcm9qZWN0SWQpIHtcclxuICAgIGlmICghcHJvamVjdElkKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBQcm9qZWN0IElEJyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW1wicHJvamVjdHNcIiwgXCJsb2NhdGlvbnNcIiwgXCJidWlsZGluZ3NcIiwgXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcInByb2R1Y3RzXCIsIFwiaW1hZ2VzXCIsIFwibm90ZXNcIl0sIFwicmVhZG9ubHlcIik7XHJcblxyXG4gICAgY29uc3QgcHJvamVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9qZWN0c1wiKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImxvY2F0aW9uc1wiKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImJ1aWxkaW5nc1wiKTtcclxuICAgIGNvbnN0IGZsb29yU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZsb29yc1wiKTtcclxuICAgIGNvbnN0IHJvb21TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicm9vbXNcIik7XHJcbiAgICBjb25zdCBwcm9kdWN0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInByb2R1Y3RzXCIpO1xyXG4gICAgY29uc3QgaW1hZ2VTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiaW1hZ2VzXCIpO1xyXG4gICAgY29uc3Qgbm90ZVN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJub3Rlc1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0ID0gYXdhaXQgcHJvamVjdFN0b3JlLmdldChwcm9qZWN0SWQpO1xyXG4gICAgaWYgKCFwcm9qZWN0KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQcm9qZWN0IG5vdCBmb3VuZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuaW5kZXgoXCJwcm9qZWN0X2lkX2ZrXCIpLmdldEFsbChwcm9qZWN0SWQpO1xyXG4gICAgY29uc3QgYnVpbGRpbmdzID0gYXdhaXQgYnVpbGRpbmdTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGZsb29yU3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCByb29tcyA9IGF3YWl0IHJvb21TdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgcHJvZHVjdFN0b3JlLmdldEFsbCgpO1xyXG4gICAgY29uc3QgaW1hZ2VzID0gYXdhaXQgaW1hZ2VTdG9yZS5nZXRBbGwoKTtcclxuICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgbm90ZVN0b3JlLmdldEFsbCgpO1xyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xyXG5cclxuICAgIHJvb21zLmZvckVhY2gocm9vbSA9PiB7XHJcbiAgICAgICAgY29uc3Qgcm9vbVByb2R1Y3RzID0gcHJvZHVjdHMuZmlsdGVyKHByb2R1Y3QgPT4gcHJvZHVjdC5yb29tX2lkX2ZrID09PSByb29tLnV1aWQpO1xyXG4gICAgICAgIGNvbnN0IHJvb21JbWFnZXMgPSBpbWFnZXMuZmlsdGVyKGltYWdlID0+IGltYWdlLnJvb21faWRfZmsgPT09IHJvb20udXVpZCk7XHJcbiAgICAgICAgY29uc3Qgcm9vbU5vdGVzID0gbm90ZXMuZmlsdGVyKG5vdGUgPT4gbm90ZS5yb29tX2lkX2ZrID09PSByb29tLnV1aWQpO1xyXG5cclxuICAgICAgICBjb25zdCBmbG9vciA9IGZsb29ycy5maW5kKGZsb29yID0+IGZsb29yLnV1aWQgPT09IHJvb20uZmxvb3JfaWRfZmspO1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkaW5nID0gYnVpbGRpbmdzLmZpbmQoYnVpbGRpbmcgPT4gYnVpbGRpbmcudXVpZCA9PT0gZmxvb3IuYnVpbGRpbmdfaWRfZmspO1xyXG4gICAgICAgIGNvbnN0IGxvY2F0aW9uID0gbG9jYXRpb25zLmZpbmQobG9jYXRpb24gPT4gbG9jYXRpb24udXVpZCA9PT0gYnVpbGRpbmcubG9jYXRpb25faWRfZmspO1xyXG5cclxuICAgICAgICByb29tUHJvZHVjdHMuZm9yRWFjaChwcm9kdWN0ID0+IHtcclxuICAgICAgICAgICAgaWYgKCFyZXN1bHRbcm9vbS5zbHVnXSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0W3Jvb20uc2x1Z10gPSBbXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSSBuZWVkIHRvIGVuc3VyZSB0aGF0IHRoZSBwcm9kdWN0IGlzIG5vdCBhbHJlYWR5IGluIHRoZSBhcnJheSBmb3IgdGhpcyByb29tXHJcbiAgICAgICAgICAgIGlmIChyZXN1bHRbcm9vbS5zbHVnXS5maW5kKHAgPT4gcC5za3UgPT09IHByb2R1Y3Quc2t1KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9ICAgXHJcblxyXG4gICAgICAgICAgICByZXN1bHRbcm9vbS5zbHVnXS5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHJvb21fc2x1Zzogcm9vbS5zbHVnLFxyXG4gICAgICAgICAgICAgICAgcm9vbV9uYW1lOiByb29tLm5hbWUsXHJcbiAgICAgICAgICAgICAgICByb29tX3dpZHRoOiByb29tLndpZHRoLFxyXG4gICAgICAgICAgICAgICAgcm9vbV9sZW5ndGg6IHJvb20ubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgcm9vbV9oZWlnaHQ6IHJvb20uaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgZmxvb3JfbmFtZTogZmxvb3IubmFtZSxcclxuICAgICAgICAgICAgICAgIGJ1aWxkaW5nX25hbWU6IGJ1aWxkaW5nLm5hbWUsXHJcbiAgICAgICAgICAgICAgICBsb2NhdGlvbl9uYW1lOiBsb2NhdGlvbi5uYW1lLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9uYW1lOiBwcm9qZWN0Lm5hbWUsXHJcbiAgICAgICAgICAgICAgICByZWY6IHByb2R1Y3QucmVmLFxyXG4gICAgICAgICAgICAgICAgcHJvZHVjdF9uYW1lOiBwcm9kdWN0LnByb2R1Y3RfbmFtZSxcclxuICAgICAgICAgICAgICAgIHByb2R1Y3Rfc2x1ZzogcHJvZHVjdC5wcm9kdWN0X3NsdWcsXHJcbiAgICAgICAgICAgICAgICBza3U6IHByb2R1Y3Quc2t1LFxyXG4gICAgICAgICAgICAgICAgY3VzdG9tOiBwcm9kdWN0LmN1c3RvbSxcclxuICAgICAgICAgICAgICAgIG93bmVyX2lkOiBwcm9kdWN0Lm93bmVyX2lkLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9pZF9mazogcHJvamVjdC51dWlkLFxyXG4gICAgICAgICAgICAgICAgcHJvamVjdF9zbHVnOiBwcm9qZWN0LnNsdWcsXHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0X3ZlcnNpb246IHByb2plY3QudmVyc2lvbixcclxuICAgICAgICAgICAgICAgIHF0eTogcm9vbVByb2R1Y3RzLmZpbHRlcihwID0+IHAuc2t1ID09PSBwcm9kdWN0LnNrdSkubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgaW1hZ2VfZmlsZW5hbWVzOiByb29tSW1hZ2VzLm1hcChpbWFnZSA9PiBpbWFnZS5zYWZlX2ZpbGVuYW1lKS5qb2luKCd8JyksXHJcbiAgICAgICAgICAgICAgICByb29tX25vdGVzOiByb29tTm90ZXMubWFwKG5vdGUgPT4gYCR7bm90ZS5ub3RlfSAodXBkYXRlZDogJHtuZXcgRGF0ZShub3RlLmxhc3RfdXBkYXRlZCB8fCBub3RlLmNyZWF0ZWRfb24pLnRvTG9jYWxlU3RyaW5nKCl9KWApLmpvaW4oJ3wnKVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvZ2luVXNlcihmb3JtRGF0YSkgeyAgICBcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwidXNlcnNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJ1c2Vyc1wiKTtcclxuICAgIGNvbnN0IGluZGV4ID0gc3RvcmUuaW5kZXgoXCJlbWFpbFwiKTtcclxuXHJcbiAgICAvLyBmb3JtRGF0YSBpcyBhIGpzIGZvcm1EYXRhIG9iamVjdCBmcm9tIHRoZSBzdWJtaXR0ZWQgZm9ybVxyXG4gICAgLy8gcGFyc2UgdGhlIGVtYWlsIGFuZCBwYXNzd29yZCBmcm9tIHRoZSBmb3JtIGRhdGFcclxuICAgIGNvbnN0IGZvcm1EYXRhT2JqID0ge307XHJcbiAgICBmb3JtRGF0YS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiAoZm9ybURhdGFPYmpba2V5XSA9IHZhbHVlKSk7ICAgICAgICBcclxuICAgIGlmICghZm9ybURhdGFPYmoubW9kYWxfZm9ybV9lbWFpbCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVtYWlsIGlzIHJlcXVpcmVkXCIpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGluZGV4LmdldChmb3JtRGF0YU9iai5tb2RhbF9mb3JtX2VtYWlsLnRvTG93ZXJDYXNlKCkpO1xyXG5cclxuICAgIGlmICh1c2VyICYmIHVzZXIucGFzc3dvcmQudG9Mb3dlckNhc2UoKSA9PT0gZm9ybURhdGFPYmoubW9kYWxfZm9ybV9wYXNzd29yZC50b0xvd2VyQ2FzZSgpKSB7XHJcbiAgICAgICAgLy8gZGVzdHJveSBhbGwgdGhlIGxvY2FsIHN0b3JhZ2UgaXRlbXNcclxuICAgICAgICBsb2NhbFN0b3JhZ2UuY2xlYXIoKTtcclxuICAgICAgICAvLyBzZXQgdGhlIHVzZXJfaWQgY29va2llXHJcbiAgICAgICAgYXdhaXQgdXRpbHMuc2V0Q29va2llKCd1c2VyX2lkJywgdXNlci51dWlkLCAzNjUpO1xyXG4gICAgICAgIC8vIHNldCB0aGUgdXNlcl9uYW1lIGNvb2tpZVxyXG4gICAgICAgIGF3YWl0IHV0aWxzLnNldENvb2tpZSgndXNlcl9uYW1lJywgdXNlci5uYW1lLCAzNjUpO1xyXG5cclxuICAgICAgICByZXR1cm4gdXNlcjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSAgIFxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRGYXZvdXJpdGVzKHVzZXJfaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgaW5pdERCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwiZmF2b3VyaXRlc1wiLCBcInJlYWRvbmx5XCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZhdm91cml0ZXNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwib3duZXJfaWRcIik7XHJcbiAgICB1c2VyX2lkID0gU3RyaW5nKHVzZXJfaWQpO1xyXG4gICAgcmV0dXJuIGF3YWl0IGluZGV4LmdldEFsbCh1c2VyX2lkKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYWRkRmF2UHJvZHVjdChza3UsIHByb2R1Y3RfbmFtZSwgdXNlcl9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJmYXZvdXJpdGVzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImZhdm91cml0ZXNcIik7XHJcbiAgICBjb25zdCBuZXdGYXZJRCA9IGdlbmVyYXRlVVVJRCgpO1xyXG5cclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgnVCcsICcgJyk7XHJcbiAgICBjb25zdCBuZXdGYXYgPSB7XHJcbiAgICAgICAgY3JlYXRlZF9vbjogbm93LFxyXG4gICAgICAgIGxhc3RfdXBkYXRlZDogbm93LFxyXG4gICAgICAgIHNrdTogc2t1LFxyXG4gICAgICAgIHByb2R1Y3RfbmFtZTogcHJvZHVjdF9uYW1lLFxyXG4gICAgICAgIG93bmVyX2lkOiB1c2VyX2lkLFxyXG4gICAgICAgIHV1aWQ6IG5ld0ZhdklELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIENoZWNrIGlmIHRoZSBwcm9kdWN0IGlzIGFscmVhZHkgaW4gdGhlIGZhdm91cml0ZXMgZm9yIHRoZSBzYW1lIHVzZXJfaWRcclxuICAgIC8vIG1ha2Ugc3VyZSBub3QgdG8gc2F2ZSB0aCBzYW1lIHNrdSBmb3IgdGhlIHNhbWUgdXNlciEgIHdlIG5vdyBoYXZlIGtleXMgb24gdGVoIGNvbHVtbnMgXCJza3VcIiBhbmQgXCJvd25lcl9pZFwiXHJcbiAgICBjb25zdCBhbGxGYXZzID0gYXdhaXQgc3RvcmUuZ2V0QWxsKCk7XHJcbiAgICBjb25zdCBleGlzdGluZ0ZhdiA9IGFsbEZhdnMuZmluZChmYXYgPT4gZmF2LnNrdSA9PT0gc2t1ICYmIGZhdi5vd25lcl9pZCA9PT0gdXNlcl9pZCk7XHJcbiAgICBpZiAoZXhpc3RpbmdGYXYpIHtcclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ1Byb2R1Y3QgYWxyZWFkeSBpbiBmYXZvdXRpdGVzJywge3N0YXR1czond2FybmluZycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgIGNvbnNvbGUud2FybignUHJvZHVjdCBhbHJlYWR5IGluIGZhdm91cml0ZXM6JywgZXhpc3RpbmdGYXYpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCBzdG9yZS5hZGQobmV3RmF2KTtcclxuICAgIGF3YWl0IHR4LmRvbmU7XHJcbiAgICBVSWtpdC5ub3RpZmljYXRpb24oJ0FkZGVkIGZhdm91cml0ZSBwcm9kdWN0Jywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgcmV0dXJuIG5ld0ZhdklEO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBhZGRGYXZvdXJpdGVUb1Jvb20oc2t1LCByb29tX2lkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgLy8gZmlyc3QgZ2V0IHRoZSBmdWxsIGRhdGEgYWJvdXQgdGhlIHByb2R1Y3QgZnJvbSB0aGUgXCJwcm9kdWN0X2RhdGFcIiB0YWJsZSBieSBza3VcclxuICAgIGNvbnN0IHByb2R1Y3REYXRhID0gYXdhaXQgZ2V0UHJvZHVjdHMoKTtcclxuICAgIGNvbnNvbGUubG9nKCdQcm9kdWN0IERhdGE6JywgcHJvZHVjdERhdGEpOyAgXHJcbiAgICBjb25zdCBwID0gcHJvZHVjdERhdGEuZmluZChwID0+IHAucHJvZHVjdF9jb2RlID09PSBza3UpO1xyXG4gICAgaWYgKCFwKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9kdWN0IHdpdGggU0tVICR7c2t1fSBub3QgZm91bmRgKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBidWlsZCB0aGUgcHJvZHVjdCBkYXRhIG9iamVjdCAgICBcclxuICAgIGNvbnN0IG5ld1Byb2R1Y3REYXRhID0ge1xyXG4gICAgICAgIGJyYW5kOiBwLnNpdGUsXHJcbiAgICAgICAgdHlwZTogcC50eXBlX3NsdWcsXHJcbiAgICAgICAgcHJvZHVjdF9zbHVnOiBwLnByb2R1Y3Rfc2x1ZyxcclxuICAgICAgICBwcm9kdWN0X25hbWU6IHAucHJvZHVjdF9uYW1lLFxyXG4gICAgICAgIHNrdTogcC5wcm9kdWN0X2NvZGUsXHJcbiAgICAgICAgcm9vbV9pZF9mazogcm9vbV9pZCxcclxuICAgICAgICBvd25lcl9pZDogYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyksXHJcbiAgICAgICAgY3VzdG9tOiAwLFxyXG4gICAgICAgIHJlZjogXCJcIixcclxuICAgICAgICBjcmVhdGVkX29uOiBhd2FpdCB1dGlscy5mb3JtYXREYXRlVGltZShuZXcgRGF0ZSgpKSxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgIG9yZGVyOiBudWxsLFxyXG4gICAgICAgIHJhbmdlOiBudWxsXHJcbiAgICB9O1xyXG4gICAgdGhpcy5zYXZlUHJvZHVjdFRvUm9vbShuZXdQcm9kdWN0RGF0YSk7ICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZUZhdm91cml0ZSh1dWlkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgdXVpZCA9IHV1aWQgKyBcIlwiO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImZhdm91cml0ZXNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmF2b3VyaXRlc1wiKTsgICAgXHJcbiAgICBhd2FpdCBzdG9yZS5kZWxldGUodXVpZCk7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRJbWFnZXNGb3JSb29tKHJvb21faWQpIHtcclxuICAgIC8vIGdldCBhbGwgaW1hZ2VzIGZvciB0aGlzIHJvb20gYW5kIHRoaXMgdXNlclxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJpbWFnZXNcIiwgXCJyZWFkb25seVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJpbWFnZXNcIik7XHJcbiAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KFwicm9vbV9pZF9ma1wiKTtcclxuICAgIGNvbnN0IGltYWdlcyA9IGF3YWl0IGluZGV4LmdldEFsbChyb29tX2lkKTtcclxuICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRVc2VySUQoKVxyXG4gICAgcmV0dXJuIGltYWdlcy5maWx0ZXIoaW1hZ2UgPT4gaW1hZ2Uub3duZXJfaWQgPT09IHVzZXJfaWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzYXZlSW1hZ2VGb3JSb29tKHJvb21faWQsIGRhdGEpICB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IGluaXREQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihcImltYWdlc1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJpbWFnZXNcIik7XHJcbiAgICBjb25zdCBuZXdJbWFnZUlEID0gZ2VuZXJhdGVVVUlEKCk7XHJcblxyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKCdUJywgJyAnKTtcclxuICAgIGNvbnN0IG5ld0ltYWdlID0ge1xyXG4gICAgICAgIGNyZWF0ZWRfb246IG5vdyxcclxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5vdyxcclxuICAgICAgICByb29tX2lkX2ZrOiByb29tX2lkLFxyXG4gICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRVc2VySUQoKSxcclxuICAgICAgICB1dWlkOiBuZXdJbWFnZUlELFxyXG4gICAgICAgIHZlcnNpb246IFwiMVwiLFxyXG4gICAgICAgIGZpbGVuYW1lOiBkYXRhLmZpbGVOYW1lLFxyXG4gICAgICAgIHNhZmVfZmlsZW5hbWU6IGRhdGEuc2FmZUZpbGVOYW1lXHJcbiAgICB9O1xyXG5cclxuICAgIGF3YWl0IHN0b3JlLmFkZChuZXdJbWFnZSk7XHJcbiAgICBhd2FpdCB0eC5kb25lO1xyXG4gICAgcmV0dXJuIG5ld0ltYWdlSUQ7XHJcblxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBwdXNoVXNlckRhdGEodXNlcl9pZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBpbml0REIoKTtcclxuICAgIC8vIGdhdGhlciBhbGwgdGhlIHVzZXIgZGF0YSBmcm9tIHRoZSBpbmRleGVkREIgaW5jbHVzaW5nIGFsbCB0aGUgcHJvamVjdHMsIGxvY2F0aW9ucywgYnVpbGRpbmdzLCBmbG9vcnMsIHJvb21zLCBwcm9kdWN0cywgaW1hZ2VzLCBub3RlcywgZmF2b3VyaXRlc1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihbXCJwcm9qZWN0c1wiLCBcImxvY2F0aW9uc1wiLCBcImJ1aWxkaW5nc1wiLCBcImZsb29yc1wiLCBcInJvb21zXCIsIFwicHJvZHVjdHNcIiwgXCJpbWFnZXNcIiwgXCJub3Rlc1wiLCBcImZhdm91cml0ZXNcIl0sIFwicmVhZG9ubHlcIik7ICBcclxuICAgIGNvbnN0IHByb2plY3RTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicHJvamVjdHNcIik7XHJcbiAgICBjb25zdCBsb2NhdGlvblN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJsb2NhdGlvbnNcIik7XHJcbiAgICBjb25zdCBidWlsZGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJidWlsZGluZ3NcIik7XHJcbiAgICBjb25zdCBmbG9vclN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmbG9vcnNcIik7XHJcbiAgICBjb25zdCByb29tU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJvb21zXCIpO1xyXG4gICAgY29uc3QgcHJvZHVjdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJwcm9kdWN0c1wiKTtcclxuICAgIGNvbnN0IGltYWdlU3RvcmUgPSB0eC5vYmplY3RTdG9yZShcImltYWdlc1wiKTtcclxuICAgIGNvbnN0IG5vdGVTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwibm90ZXNcIik7XHJcbiAgICBjb25zdCBmYXZTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwiZmF2b3VyaXRlc1wiKTtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0cyA9IGF3YWl0IHByb2plY3RTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IGxvY2F0aW9ucyA9IGF3YWl0IGxvY2F0aW9uU3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBidWlsZGluZ3MgPSBhd2FpdCBidWlsZGluZ1N0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3QgZmxvb3JzID0gYXdhaXQgZmxvb3JTdG9yZS5pbmRleChcIm93bmVyX2lkXCIpLmdldEFsbCh1c2VyX2lkKTtcclxuICAgIGNvbnN0IHJvb21zID0gYXdhaXQgcm9vbVN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBwcm9kdWN0U3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBpbWFnZXMgPSBhd2FpdCBpbWFnZVN0b3JlLmluZGV4KFwib3duZXJfaWRcIikuZ2V0QWxsKHVzZXJfaWQpO1xyXG4gICAgY29uc3Qgbm90ZXMgPSBhd2FpdCBub3RlU3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcbiAgICBjb25zdCBmYXZvdXJpdGVzID0gYXdhaXQgZmF2U3RvcmUuaW5kZXgoXCJvd25lcl9pZFwiKS5nZXRBbGwodXNlcl9pZCk7XHJcblxyXG4gICAgLy8gbm93IHB1c2ggYWxsIHRoaXMgZGF0YSB0byB0aGUgc2VydmVyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IHtcclxuICAgICAgICBwcm9qZWN0czogcHJvamVjdHMsXHJcbiAgICAgICAgbG9jYXRpb25zOiBsb2NhdGlvbnMsXHJcbiAgICAgICAgYnVpbGRpbmdzOiBidWlsZGluZ3MsXHJcbiAgICAgICAgZmxvb3JzOiBmbG9vcnMsXHJcbiAgICAgICAgcm9vbXM6IHJvb21zLFxyXG4gICAgICAgIHByb2R1Y3RzOiBwcm9kdWN0cyxcclxuICAgICAgICBpbWFnZXM6IGltYWdlcyxcclxuICAgICAgICBub3Rlczogbm90ZXMsXHJcbiAgICAgICAgZmF2b3VyaXRlczogZmF2b3VyaXRlc1xyXG4gICAgfTtcclxuXHJcbiAgICAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goQ09ORklHLkFQSV9FTkRQT0lOVFMuU1lOQ19VU0VSX0RBVEEsIHtcclxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZXJEYXRhKVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCBlcnJvciEgU3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXNwb25zZURhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnUmVzcG9uc2UgRGF0YTonLCByZXNwb25zZURhdGEpO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ1N0YXR1czonLCByZXNwb25zZURhdGEuc3RhdHVzKTsgIC8vIGVycm9yIHwgc3VjY2Vzc1xyXG4gICAgcmV0dXJuKHJlc3BvbnNlRGF0YSk7ICAgIFxyXG59XHJcblxyXG5cclxuLy8gRXhwb3J0IHRoZSBmdW5jdGlvbnNcclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBnZW5lcmF0ZVVVSUQsIFxyXG4gICAgaW5pdERCLFxyXG4gICAgZmV0Y2hBbmRTdG9yZVByb2R1Y3RzLFxyXG4gICAgZmV0Y2hBbmRTdG9yZVVzZXJzLFxyXG4gICAgZ2V0UHJvZHVjdHMsXHJcbiAgICBnZXRQcm9qZWN0cywgICAgXHJcbiAgICBnZXRQcm9qZWN0QnlVVUlELFxyXG4gICAgdXBkYXRlUHJvamVjdERldGFpbHMsXHJcbiAgICBzeW5jRGF0YSxcclxuICAgIHNhdmVQcm9kdWN0VG9Sb29tLFxyXG4gICAgZ2V0UHJvZHVjdHNGb3JSb29tLFxyXG4gICAgZGVsZXRlUHJvZHVjdEZyb21Sb29tLFxyXG4gICAgc2V0U2t1UXR5Rm9yUm9vbSxcclxuICAgIHVwZGF0ZVByb2R1Y3RSZWYsXHJcbiAgICBnZXRQcm9qZWN0U3RydWN0dXJlLFxyXG4gICAgZ2V0Um9vbU1ldGEsXHJcbiAgICB1cGRhdGVOYW1lLFxyXG4gICAgYWRkUm9vbSxcclxuICAgIGFkZEZsb29yLFxyXG4gICAgYWRkQnVpbGRpbmcsXHJcbiAgICBhZGRMb2NhdGlvbixcclxuICAgIHJlbW92ZVJvb20sXHJcbiAgICByZW1vdmVGbG9vcixcclxuICAgIHJlbW92ZUJ1aWxkaW5nLFxyXG4gICAgY3JlYXRlUHJvamVjdCxcclxuICAgIHVwZGF0ZVJvb21EaW1lbnNpb24sXHJcbiAgICBjb3B5Um9vbSxcclxuICAgIGdldEZsb29ycyxcclxuICAgIGNvcHlQcm9qZWN0LFxyXG4gICAgZ2V0Um9vbU5vdGVzLCAgICBcclxuICAgIGFkZE5vdGUsXHJcbiAgICBhZGRJbWFnZSxcclxuICAgIHJlbW92ZU5vdGVCeVVVSUQsXHJcbiAgICBnZXRQcm9kdWN0c0ZvclByb2plY3QsXHJcbiAgICBnZXRVc2VyLFxyXG4gICAgdXBkYXRlVXNlcixcclxuICAgIGdldFNjaGVkdWxlUGVyUm9vbSxcclxuICAgIGxvZ2luVXNlcixcclxuICAgIGFkZEZhdlByb2R1Y3QsXHJcbiAgICBnZXRGYXZvdXJpdGVzLFxyXG4gICAgYWRkRmF2b3VyaXRlVG9Sb29tLFxyXG4gICAgcmVtb3ZlRmF2b3VyaXRlLFxyXG4gICAgZ2V0SW1hZ2VzRm9yUm9vbSxcclxuICAgIHNhdmVJbWFnZUZvclJvb20sXHJcbiAgICBwdXNoVXNlckRhdGEsXHJcbiAgICBwdWxsVXNlckRhdGEsXHJcbiAgICByZW1vdmVQcm9qZWN0XHJcbiAgICAvLyBBZGQgb3RoZXIgZGF0YWJhc2UtcmVsYXRlZCBmdW5jdGlvbnMgaGVyZVxyXG59O1xyXG4iLCJjb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbmNvbnN0IGRiID0gcmVxdWlyZSgnLi4vZGInKTtcclxuY29uc3QgdGFibGVzID0gcmVxdWlyZSgnLi90YWJsZXMnKTtcclxuXHJcblxyXG5cclxuY2xhc3MgU2lkZWJhck1vZHVsZSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLm1lbnVIdG1sID0gJyc7XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gZmFsc2U7ICAgICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBpbml0KCkge1xyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGl6ZWQpIHJldHVybjtcclxuICAgICAgICBNdXN0YWNoZS50YWdzID0gW1wiW1tcIiwgXCJdXVwiXTtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2VuZXJhdGVGYXZvdXJpdGVzKGRhdGEpICB7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIGA8cD5Zb3UgaGF2ZSBub3QgYWRkZWQgYW55IGZhb3V0aXRlIHByb2R1Y3RzIHlldC48L3A+XHJcbiAgICAgICAgICAgIDxwPllvdSBjYW4gYWRkIHByb2R1Y3RzIHRvIHlvdXIgZmF2b3VyaXRlcyBieSBmaXJzdCBhZGRpbmcgYSBwcm9kdWN0IHRvIHRoaXMgcm9vbSB0aGVuIGNsaWNraW5nIHRoZSA8c3BhbiBjbGFzcz1cInByb2R1Y3QtbmFtZVwiIHVrLWljb249XCJpY29uOiBoZWFydDtcIj48L3NwYW4+IGljb24gaW4gdGhlIHRhYmxlLjwvcD5gO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG4gICAgICAgIGxldCBodG1sID0gJyc7XHJcblxyXG4gICAgICAgIC8vIHNvcnQgZmF2b3VyaXRlcyBieSBwcm9kdWN0X25hbWUgYW5kIGFkZCBhbGwgc2t1J3Mgd2l0aCB0aGUgc2FtZSBwcm9kdWN0X25hbWUgdG8gYSBjaGlsZCBvYmplY3QuIFxyXG4gICAgICAgIC8vIFRoaXMgd2lsbCBhbGxvdyB1cyB0byBkaXNwbGF5IHRoZSBwcm9kdWN0X25hbWUgb25jZSBhbmQgYWxsIHNrdSdzIHVuZGVyIGl0LlxyXG4gICAgICAgIGxldCBzb3J0ZWQgPSBkYXRhLnJlZHVjZSgoYWNjLCBpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghYWNjW2l0ZW0ucHJvZHVjdF9uYW1lXSkgeyAgXHJcbiAgICAgICAgICAgICAgICBhY2NbaXRlbS5wcm9kdWN0X25hbWVdID0gW107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYWNjW2l0ZW0ucHJvZHVjdF9uYW1lXS5wdXNoKGl0ZW0pO1xyXG4gICAgICAgICAgICByZXR1cm4gYWNjOyBcclxuICAgICAgICB9LCB7fSk7XHJcblxyXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgc29ydGVkIG9iamVjdCBhbmQgZ2VuZXJhdGUgdGhlIGh0bWwgYXMgYSBsaXN0IHdpdGggcHJvZHVjdF9uYW1lIGFuZCBza3Unc1xyXG4gICAgICAgIE9iamVjdC5rZXlzKHNvcnRlZCkuZm9yRWFjaChrZXkgPT4geyAgICBcclxuICAgICAgICAgICAgaHRtbCArPSBgPGxpIGNsYXNzPVwicHJvZHVjdC1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9kdWN0LW5hbWVcIiB1ay1pY29uPVwiaWNvbjogZm9sZGVyO1wiPjwvc3Bhbj4gXHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9kdWN0LW5hbWVcIj48YSBkYXRhLXByb2R1Y3Q9XCIke2tleX1cIiBocmVmPVwiI1wiPiR7a2V5fTwvYT48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8dWwgY2xhc3M9XCJza3UtbGlzdFwiPmA7XHJcbiAgICAgICAgICAgIHNvcnRlZFtrZXldLmZvckVhY2goaXRlbSA9PiB7ICAgXHJcbiAgICAgICAgICAgICAgICBodG1sICs9IGBcclxuICAgICAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJza3UtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInNrdS1uYW1lXCI+PGEgY2xhc3M9XCJhZGQtZmF2LXRvLXJvb21cIiBkYXRhLXNrdT1cIiR7aXRlbS5za3V9XCIgaHJlZj1cIiNcIj4ke2l0ZW0uc2t1fTwvYT48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJtaW51cy1jaXJjbGVcIiBjbGFzcz1cImFjdGlvbi1pY29uIHJlbW92ZS1wcm9kdWN0LWZyb20tZmF2c1wiIGRhdGEtdXVpZD1cIiR7aXRlbS51dWlkfVwiIGRhdGEtYWN0aW9uPVwicmVtb3ZlXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbGk+YDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGh0bWwgKz0gYDwvdWw+PC9saT5gO1xyXG4gICAgICAgIH0pOyAgXHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIFxyXG4gICAgLy8gXHJcbiAgICAvLyByZW5kZXJGYXZvdXJpdGVzXHJcbiAgICAvLyAgICAgXHJcbiAgICBhc3luYyByZW5kZXJGYXZvdXJpdGVzKHVzZXJfaWQpIHsgICAgICAgIFxyXG4gICAgICAgIHVzZXJfaWQudG9TdHJpbmcoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZhdm91cml0ZXMgPSAgYXdhaXQgZGIuZ2V0RmF2b3VyaXRlcyh1c2VyX2lkKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHNpZGVtZW51SHRtbCA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVGYXZvdXJpdGVzKGZhdm91cml0ZXMpOyAgICAgICAgICAgXHJcblxyXG4gICAgICAgICQoJy5mYXZvdXJpdGVzJykuaHRtbChzaWRlbWVudUh0bWwpO1xyXG5cclxuICAgICAgICAkKCcuYWRkLWZhdi10by1yb29tJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjb25zdCBza3UgPSAkKHRoaXMpLmRhdGEoJ3NrdScpO1xyXG4gICAgICAgICAgICBjb25zdCByb29tX2lkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpOyAgICAgICAgICBcclxuICAgICAgICAgICAgYXdhaXQgZGIuYWRkRmF2b3VyaXRlVG9Sb29tKHNrdSwgcm9vbV9pZCk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignRmF2b3VyaXRlIGFkZGVkIHRvIHJvb20nLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIHRhYmxlcy5yZW5kZXJQcm9kY3RzVGFibGUocm9vbV9pZCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICQoJy5hY3Rpb24taWNvbi5yZW1vdmUtcHJvZHVjdC1mcm9tLWZhdnMnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgKGUpID0+IHsgIC8vYXJyb3cgZnVuY3Rpb24gcHJlc2VydmVzIHRoZSBjb250ZXh0IG9mIHRoaXNcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjb25zdCB1dWlkID0gJChlLmN1cnJlbnRUYXJnZXQpLmRhdGEoJ3V1aWQnKTtcclxuICAgICAgICAgICAgYXdhaXQgZGIucmVtb3ZlRmF2b3VyaXRlKHV1aWQpO1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ0Zhdm91cml0ZSByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlckZhdm91cml0ZXModXNlcl9pZCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9ICAgIFxyXG5cclxuXHJcbiAgICBhc3luYyBnZW5lcmF0ZU5hdk1lbnUoZGF0YSkge1xyXG4gICAgICAgIGlmICghZGF0YSkgcmV0dXJuICc8ZGl2Pk5vIHByb2plY3Qgc3RydWN0dXJlIGF2YWlsYWJsZTwvZGl2Pic7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIGxldCBodG1sID0gJyc7XHJcblxyXG4gICAgICAgIC8vIE1hbmFnZSBwcm9qZWN0IGxpbmtcclxuICAgICAgICBodG1sICs9IGBcclxuICAgICAgICA8bGkgY2xhc3M9XCJwcm9qZWN0LWl0ZW1cIj5cclxuICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBjbGFzcz1cImVkaXQtcHJvamVjdC1saW5rXCIgZGF0YS1pZD1cIiR7ZGF0YS5wcm9qZWN0X2lkfVwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9qZWN0LW5hbWVcIiB1ay1pY29uPVwiaWNvbjogZm9sZGVyO1wiPjwvc3Bhbj4gJHtkYXRhLnByb2plY3RfbmFtZX1cclxuICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgIDwvbGk+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyBsb2NhdGlvbnNcclxuICAgICAgICBPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICdwcm9qZWN0X25hbWUnICYmIGtleSAhPT0gJ3Byb2plY3Rfc2x1ZycgJiYga2V5ICE9PSAncHJvamVjdF9pZCcpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZGF0YVtrZXldO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSB0aGlzLnByb2Nlc3NMb2NhdGlvbihrZXksIGxvY2F0aW9uLCBkYXRhLnByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3NMb2NhdGlvbihzbHVnLCBsb2NhdGlvbiwgcHJvamVjdElkKSB7XHJcbiAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwibG9jYXRpb24taXRlbVwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibG9jYXRpb24taGVhZGVyXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImxvY2F0aW9uLW5hbWVcIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwiaWNvbjogbG9jYXRpb247XCI+PC9zcGFuPiAke2xvY2F0aW9uLmxvY2F0aW9uX25hbWV9XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWljb25zIGxvY2F0aW9uXCI+ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwibWludXMtY2lyY2xlXCIgY2xhc3M9XCJhY3Rpb24taWNvblwiIGRhdGEtaWQ9XCIke2xvY2F0aW9uLmxvY2F0aW9uX2lkfVwiIGRhdGEtYWN0aW9uPVwicmVtb3ZlXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8dWwgY2xhc3M9XCJidWlsZGluZy1saXN0XCI+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyBidWlsZGluZ3NcclxuICAgICAgICBPYmplY3Qua2V5cyhsb2NhdGlvbikuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAnbG9jYXRpb25fbmFtZScgJiYga2V5ICE9PSAnbG9jYXRpb25fc2x1ZycgJiYga2V5ICE9PSAnbG9jYXRpb25faWQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBidWlsZGluZyA9IGxvY2F0aW9uW2tleV07XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IHRoaXMucHJvY2Vzc0J1aWxkaW5nKGtleSwgYnVpbGRpbmcsIHByb2plY3RJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIFwiQWRkIEJ1aWxkaW5nXCIgb3B0aW9uXHJcbiAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJidWlsZGluZy1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZGQtYnVpbGRpbmdcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBkYXRhLWlkPVwiJHtsb2NhdGlvbi5sb2NhdGlvbl9pZH1cIiBkYXRhLWFjdGlvbj1cImFkZFwiPkFkZCBCdWlsZGluZzwvYT5cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2xpPlxyXG4gICAgICAgICAgICA8L3VsPlxyXG4gICAgICAgIDwvbGk+YDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJvY2Vzc0J1aWxkaW5nKHNsdWcsIGJ1aWxkaW5nLCBwcm9qZWN0SWQpIHtcclxuICAgICAgICBsZXQgaHRtbCA9IGBcclxuICAgICAgICA8bGkgY2xhc3M9XCJidWlsZGluZy1pdGVtXCI+XHJcbiAgICAgICAgICAgIDxoNCBjbGFzcz1cImJ1aWxkaW5nLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJidWlsZGluZy1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cImljb246IGhvbWU7XCI+PC9zcGFuPiAke2J1aWxkaW5nLmJ1aWxkaW5nX25hbWV9XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWljb25zIGJ1aWxkaW5nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb24gYnVpbGRpbmdcIiBkYXRhLWlkPVwiJHtidWlsZGluZy5idWlsZGluZ19pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2g0PlxyXG4gICAgICAgICAgICA8dWwgY2xhc3M9XCJmbG9vci1saXN0XCI+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmbG9vcnNcclxuICAgICAgICBPYmplY3Qua2V5cyhidWlsZGluZykuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAnYnVpbGRpbmdfbmFtZScgJiYga2V5ICE9PSAnYnVpbGRpbmdfc2x1ZycgJiYga2V5ICE9PSAnYnVpbGRpbmdfaWQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBmbG9vciA9IGJ1aWxkaW5nW2tleV07XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IHRoaXMucHJvY2Vzc0Zsb29yKGtleSwgZmxvb3IsIHByb2plY3RJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIFwiQWRkIEZsb29yXCIgb3B0aW9uXHJcbiAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICA8bGkgY2xhc3M9XCJmbG9vci1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZGQtZmxvb3JcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBkYXRhLWlkPVwiJHtidWlsZGluZy5idWlsZGluZ19pZH1cIiBkYXRhLWFjdGlvbj1cImFkZFwiPkFkZCBGbG9vcjwvYT5cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2xpPlxyXG4gICAgICAgICAgICA8L3VsPlxyXG4gICAgICAgIDwvbGk+YDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJvY2Vzc0Zsb29yKHNsdWcsIGZsb29yLCBwcm9qZWN0SWQpIHtcclxuICAgICAgICBsZXQgaHRtbCA9IGBcclxuICAgICAgICA8bGkgY2xhc3M9XCJmbG9vci1pdGVtXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbG9vci1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgZGF0YS1pZD1cIiR7Zmxvb3IuZmxvb3JfaWR9XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbG9vci1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHVrLWljb249XCJpY29uOiB0YWJsZTtcIj48L3NwYW4+ICR7Zmxvb3IuZmxvb3JfbmFtZX1cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWljb25zIGZsb29yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb24gZmxvb3JcIiBkYXRhLWlkPVwiJHtmbG9vci5mbG9vcl9pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHVsIGNsYXNzPVwicm9vbS1saXN0XCI+YDtcclxuXHJcbiAgICAgICAgLy8gUHJvY2VzcyByb29tc1xyXG4gICAgICAgIE9iamVjdC5rZXlzKGZsb29yKS5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICdmbG9vcl9uYW1lJyAmJiBrZXkgIT09ICdmbG9vcl9zbHVnJyAmJiBrZXkgIT09ICdmbG9vcl9pZCcpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvb20gPSBmbG9vcltrZXldO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSB0aGlzLnByb2Nlc3NSb29tKGtleSwgcm9vbSwgcHJvamVjdElkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgXCJBZGQgUm9vbVwiIG9wdGlvblxyXG4gICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgPGxpIGNsYXNzPVwicm9vbS1pdGVtIGFkZC1yb29tXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZGQtcm9vbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiIGRhdGEtYWN0aW9uPVwiYWRkXCIgZGF0YS1pZD1cIiR7Zmxvb3IuZmxvb3JfaWR9XCI+QWRkIFJvb208L2E+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9saT5cclxuICAgICAgICAgICAgPC91bD5cclxuICAgICAgICA8L2xpPmA7XHJcblxyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgfVxyXG5cclxuICAgIHByb2Nlc3NSb29tKHNsdWcsIHJvb20sIHByb2plY3RJZCkge1xyXG4gICAgICAgIHJldHVybiBgXHJcbiAgICAgICAgPGxpIGNsYXNzPVwicm9vbS1pdGVtIHZpZXctcm9vbVwiPlxyXG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cInJvb20tbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBjbGFzcz1cInJvb20tbGlua1wiIGRhdGEtaWQ9XCIke3Jvb20ucm9vbV9pZH1cIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB1ay1pY29uPVwiaWNvbjogbW92ZTtcIj48L3NwYW4+ICR7cm9vbS5yb29tX25hbWV9XHJcbiAgICAgICAgICAgICAgICA8L2E+XHJcbiAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgPHNwYW4gdWstaWNvbj1cIm1pbnVzLWNpcmNsZVwiIGNsYXNzPVwiYWN0aW9uLWljb24gcm9vbVwiIGRhdGEtaWQ9XCIke3Jvb20ucm9vbV9pZH1cIiBkYXRhLWFjdGlvbj1cInJlbW92ZVwiPjwvc3Bhbj5cclxuICAgICAgICA8L2xpPmA7XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IFNpZGViYXJNb2R1bGUoKTsiLCJjb25zdCBkYiA9IHJlcXVpcmUoJy4uL2RiJyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xyXG5sZXQgc2lkZWJhcjsgLy8gcGxhY2Vob2xkZXIgZm9yIHNpZGViYXIgbW9kdWxlLCBsYXp5IGxvYWRlZCBsYXRlclxyXG5cclxuY2xhc3MgU3luY01vZHVsZSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgLy8gQmluZCBtZXRob2RzIHRoYXQgbmVlZCAndGhpcycgY29udGV4dFxyXG4gICAgICAgIC8vdGhpcy5oYW5kbGVGaWxlVXBsb2FkID0gdGhpcy5oYW5kbGVGaWxlVXBsb2FkLmJpbmQodGhpcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSByZXR1cm47ICAgICAgICBcclxuICAgICAgICBpZiAoIXNpZGViYXIpIHtcclxuICAgICAgICAgICAgc2lkZWJhciA9IHJlcXVpcmUoJy4vc2lkZWJhcicpOyAgLy8gbGF6eSBsb2FkIGl0IHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY2llcywganVzdCB1c2UgY2FsbCBpbml0IHdoZW4gcmVxdWlyZWRcclxuICAgICAgICB9ICAgICAgICBcclxuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuICAgIGFzeW5jIGNsZWFyTG9jYWxTdG9yYWdlKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdZb3UgYXJlIG9mZmxpbmUuIFBsZWFzZSBjb25uZWN0IHRvIHRoZSBpbnRlcm5ldCBhbmQgdHJ5IGFnYWluLicsIHN0YXR1czogJ3dhcm5pbmcnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjAwMCB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgICAgICB1dGlscy5zaG93U3BpbigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuXHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XHJcblxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgdXRpbHMuaGlkZVNwaW4oKTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFVzZXJEYXRhKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdZb3UgYXJlIG9mZmxpbmUuIFBsZWFzZSBjb25uZWN0IHRvIHRoZSBpbnRlcm5ldCBhbmQgdHJ5IGFnYWluLicsIHN0YXR1czogJ3dhcm5pbmcnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjAwMCB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgICAgICB1dGlscy5zaG93U3BpbigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuXHJcbiAgICAgICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldFVzZXJJRCgpO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRiLnB1bGxVc2VyRGF0YSh1c2VyX2lkKTsgICAgICAgIFxyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgdXRpbHMuaGlkZVNwaW4oKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgYXN5bmMgcHVzaEFsbFVzZXJEYXRhKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIC8vIGRldGVjdCBpZiB1c2VyIGlzIG9mZmxpbmVcclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnWW91IGFyZSBvZmZsaW5lLiBQbGVhc2UgY29ubmVjdCB0byB0aGUgaW50ZXJuZXQgYW5kIHRyeSBhZ2Fpbi4nLCBzdGF0dXM6ICd3YXJuaW5nJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdEYXRhIFB1c2ggU3RhcnRlZCAuLi4nLCBzdGF0dXM6ICdwcmltYXJ5JywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDEwMDAgfSk7XHJcbiAgICAgICAgdXRpbHMuc2hvd1NwaW4oKTtcclxuICAgICAgICBcclxuICAgICAgICAkKCcjc3luY2ljb24nKS5hZGRDbGFzcygnYWN0aXZlJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKTtcclxuXHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGIucHVzaFVzZXJEYXRhKHVzZXJfaWQpO1xyXG4gICAgICAgICQoJyNzeW5jaWNvbicpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTsgICAgICAgIFxyXG4gICAgICAgIFxyXG4gICAgICAgIHV0aWxzLmhpZGVTcGluKCk7XHJcbiAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT0gJ2Vycm9yJykge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdUaGVyZSB3YXMgYW4gZXJyb3Igc3luY2luZyB5b3VyIGRhdGEhIFBsZWFzZSB0cnkgYWdhaW4uJywgc3RhdHVzOiAnZGFuZ2VyJywgcG9zOiAnYm90dG9tLWNlbnRlcicsIHRpbWVvdXQ6IDIwMDAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHttZXNzYWdlOiAnRGF0YSBQdXNoIENvbXBsZXRlIC4uLicsIHN0YXR1czogJ3N1Y2Nlc3MnLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjAwMCB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuXHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTeW5jTW9kdWxlKCk7IiwiY29uc3QgZGIgPSByZXF1aXJlKCcuLi9kYicpO1xyXG5jb25zdCBNdXN0YWNoZSA9IHJlcXVpcmUoJ211c3RhY2hlJyk7XHJcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xyXG5sZXQgc2lkZWJhcjsgLy8gcGxhY2Vob2xkZXIgZm9yIHNpZGViYXIgbW9kdWxlLCBsYXp5IGxvYWRlZCBsYXRlclxyXG5cclxuY2xhc3MgVGFibGVzTW9kdWxlIHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuaXNJbml0aWFsaXplZCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMucFRhYmxlID0gbnVsbDtcclxuICAgICAgICAvLyBCaW5kIG1ldGhvZHMgdGhhdCBuZWVkICd0aGlzJyBjb250ZXh0XHJcbiAgICAgICAgdGhpcy5oYW5kbGVGaWxlVXBsb2FkID0gdGhpcy5oYW5kbGVGaWxlVXBsb2FkLmJpbmQodGhpcyk7XHJcbiAgICAgICAgdGhpcy51cGRhdGVJbWFnZXMgPSB0aGlzLnVwZGF0ZUltYWdlcy5iaW5kKHRoaXMpOyAgICAgICAgXHJcbiAgICAgICAgdGhpcy5nZXRSb29tSW1hZ2VzID0gdGhpcy5nZXRSb29tSW1hZ2VzLmJpbmQodGhpcyk7ICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBpbml0KCkge1xyXG4gICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGl6ZWQpIHJldHVybjtcclxuICAgICAgICBNdXN0YWNoZS50YWdzID0gW1wiW1tcIiwgXCJdXVwiXTsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKCFzaWRlYmFyKSB7XHJcbiAgICAgICAgICAgIHNpZGViYXIgPSByZXF1aXJlKCcuL3NpZGViYXInKTsgIC8vIGxhenkgbG9hZCBpdCB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXMsIGp1c3QgdXNlIGNhbGwgaW5pdCB3aGVuIHJlcXVpcmVkXHJcbiAgICAgICAgfSAgICAgICAgXHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gdHJ1ZTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHVwZGF0ZVNrdXNEcm9wZG93bihwcm9kdWN0KSB7XHJcbiAgICAgICAgdGhpcy5pbml0KCk7XHJcbiAgICAgICAgY29uc3Qgc2t1cyA9IGF3YWl0IHRoaXMuZ2V0U2t1c0ZvclByb2R1Y3QocHJvZHVjdCk7ICAgICAgICBcclxuICAgICAgICB0aGlzLnJlbmRlclNrdXNEcm9wZG93bihza3VzKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyByZW5kZXJTa3VzRHJvcGRvd24oc2t1cykge1xyXG4gICAgICAgIGlmICghc2t1cyB8fCAhc2t1cy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignTm8gc2t1IGRhdGEgcHJvdmlkZWQnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IG9wdGlvbnNIdG1sID0gJzxvcHRpb24gdmFsdWU9XCJcIj5TZWxlY3QgU0tVPC9vcHRpb24+JztcclxuICAgICAgICBza3VzLmZvckVhY2goc2t1ID0+IHtcclxuICAgICAgICAgICAgb3B0aW9uc0h0bWwgKz0gYDxvcHRpb24gdmFsdWU9XCIke3NrdS5zbHVnfVwiPiR7c2t1Lm5hbWV9PC9vcHRpb24+YDtcclxuICAgICAgICB9KTsgXHJcbiAgICAgICAgJCgnI2Zvcm1fc2t1JykuaHRtbChvcHRpb25zSHRtbCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0U2t1c0ZvclByb2R1Y3QodXNlcl9wcm9kdWN0KSB7XHJcbiAgICAgICAgY29uc3QgcHJvZHVjdHMgPSBhd2FpdCBkYi5nZXRQcm9kdWN0cygpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBwcm9kdWN0c1xyXG4gICAgICAgICAgICAuZmlsdGVyKHByb2R1Y3QgPT4gcHJvZHVjdC5wcm9kdWN0X3NsdWcgPT09IHVzZXJfcHJvZHVjdClcclxuICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCBwcm9kdWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFjYy5zb21lKGl0ZW0gPT4gaXRlbS5zbHVnID09PSBwcm9kdWN0LnByb2R1Y3Rfc2x1ZykpIHtcclxuICAgICAgICAgICAgICAgICAgICBhY2MucHVzaCh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzbHVnOiBwcm9kdWN0LnByb2R1Y3RfY29kZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb2R1Y3QucHJvZHVjdF9jb2RlIFxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcclxuICAgICAgICAgICAgfSwgW10pICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcclxuICAgIH0gICAgICAgXHJcbiAgICBcclxuICAgIGFzeW5jIHVwZGF0ZVByb2R1Y3RzRHJvcGRvd24odHlwZSkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gYXdhaXQgdGhpcy5nZXRQcm9kdWN0c0ZvclR5cGUodHlwZSk7ICAgICAgICBcclxuICAgICAgICB0aGlzLnJlbmRlclByb2R1Y3RzRHJvcGRvd24ocHJvZHVjdHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHJlbmRlclByb2R1Y3RzRHJvcGRvd24ocHJvZHVjdHMpIHtcclxuICAgICAgICBpZiAoIXByb2R1Y3RzIHx8ICFwcm9kdWN0cy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignTm8gcHJvZHVjdHMgZGF0YSBwcm92aWRlZCcpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgb3B0aW9uc0h0bWwgPSAnPG9wdGlvbiB2YWx1ZT1cIlwiPlNlbGVjdCBQcm9kdWN0PC9vcHRpb24+JztcclxuICAgICAgICBwcm9kdWN0cy5mb3JFYWNoKHByb2R1Y3QgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb25zSHRtbCArPSBgPG9wdGlvbiB2YWx1ZT1cIiR7cHJvZHVjdC5zbHVnfVwiPiR7cHJvZHVjdC5uYW1lfTwvb3B0aW9uPmA7XHJcbiAgICAgICAgfSk7ICAgICAgICBcclxuICAgICAgICAkKCcjZm9ybV9wcm9kdWN0JykuaHRtbChvcHRpb25zSHRtbCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0UHJvZHVjdHNGb3JUeXBlKHR5cGUpIHtcclxuICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGRiLmdldFByb2R1Y3RzKCk7XHJcbiAgICAgICAgY29uc3Qgc2l0ZSA9ICQoJyNmb3JtX2JyYW5kJykudmFsKCk7XHJcblxyXG4gICAgICAgIHJldHVybiBwcm9kdWN0c1xyXG4gICAgICAgICAgICAuZmlsdGVyKHByb2R1Y3QgPT4gcHJvZHVjdC50eXBlX3NsdWcgPT09IHR5cGUgJiYgcHJvZHVjdC5zaXRlID09PSBzaXRlIClcclxuICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCBwcm9kdWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghYWNjLnNvbWUoaXRlbSA9PiBpdGVtLnNsdWcgPT09IHByb2R1Y3QucHJvZHVjdF9zbHVnKSkge1xyXG4gICAgICAgICAgICAgICAgYWNjLnB1c2goeyBcclxuICAgICAgICAgICAgICAgIHNsdWc6IHByb2R1Y3QucHJvZHVjdF9zbHVnLCBcclxuICAgICAgICAgICAgICAgIG5hbWU6IHByb2R1Y3QucHJvZHVjdF9zbHVnLnJlcGxhY2UoL154Y2l0ZS0vaSwgJycpLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKS50cmltKCkucmVwbGFjZSgvLS9nLCAnICcpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgICAgICAgICB9LCBbXSkgICAgICAgICAgICBcclxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xyXG4gICAgfSAgICBcclxuXHJcbiAgICBhc3luYyB1cGRhdGVUeXBlc0Ryb3Bkb3duKGJyYW5kKSB7XHJcbiAgICAgICAgdGhpcy5pbml0KCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCB0eXBlcyA9IGF3YWl0IHRoaXMuZ2V0VHlwZXNGb3JCcmFuZChicmFuZCk7ICAgICAgICBcclxuICAgICAgICB0aGlzLnJlbmRlclR5cGVzRHJvcGRvd24odHlwZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFR5cGVzRm9yQnJhbmQoYnJhbmQpIHtcclxuICAgICAgICBjb25zdCBwcm9kdWN0cyA9IGF3YWl0IGRiLmdldFByb2R1Y3RzKCk7XHJcbiAgICAgICAgcmV0dXJuIHByb2R1Y3RzXHJcbiAgICAgICAgICAgIC5maWx0ZXIocHJvZHVjdCA9PiBwcm9kdWN0LnNpdGUgPT09IGJyYW5kKVxyXG4gICAgICAgICAgICAucmVkdWNlKChhY2MsIHByb2R1Y3QpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICghYWNjLnNvbWUoaXRlbSA9PiBpdGVtLnNsdWcgPT09IHByb2R1Y3QudHlwZV9zbHVnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNsdWc6IHByb2R1Y3QudHlwZV9zbHVnLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvZHVjdC50eXBlX25hbWUgXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgICAgICAgICB9LCBbXSlcclxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHJlbmRlclR5cGVzRHJvcGRvd24odHlwZXMpIHtcclxuICAgICAgICBpZiAoIXR5cGVzIHx8ICF0eXBlcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignTm8gdHlwZXMgZGF0YSBwcm92aWRlZCcpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9ICQoJyNvcHRpb25zJyk7XHJcbiAgICAgICAgaWYgKCF0ZW1wbGF0ZS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVGVtcGxhdGUgI29wdGlvbnMgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBvcHRpb25zSHRtbCA9ICc8b3B0aW9uIHZhbHVlPVwiXCI+U2VsZWN0IFR5cGU8L29wdGlvbj4nO1xyXG4gICAgICAgIHR5cGVzLmZvckVhY2godHlwZSA9PiB7XHJcbiAgICAgICAgICAgIG9wdGlvbnNIdG1sICs9IGA8b3B0aW9uIHZhbHVlPVwiJHt0eXBlLnNsdWd9XCI+JHt0eXBlLm5hbWV9PC9vcHRpb24+YDtcclxuICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgICAgICQoJyNmb3JtX3R5cGUnKS5odG1sKG9wdGlvbnNIdG1sKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyB1cGRhdGVQcm9qZWN0Q2xpY2sodXVpZCkge1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZygndXBkYXRlUHJvamVjdENsaWNrJywgdXVpZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nUHJvamVjdCA9IGF3YWl0IGRiLmdldFByb2plY3RCeVVVSUQodXVpZCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKCdleGlzdGluZ1Byb2plY3QnLCBleGlzdGluZ1Byb2plY3QpO1xyXG5cclxuICAgICAgICBpZiAoIWV4aXN0aW5nUHJvamVjdCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQcm9qZWN0IG5vdCBmb3VuZCcpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBwcm9qZWN0RGF0YSA9IHtcclxuICAgICAgICAgICAgdXVpZDogdXVpZCxcclxuICAgICAgICAgICAgcHJvamVjdF9pZDogJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X2lkJykudmFsKCkgfHwgZXhpc3RpbmdQcm9qZWN0LnByb2plY3RfaWQsXHJcbiAgICAgICAgICAgIHJvb21faWRfZms6IGV4aXN0aW5nUHJvamVjdC5yb29tX2lkX2ZrLCAvLyBsZWdhY3lcclxuICAgICAgICAgICAgbmFtZTogJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X25hbWUnKS52YWwoKSB8fCBleGlzdGluZ1Byb2plY3QubmFtZSxcclxuICAgICAgICAgICAgc2x1ZzogYXdhaXQgdXRpbHMuc2x1Z2lmeSgkKCcjZm9ybV9lZGl0X3Byb2plY3RfbmFtZScpLnZhbCgpKSB8fCBleGlzdGluZ1Byb2plY3Quc2x1ZyxcclxuICAgICAgICAgICAgZW5naW5lZXI6ICQoJyNmb3JtX2VkaXRfcHJvamVjdF9lbmdpbmVlcicpLnZhbCgpIHx8IGV4aXN0aW5nUHJvamVjdC5lbmdpbmVlcixcclxuICAgICAgICAgICAgcHJvamVjdF92ZXJzaW9uOiAkKCcjZm9ybV9lZGl0X3Byb2plY3RfdmVyc2lvbicpLnZhbCgpIHx8IGV4aXN0aW5nUHJvamVjdC5wcm9qZWN0X3ZlcnNpb24sXHJcbiAgICAgICAgICAgIGxhc3RfdXBkYXRlZDogYXdhaXQgdXRpbHMuZm9ybWF0RGF0ZVRpbWUobmV3IERhdGUoKSksXHJcbiAgICAgICAgICAgIGNyZWF0ZWRfb246IGV4aXN0aW5nUHJvamVjdC5jcmVhdGVkX29uLFxyXG4gICAgICAgICAgICBvd25lcl9pZDogZXhpc3RpbmdQcm9qZWN0Lm93bmVyX2lkLFxyXG4gICAgICAgICAgICBjZWY6IGV4aXN0aW5nUHJvamVjdC5jZWYgLy8gdW51c2VkXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coJ3VwZGF0ZVByb2plY3RDbGljaycsIHByb2plY3REYXRhKTtcclxuXHJcblxyXG4gICAgICAgIGF3YWl0IGRiLnVwZGF0ZVByb2plY3REZXRhaWxzKHByb2plY3REYXRhKTtcclxuXHJcbiAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHtcclxuICAgICAgICAgICAgbWVzc2FnZTogJ1Byb2plY3QgVXBkYXRlZCcsXHJcbiAgICAgICAgICAgIHN0YXR1czogJ3N1Y2Nlc3MnLFxyXG4gICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgdGltZW91dDogMTUwMFxyXG4gICAgfSk7ICAgICAgICBcclxuICAgICAgXHJcbiAgICAgICAgICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBhZGRTcGVjaWFsVG9Sb29tQ2xpY2soKSB7XHJcbiAgICAgICAgLy8gdG8gc2F2ZSBkdXBsaWNhdGlvbiBqdXN0IGJ1aWxkIHRoZSBwcm9kdWN0IGRhdGEgb2JqZWN0IGFuZCBjYWxsIHRoZSBhZGRQcm9kdWN0VG9Sb29tQ2xpY2sgbWV0aG9kXHJcbiAgICAgICAgY29uc3QgcHJvZHVjdERhdGEgPSB7XHJcbiAgICAgICAgICAgIGJyYW5kOiAkKCcjZm9ybV9jdXN0b21fYnJhbmQnKS52YWwoKSxcclxuICAgICAgICAgICAgdHlwZTogJCgnI2Zvcm1fY3VzdG9tX3R5cGUnKS52YWwoKSxcclxuICAgICAgICAgICAgcHJvZHVjdF9zbHVnOiBhd2FpdCB1dGlscy5zbHVnaWZ5KCQoJyNmb3JtX2N1c3RvbV9wcm9kdWN0JykudmFsKCkpLFxyXG4gICAgICAgICAgICBwcm9kdWN0X25hbWU6ICQoJyNmb3JtX2N1c3RvbV9wcm9kdWN0JykudmFsKCksXHJcbiAgICAgICAgICAgIHNrdTogJCgnI2Zvcm1fY3VzdG9tX3NrdScpLnZhbCgpLCAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByb29tX2lkX2ZrOiAkKCcjbV9yb29tX2lkJykudmFsKCksXHJcbiAgICAgICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKSxcclxuICAgICAgICAgICAgY3VzdG9tOiAkKCcjZm9ybV9jdXN0b21fZmxhZycpLnZhbCgpLFxyXG4gICAgICAgICAgICByZWY6IFwiXCIsXHJcbiAgICAgICAgICAgIGNyZWF0ZWRfb246IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgICAgICBsYXN0X3VwZGF0ZWQ6IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgICAgICBvcmRlcjogbnVsbCxcclxuICAgICAgICAgICAgcmFuZ2U6IG51bGxcclxuICAgICAgICB9O1xyXG4gICAgICAgIC8vVUlraXQubW9kYWwoJyNhZGQtc3BlY2lhbCcpLmhpZGUoKTtcclxuICAgICAgICB0aGlzLmRvQWRkUHJvZHVjdChwcm9kdWN0RGF0YSk7ICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgYWRkUHJvZHVjdFRvUm9vbUNsaWNrKCkge1xyXG5cclxuICAgICAgICAvLyBidWlsZCB0aGUgcHJvZHVjdCBkYXRhIG9iamVjdCAgICBcclxuICAgICAgICBjb25zdCBwcm9kdWN0RGF0YSA9IHtcclxuICAgICAgICAgICAgYnJhbmQ6ICQoJyNmb3JtX2JyYW5kJykudmFsKCksXHJcbiAgICAgICAgICAgIHR5cGU6ICQoJyNmb3JtX3R5cGUnKS52YWwoKSxcclxuICAgICAgICAgICAgcHJvZHVjdF9zbHVnOiAkKCcjZm9ybV9wcm9kdWN0JykudmFsKCksXHJcbiAgICAgICAgICAgIHByb2R1Y3RfbmFtZTogJCgnI2Zvcm1fcHJvZHVjdCBvcHRpb246c2VsZWN0ZWQnKS50ZXh0KCksXHJcbiAgICAgICAgICAgIHNrdTogJCgnI2Zvcm1fc2t1JykudmFsKCkgfHwgJCgnI2Zvcm1fcHJvZHVjdCcpLnZhbCgpLFxyXG4gICAgICAgICAgICByb29tX2lkX2ZrOiAkKCcjbV9yb29tX2lkJykudmFsKCksXHJcbiAgICAgICAgICAgIG93bmVyX2lkOiBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKSxcclxuICAgICAgICAgICAgY3VzdG9tOiAwLFxyXG4gICAgICAgICAgICByZWY6IFwiXCIsXHJcbiAgICAgICAgICAgIGNyZWF0ZWRfb246IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgICAgICBsYXN0X3VwZGF0ZWQ6IGF3YWl0IHV0aWxzLmZvcm1hdERhdGVUaW1lKG5ldyBEYXRlKCkpLFxyXG4gICAgICAgICAgICBvcmRlcjogbnVsbCxcclxuICAgICAgICAgICAgcmFuZ2U6IG51bGxcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuZG9BZGRQcm9kdWN0KHByb2R1Y3REYXRhKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBkb0FkZFByb2R1Y3QocHJvZHVjdERhdGEpIHtcclxuXHJcbiAgICAgICAgaWYgKCAhcHJvZHVjdERhdGEucHJvZHVjdF9zbHVnICkge1xyXG4gICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe1xyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0FsbCBmaWVsZHMgYXJlIHJlcXVpcmVkJyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogJ2RhbmdlcicsXHJcbiAgICAgICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDE1MDBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHV0aWxzLnNob3dTcGluKCk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGRiLnNhdmVQcm9kdWN0VG9Sb29tKHByb2R1Y3REYXRhKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMucmVmcmVzaFRhYmxlRGF0YSgpO1xyXG5cclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcm9kdWN0IGFkZGVkIHRvIHJvb20nLFxyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnc3VjY2VzcycsXHJcbiAgICAgICAgICAgICAgICBwb3M6ICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDE1MDBcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB1dGlscy5oaWRlU3BpbigpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldFF0eURpYWxvZyhwcm9kdWN0RGF0YS5za3UsIDEpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzYXZpbmcgcHJvZHVjdCB0byByb29tOicsIGVycik7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnRXJyb3Igc2F2aW5nIHByb2R1Y3QgdG8gcm9vbScsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdkYW5nZXInLFxyXG4gICAgICAgICAgICAgICAgcG9zOiAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxNTAwXHJcbiAgICAgICAgICAgIH0pOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB1dGlscy5oaWRlU3BpbigpOyAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgLy8gR3JvdXAgcHJvZHVjdHMgYnkgU0tVIGFuZCBjb3VudCBvY2N1cnJlbmNlc1xyXG4gICAgYXN5bmMgZ3JvdXBQcm9kdWN0c0J5U0tVKHByb2R1Y3RzKSB7XHJcbiAgICAgICAgY29uc3QgZ3JvdXBlZFByb2R1Y3RzID0gcHJvZHVjdHMucmVkdWNlKChhY2MsIHByb2R1Y3QpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFhY2NbcHJvZHVjdC5za3VdKSB7XHJcbiAgICAgICAgICAgICAgICBhY2NbcHJvZHVjdC5za3VdID0geyAuLi5wcm9kdWN0LCBxdHk6IDAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBhY2NbcHJvZHVjdC5za3VdLnF0eSArPSAxO1xyXG4gICAgICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgICAgIH0sIHt9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoZ3JvdXBlZFByb2R1Y3RzKTtcclxuICAgIH0gICAgXHJcblxyXG5cclxuICAgIGFzeW5jIGFkZEZhdkRpYWxvZyhza3UsIHByb2R1Y3RfbmFtZSkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuaW5pdCgpOyAgLy8gY2FsbCBpbml0IGFzIHdlJ2xsIG5lZWQgdGhlIHNpZGViYXIgbW9kdWxlIHRvIGJlIGxvYWRlZFxyXG5cclxuICAgICAgICAkKCdzcGFuLnBsYWNlX3NrdScpLmh0bWwoc2t1KTtcclxuICAgICAgICAkKCdpbnB1dCNkZWxfc2t1JykudmFsKHNrdSk7XHJcbiAgICAgICAgY29uc3QgdXNlcl9pZCA9IGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG5cclxuICAgICAgICBhd2FpdCBkYi5hZGRGYXZQcm9kdWN0KHNrdSwgcHJvZHVjdF9uYW1lLCB1c2VyX2lkKTsgICAgICAgXHJcbiAgICAgICAgYXdhaXQgc2lkZWJhci5yZW5kZXJGYXZvdXJpdGVzKHVzZXJfaWQpOyAgICAgICBcclxuICAgIH1cclxuXHJcblxyXG5cclxuICAgIGFzeW5jIHJlbW92ZVNrdURpYWxvZyhza3UpIHtcclxuICAgICAgICAvLyBvcGVuIHRoZSBkZWwtc2t1IG1vZGFsIGFuZCBwYXNzIHRoZSBza3UgdG8gYmUgZGVsZXRlZFxyXG4gICAgICAgICQoJ3NwYW4ucGxhY2Vfc2t1JykuaHRtbChza3UpO1xyXG4gICAgICAgICQoJ2lucHV0I2RlbF9za3UnKS52YWwoc2t1KTtcclxuXHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNkZWwtc2t1JywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpOyAgICAgICAgXHJcblxyXG4gICAgICAgICQoJyNmb3JtLXN1Ym1pdC1kZWwtc2t1Jykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgYXN5bmMgKGUpID0+IHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjb25zdCBza3UgPSAkKCcjZGVsX3NrdScpLnZhbCgpO1xyXG4gICAgICAgICAgICBjb25zdCByb29tX2lkID0gJCgnI21fcm9vbV9pZCcpLnZhbCgpOyAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhd2FpdCBkYi5kZWxldGVQcm9kdWN0RnJvbVJvb20oc2t1LCByb29tX2lkKTtcclxuICAgICAgICAgICAgdGhpcy5yZWZyZXNoVGFibGVEYXRhKCk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm1vZGFsKCcjZGVsLXNrdScpLmhpZGUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSk7ICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2V0UXR5RGlhbG9nKHNrdSwgcXR5KSB7XHJcbiAgICAgICAgLy8gb3BlbiB0aGUgZGVsLXNrdSBtb2RhbCBhbmQgcGFzcyB0aGUgc2t1IHRvIGJlIGRlbGV0ZWRcclxuICAgICAgICAkKCdzcGFuLnBsYWNlX3NrdScpLmh0bWwoc2t1KTtcclxuICAgICAgICAkKCdpbnB1dCNzZXRfcXR5X3NrdScpLnZhbChza3UpO1xyXG4gICAgICAgICQoJ2lucHV0I3NldF9xdHlfcXR5JykudmFsKHF0eSk7XHJcblxyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjc2V0LXF0eScsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTsgICAgXHJcbiAgICAgICAgVUlraXQudXRpbC5vbignI3NldC1xdHknLCAnc2hvd24nLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICQoJyNzZXRfcXR5X3F0eScpLmZvY3VzKCkuc2VsZWN0KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcblxyXG4gICAgICAgICQoJyNmb3JtLXN1Ym1pdC1zZXQtcXR5Jykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgYXN5bmMgKGUpID0+IHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBjb25zdCBxdHkgPSAkKCcjc2V0X3F0eV9xdHknKS52YWwoKTtcclxuICAgICAgICAgICAgY29uc3Qgc2t1ID0gJCgnI3NldF9xdHlfc2t1JykudmFsKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJvb21faWQgPSAkKCcjbV9yb29tX2lkJykudmFsKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhd2FpdCBkYi5zZXRTa3VRdHlGb3JSb29tKHF0eSwgc2t1LCByb29tX2lkKTtcclxuICAgICAgICAgICAgdGhpcy5yZWZyZXNoVGFibGVEYXRhKCk7XHJcbiAgICAgICAgICAgIFVJa2l0Lm1vZGFsKCcjc2V0LXF0eScpLmhpZGUoKTsgICAgICAgICAgICBcclxuICAgICAgICB9KTsgICAgICBcclxuICAgIH1cclxuXHJcblxyXG4gICAgYXN5bmMgcmVmcmVzaFRhYmxlRGF0YShyb29tSUQpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnUmVmcmVzaGluZyB0YWJsZSBkYXRhIGZvciByb29tOicsIHJvb21JRCk7XHJcbiAgICAgICAgbGV0IHJvb21JRFRvVXNlID0gcm9vbUlEIHx8ICQoJyNtX3Jvb21faWQnKS52YWwoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGFsbFByb2R1Y3RzSW5Sb29tID0gYXdhaXQgZGIuZ2V0UHJvZHVjdHNGb3JSb29tKHJvb21JRFRvVXNlKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGdyb3VwZWRQcm9kdWN0cyA9IGF3YWl0IHRoaXMuZ3JvdXBQcm9kdWN0c0J5U0tVKGFsbFByb2R1Y3RzSW5Sb29tKTtcclxuICAgICAgICB0aGlzLnBUYWJsZS5zZXREYXRhKGdyb3VwZWRQcm9kdWN0cyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgcmVuZGVyUHJvZGN0c1RhYmxlKHJvb21JRCkge1xyXG5cclxuICAgICAgICBsZXQgcm9vbUlEVG9Vc2UgPSByb29tSUQgfHwgJCgnI21fcm9vbV9pZCcpLnZhbCgpO1xyXG4gICAgICAgIGNvbnN0IGFsbFByb2R1Y3RzSW5Sb29tID0gYXdhaXQgZGIuZ2V0UHJvZHVjdHNGb3JSb29tKHJvb21JRFRvVXNlKTtcclxuICAgICAgICBjb25zdCBncm91cGVkUHJvZHVjdHMgPSBhd2FpdCB0aGlzLmdyb3VwUHJvZHVjdHNCeVNLVShhbGxQcm9kdWN0c0luUm9vbSk7XHJcblxyXG4gICAgICAgIHRoaXMucFRhYmxlID0gbmV3IFRhYnVsYXRvcihcIiNwdGFibGVcIiwge1xyXG4gICAgICAgICAgICBkYXRhOiBncm91cGVkUHJvZHVjdHMsICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxvYWRlcjogZmFsc2UsXHJcbiAgICAgICAgICAgIGxheW91dDogXCJmaXRDb2x1bW5zXCIsXHJcbiAgICAgICAgICAgIGRhdGFMb2FkZXJFcnJvcjogXCJUaGVyZSB3YXMgYW4gZXJyb3IgbG9hZGluZyB0aGUgZGF0YVwiLFxyXG4gICAgICAgICAgICBpbml0aWFsU29ydDpbXHJcbiAgICAgICAgICAgICAgICB7Y29sdW1uOlwicHJvZHVjdF9zbHVnXCIsIGRpcjpcImFzY1wifSwgLy9zb3J0IGJ5IHRoaXMgZmlyc3RcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29sdW1uczogW3tcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJwcm9kdWN0X2lkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IFwidXVpZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcInByb2R1Y3Rfc2x1Z1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2R1Y3Rfc2x1Z1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIlNLVVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBcInNrdVwiLCAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgc29ydGVyOlwic3RyaW5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJQcm9kdWN0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IFwicHJvZHVjdF9uYW1lXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJSZWZcIixcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogXCJyZWZcIiwgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgZWRpdG9yOiBcImlucHV0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgZWRpdG9yUGFyYW1zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWFzazogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0Q29udGVudHM6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRBdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhsZW5ndGg6IFwiN1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIlF0eVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBcInF0eVwiLCAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBjZWxsQ2xpY2s6IChlLCBjZWxsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0UXR5RGlhbG9nKGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnNrdSwgY2VsbC5nZXRSb3coKS5nZXREYXRhKCkucXR5KTtcclxuICAgICAgICAgICAgICAgICAgICB9ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclNvcnQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdHRlcjogdXRpbHMuaWNvbkZhdixcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogNDAsXHJcbiAgICAgICAgICAgICAgICAgICAgaG96QWxpZ246IFwiY2VudGVyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgY2VsbENsaWNrOiAoZSwgY2VsbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZEZhdkRpYWxvZyhjZWxsLmdldFJvdygpLmdldERhdGEoKS5za3UsIGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnByb2R1Y3RfbmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyU29ydDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0dGVyOiB1dGlscy5pY29uWCxcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogNDAsXHJcbiAgICAgICAgICAgICAgICAgICAgaG96QWxpZ246IFwiY2VudGVyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgY2VsbENsaWNrOiAoZSwgY2VsbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZVNrdURpYWxvZyhjZWxsLmdldFJvdygpLmdldERhdGEoKS5za3UpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5wVGFibGUub24oXCJjZWxsRWRpdGVkXCIsIGZ1bmN0aW9uIChjZWxsKSB7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHNrdSA9IGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnNrdTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbV9pZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTtcclxuICAgICAgICAgICAgY29uc3QgcmVmID0gY2VsbC5nZXRSb3coKS5nZXREYXRhKCkucmVmICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRiLnVwZGF0ZVByb2R1Y3RSZWYocm9vbV9pZCwgc2t1LCByZWYpOyAgICAgICAgIFxyXG4gICAgICAgIH0pOyAgICAgICAgXHJcblxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGhhbmRsZUZpbGVVcGxvYWQoZXZlbnQpIHtcclxuICAgICAgICBcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBmaWxlUGlja2VyID0gZXZlbnQudGFyZ2V0O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCFmaWxlUGlja2VyIHx8ICFmaWxlUGlja2VyLmZpbGVzIHx8ICFmaWxlUGlja2VyLmZpbGVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBmaWxlIHNlbGVjdGVkLicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZmlsZVBpY2tlci5maWxlc1swXTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbGVjdGVkIGZpbGU6JywgZmlsZSk7XHJcblxyXG4gICAgICAgICAgICBVSWtpdC5tb2RhbCgkKCcjdXBsb2FkLXByb2dyZXNzJykpLnNob3coKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChmaWxlKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcclxuICAgICAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZCgnaW1hZ2UnLCBmaWxlKTtcclxuICAgICAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZCgndXNlcl9pZCcsIGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpKTtcclxuICAgICAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZCgncm9vbV9pZCcsICQoJyNtX3Jvb21faWQnKS52YWwoKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgICAgICAgICAgeGhyLm9wZW4oXCJQT1NUXCIsIFwiaHR0cHM6Ly9zc3QudGFtbGl0ZS5jby51ay9hcGkvaW1hZ2VfdXBsb2FkXCIsIHRydWUpICAgIDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBNb25pdG9yIHByb2dyZXNzIGV2ZW50c1xyXG4gICAgICAgICAgICAgICAgeGhyLnVwbG9hZC5hZGRFdmVudExpc3RlbmVyKFwicHJvZ3Jlc3NcIiwgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZS5sZW5ndGhDb21wdXRhYmxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwZXJjZW50YWdlID0gKGUubG9hZGVkIC8gZS50b3RhbCkgKiAxMDA7IC8vIENhbGN1bGF0ZSBwZXJjZW50YWdlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dChgVXBsb2FkaW5nOiAke01hdGgucm91bmQocGVyY2VudGFnZSl9JWApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCcudWstcHJvZ3Jlc3MnKS52YWwocGVyY2VudGFnZSk7IC8vIFVwZGF0ZSBwcm9ncmVzcyBiYXJcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gVXNlIGFycm93IGZ1bmN0aW9uIHRvIHByZXNlcnZlICd0aGlzJyBjb250ZXh0XHJcbiAgICAgICAgICAgICAgICB4aHIub25sb2FkID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZpbGUgdXBsb2FkZWQgc3VjY2Vzc2Z1bGx5OicsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dCgnVXBsb2FkIGNvbXBsZXRlIScpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnLnVrLXByb2dyZXNzJykudmFsKDEwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjdXBsb2FkLXByb2dyZXNzICNjbG9zZS1wcm9ncmVzcycpLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudXBkYXRlSW1hZ2VzKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZpbGUgdXBsb2FkIGZhaWxlZDonLCByZXNwb25zZS5tZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dCgnVXBsb2FkIGZhaWxlZDogJyArIHJlc3BvbnNlLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3VwbG9hZC1wcm9ncmVzcyAjY2xvc2UtcHJvZ3Jlc3MnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmlsZSB1cGxvYWQgZmFpbGVkLiBTdGF0dXM6JywgeGhyLnN0YXR1cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dCgnVXBsb2FkIGZhaWxlZC4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3VwbG9hZC1wcm9ncmVzcyAjY2xvc2UtcHJvZ3Jlc3MnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIGVycm9yc1xyXG4gICAgICAgICAgICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmlsZSB1cGxvYWQgZmFpbGVkIGR1ZSB0byBhIG5ldHdvcmsgZXJyb3IuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KCdOZXR3b3JrIGVycm9yIG9jY3VycmVkIGR1cmluZyB1cGxvYWQuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgJCgnI3VwbG9hZC1wcm9ncmVzcyAjY2xvc2UtcHJvZ3Jlc3MnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICB4aHIudGltZW91dCA9IDEyMDAwMDsgLy8gU2V0IHRpbWVvdXQgdG8gMiBtaW51dGVzXHJcbiAgICAgICAgICAgICAgICB4aHIub250aW1lb3V0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZpbGUgdXBsb2FkIHRpbWVkIG91dC4nKTtcclxuICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQoJ1VwbG9hZCB0aW1lZCBvdXQuIFBsZWFzZSB0cnkgYWdhaW4uJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgJCgnI3VwbG9hZC1wcm9ncmVzcyAjY2xvc2UtcHJvZ3Jlc3MnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICB4aHIuc2VuZChmb3JtRGF0YSk7IC8vIFNlbmQgdGhlIGZvcm0gZGF0YVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdObyBmaWxlIHNlbGVjdGVkLicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VwbG9hZCBlcnJvcjonLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSAgICBcclxuICAgIFxyXG4gICAgYXN5bmMgdXBkYXRlSW1hZ2VzKHJlc3BvbnNlKSB7ICAgICAgICBcclxuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBkYi5zYXZlSW1hZ2VGb3JSb29tKCQoJyNtX3Jvb21faWQnKS52YWwoKSwgcmVzcG9uc2UpOyAgICAgICAgXHJcbiAgICAgICAgYXdhaXQgdGhpcy5nZXRSb29tSW1hZ2VzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0Um9vbUltYWdlcygpIHtcclxuICAgICAgICBjb25zdCBpbWFnZXMgPSBhd2FpdCBkYi5nZXRJbWFnZXNGb3JSb29tKCQoJyNtX3Jvb21faWQnKS52YWwoKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ2dldCByb29tIGltYWdlczonLCBpbWFnZXMpO1xyXG4gICAgICAgIGNvbnN0IGh0bWwgPSBhd2FpdCB0aGlzLmdlbmVyYXRlSW1hZ2VzKGltYWdlcyk7XHJcbiAgICAgICAgJCgnI2ltYWdlcy5yb29tX2ltYWdlcycpLmh0bWwoaHRtbCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2VuZXJhdGVJbWFnZXMoaW1hZ2VzKSB7XHJcbiAgICAgICAgbGV0IGh0bWwgPSBgPGRpdiBjbGFzcz1cInVrLXdpZHRoLTEtMVwiIHVrLWxpZ2h0Ym94PVwiYW5pbWF0aW9uOiBzbGlkZVwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJ1ay1ncmlkLXNtYWxsIHVrLWNoaWxkLXdpZHRoLTEtMiB1ay1jaGlsZC13aWR0aC0xLTJAcyB1ay1jaGlsZC13aWR0aC0xLTNAbSB1ay1jaGlsZC13aWR0aC0xLTRAbCB1ay1mbGV4LWNlbnRlciB1ay10ZXh0LWNlbnRlciBcIiB1ay1ncmlkPmA7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIFxyXG4gICAgICAgIGltYWdlcy5mb3JFYWNoKGltYWdlID0+IHtcclxuICAgICAgICAgICAgaHRtbCArPSBgPGRpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInVrLWNhcmQgdWstY2FyZC1kZWZhdWx0IHVrLWNhcmQtYm9keSB1ay1wYWRkaW5nLXJlbW92ZVwiPlxyXG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cImh0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvdXBsb2Fkcy8ke2ltYWdlLnNhZmVfZmlsZW5hbWV9XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW1hZ2ViZ1wiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKGh0dHBzOi8vc3N0LnRhbWxpdGUuY28udWsvdXBsb2Fkcy8ke2ltYWdlLnNhZmVfZmlsZW5hbWV9KTtcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvYT5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PmA7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGh0bWwgKz0gYDwvZGl2PjwvZGl2PmA7XHJcblxyXG4gICAgICAgIHJldHVybihodG1sKTtcclxuICAgIH1cclxuXHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBUYWJsZXNNb2R1bGUoKTsiLCJjbGFzcyBVdGlsc01vZHVsZSB7XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1V0aWxzTW9kdWxlIGNvbnN0cnVjdG9yJyk7XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gZmFsc2U7ICAgXHJcblxyXG4gICAgICAgIHRoaXMudWlkID0gdGhpcy5nZXRDb29raWUoJ3VzZXJfaWQnKTtcclxuXHJcbiAgICAgICAgdGhpcy5jaGVja0xvZ2luKCk7ICAgICAgICBcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmljb25QbHVzID0gZnVuY3Rpb24oY2VsbCwgZm9ybWF0dGVyUGFyYW1zLCBvblJlbmRlcmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1jaXJjbGUtcGx1c1wiPjwvaT4nO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpcy5pY29uTWludXMgPSBmdW5jdGlvbihjZWxsLCBmb3JtYXR0ZXJQYXJhbXMsIG9uUmVuZGVyZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICc8aSBjbGFzcz1cImZhLXNvbGlkIGZhLWNpcmNsZS1taW51c1wiPjwvaT4nO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpcy5pY29uWCA9IGZ1bmN0aW9uKGNlbGwsIGZvcm1hdHRlclBhcmFtcywgb25SZW5kZXJlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJzxzcGFuIGNsYXNzPVwiaWNvbiByZWRcIiB1ay1pY29uPVwiaWNvbjogdHJhc2g7IHJhdGlvOiAxLjNcIiB0aXRsZT1cIkRlbGV0ZVwiPjwvc3Bhbj4nO1xyXG4gICAgICAgIH07ICAgIFxyXG4gICAgICAgIHRoaXMuaWNvbkNvcHkgPSBmdW5jdGlvbihjZWxsLCBmb3JtYXR0ZXJQYXJhbXMsIG9uUmVuZGVyZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICc8c3BhbiBjbGFzcz1cImljb25cIiB1ay1pY29uPVwiaWNvbjogY29weTsgcmF0aW86IDEuM1wiIHRpdGxlPVwiRHVwbGljYXRlXCI+PC9zcGFuPic7XHJcbiAgICAgICAgfTsgICAgIFxyXG4gICAgICAgIHRoaXMuaWNvbkZhdiA9IGZ1bmN0aW9uKGNlbGwsIGZvcm1hdHRlclBhcmFtcywgb25SZW5kZXJlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJzxzcGFuIGNsYXNzPVwiaWNvbiByZWRcIiB1ay1pY29uPVwiaWNvbjogaGVhcnQ7IHJhdGlvOiAxLjNcIiB0aXRsZT1cIkZhdm91cml0ZVwiPjwvc3Bhbj4nO1xyXG4gICAgICAgIH07ICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxvZ2luID0gVUlraXQubW9kYWwoJy5sb2dpbm1vZGFsJywge1xyXG4gICAgICAgICAgICBiZ0Nsb3NlIDogZmFsc2UsXHJcbiAgICAgICAgICAgIGVzY0Nsb3NlIDogZmFsc2VcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSByZXR1cm47XHJcbiAgICAgICAgTXVzdGFjaGUudGFncyA9IFtcIltbXCIsIFwiXV1cIl07XHJcbiAgICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gdHJ1ZTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIFxyXG4gICAgYXN5bmMgY2hlY2tMb2dpbigpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQ2hlY2tpbmcgYXV0aGVudGljYXRpb24gLi4uJyk7XHJcbiAgICAgICAgY29uc3QgZGIgPSByZXF1aXJlKCcuLi9kYicpOyAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB0aGlzLmdldENvb2tpZSgndXNlcl9pZCcpO1xyXG4gICAgXHJcbiAgICAgICAgaWYgKHVzZXJfaWQgPT0gXCJcIikge1xyXG4gICAgICAgICAgICBVSWtpdC5tb2RhbCgnLmxvZ2lubW9kYWwnKS5zaG93KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgJCgnI21fdXNlcl9pZCcpLnZhbCh1c2VyX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IHRoYXQgPSB0aGlzO1xyXG4gICAgXHJcbiAgICAgICAgJChcIiNmb3JtLWxvZ2luXCIpLm9mZihcInN1Ym1pdFwiKS5vbihcInN1Ym1pdFwiLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgJCgnLmxvZ2luLWVycm9yJykuaGlkZSgpO1xyXG4gICAgICAgICAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNmb3JtLWxvZ2luXCIpOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgZGIubG9naW5Vc2VyKG5ldyBGb3JtRGF0YShmb3JtKSk7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodXNlciAhPT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgICQoJyNtX3VzZXJfaWQnKS52YWwodXNlci51dWlkKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQuc2V0Q29va2llKCd1c2VyX2lkJywgdXNlci51dWlkKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQuc2V0Q29va2llKCd1c2VyX25hbWUnLCB1c2VyLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgZGIuc3luY0RhdGEodXNlci51dWlkKTsgIFxyXG4gICAgXHJcbiAgICAgICAgICAgICAgICBVSWtpdC5tb2RhbCgkKCcjbG9naW4nKSkuaGlkZSgpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXNlIHJlcGxhY2Ugc3RhdGUgaW5zdGVhZCBvZiByZWRpcmVjdFxyXG4gICAgICAgICAgICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCAnJywgJy8nKTtcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgJCgnLmxvZ2luLWVycm9yIHAnKS5odG1sKFwiVGhlcmUgd2FzIGFuIGVycm9yIGxvZ2dpbmcgaW4uIFBsZWFzZSB0cnkgYWdhaW4uXCIpO1xyXG4gICAgICAgICAgICAgICAgJCgnLmxvZ2luLWVycm9yJykuc2hvdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9nb3V0KCkge1xyXG4gICAgICAgIC8vIGlmIG9mZmxpbmUgc2hvdyBtZXNzYWdlXHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7bWVzc2FnZTogJ1lvdSBhcmUgb2ZmbGluZS4gUGxlYXNlIGNvbm5lY3QgdG8gdGhlIGludGVybmV0IGFuZCB0cnkgYWdhaW4uJywgc3RhdHVzOiAnd2FybmluZycsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAyMDAwIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhd2FpdCB0aGlzLmRlbGV0ZUNvb2tpZSgndXNlcl9pZCcpO1xyXG4gICAgICAgIGF3YWl0IHRoaXMuZGVsZXRlQ29va2llKCd1c2VyX25hbWUnKTtcclxuICAgICAgICAvLyBVc2UgcmVwbGFjZSBzdGF0ZSBpbnN0ZWFkIG9mIHJlZGlyZWN0XHJcbiAgICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCAnJywgJy8/dD0nKTtcclxuICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBkZWxldGVDb29raWUoY25hbWUpIHtcclxuICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoKTtcclxuICAgICAgICBkLnNldFRpbWUoZC5nZXRUaW1lKCkgLSAoMjQgKiA2MCAqIDYwICogMTAwMCkpO1xyXG4gICAgICAgIGxldCBleHBpcmVzID0gXCJleHBpcmVzPVwiICsgZC50b1VUQ1N0cmluZygpO1xyXG4gICAgICAgIGRvY3VtZW50LmNvb2tpZSA9IGNuYW1lICsgXCI9O1wiICsgZXhwaXJlcyArIFwiO3BhdGg9L1wiO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNldENvb2tpZShjbmFtZSwgY3ZhbHVlLCBleGRheXMpIHtcclxuICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoKTtcclxuICAgICAgICBkLnNldFRpbWUoZC5nZXRUaW1lKCkgKyAoZXhkYXlzICogMjQgKiA2MCAqIDYwICogMTAwMCkpO1xyXG4gICAgICAgIGxldCBleHBpcmVzID0gXCJleHBpcmVzPVwiK2QudG9VVENTdHJpbmcoKTtcclxuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjbmFtZSArIFwiPVwiICsgY3ZhbHVlICsgXCI7XCIgKyBleHBpcmVzICsgXCI7cGF0aD0vXCI7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0Q29va2llKGNuYW1lKSB7XHJcbiAgICAgICAgbGV0IG5hbWUgPSBjbmFtZSArIFwiPVwiO1xyXG4gICAgICAgIGxldCBjYSA9IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpO1xyXG4gICAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBjYS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgYyA9IGNhW2ldO1xyXG4gICAgICAgICAgICB3aGlsZSAoYy5jaGFyQXQoMCkgPT0gJyAnKSB7XHJcbiAgICAgICAgICAgICAgICBjID0gYy5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGMuaW5kZXhPZihuYW1lKSA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYy5zdWJzdHJpbmcobmFtZS5sZW5ndGgsIGMubGVuZ3RoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgIH1cclxuXHJcblxyXG4gICAgYXN5bmMgZ2V0VXNlcklEKCkge1xyXG4gICAgICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB0aGlzLmdldENvb2tpZSgndXNlcl9pZCcpOyAgICAgICAgXHJcbiAgICAgICAgaWYgKHVzZXJfaWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVzZXJfaWQudG9TdHJpbmcoKTtcclxuICAgICAgICB9IGVsc2UgeyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLmNoZWNrTG9naW4oKTtcclxuICAgICAgICB9ICAgICAgIFxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBhc3luYyBzaG93U3BpbigpIHtcclxuICAgICAgICAkKCcjc3Bpbm5lcicpLmZhZGVJbignZmFzdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGhpZGVTcGluKCkge1xyXG4gICAgICAgICQoJyNzcGlubmVyJykuZmFkZU91dCgnZmFzdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGZvcm1hdERhdGVUaW1lIChkYXRlKSB7XHJcbiAgICAgICAgY29uc3QgcGFkID0gKG51bSkgPT4gbnVtLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKTtcclxuICAgICAgICByZXR1cm4gYCR7ZGF0ZS5nZXRGdWxsWWVhcigpfS0ke3BhZChkYXRlLmdldE1vbnRoKCkgKyAxKX0tJHtwYWQoZGF0ZS5nZXREYXRlKCkpfSAke3BhZChkYXRlLmdldEhvdXJzKCkpfToke3BhZChkYXRlLmdldE1pbnV0ZXMoKSl9OiR7cGFkKGRhdGUuZ2V0U2Vjb25kcygpKX1gO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNldENvb2tpZShjbmFtZSwgY3ZhbHVlLCBleGRheXMpIHtcclxuICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoKTtcclxuICAgICAgICBkLnNldFRpbWUoZC5nZXRUaW1lKCkgKyAoZXhkYXlzICogMjQgKiA2MCAqIDYwICogMTAwMCkpO1xyXG4gICAgICAgIGxldCBleHBpcmVzID0gXCJleHBpcmVzPVwiK2QudG9VVENTdHJpbmcoKTtcclxuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjbmFtZSArIFwiPVwiICsgY3ZhbHVlICsgXCI7XCIgKyBleHBpcmVzICsgXCI7cGF0aD0vXCI7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0Q29va2llKGNuYW1lKSB7XHJcbiAgICAgICAgbGV0IG5hbWUgPSBjbmFtZSArIFwiPVwiO1xyXG4gICAgICAgIGxldCBjYSA9IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpO1xyXG4gICAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBjYS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgYyA9IGNhW2ldO1xyXG4gICAgICAgICAgICB3aGlsZSAoYy5jaGFyQXQoMCkgPT0gJyAnKSB7XHJcbiAgICAgICAgICAgICAgICBjID0gYy5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGMuaW5kZXhPZihuYW1lKSA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYy5zdWJzdHJpbmcobmFtZS5sZW5ndGgsIGMubGVuZ3RoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgIH0gICBcclxuICAgIFxyXG4gICAgYXN5bmMgc2x1Z2lmeSh0ZXh0KSB7XHJcbiAgICAgICAgLy8gbWFrZSBhIHNsdWcgb2YgdGhpcyB0ZXh0XHJcbiAgICAgICAgcmV0dXJuIHRleHQudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLnRyaW0oKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxzKy9nLCAnLScpICAgICAgICAgICAvLyBSZXBsYWNlIHNwYWNlcyB3aXRoIC1cclxuICAgICAgICAgICAgLnJlcGxhY2UoL1teXFx3XFwtXSsvZywgJycpICAgICAgIC8vIFJlbW92ZSBhbGwgbm9uLXdvcmQgY2hhcnNcclxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcLVxcLSsvZywgJy0nKTsgICAgICAgIC8vIFJlcGxhY2UgbXVsdGlwbGUgLSB3aXRoIHNpbmdsZSAtXHJcbiAgICB9XHJcbiAgICBhc3luYyBkZXNsdWdpZnkodGV4dCkge1xyXG4gICAgICAgIC8vIG1ha2UgaHVtYW4gcmVhZGFibGUgdGV4dCBmcm9tIHNsdWcgICBcclxuICAgICAgICByZXR1cm4gdGV4dC50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkudHJpbSgpXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC8tL2csICcgJyk7ICAgICAgICAgICAvLyBSZXBsYWNlIC0gd2l0aCBzcGFjZSAgICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRBcHBWZXJzaW9uKCkge1xyXG4gICAgICAgIC8vY29uc29sZS5sb2coJ2dldHRpbmcgdmVyc2lvbicpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIHNlcnZpY2Ugd29ya2VyIHJlZ2lzdHJhdGlvblxyXG4gICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSBhd2FpdCBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWFkeTtcclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnZ290IHJlZ2lzdHJhdGlvbjonLCByZWdpc3RyYXRpb24pO1xyXG4gICAgXHJcbiAgICAgICAgICAgIGlmICghcmVnaXN0cmF0aW9uLmFjdGl2ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBhY3RpdmUgc2VydmljZSB3b3JrZXIgZm91bmQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25Qcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgbGV0IG1lc3NhZ2VIYW5kbGVyO1xyXG4gICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjbGVhbnVwID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcclxuICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgbWVzc2FnZUhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdWZXJzaW9uIHJlcXVlc3QgdGltZWQgb3V0JykpO1xyXG4gICAgICAgICAgICAgICAgfSwgMTAwMDApO1xyXG4gICAgXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlSGFuZGxlciA9IChldmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ1V0aWxzIHJlY2VpdmVkIFNXIG1lc3NhZ2U6JywgZXZlbnQuZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LmRhdGE/LnR5cGUgPT09ICdDQUNIRV9WRVJTSU9OJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSBldmVudC5kYXRhLnZlcnNpb24uc3BsaXQoJy12JylbMV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFeHRyYWN0ZWQgdmVyc2lvbjonLCB2ZXJzaW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh2ZXJzaW9uKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgXHJcbiAgICAgICAgICAgICAgICAvLyBBZGQgbWVzc2FnZSBsaXN0ZW5lciBiZWZvcmUgc2VuZGluZyBtZXNzYWdlXHJcbiAgICAgICAgICAgICAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgbWVzc2FnZUhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBTZW5kIG1lc3NhZ2UgdG8gc2VydmljZSB3b3JrZXJcclxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ1V0aWxzIHNlbmRpbmcgZ2V0Q2FjaGVWZXJzaW9uIG1lc3NhZ2UnKTtcclxuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5hY3RpdmUucG9zdE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdHRVRfVkVSU0lPTicsXHJcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICBcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IGF3YWl0IHZlcnNpb25Qcm9taXNlO1xyXG4gICAgICAgICAgICByZXR1cm4gYDEuMC4ke3ZlcnNpb259YDtcclxuICAgIFxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIC8vY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBhcHAgdmVyc2lvbjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIHJldHVybiAnTm90IHNldCc7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGNsZWFyU2VydmljZVdvcmtlckNhY2hlKCkge1xyXG4gICAgICAgIC8vIGlmIG9mZmxpbmUgc2hvdyBtZXNzYWdlXHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbih7bWVzc2FnZTogJ1lvdSBhcmUgb2ZmbGluZS4gUGxlYXNlIGNvbm5lY3QgdG8gdGhlIGludGVybmV0IGFuZCB0cnkgYWdhaW4uJywgc3RhdHVzOiAnd2FybmluZycsIHBvczogJ2JvdHRvbS1jZW50ZXInLCB0aW1lb3V0OiAyMDAwIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCByZWdpc3RyYXRpb25zID0gYXdhaXQgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuZ2V0UmVnaXN0cmF0aW9ucygpO1xyXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHJlZ2lzdHJhdGlvbnMubWFwKHJlZyA9PiByZWcudW5yZWdpc3RlcigpKSk7XHJcbiAgICAgICAgY29uc3QgY2FjaGVLZXlzID0gYXdhaXQgY2FjaGVzLmtleXMoKTtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChjYWNoZUtleXMubWFwKGtleSA9PiBjYWNoZXMuZGVsZXRlKGtleSkpKTtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKCdTZXJ2aWNlIFdvcmtlciBhbmQgY2FjaGVzIGNsZWFyZWQnKTtcclxuICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgbWFrZWlkKGxlbmd0aCkge1xyXG4gICAgICAgIGxldCByZXN1bHQgPSAnJztcclxuICAgICAgICBjb25zdCBjaGFyYWN0ZXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5JztcclxuICAgICAgICBjb25zdCBjaGFyYWN0ZXJzTGVuZ3RoID0gY2hhcmFjdGVycy5sZW5ndGg7XHJcbiAgICAgICAgbGV0IGNvdW50ZXIgPSAwO1xyXG4gICAgICAgIHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCArPSBjaGFyYWN0ZXJzLmNoYXJBdChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFyYWN0ZXJzTGVuZ3RoKSk7XHJcbiAgICAgICAgICAgIGNvdW50ZXIgKz0gMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcblxyXG59XHJcbm1vZHVsZS5leHBvcnRzID0gbmV3IFV0aWxzTW9kdWxlKCk7IiwiY29uc3QgTXVzdGFjaGUgPSByZXF1aXJlKCdtdXN0YWNoZScpO1xyXG5jb25zdCBzc3QgPSByZXF1aXJlKCcuL3NzdCcpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vbW9kdWxlcy91dGlscycpO1xyXG5jb25zdCBDT05GSUcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKHBhdGgpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgL3ZpZXdzLyR7cGF0aH0uaHRtbGApO1xyXG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcignTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdGZXRjaGluZyBmcm9tIGNhY2hlOicsIGVycm9yKTtcclxuICAgICAgICBjb25zdCBjYWNoZSA9IGF3YWl0IGNhY2hlcy5vcGVuKENPTkZJRy5DQUNIRV9OQU1FKTsgLy8gVXNlIENPTkZJRy5DQUNIRV9OQU1FIGluIHlvdXIgY2FjaGUgb3BlcmF0aW9uc1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNhY2hlZFJlc3BvbnNlID0gYXdhaXQgY2FjaGUubWF0Y2goYC92aWV3cy8ke3BhdGh9Lmh0bWxgKTtcclxuICAgICAgICBpZiAoY2FjaGVkUmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGNhY2hlZFJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICAgICAgaXNSb3V0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG59XHJcblxyXG5sZXQgaXNSb3V0aW5nID0gZmFsc2U7XHJcblxyXG5hc3luYyBmdW5jdGlvbiByb3V0ZXIocGF0aCwgcHJvamVjdF9pZCkge1xyXG4gICAgaWYgKGlzUm91dGluZykgcmV0dXJuO1xyXG4gICAgaXNSb3V0aW5nID0gdHJ1ZTtcclxuICAgIFxyXG4gICAgYXdhaXQgdXRpbHMuY2hlY2tMb2dpbigpO1xyXG5cclxuICAgIC8vIFVwZGF0ZSBicm93c2VyIFVSTCB3aXRob3V0IHJlbG9hZFxyXG4gICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHt9LCAnJywgYC8ke3BhdGh9YCk7XHJcbiAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgICAgbGV0IHRlbXBsYXRlO1xyXG4gICAgICAgIHN3aXRjaChwYXRoKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ3RhYmxlcyc6ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGUgPSBhd2FpdCBsb2FkVGVtcGxhdGUoJ3RhYmxlcycpO1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHN0b3JlZCBwcm9qZWN0IGRhdGFcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByb2plY3REYXRhID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBNdXN0YWNoZS5yZW5kZXIodGVtcGxhdGUsIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdUYWJsZXMgUGFnZScsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdDogcHJvamVjdERhdGEsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdF9pZDogcHJvamVjdF9pZFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAkKCcjcGFnZScpLmh0bWwocmVuZGVyZWQpO1xyXG4gICAgICAgICAgICAgICAgc3N0Lmdsb2JhbEJpbmRzKCk7XHJcbiAgICAgICAgICAgICAgICBzc3QudGFibGVzRnVuY3Rpb25zKHByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NjaGVkdWxlJzpcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlID0gYXdhaXQgbG9hZFRlbXBsYXRlKCdzY2hlZHVsZScpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWRTY2hlZHVsZSA9IE11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgeyBcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1NjaGVkdWxlIFBhZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICdUaGlzIGlzIHRoZSBzY2hlZHVsZSBwYWdlIGNvbnRlbnQnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICQoJyNwYWdlJykuaHRtbChyZW5kZXJlZFNjaGVkdWxlKTtcclxuICAgICAgICAgICAgICAgIHNzdC5nbG9iYWxCaW5kcygpO1xyXG4gICAgICAgICAgICAgICAgc3N0LnNjaGVkdWxlRnVuY3Rpb25zKCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnYWNjb3VudCc6XHJcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZSA9IGF3YWl0IGxvYWRUZW1wbGF0ZSgnYWNjb3VudCcpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyZWRBY2NvdW50ID0gTXVzdGFjaGUucmVuZGVyKHRlbXBsYXRlLCB7IFxyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnQWNjb3VudCBQYWdlJyxcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiAnVGhpcyBpcyB0aGUgYWNjb3VudCBwYWdlIGNvbnRlbnQnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICQoJyNwYWdlJykuaHRtbChyZW5kZXJlZEFjY291bnQpO1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBzc3QuZ2xvYmFsQmluZHMoKTtcclxuICAgICAgICAgICAgICAgICAgICBzc3QuYWNjb3VudEZ1bmN0aW9ucygpO1xyXG4gICAgICAgICAgICAgICAgfSwgNTAwKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrOyAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlID0gYXdhaXQgbG9hZFRlbXBsYXRlKCdob21lJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJlZEhvbWUgPSBNdXN0YWNoZS5yZW5kZXIodGVtcGxhdGUsIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdEYXNoYm9hcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICdZb3VyIHByb2plY3RzIGFyZSBsaXN0ZWQgYmVsb3cnXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICQoJyNwYWdlJykuaHRtbChyZW5kZXJlZEhvbWUpO1xyXG4gICAgICAgICAgICAgICAgc3N0Lmdsb2JhbEJpbmRzKCk7XHJcbiAgICAgICAgICAgICAgICBzc3QuaG9tZUZ1bmN0aW9ucygpO1xyXG4gICAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignUm91dGluZyBlcnJvcjonLCBlcnJvcik7XHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpOyAgICAgICAgXHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIGlzUm91dGluZyA9IGZhbHNlO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyBIYW5kbGUgYnJvd3NlciBiYWNrL2ZvcndhcmQgYnV0dG9uc1xyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWVcclxuICAgICAgICAuc3BsaXQoJy8nKVxyXG4gICAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0Lmxlbmd0aCA+IDApO1xyXG4gICAgcm91dGVyKHBhdGhQYXJ0c1swXSB8fCAnaG9tZScsIHBhdGhQYXJ0c1sxXSk7XHJcbn0pO1xyXG5cclxuLy9tb2R1bGUuZXhwb3J0cyA9IHJvdXRlcjtcclxud2luZG93LnJvdXRlciA9IHJvdXRlcjtcclxuIiwiY29uc3QgTXVzdGFjaGUgPSByZXF1aXJlKCdtdXN0YWNoZScpO1xyXG5jb25zdCBkYiA9IHJlcXVpcmUoJy4vZGInKTsgXHJcbmNvbnN0IHRhYmxlcyA9IHJlcXVpcmUoJy4vbW9kdWxlcy90YWJsZXMnKTtcclxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21vZHVsZXMvdXRpbHMnKTtcclxuY29uc3Qgc2lkZWJhciA9IHJlcXVpcmUoJy4vbW9kdWxlcy9zaWRlYmFyJyk7XHJcbmNvbnN0IHN5bmMgPSByZXF1aXJlKCcuL21vZHVsZXMvc3luYycpO1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2xvYmFsQmluZHMoKSB7XHJcblxyXG4gICAgY29uc3QgY3VycmVudFByb2plY3QgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50UHJvamVjdCcpIHx8ICd7fScpO1xyXG4gICAgaWYgKCFjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkKSB7XHJcbiAgICAgICAgJCgnLnRhYmxlc19saW5rLC5zY2hlZHVsZV9saW5rJykuaGlkZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAkKCcudGFibGVzX2xpbmssLnNjaGVkdWxlX2xpbmsnKS5zaG93KCk7XHJcbiAgICB9ICAgIFxyXG5cclxuICAgICQoJyNzeW5jaWNvbicpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHN5bmMucHVzaEFsbFVzZXJEYXRhKCk7XHJcbiAgICB9KTtcclxuICAgICQoJyNzeW5jaWNvbicpLm9uKCd0b3VjaGVuZCcpLm9uKCd0b3VjaGVuZCcsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAkKCcjc3luY2ljb24nKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7IFxyXG4gICAgICAgIH0sIDEwMDApO1xyXG4gICAgfSk7XHJcblxyXG59XHJcblxyXG4vKlxyXG4qICAgVGFibGVzIHBhZ2UgZnVuY3Rpb25zXHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIHRhYmxlc0Z1bmN0aW9ucyhwcm9qZWN0X2lkKSB7XHJcbiAgICB0YWJsZXMuaW5pdCgpOyAgICAgIFxyXG5cclxuICAgIGNvbnN0IHVzZXJfaWQgPSBhd2FpdCB1dGlscy5nZXRDb29raWUoJ3VzZXJfaWQnKTtcclxuICAgIFxyXG4gICAgY29uc3QgY3VycmVudFByb2plY3QgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50UHJvamVjdCcpIHx8ICd7fScpO1xyXG4gICAgaWYgKGN1cnJlbnRQcm9qZWN0LnByb2plY3RfaWQpIHtcclxuICAgICAgICBwcm9qZWN0X2lkID0gY3VycmVudFByb2plY3QucHJvamVjdF9pZDtcclxuICAgIH0gICAgICAgIFxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdSdW5uaW5nIHRhYmxlcyBmdW5jdGlvbnMgZm9yIHByb2plY3Q6JywgcHJvamVjdF9pZCk7XHJcblxyXG4gICAgXHJcblxyXG4gICAgLy8kKCcjZGVidWcnKS5odG1sKGN1cnJlbnRQcm9qZWN0LnByb2plY3RfbmFtZSk7XHJcbiAgICAkKCcudGFibGVzX2xpbmsnKS5zaG93KCk7XHJcbiAgICBVSWtpdC5vZmZjYW52YXMoJy50YWJsZXMtc2lkZScpLnNob3coKTtcclxuXHJcbiAgICAvLyBJbml0aWFsIGxvYWQgd2l0aCBkZWZhdWx0IGJyYW5kXHJcbiAgICBhd2FpdCB0YWJsZXMudXBkYXRlVHlwZXNEcm9wZG93bignMScpO1xyXG4gICAgXHJcbiAgICAvLyBIYW5kbGUgYnJhbmQgY2hhbmdlc1xyXG4gICAgJCgnI2Zvcm1fYnJhbmQnKS5vbignY2hhbmdlJywgYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgYXdhaXQgdGFibGVzLnVwZGF0ZVR5cGVzRHJvcGRvd24oJCh0aGlzKS52YWwoKSk7XHJcbiAgICB9KTtcclxuICAgIC8vIEhhbmRsZSB0eXBlIGNoYW5nZXNcclxuICAgICQoJyNmb3JtX3R5cGUnKS5vbignY2hhbmdlJywgYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgYXdhaXQgdGFibGVzLnVwZGF0ZVByb2R1Y3RzRHJvcGRvd24oJCh0aGlzKS52YWwoKSk7XHJcbiAgICB9KTtcclxuICAgIC8vIEhhbmRsZSBwcm9kdWN0IGNoYW5nZXNcclxuICAgICQoJyNmb3JtX3Byb2R1Y3QnKS5vbignY2hhbmdlJywgYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgYXdhaXQgdGFibGVzLnVwZGF0ZVNrdXNEcm9wZG93bigkKHRoaXMpLnZhbCgpKTtcclxuICAgIH0pOyAgICBcclxuXHJcbiAgICAvLyBhZGQgcHJvZGN1dCB0byByb29tXHJcbiAgICAkKCcjYnRuX2FkZF9wcm9kdWN0Jykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgYXdhaXQgdGFibGVzLmFkZFByb2R1Y3RUb1Jvb21DbGljaygpOyAgICAgICBcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBTcGVjaWFsIHRvIHJvb21cclxuICAgICQoJyNidG5fYWRkX3NwZWNpYWwnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgLy9VSWtpdC5tb2RhbCgnI2FkZC1zcGVjaWFsJykucmVtb3ZlKCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNhZGQtc3BlY2lhbCcsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTtcclxuICAgIH0pO1xyXG5cclxuICAgICQoJyNhZGQtaW1hZ2UnKS5vbignY2hhbmdlJywgdGFibGVzLmhhbmRsZUZpbGVVcGxvYWQpO1xyXG4gICAgJCgnI3VwbG9hZC1wcm9ncmVzcyAjY2xvc2UtcHJvZ3Jlc3MnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJCgnI3VwbG9hZC1wcm9ncmVzcycpKS5oaWRlKCk7XHJcbiAgICB9KTsgICAgXHJcblxyXG5cclxuICAgIGF3YWl0IHRhYmxlcy5yZW5kZXJQcm9kY3RzVGFibGUoKTtcclxuXHJcbiAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyBcclxuICAgIGF3YWl0IHNpZGViYXIucmVuZGVyRmF2b3VyaXRlcyh1c2VyX2lkKTtcclxuXHJcblxyXG4gICAgLy8gbG9hZFJvb21EYXRhIGZvciB0aGUgZmlyc3QgbWVudGlvbmVkIHJvb20gaWQgaW4gdGhlIHNpZGViYXJcclxuICAgIGNvbnN0IGZpcnN0Um9vbUlkID0gJCgnI2xvY2F0aW9ucyAucm9vbS1saW5rJykuZmlyc3QoKS5kYXRhKCdpZCcpOyAgICBcclxuICAgIGF3YWl0IGxvYWRSb29tRGF0YShmaXJzdFJvb21JZCk7XHJcbiAgICBhd2FpdCBsb2FkUm9vbU5vdGVzKGZpcnN0Um9vbUlkKTtcclxuICAgIGF3YWl0IGxvYWRSb29tSW1hZ2VzKGZpcnN0Um9vbUlkKTtcclxuXHJcbiAgICAvLyBuYW1lIGxhYmVscyAocmVuYW1lKVxyXG4gICAgJCgnc3Bhbi5uYW1lJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ05hbWUgY2xpY2tlZDonLCAkKHRoaXMpLmRhdGEoJ2lkJykpOyAgICBcclxuICAgICAgICBjb25zdCBzdG9yZSA9ICQodGhpcykuZGF0YSgndGJsJyk7XHJcbiAgICAgICAgY29uc3QgdXVpZCA9ICQodGhpcykuZGF0YSgnaWQnKTtcclxuICAgICAgICBjb25zdCBuYW1lID0gJCh0aGlzKS50ZXh0KCk7XHJcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgLy8gY2FsbCB0aGUgbW9kYWwgdG8gdXBkYXRlIHRoZSBuYW1lXHJcbiAgICAgICAgVUlraXQubW9kYWwucHJvbXB0KCc8aDQ+TmV3IG5hbWU8L2g0PicsIG5hbWUpLnRoZW4oYXN5bmMgZnVuY3Rpb24obmV3TmFtZSkge1xyXG4gICAgICAgICAgICBpZiAobmV3TmFtZSkgeyAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGF3YWl0IGRiLnVwZGF0ZU5hbWUoc3RvcmUsIHV1aWQsIG5ld05hbWUpO1xyXG4gICAgICAgICAgICAgICAgJCh0aGF0KS50ZXh0KG5ld05hbWUpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG5cclxuICAgIC8vIHJvb20gZGltZW5zaW9uIGZpZWxkc1xyXG4gICAgJCgnLnJvb21kaW0nKS5vZmYoJ2JsdXInKS5vbignYmx1cicsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBjb25zdCByb29tVXVpZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTtcclxuICAgICAgICBjb25zdCBmaWVsZCA9ICQodGhpcykuZGF0YSgnZmllbGQnKTtcclxuICAgICAgICBjb25zdCB2YWx1ZSA9ICQodGhpcykudmFsKCk7XHJcbiAgICAgICAgYXdhaXQgZGIudXBkYXRlUm9vbURpbWVuc2lvbihyb29tVXVpZCwgZmllbGQsIHZhbHVlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGFkZCBzcGVjaWFsIHRvIHJvb21cclxuICAgICQoJyNmb3JtLWFkZC1zcGVjaWFsJykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBhd2FpdCB0YWJsZXMuYWRkU3BlY2lhbFRvUm9vbUNsaWNrKCk7ICAgICAgICAgXHJcbiAgICAgICAgJCgnI2Zvcm0tYWRkLXNwZWNpYWwnKS50cmlnZ2VyKFwicmVzZXRcIik7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNhZGQtc3BlY2lhbCcpLmhpZGUoKTsgXHJcbiAgICB9KTsgICAgIFxyXG5cclxuICAgIC8vIG9wZW4gY29weSByb29tIG1vZGFsXHJcbiAgICAkKCcjY29weV9yb29tJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgIFxyXG4gICAgICAgIGNvbnN0IGZsb29ycyA9IGF3YWl0IGRiLmdldEZsb29ycyhwcm9qZWN0X2lkKTtcclxuICAgICAgICBsZXQgZmxvb3JPcHRpb25zID0gZmxvb3JzLm1hcChmbG9vciA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7Zmxvb3IudXVpZH1cIj4ke2Zsb29yLm5hbWV9PC9vcHRpb24+YCkuam9pbignJyk7XHJcbiAgICAgICAgJCgnI2NvcHktcm9vbS1tb2RhbCBzZWxlY3QjbW9kYWxfZm9ybV9mbG9vcicpLmh0bWwoZmxvb3JPcHRpb25zKTtcclxuXHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNjb3B5LXJvb20tbW9kYWwnLCB7IHN0YWNrIDogdHJ1ZSB9KS5zaG93KCk7ICAgICAgIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gY29weSByb29tIG1vZGFsIHN1Ym1pdHRlZFxyXG4gICAgJCgnI2Zvcm0tY29weS1yb29tJykub2ZmKCdzdWJtaXQnKS5vbignc3VibWl0JywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBjb25zdCByb29tVXVpZCA9ICQoJyNtX3Jvb21faWQnKS52YWwoKTsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IG5ld1Jvb21OYW1lID0gJCgnI21vZGFsX2Zvcm1fbmV3X25hbWUnKS52YWwoKTtcclxuICAgICAgICBjb25zdCBuZXdGbG9vclV1aWQgPSAkKCcjbW9kYWxfZm9ybV9mbG9vcicpLmZpbmQoXCI6c2VsZWN0ZWRcIikudmFsKCk7XHJcblxyXG4gICAgICAgIGNvbnN0IG5ld1Jvb21VdWlkID0gYXdhaXQgZGIuY29weVJvb20ocm9vbVV1aWQsIG5ld1Jvb21OYW1lLCBuZXdGbG9vclV1aWQpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IC8vIHByb2plY3RfaWRcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbURhdGEobmV3Um9vbVV1aWQpO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsKCcjY29weS1yb29tLW1vZGFsJykuaGlkZSgpOyBcclxuICAgIH0pOyAgICBcclxuXHJcbiAgICAvLyBhZGQgbm90ZSBidXR0b24gY2xpY2tcclxuICAgICQoJyNhZGQtbm90ZScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICQoJyNlZGl0X25vdGVfdXVpZCcpLnZhbCgnJyk7XHJcbiAgICAgICAgJCgnI21vZGFsX2Zvcm1fbm90ZScpLnZhbCgnJyk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNhZGQtbm90ZS1tb2RhbCcsIHsgc3RhY2sgOiB0cnVlIH0pLnNob3coKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGFkZCBub3RlIG1vZGFsIHN1Ym1pdHRlZFxyXG4gICAgJCgnI2Zvcm0tYWRkLW5vdGUnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IGVkaXROb3RlVXVpZCA9ICQoJyNlZGl0X25vdGVfdXVpZCcpLnZhbCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3Qgcm9vbVV1aWQgPSAkKCcjbV9yb29tX2lkJykudmFsKCk7ICAgICAgICBcclxuICAgICAgICBjb25zdCBub3RlID0gJCgnI21vZGFsX2Zvcm1fbm90ZScpLnZhbCgpOyAgICAgICAgXHJcblxyXG4gICAgICAgIC8vIGVkaXRpbmcsIGp1c3QgZGVsZXRlIHRoZSBvbGQgb25lIGFuZCByZWNyZWF0ZSAoZG9lcyBtZWFuIHRoZSBjcmVhdGVkIGRhdGUgd2lsbCBhbHNvIGJlIHVwZGF0ZWQpXHJcbiAgICAgICAgaWYgKGVkaXROb3RlVXVpZCAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGRiLnJlbW92ZU5vdGVCeVVVSUQoZWRpdE5vdGVVdWlkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGF3YWl0IGRiLmFkZE5vdGUocm9vbVV1aWQsIG5vdGUpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tRGF0YShyb29tVXVpZCk7XHJcbiAgICAgICAgYXdhaXQgbG9hZFJvb21Ob3Rlcyhyb29tVXVpZCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNhZGQtbm90ZS1tb2RhbCcpLmhpZGUoKTsgXHJcbiAgICB9KTsgICAgXHJcblxyXG59XHJcbi8qIFxyXG4gICAgLy8gRW5kIHRhYmxlc0Z1bmN0aW9ucyBcclxuKi9cclxuXHJcblxyXG4vKlxyXG4qICAgSG9tZSBwYWdlIGZ1bmN0aW9uc1xyXG4qL1xyXG5jb25zdCBob21lRnVuY3Rpb25zID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc29sZS5sb2coJ1J1bm5pbmcgaG9tZSBmdW5jdGlvbnMgdjInKTtcclxuXHJcbiAgICBsZXQgZGVmZXJyZWRQcm9tcHQ7XHJcbiAgICBjb25zdCBpbnN0YWxsQnV0dG9uID0gJCgnI2luc3RhbGxCdXR0b24nKTtcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JlaW5zdGFsbHByb21wdCcsIChlKSA9PiB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICAgICAgXHJcbiAgICAgICAgLy8gU3Rhc2ggdGhlIGV2ZW50IHNvIGl0IGNhbiBiZSB0cmlnZ2VyZWQgbGF0ZXJcclxuICAgICAgICBkZWZlcnJlZFByb21wdCA9IGU7XHJcbiAgICAgICAgLy8gU2hvdyB0aGUgaW5zdGFsbCBidXR0b25cclxuICAgICAgICBjb25zb2xlLmxvZygnYmVmb3JlaW5zdGFsbHByb21wdCBmaXJlZCcpO1xyXG4gICAgICAgIGluc3RhbGxCdXR0b24uc2hvdygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaW5zdGFsbEJ1dHRvbi5vbignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgaWYgKCFkZWZlcnJlZFByb21wdCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFNob3cgdGhlIGluc3RhbGwgcHJvbXB0XHJcbiAgICAgICAgZGVmZXJyZWRQcm9tcHQucHJvbXB0KCk7XHJcbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIHVzZXIgdG8gcmVzcG9uZCB0byB0aGUgcHJvbXB0XHJcbiAgICAgICAgY29uc3QgeyBvdXRjb21lIH0gPSBhd2FpdCBkZWZlcnJlZFByb21wdC51c2VyQ2hvaWNlO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBVc2VyIHJlc3BvbnNlIHRvIHRoZSBpbnN0YWxsIHByb21wdDogJHtvdXRjb21lfWApO1xyXG4gICAgICAgIC8vIFdlJ3ZlIHVzZWQgdGhlIHByb21wdCwgYW5kIGNhbid0IHVzZSBpdCBhZ2FpbiwgZGlzY2FyZCBpdFxyXG4gICAgICAgIGRlZmVycmVkUHJvbXB0ID0gbnVsbDtcclxuICAgICAgICAvLyBIaWRlIHRoZSBpbnN0YWxsIGJ1dHRvblxyXG4gICAgICAgIGluc3RhbGxCdXR0b24uaGlkZSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2FwcGluc3RhbGxlZCcsIChldnQpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQXBwbGljYXRpb24gaW5zdGFsbGVkJyk7XHJcbiAgICAgICAgaW5zdGFsbEJ1dHRvbi5oaWRlKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvL1VJa2l0Lm9mZmNhbnZhcygnLnRhYmxlcy1zaWRlJykuaGlkZSgpO1xyXG5cclxuXHJcbiAgICB2YXIgZGFzaFRhYmxlID0gcmVuZGVyUHJvamVjdHNUYWJsZSgpO1xyXG4gICAgLy9kYXNoVGFibGUuc2V0RGF0YShkYXRhKTtcclxuXHJcbiAgICAkKCcjYnRuLWNyZWF0ZS1wcm9qZWN0Jykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgJCgnI2Zvcm0tY3JlYXRlLXByb2plY3QnKS50cmlnZ2VyKFwicmVzZXRcIik7ICAgICAgICBcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2NyZWF0ZS1wcm9qZWN0JywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpO1xyXG4gICAgICAgICQoJyNmb3JtX3Byb2plY3RfbmFtZScpLmZvY3VzKCk7XHJcbiAgICB9KTsgICAgXHJcblxyXG4gICAgLyogQWRkIHByb2plY3QgcmVsYXRlZCBiaW5kcyAqL1xyXG4gICAgJCgnI2Zvcm1fcHJvamVjdF9uYW1lJykub2ZmKCdmb2N1cycpLm9uKCdmb2N1cycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAkKCcjZm9ybV9sb2NhdGlvbicpLmF0dHIoeydkaXNhYmxlZCc6J2Rpc2FibGVkJ30pO1xyXG4gICAgICAgICQoJyNmb3JtX2J1aWxkaW5nJykuYXR0cih7J2Rpc2FibGVkJzonZGlzYWJsZWQnfSk7XHJcbiAgICB9KTtcclxuICAgICQoJyNmb3JtX3Byb2plY3RfbmFtZScpLm9mZignYmx1cicpLm9uKCdibHVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLnZhbCgpICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgJCgnI2Zvcm1fbG9jYXRpb24nKS5yZW1vdmVBdHRyKCdkaXNhYmxlZCcpLmZvY3VzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICAkKCcjZm9ybV9sb2NhdGlvbicpLm9mZignYmx1cicpLm9uKCdibHVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLnZhbCgpICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgJCgnI2Zvcm1fYnVpbGRpbmcnKS5yZW1vdmVBdHRyKCdkaXNhYmxlZCcpLmZvY3VzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICAkKCcjZm9ybV9idWlsZGluZycpLm9mZignYmx1cicpLm9uKCdibHVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLnZhbCgpICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgJCgnI2Zvcm1fZmxvb3InKS5yZW1vdmVBdHRyKCdkaXNhYmxlZCcpLmZvY3VzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7ICAgXHJcbiAgICAkKCcjZm9ybV9mbG9vcicpLm9mZignYmx1cicpLm9uKCdibHVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLnZhbCgpICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgJCgnI2Zvcm1fcm9vbScpLnJlbW92ZUF0dHIoJ2Rpc2FibGVkJykuZm9jdXMoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTsgICAgIFxyXG4gICAgXHJcbiAgICAkKCcjZm9ybS1jcmVhdGUtcHJvamVjdCcpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY3JlYXRlUHJvamVjdCgpOyAgICAgICAgICAgICAgXHJcbiAgICB9KTsgICAgICAgIFxyXG5cclxuXHJcbn07XHJcbi8qIFxyXG4gICAgLy8gRU5EIGhvbWVGdW5jdGlvbnMgXHJcbiovXHJcblxyXG5cclxuLypcclxuKiAgIFNjaGVkdWxlIGZ1bmN0aW9uc1xyXG4qL1xyXG5jb25zdCBzY2hlZHVsZUZ1bmN0aW9ucyA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCdSdW5uaW5nIHNjaGVkdWxlIGZ1bmN0aW9ucyB2MicpO1xyXG4gICAgLy9VSWtpdC5vZmZjYW52YXMoJy50YWJsZXMtc2lkZScpLmhpZGUoKTtcclxuXHJcbiAgICBsZXQgcHJvamVjdElkID0gJCgnI21fcHJvamVjdF9pZCcpLnZhbCgpO1xyXG4gICAgaWYgKHByb2plY3RJZCA9PSBcIlwiKSB7XHJcbiAgICAgICAgLy8gZ2V0IGZyb20gbG9jYWwgc3RvcmFnZVxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRQcm9qZWN0ID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudFByb2plY3QnKSB8fCAne30nKTtcclxuICAgICAgICBpZiAoY3VycmVudFByb2plY3QucHJvamVjdF9pZCkge1xyXG4gICAgICAgICAgICBwcm9qZWN0SWQgPSBjdXJyZW50UHJvamVjdC5wcm9qZWN0X2lkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIHByb2plY3QgaWQgZm91bmQnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwZGF0YSA9IGF3YWl0IGRiLmdldFByb2plY3RCeVVVSUQocHJvamVjdElkKTtcclxuXHJcbiAgICAkKCcjbV9wcm9qZWN0X3NsdWcnKS52YWwocGRhdGEuc2x1Zyk7XHJcbiAgICAkKCcjbV9wcm9qZWN0X3ZlcnNpb24nKS52YWwocGRhdGEudmVyc2lvbik7XHJcblxyXG4gICAgJCgnI2luZm9fcHJvamVjdF9uYW1lJykuaHRtbChwZGF0YS5uYW1lKTtcclxuICAgICQoJyNpbmZvX3Byb2plY3RfaWQnKS5odG1sKHBkYXRhLnByb2plY3RfaWQpOyAgICBcclxuICAgICQoJyNpbmZvX2VuZ2luZWVyJykuaHRtbChwZGF0YS5lbmdpbmVlcik7XHJcbiAgICAkKCcjaW5mb19kYXRlJykuaHRtbChuZXcgRGF0ZShwZGF0YS5sYXN0X3VwZGF0ZWQpLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InKSk7XHJcblxyXG4gICAgY29uc3Qgc2RhdGEgPSBhd2FpdCBkYi5nZXRQcm9kdWN0c0ZvclByb2plY3QocHJvamVjdElkKTtcclxuXHJcbiAgICBsZXQgdGFibGVkYXRhID0gc2RhdGEubWFwKHByb2R1Y3QgPT4gKHtcclxuICAgICAgICB1dWlkOiBwcm9kdWN0LnV1aWQsXHJcbiAgICAgICAgcHJvZHVjdF9zbHVnOiBwcm9kdWN0LnByb2R1Y3Rfc2x1ZyxcclxuICAgICAgICBwcm9kdWN0X25hbWU6IHByb2R1Y3QucHJvZHVjdF9uYW1lLCAgICAgICAgICAgICAgICBcclxuICAgICAgICByZWY6IHByb2R1Y3QucmVmLFxyXG4gICAgICAgIHF0eTogcHJvZHVjdC5xdHksXHJcbiAgICAgICAgc2t1OiBwcm9kdWN0LnNrdSAgICAgICAgXHJcbiAgICB9KSk7ICAgICAgIFxyXG5cclxuICAgIHZhciBzVGFibGUgPSBuZXcgVGFidWxhdG9yKFwiI3N0YWJsZVwiLCB7XHJcbiAgICAgICAgZGF0YTogdGFibGVkYXRhLFxyXG4gICAgICAgIGxheW91dDogXCJmaXRDb2x1bW5zXCIsXHJcbiAgICAgICAgbG9hZGVyOiBmYWxzZSxcclxuICAgICAgICBkYXRhTG9hZGVyRXJyb3I6IFwiVGhlcmUgd2FzIGFuIGVycm9yIGxvYWRpbmcgdGhlIGRhdGFcIixcclxuICAgICAgICBkb3dubG9hZEVuY29kZXI6IGZ1bmN0aW9uKGZpbGVDb250ZW50cywgbWltZVR5cGUpe1xyXG4gICAgICAgICAgICBnZW5lcmF0ZURhdGFTaGVldHMoZmlsZUNvbnRlbnRzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbHVtbnM6IFt7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJpZFwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwidXVpZFwiLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUHJvZHVjdFwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwicHJvZHVjdF9uYW1lXCIsXHJcbiAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJsZWZ0XCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJRdHlcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInF0eVwiLCAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGhvekFsaWduOiBcImxlZnRcIixcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiU0tVXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJza3VcIixcclxuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjUwJVwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlJlZlwiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwicmVmXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLCAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG5cclxuICAgICQoJyNnZW5fZGF0YXNoZWV0cywjZ2VuX3NjaGVkdWxlc19jb25maXJtJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgaWYgKCQoJyNpbmNsdWRlX3NjaGVkdWxlJykuaXMoJzpjaGVja2VkJykgPT0gZmFsc2UgJiZcclxuICAgICAgICAgICAgJCgnI2luY2x1ZGVfZGF0YXNoZWV0cycpLmlzKCc6Y2hlY2tlZCcpID09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgICAgICBhbGVydCgnTm90aGluZyB0byBnZW5lcmF0ZSwgcGxlYXNlIHNlbGVjdCBhbiBvcHRpb24nKTtcclxuICAgICAgICAgICAgICAgIHJldHVybihmYWxzZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyB0cmlnZ2VyIHRoZSAgIGRvd25sb2FkLCB3aGljaCBpcyBpbnRlcmNlcHRlZCBhbmQgdHJpZ2dlcnNcclxuICAgICAgICAvLyBnZW5lcmF0ZURhdGFTaGVldHMoKVxyXG4gICAgICAgIHNUYWJsZS5kb3dubG9hZChcImpzb25cIiwgXCJkYXRhLmpzb25cIiwge30sIFwidmlzaWJsZVwiKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAkKCcjZm9ybS1zdWJtaXQtZm9saW8tcHJvZ3Jlc3MnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBwZGF0YS5zbHVnO1xyXG4gICAgICAgIGlmIChwZGF0YS52ZXJzaW9uID4gMSkge1xyXG4gICAgICAgICAgICBmaWxlbmFtZSA9IGZpbGVuYW1lK1wiLXZcIiArIHBkYXRhLnZlcnNpb247XHJcbiAgICAgICAgfSAgICAgICAgXHJcbiAgICAgICAgY29uc3QgYnVzdGVyID0gdXRpbHMubWFrZWlkKDEwKTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgkKCcjZm9saW8tcHJvZ3Jlc3MnKSkuaGlkZSgpO1xyXG4gICAgICAgIHdpbmRvdy5vcGVuKFwiaHR0cHM6Ly9zdGFnaW5nLnRhbWxpdGUuY28udWsvcGRmbWVyZ2UvXCIrZmlsZW5hbWUrXCIucGRmP3Q9XCIrYnVzdGVyLCAnX2JsYW5rJyk7XHJcbiAgICB9KTsgICAgXHJcblxyXG5cclxufVxyXG4vKlxyXG4qIC8vIEVuZCBTY2hlZHVsZSBmdW5jdGlvbnNcclxuKi9cclxuXHJcblxyXG4vKlxyXG4qIEFjY291bnQgUGFnZSBmdW5jdGlvbnNcclxuKi9cclxuY29uc3QgYWNjb3VudEZ1bmN0aW9ucyA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCdSdW5uaW5nIGFjY291bnQgZnVuY3Rpb25zIHYyJyk7XHJcbiAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgZGIuZ2V0VXNlcih1c2VyX2lkKTsgICBcclxuICAgIFxyXG4gICAgaWYgKCF1c2VyKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3IgZ2V0dGluZyB1ZWVyIGRldGFpbHMnKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgJCgnI25hbWUnKS52YWwodXNlci5uYW1lKTtcclxuICAgICQoJyNlbWFpbCcpLnZhbCh1c2VyLmVtYWlsKTtcclxuICAgICQoJyNwYXNzd29yZCcpLnZhbCh1c2VyLnBhc3N3b3JkKTtcclxuICAgICQoJyNjb2RlJykudmFsKHVzZXIuY29kZSk7XHJcblxyXG4gICAgJCgnI2J0bl9wdWxsX3VzZXJfZGF0YScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IHN5bmMuZ2V0VXNlckRhdGEoKTtcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICAvLyBpZiBvZmZsaW5lLCBwcmV2ZW50IHRoaXMgaGFwcGVuaW5nIC0gZGlzYWJsZSB0aGUgYnV0dG9uXHJcbiAgICBpZiAoIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAkKCcjYnRuX3B1c2hfdXNlcl9kYXRhJykucHJvcChcImRpc2FibGVkXCIsIHRydWUpO1xyXG4gICAgfSAgICBcclxuICAgICQoJyNidG5fY2xlYXJfbG9jYWxfc3RvcmFnZScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IHV0aWxzLmNsZWFyU2VydmljZVdvcmtlckNhY2hlKCk7XHJcbiAgICB9KTsgICAgXHJcblxyXG4gICAgLy8gaWYgb2ZmbGluZSwgZGlzYWJsZSB0aGUgbG9nb3V0IGJ1dHRvblxyXG4gICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgJCgnI2J0bl9sb2dvdXQnKS5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XHJcbiAgICB9ICAgIFxyXG4gICAgJCgnI2J0bl9sb2dvdXQnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBhd2FpdCB1dGlscy5sb2dvdXQoKTtcclxuICAgIH0pOyAgICAgIFxyXG5cclxuICAgIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICQoJyNmb3JtLXVwZGF0ZS1hY2NvdW50JykucHJvcChcImRpc2FibGVkXCIsIHRydWUpO1xyXG4gICAgfSBcclxuXHJcbiAgICAkKCcjZm9ybS11cGRhdGUtYWNjb3VudCcpLm9mZignc3VibWl0Jykub24oJ3N1Ym1pdCcsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZygnVXBkYXRlIGFjY291bnQgY2xpY2tlZCcpO1xyXG4gICAgICAgIC8vIGJ1aWxkIHRoZSB1c2VyIG9iamVjdCBmcm9tIHN1Ym1pdHRlZCBmb3JtIGZpZWxkc1xyXG4gICAgICAgIGNvbnN0IGZvcm1kYXRhID0geyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBuYW1lOiAkKCcjbmFtZScpLnZhbCgpLFxyXG4gICAgICAgICAgICBlbWFpbDogJCgnI2VtYWlsJykudmFsKCksXHJcbiAgICAgICAgICAgIHBhc3N3b3JkOiAkKCcjcGFzc3dvcmQnKS52YWwoKSxcclxuICAgICAgICAgICAgY29kZTogJCgnI2NvZGUnKS52YWwoKVxyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgICAgICBjb25zdCB1c2VyX2lkID0gYXdhaXQgdXRpbHMuZ2V0Q29va2llKCd1c2VyX2lkJyk7XHJcbiAgICAgICAgYXdhaXQgZGIudXBkYXRlVXNlcihmb3JtZGF0YSwgdXNlcl9pZCk7XHJcbiAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdBY2NvdW50IHVwZGF0ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICB9KTtcclxuXHJcbn1cclxuLypcclxuKiAvLyBFbmQgYWNjb3VudCBwYWdlIGZ1bmN0aW9uc1xyXG4qL1xyXG5cclxuXHJcblxyXG4vKlxyXG4qIEdlbmVyYXRlIERhdGEgU2hlZXRzIHJlbGF0ZWQgZnVuY3Rpb25zXHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlRGF0YVNoZWV0cyhkYXRhKSB7XHJcbiAgICBVSWtpdC5tb2RhbCgkKCcjZm9saW8tcHJvZ3Jlc3MnKSkuc2hvdygpO1xyXG4gICAgY29uc3Qgc2NoZWR1bGVfdHlwZSA9ICQoJ2lucHV0W25hbWU9c2NoZWR1bGVfdHlwZV06Y2hlY2tlZCcpLnZhbCgpO1xyXG4gICAgY29uc3QgcHJvamVjdF9pZCA9ICQoJ2lucHV0I21fcHJvamVjdF9pZCcpLnZhbCgpIHx8IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JykpLnByb2plY3RfaWQ7XHJcbiAgICBpZiAoc2NoZWR1bGVfdHlwZSA9PSBcImJ5X3Byb2plY3RcIikge1xyXG4gICAgICAgIGpzb25EYXRhID0gZGF0YTsgLy8gdGhlIHNjaGVkdWxlIHRhYmxlIGRhdGEgZm9yIGEgZnVsbCBwcm9qZWN0IHNjaGVkdWxlXHJcbiAgICAgICAgY2FsbEdlblNoZWV0cyhzY2hlZHVsZV90eXBlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdHJ5IHsgICAgICAgICAgICBcclxuICAgICAgICAgICAganNvbkRhdGEgPSBhd2FpdCBkYi5nZXRTY2hlZHVsZVBlclJvb20ocHJvamVjdF9pZCk7IC8vIFdhaXQgZm9yIHRoZSBkYXRhXHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ2pzb25EYXRhJywganNvbkRhdGEpO1xyXG4gICAgICAgICAgICBjYWxsR2VuU2hlZXRzKHNjaGVkdWxlX3R5cGUpOyAvLyBDYWxsIHdpdGggdGhlIHJlc29sdmVkIGRhdGFcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgZmV0Y2hpbmcgc2NoZWR1bGUgcGVyIHJvb206XCIsIGVycm9yKTtcclxuICAgICAgICAgICAgYWxlcnQoXCJGYWlsZWQgdG8gZmV0Y2ggc2NoZWR1bGUgZGF0YS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjYWxsR2VuU2hlZXRzKHNjaGVkdWxlX3R5cGUpIHtcclxuICAgICQoJy51ay1wcm9ncmVzcycpLnZhbCgxMCk7XHJcbiAgICAkKCcjZG93bmxvYWRfZGF0YXNoZWV0cycpLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcclxuICAgICQoJyNwcm9ncmVzcy10ZXh0JykudGV4dChcIkdhdGhlcmluZyBEYXRhIC4uLlwiKTtcclxuXHJcbiAgICAkLmFqYXgoe1xyXG4gICAgICAgIHVybDogXCJodHRwczovL3N0YWdpbmcudGFtbGl0ZS5jby51ay9jaV9pbmRleC5waHAvZG93bmxvYWRfc2NoZWR1bGVcIixcclxuICAgICAgICB0eXBlOiBcIlBPU1RcIixcclxuICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgIHByb2plY3Rfc2x1ZzogJCgnI21fcHJvamVjdF9zbHVnJykudmFsKCksXHJcbiAgICAgICAgICAgIHByb2plY3RfdmVyc2lvbjogJCgnI21fcHJvamVjdF92ZXJzaW9uJykudmFsKCksXHJcbiAgICAgICAgICAgIGluZm9fcHJvamVjdF9uYW1lOiAkKCcjaW5mb19wcm9qZWN0X25hbWUnKS50ZXh0KCksXHJcbiAgICAgICAgICAgIGluZm9fcHJvamVjdF9pZDogJCgnI2luZm9fcHJvamVjdF9pZCcpLnRleHQoKSxcclxuICAgICAgICAgICAgaW5mb19lbmdpbmVlcjogJCgnI2luZm9fZW5naW5lZXInKS50ZXh0KCksXHJcbiAgICAgICAgICAgIGluZm9fZGF0ZTogJCgnI2luZm9fZGF0ZScpLnRleHQoKSxcclxuICAgICAgICAgICAgaW5jbHVkZV9zY2hlZHVsZTogJCgnI2luY2x1ZGVfc2NoZWR1bGUnKS5pcygnOmNoZWNrZWQnKSxcclxuICAgICAgICAgICAgaW5jbHVkZV9kYXRhc2hlZXRzOiAkKCcjaW5jbHVkZV9kYXRhc2hlZXRzJykuaXMoJzpjaGVja2VkJyksXHJcbiAgICAgICAgICAgIHNjaGVkdWxlX3R5cGU6IHNjaGVkdWxlX3R5cGUsXHJcbiAgICAgICAgICAgIHNrdXM6IGpzb25EYXRhLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgeGhyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyB3aW5kb3cuWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgICAgICAgICAgbGV0IGxhc3RQcm9jZXNzZWRJbmRleCA9IDA7XHJcbiAgICAgICAgICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VUZXh0ID0geGhyLnJlc3BvbnNlVGV4dC50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IHJlc3BvbnNlVGV4dC5zcGxpdCgnXFxuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IGxhc3RQcm9jZXNzZWRJbmRleDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldLnRyaW0oKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhsaW5lKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWxpbmUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZSA9IEpTT04ucGFyc2UobGluZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cGRhdGUuc3RlcCAmJiB1cGRhdGUudG90YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBlcmNlbnRhZ2UgPSAodXBkYXRlLnN0ZXAgLyAodXBkYXRlLnRvdGFsIC0gMSkpICogMTAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI3Byb2dyZXNzLXRleHQnKS50ZXh0KHVwZGF0ZS5tZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJy51ay1wcm9ncmVzcycpLnZhbChwZXJjZW50YWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlLmNvbXBsZXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnUHJvY2Vzc2luZyBjb21wbGV0ZTonLCB1cGRhdGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnLnVrLXByb2dyZXNzJykudmFsKDEwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjcHJvZ3Jlc3MtdGV4dCcpLnRleHQodXBkYXRlLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI2Rvd25sb2FkX2RhdGFzaGVldHMnKS5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJTa2lwcGluZyBpbnZhbGlkIEpTT04gbGluZTpcIiwgbGluZSwgZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGFzdFByb2Nlc3NlZEluZGV4ID0gbGluZXMubGVuZ3RoO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICByZXR1cm4geGhyO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3VjY2VzczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uICh4aHIsIHN0YXR1cywgZXJyb3IpIHtcclxuICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gXCJ0aW1lb3V0XCIpIHtcclxuICAgICAgICAgICAgICAgIGFsZXJ0KFwiVGhlIHJlcXVlc3QgdGltZWQgb3V0LiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLlwiKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIHRvZG86IHRoaXMgaXMgYWN0dWFsbHkgZmlyaW5nIGJ1dCBhbGwgd29ya3Mgb2ssIGRlYnVnXHJcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUuZXJyb3IoXCJBbiBlcnJvciBvY2N1cnJlZDpcIiwgc3RhdHVzLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHRpbWVvdXQ6IDMxMDAwMCwgLy8gMzEwIHNlY29uZHMgKDUgbWludXRlcyArIGJ1ZmZlcilcclxuICAgIH0pO1xyXG59XHJcbi8qXHJcbiogLy8gZW5kIEdlbmVyYXRlIERhdGEgU2hlZXRzXHJcbiovXHJcblxyXG5cclxuXHJcbi8qXHJcbiogR2V0IGFsbCBwcm9qZWN0cyAoZm9yIHRoaXMgdXNlcikgYW5kIHJlbmRlciB0aGUgdGFibGVcclxuKi9cclxuYXN5bmMgZnVuY3Rpb24gcmVuZGVyUHJvamVjdHNUYWJsZSgpIHtcclxuXHJcbiAgICBjb25zdCBwcm9qZWN0cyA9IGF3YWl0IGRiLmdldFByb2plY3RzKGF3YWl0IHV0aWxzLmdldENvb2tpZSgndXNlcl9pZCcpKTtcclxuICAgIGxldCB0YWJsZWRhdGEgPSBwcm9qZWN0cy5tYXAocHJvamVjdCA9PiAoe1xyXG4gICAgICAgIHByb2plY3RfbmFtZTogcHJvamVjdC5uYW1lLFxyXG4gICAgICAgIHByb2plY3Rfc2x1ZzogcHJvamVjdC5zbHVnLFxyXG4gICAgICAgIHZlcnNpb246IHByb2plY3QudmVyc2lvbixcclxuICAgICAgICBwcm9qZWN0X2lkOiBwcm9qZWN0LnV1aWQsXHJcbiAgICAgICAgcHJvamVjdF9yZWY6IHByb2plY3QucHJvamVjdF9pZCxcclxuICAgICAgICBjcmVhdGVkOiBuZXcgRGF0ZShwcm9qZWN0LmNyZWF0ZWRfb24pLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InKSxcclxuICAgICAgICBwcm9kdWN0czogcHJvamVjdC5wcm9kdWN0c19jb3VudFxyXG4gICAgfSkpOyAgICAgXHJcblxyXG4gICAgdmFyIGRhc2hUYWJsZSA9IG5ldyBUYWJ1bGF0b3IoXCIjZGFzaGJvYXJkX3Byb2plY3RzXCIsIHtcclxuICAgICAgICBkYXRhOiB0YWJsZWRhdGEsICAgICAgICAgICAgXHJcbiAgICAgICAgbG9hZGVyOiBmYWxzZSxcclxuICAgICAgICBsYXlvdXQ6IFwiZml0Q29sdW1uc1wiLFxyXG4gICAgICAgIGRhdGFMb2FkZXJFcnJvcjogXCJUaGVyZSB3YXMgYW4gZXJyb3IgbG9hZGluZyB0aGUgZGF0YVwiLFxyXG4gICAgICAgIGluaXRpYWxTb3J0OltcclxuICAgICAgICAgICAge2NvbHVtbjpcInByb2plY3RfbmFtZVwiLCBkaXI6XCJhc2NcIn0sIFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29sdW1uczogW3tcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcInByb2plY3RfaWRcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3RfaWRcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IGZhbHNlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcInByb2plY3Rfc2x1Z1wiLFxyXG4gICAgICAgICAgICAgICAgZmllbGQ6IFwicHJvamVjdF9zbHVnXCIsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJQcm9qZWN0IE5hbWVcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3RfbmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgZm9ybWF0dGVyOiBcImxpbmtcIixcclxuICAgICAgICAgICAgICAgIHNvcnRlcjpcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGhlYWRlclNvcnRTdGFydGluZ0RpcjpcImRlc2NcIixcclxuICAgICAgICAgICAgICAgIGZvcm1hdHRlclBhcmFtczp7XHJcbiAgICAgICAgICAgICAgICAgICAgbGFiZWxGaWVsZDogXCJwcm9qZWN0X25hbWVcIixcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IFwiX3NlbGZcIixcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IFwiI1wiLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjQwJVwiLFxyXG4gICAgICAgICAgICAgICAgY2VsbENsaWNrOiBmdW5jdGlvbihlLCBjZWxsKSB7ICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0RGF0YSA9IGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpOyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRQcm9qZWN0JywgSlNPTi5zdHJpbmdpZnkocHJvamVjdERhdGEpKTtcclxuICAgICAgICAgICAgICAgICAgICAkKCcjbV9wcm9qZWN0X2lkJykudmFsKHByb2plY3REYXRhLnByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5yb3V0ZXIoJ3RhYmxlcycsIHByb2plY3REYXRhLnByb2plY3RfaWQpOyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlByb2plY3QgSURcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2plY3RfcmVmXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogXCIyMCVcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUHJvZHVjdHNcIixcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBcInByb2R1Y3RzXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogMTIwLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogZmFsc2VcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUmV2XCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJ2ZXJzaW9uXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogODAsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJDcmVhdGVkXCIsXHJcbiAgICAgICAgICAgICAgICBmaWVsZDogXCJjcmVhdGVkXCIsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogXCIyMCVcIixcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaGVhZGVyU29ydDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZXI6IHV0aWxzLmljb25Db3B5LFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMTAlXCIsXHJcbiAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJjZW50ZXJcIixcclxuICAgICAgICAgICAgICAgIGNlbGxDbGljazogZnVuY3Rpb24gKGUsIGNlbGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb3B5UHJvamVjdChjZWxsLmdldFJvdygpLmdldERhdGEoKS5wcm9qZWN0X2lkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeyAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaGVhZGVyU29ydDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZXI6IHV0aWxzLmljb25YLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMTAlXCIsXHJcbiAgICAgICAgICAgICAgICBob3pBbGlnbjogXCJjZW50ZXJcIixcclxuICAgICAgICAgICAgICAgIGNlbGxDbGljazogZnVuY3Rpb24gKGUsIGNlbGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGVQcm9qZWN0KGNlbGwuZ2V0Um93KCkuZ2V0RGF0YSgpLnByb2plY3RfaWQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICB9KTsgICAgXHJcbn1cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuLy8gXHJcbi8vIHJlbmRlclNpZGViYXJcclxuLy8gXHJcbmFzeW5jIGZ1bmN0aW9uIHJlbmRlclNpZGViYXIocHJvamVjdF9pZCkge1xyXG4gICAgcHJvamVjdF9pZC50b1N0cmluZygpO1xyXG4gICAgY29uc29sZS5sb2coJ1JlbmRlcmluZyBzaWRlYmFyIGZvciBwcm9qZWN0OicsIHByb2plY3RfaWQpO1xyXG5cclxuICAgIGNvbnN0IHByb2plY3RTdHJ1Y3R1cmUgPSBhd2FpdCBkYi5nZXRQcm9qZWN0U3RydWN0dXJlKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICAgICBcclxuICAgIGNvbnN0IHNpZGVtZW51SHRtbCA9IGF3YWl0IHNpZGViYXIuZ2VuZXJhdGVOYXZNZW51KHByb2plY3RTdHJ1Y3R1cmUpOyAgIFxyXG5cclxuICAgICQoJy5sb2NhdGlvbnMnKS5odG1sKHNpZGVtZW51SHRtbCk7XHJcblxyXG4gICAgLyogUHJvamVjdCBDbGljayAtIGxvYWQgcHJvamVjdCBkYXRhICovXHJcbiAgICAkKCdhLmVkaXQtcHJvamVjdC1saW5rJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYXdhaXQgbG9hZFByb2plY3REYXRhKHByb2plY3RfaWQpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuXHJcblxyXG4gICAgLyogUm9vbSBDbGljayAtIGxvYWQgcm9vbSBkYXRhICovXHJcbiAgICAkKCdhLnJvb20tbGluaycpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tRGF0YSgkKHRoaXMpLmRhdGEoJ2lkJykpO1xyXG4gICAgICAgIGF3YWl0IGxvYWRSb29tTm90ZXMoJCh0aGlzKS5kYXRhKCdpZCcpKTtcclxuICAgICAgICBhd2FpdCBsb2FkUm9vbUltYWdlcygkKHRoaXMpLmRhdGEoJ2lkJykpO1xyXG4gICAgfSk7ICAgIFxyXG5cclxuICAgIC8qIEFkZCBSb29tIENsaWNrIC0gYWRkIGEgbmV3IHJvb20gKi9cclxuICAgICQoJ3NwYW4uYWRkLXJvb20gYScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IGZsb29yVXVpZCA9ICQodGhpcykuZGF0YSgnaWQnKTsgICBcclxuICAgICAgICBjb25zdCByb29tTmFtZSA9IGF3YWl0IFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0PkVudGVyIHRoZSByb29tIG5hbWU8L2g0PicpO1xyXG4gICAgICAgIGlmIChyb29tTmFtZSkge1xyXG4gICAgICAgICAgICBjb25zdCByb29tVXVpZCA9IGF3YWl0IGRiLmFkZFJvb20oZmxvb3JVdWlkLCByb29tTmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChyb29tVXVpZCkge1xyXG4gICAgICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdSb29tIGFkZGVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oe21lc3NhZ2U6ICdBIHJvb20gb2YgdGhlIHNhbWUgbmFtZSBhbHJlYWR5IGV4aXN0cy4nLCBzdGF0dXM6ICdkYW5nZXInLCBwb3M6ICdib3R0b20tY2VudGVyJywgdGltZW91dDogMjUwMCB9KTsgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLyogQWRkIEZMb29yIENsaWNrIC0gYWRkIGEgbmV3IGZsb29yICovXHJcbiAgICAkKCdzcGFuLmFkZC1mbG9vciBhJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdVdWlkID0gJCh0aGlzKS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgIGNvbnN0IGZsb29yTmFtZSA9IGF3YWl0IFVJa2l0Lm1vZGFsLnByb21wdCgnPGg0PkVudGVyIHRoZSBmbG9vciBuYW1lPC9oND4nKTtcclxuICAgICAgICBpZiAoZmxvb3JOYW1lKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZsb29yVXVpZCA9IGF3YWl0IGRiLmFkZEZsb29yKGJ1aWxkaW5nVXVpZCwgZmxvb3JOYW1lKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdGbG9vciBhZGRlZCcsIHtzdGF0dXM6J3N1Y2Nlc3MnLHBvczogJ2JvdHRvbS1jZW50ZXInLHRpbWVvdXQ6IDE1MDB9KTtcclxuICAgICAgICAgICAgYXdhaXQgcmVuZGVyU2lkZWJhcihwcm9qZWN0X2lkKTsgXHJcbiAgICAgICAgfSAgIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLyogQWRkIGJ1aWxkaW5nIENsaWNrIC0gYWRkIGEgbmV3IGJ1aWxkaW5nICovXHJcbiAgICAkKCdzcGFuLmFkZC1idWlsZGluZyBhJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICBcclxuICAgICAgICBjb25zdCBsb2NhdGlvblV1aWQgPSAkKHRoaXMpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgY29uc3QgYnVpbGRpbmdOYW1lID0gYXdhaXQgVUlraXQubW9kYWwucHJvbXB0KCc8aDQ+RW50ZXIgdGhlIGJ1aWxkaW5nIG5hbWU8L2g0PicpO1xyXG4gICAgICAgIGlmIChidWlsZGluZ05hbWUpIHtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRpbmdVdWlkID0gYXdhaXQgZGIuYWRkQnVpbGRpbmcobG9jYXRpb25VdWlkLCBidWlsZGluZ05hbWUpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignYnVpbGRpbmcgYWRkZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgICAgIH0gICBcclxuICAgIH0pOyAgICAgXHJcbiAgICBcclxuICAgICQoJ2xpLnJvb20taXRlbSBzcGFuLmFjdGlvbi1pY29uLnJvb20nKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgYXN5bmMgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgICAgICAgICAgICBcclxuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcclxuICAgICAgICBjb25zdCBtc2cgPSAnPGg0IGNsYXNzPVwicmVkXCI+V2FybmluZzwvaDQ+PHA+VGhpcyB3aWxsIHJlbW92ZSB0aGUgcm9vbSBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aGUgcm9vbSE8L3AnO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbVV1aWQgPSAkKHRoYXQpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZW1vdmluZyByb29tOicsIHJvb21VdWlkKTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vbU5hbWUgPSBhd2FpdCBkYi5yZW1vdmVSb29tKHJvb21VdWlkKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmVtb3ZlZCByb29tOicsIHJvb21OYW1lKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdSb29tIHJlbW92ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IC8vIHByb2plY3RfaWQgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NhbmNlbGxlZC4nKVxyXG4gICAgICAgIH0pOyAgICAgICAgXHJcbiAgICB9KTsgICBcclxuICAgIFxyXG4gICAgJCgnbGkuZmxvb3ItaXRlbSBzcGFuLmFjdGlvbi1pY29uLmZsb29yJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgY29uc3QgbXNnID0gJzxoNCBjbGFzcz1cInJlZFwiPldhcm5pbmc8L2g0PjxwPlRoaXMgd2lsbCByZW1vdmUgdGhlIGZsb29yLCByb29tcyBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aG9zZSByb29tcyE8L3AnO1xyXG4gICAgICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgY29uc3QgZmxvb3JVdWlkID0gJCh0aGF0KS5kYXRhKCdpZCcpOyAgIFxyXG4gICAgICAgICAgICBjb25zdCBmbG9vck5hbWUgPSBhd2FpdCBkYi5yZW1vdmVGbG9vcihmbG9vclV1aWQpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignRmxvb3IgYW5kIHJvb21zIHJlbW92ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IC8vIHByb2plY3RfaWQgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NhbmNlbGxlZC4nKVxyXG4gICAgICAgIH0pOyAgICAgICAgXHJcbiAgICB9KTsgICAgICAgICAgXHJcblxyXG4gICAgJCgnbGkuYnVpbGRpbmctaXRlbSBzcGFuLmFjdGlvbi1pY29uLmJ1aWxkaW5nJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgY29uc3QgbXNnID0gJzxoNCBjbGFzcz1cInJlZFwiPldhcm5pbmc8L2g0PjxwPlRoaXMgd2lsbCByZW1vdmUgdGhlIGJ1aWxkaW5nLCBhbGwgZmxvb3IsIHJvb21zIGFuZCA8Yj5BTEwgcHJvZHVjdHM8L2I+IGluIHRob3NlIHJvb21zITwvcCc7XHJcbiAgICAgICAgVUlraXQubW9kYWwuY29uZmlybShtc2cpLnRoZW4oIGFzeW5jIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZGluZ1V1aWQgPSAkKHRoYXQpLmRhdGEoJ2lkJyk7ICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkaW5nTmFtZSA9IGF3YWl0IGRiLnJlbW92ZUJ1aWxkaW5nKGJ1aWxkaW5nVXVpZCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdidWlsZGluZywgZmxvb3JzIGFuZCByb29tcyByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpOyAvLyBwcm9qZWN0X2lkICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW5jZWxsZWQuJylcclxuICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgfSk7ICBcclxuICAgICAgXHJcblxyXG4gICAgLy8gdXBkYXRlIHByb2plY3QgZGV0YWlsc1xyXG4gICAgJCgnI2Zvcm0tdXBkYXRlLXByb2plY3QnKS5vZmYoJ3N1Ym1pdCcpLm9uKCdzdWJtaXQnLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9pZCA9ICQoJyNtX3Byb2plY3RfaWQnKS52YWwoKTtcclxuICAgICAgICBhd2FpdCB0YWJsZXMudXBkYXRlUHJvamVjdENsaWNrKHByb2plY3RfaWQpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7XHJcbiAgICAgICAgVUlraXQubW9kYWwoJyNlZGl0LXByb2plY3QtbW9kYWwnKS5oaWRlKCk7IFxyXG4gICAgfSk7ICAgICBcclxuXHJcbn1cclxuLy8gXHJcbi8vIEVuZCByZW5kZXJTaWRlYmFyXHJcbi8vIFxyXG5cclxuXHJcbi8qIFxyXG4qIENyZWF0ZSBQcm9qZWN0XHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVByb2plY3QoKSB7XHJcbiAgICBjb25zdCBwcm9qZWN0X25hbWUgPSAkKCcjZm9ybV9wcm9qZWN0X25hbWUnKS52YWwoKTtcclxuICAgIGNvbnN0IGxvY2F0aW9uID0gJCgnI2Zvcm1fbG9jYXRpb24nKS52YWwoKTtcclxuICAgIGNvbnN0IGJ1aWxkaW5nID0gJCgnI2Zvcm1fYnVpbGRpbmcnKS52YWwoKTtcclxuICAgIGNvbnN0IGZsb29yID0gJCgnI2Zvcm1fZmxvb3InKS52YWwoKTtcclxuICAgIGNvbnN0IHJvb20gPSAkKCcjZm9ybV9yb29tJykudmFsKCk7XHJcbiAgICBjb25zdCBwcm9qZWN0X2lkID0gYXdhaXQgZGIuY3JlYXRlUHJvamVjdChwcm9qZWN0X25hbWUsIGxvY2F0aW9uLCBidWlsZGluZywgZmxvb3IsIHJvb20pOyAgICBcclxuICAgIGF3YWl0IHJlbmRlclNpZGViYXIocHJvamVjdF9pZCk7IFxyXG4gICAgYXdhaXQgcmVuZGVyUHJvamVjdHNUYWJsZSgpO1xyXG4gICAgVUlraXQubW9kYWwoJyNjcmVhdGUtcHJvamVjdCcpLmhpZGUoKTtcclxufVxyXG5cclxuLyogXHJcbiogQ29weSBQcm9qZWN0XHJcbiovXHJcbmFzeW5jIGZ1bmN0aW9uIGNvcHlQcm9qZWN0KHByb2plY3RfaWQpIHtcclxuICAgIGNvbnN0IHByb2plY3REYXRhID0gYXdhaXQgZGIuZ2V0UHJvamVjdEJ5VVVJRChwcm9qZWN0X2lkKTtcclxuICAgIGNvbnN0IHByb2plY3ROYW1lID0gYXdhaXQgVUlraXQubW9kYWwucHJvbXB0KCc8aDQ+RW50ZXIgdGhlIG5ldyBwcm9qZWN0IG5hbWU8L2g0PicsIHByb2plY3REYXRhLm5hbWUgKyAnIC0gQ29weScpO1xyXG4gICAgaWYgKHByb2plY3ROYW1lKSB7XHJcbiAgICAgICAgY29uc3QgbmV3UHJvamVjdElkID0gYXdhaXQgZGIuY29weVByb2plY3QocHJvamVjdF9pZCwgcHJvamVjdE5hbWUpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclByb2plY3RzVGFibGUoKTtcclxuICAgICAgICBVSWtpdC5ub3RpZmljYXRpb24oJ1Byb2plY3QgY29waWVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBkZWxldGVQcm9qZWN0KHByb2plY3RfaWQpIHtcclxuICAgIGNvbnN0IG1zZyA9ICc8aDQgY2xhc3M9XCJyZWRcIj5XYXJuaW5nPC9oND48cD5UaGlzIHdpbGwgcmVtb3ZlIHRoZSBwcm9qZWN0LCBhbGwgZmxvb3JzLCByb29tcyBhbmQgPGI+QUxMIHByb2R1Y3RzPC9iPiBpbiB0aG9zZSByb29tcyE8L3A+JztcclxuICAgIFVJa2l0Lm1vZGFsLmNvbmZpcm0obXNnKS50aGVuKCBhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICBhd2FpdCBkYi5yZW1vdmVQcm9qZWN0KHByb2plY3RfaWQpO1xyXG4gICAgICAgIGF3YWl0IHJlbmRlclByb2plY3RzVGFibGUoKTtcclxuICAgICAgICBhd2FpdCByZW5kZXJTaWRlYmFyKHByb2plY3RfaWQpO1xyXG4gICAgICAgIFVJa2l0Lm5vdGlmaWNhdGlvbignUHJvamVjdCByZW1vdmVkJywge3N0YXR1czonc3VjY2VzcycscG9zOiAnYm90dG9tLWNlbnRlcicsdGltZW91dDogMTUwMH0pO1xyXG4gICAgfSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDYW5jZWxsZWQuJylcclxuICAgIH0pOyAgICAgICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRQcm9qZWN0RGF0YShwcm9qZWN0SWQpIHsgICAgXHJcbiAgICAkKCcjbV9wcm9qZWN0X2lkJykudmFsKHByb2plY3RJZCk7XHJcbiAgICBpZiAoIXByb2plY3RJZCkgcmV0dXJuO1xyXG4gICAgcHJvamVjdElkID0gcHJvamVjdElkLnRvU3RyaW5nKCk7XHJcbiAgICBjb25zdCBwcm9qZWN0RGF0YSA9IGF3YWl0IGRiLmdldFByb2plY3RCeVVVSUQocHJvamVjdElkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50UHJvamVjdCcsIEpTT04uc3RyaW5naWZ5KHByb2plY3REYXRhKSk7XHJcblxyXG4gICAgJCgnI2Zvcm1fZWRpdF9wcm9qZWN0X25hbWUnKS52YWwocHJvamVjdERhdGEubmFtZSk7XHJcbiAgICAkKCcjZm9ybV9lZGl0X3Byb2plY3RfaWQnKS52YWwocHJvamVjdERhdGEucHJvamVjdF9pZCk7XHJcbiAgICAkKCcjZm9ybV9lZGl0X3Byb2plY3RfZW5naW5lZXInKS52YWwocHJvamVjdERhdGEuZW5naW5lZXIpOyAgICBcclxuICAgICQoJyNmb3JtX2VkaXRfcHJvamVjdF92ZXJzaW9uJykudmFsKHByb2plY3REYXRhLnZlcnNpb24pO1xyXG5cclxuICAgIFVJa2l0Lm1vZGFsKCcjZWRpdC1wcm9qZWN0LW1vZGFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpO1xyXG59ICAgIFxyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRSb29tRGF0YShyb29tSWQpIHtcclxuICAgICQoJyNtX3Jvb21faWQnKS52YWwocm9vbUlkKTsgICBcclxuICAgIGlmICghcm9vbUlkKSByZXR1cm47ICAgICBcclxuICAgIHJvb21JZCA9IHJvb21JZC50b1N0cmluZygpO1xyXG4gICAgcm9vbUlkID0gXCJcIiArIHJvb21JZDtcclxuICAgIC8vIGdldCB0aGUgbmFtZXMgZm9yIHRoZSBsb2NhdGlvbiwgYnVpbGRpbmcsIGZsb29yIGFuZCByb29tIGJhc2VkIG9uIHRoaXMgcm9vbUlkLlxyXG4gICAgY29uc3Qgcm9vbU1ldGEgPSBhd2FpdCBkYi5nZXRSb29tTWV0YShyb29tSWQpOyAgICAgICAgXHJcbiAgICAkKCcubmFtZS5sb2NhdGlvbl9uYW1lJykuaHRtbChyb29tTWV0YS5sb2NhdGlvbi5uYW1lKS5hdHRyKCdkYXRhLWlkJywgcm9vbU1ldGEubG9jYXRpb24udXVpZCk7XHJcbiAgICAkKCcubmFtZS5idWlsZGluZ19uYW1lJykuaHRtbChyb29tTWV0YS5idWlsZGluZy5uYW1lKS5hdHRyKCdkYXRhLWlkJywgcm9vbU1ldGEuYnVpbGRpbmcudXVpZCk7XHJcbiAgICAkKCcubmFtZS5mbG9vcl9uYW1lJykuaHRtbChyb29tTWV0YS5mbG9vci5uYW1lKS5hdHRyKCdkYXRhLWlkJywgcm9vbU1ldGEuZmxvb3IudXVpZCk7XHJcbiAgICAkKCcubmFtZS5yb29tX25hbWUnKS5odG1sKHJvb21NZXRhLnJvb20ubmFtZSkuYXR0cignZGF0YS1pZCcsIHJvb21NZXRhLnJvb20udXVpZCk7XHJcblxyXG4gICAgJCgnI3Jvb21faGVpZ2h0JykudmFsKHJvb21NZXRhLnJvb20uaGVpZ2h0KTtcclxuICAgICQoJyNyb29tX3dpZHRoJykudmFsKHJvb21NZXRhLnJvb20ud2lkdGgpO1xyXG4gICAgJCgnI3Jvb21fbGVuZ3RoJykudmFsKHJvb21NZXRhLnJvb20ubGVuZ3RoKTtcclxuXHJcbiAgICBhd2FpdCB0YWJsZXMucmVmcmVzaFRhYmxlRGF0YShyb29tSWQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2FkUm9vbU5vdGVzKHJvb21JZCkge1xyXG4gICAgJCgnI21fcm9vbV9pZCcpLnZhbChyb29tSWQpOyAgIFxyXG4gICAgaWYgKCFyb29tSWQpIHJldHVybjsgICAgICAgICBcclxuICAgIHJvb21JZCA9IFwiXCIgKyByb29tSWQ7XHJcbiAgICBcclxuICAgIGNvbnN0IHJvb21Ob3RlcyA9IGF3YWl0IGRiLmdldFJvb21Ob3Rlcyhyb29tSWQpOyAgXHJcbiAgICAvLyBpdGVyYXRlIHRoZSBub3RlcyBhbmQgYnVpbGQgaHRtbCB0byBkaXNwbGF5IHRoZW0gYXMgYSBsaXN0LiBhbHNvIGFkZCBhIGRlbGV0ZSBpY29uIHRvIGVhY2ggbm90ZSBhbmQgc2hvdCB0aGUgZGF0ZSBjcmVhdGVkIGluIGRkLW1tLXl5eSBmb3JtYXRcclxuICAgIGxldCBub3Rlc0h0bWwgPSByb29tTm90ZXMubWFwKG5vdGUgPT4gXHJcbiAgICAgICAgYDxsaSBjbGFzcz1cIm5vdGVcIj5cclxuICAgICAgICA8cCBjbGFzcz1cIm5vdGUtZGF0ZVwiPiR7bmV3IERhdGUobm90ZS5jcmVhdGVkX29uKS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJyl9PC9wPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJub3RlLWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgPHNwYW4gZGF0YS11dWlkPVwiJHtub3RlLnV1aWR9XCIgY2xhc3M9XCJpY29uIGVkaXRfbm90ZVwiIHVrLWljb249XCJpY29uOiBmaWxlLWVkaXQ7IHJhdGlvOiAxXCIgdGl0bGU9XCJFZGl0XCI+PC9zcGFuPiAgICBcclxuICAgICAgICAgICAgPHNwYW4gZGF0YS11dWlkPVwiJHtub3RlLnV1aWR9XCIgY2xhc3M9XCJpY29uIHJlZCBkZWxldGVfbm90ZVwiIHVrLWljb249XCJpY29uOiB0cmFzaDsgcmF0aW86IDFcIiB0aXRsZT1cIkRlbGV0ZVwiPjwvc3Bhbj4gICAgICAgICAgICBcclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPHAgY2xhc3M9XCJub3RlLXRleHQgJHtub3RlLnV1aWR9XCI+JHtub3RlLm5vdGV9PC9wPlxyXG4gICAgICAgIDwvbGk+YCkuam9pbignJyk7XHJcbiAgICAkKCcjcm9vbV9ub3RlcycpLmh0bWwobm90ZXNIdG1sKTtcclxuXHJcblxyXG4gICAgJCgnLm5vdGUtYWN0aW9ucyAuZWRpdF9ub3RlJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGFzeW5jIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgY29uc3Qgbm90ZVV1aWQgPSAkKHRoaXMpLmRhdGEoJ3V1aWQnKTtcclxuICAgICAgICBjb25zdCBub3RlVGV4dCA9ICQoYC5ub3RlLXRleHQuJHtub3RlVXVpZH1gKS50ZXh0KCk7XHJcbiAgICAgICAgJCgnI2VkaXRfbm90ZV91dWlkJykudmFsKG5vdGVVdWlkKTtcclxuICAgICAgICAkKCcjbW9kYWxfZm9ybV9ub3RlJykudmFsKG5vdGVUZXh0KTtcclxuICAgICAgICBVSWtpdC5tb2RhbCgnI2FkZC1ub3RlLW1vZGFsJywgeyBzdGFjayA6IHRydWUgfSkuc2hvdygpOyAgICAgICBcclxuICAgIH0pOyAgICAgIFxyXG5cclxuXHJcbiAgICAkKCcubm90ZS1hY3Rpb25zIC5kZWxldGVfbm90ZScpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGNvbnN0IG5vdGVVdWlkID0gJCh0aGlzKS5kYXRhKCd1dWlkJyk7XHJcbiAgICAgICAgVUlraXQubW9kYWwuY29uZmlybSgnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSB0aGlzIG5vdGU/JykudGhlbihhc3luYyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgYXdhaXQgZGIucmVtb3ZlTm90ZUJ5VVVJRChub3RlVXVpZCk7XHJcbiAgICAgICAgICAgIGF3YWl0IGxvYWRSb29tTm90ZXMoJCgnI21fcm9vbV9pZCcpLnZhbCgpKTtcclxuICAgICAgICAgICAgVUlraXQubm90aWZpY2F0aW9uKCdOb3RlIERlbGV0ZWQnLCB7c3RhdHVzOidzdWNjZXNzJyxwb3M6ICdib3R0b20tY2VudGVyJyx0aW1lb3V0OiAxNTAwfSk7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRGVsZXRlIG5vdGUgY2FuY2VsbGVkLicpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7ICAgIFxyXG4gICAgXHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRSb29tSW1hZ2VzKHJvb21JZCkge1xyXG4gICAgJCgnI21fcm9vbV9pZCcpLnZhbChyb29tSWQpOyAgIFxyXG4gICAgaWYgKCFyb29tSWQpIHJldHVybjsgICAgICAgICBcclxuICAgIHJvb21JZCA9IFwiXCIgKyByb29tSWQ7XHJcblxyXG4gICAgYXdhaXQgdGFibGVzLmdldFJvb21JbWFnZXMoKTtcclxuICAgXHJcbn1cclxuXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBnbG9iYWxCaW5kcyxcclxuICAgIGhvbWVGdW5jdGlvbnMsXHJcbiAgICB0YWJsZXNGdW5jdGlvbnMsXHJcbiAgICBzY2hlZHVsZUZ1bmN0aW9ucyxcclxuICAgIGFjY291bnRGdW5jdGlvbnMgXHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgaW5zdGFuY2VPZkFueSA9IChvYmplY3QsIGNvbnN0cnVjdG9ycykgPT4gY29uc3RydWN0b3JzLnNvbWUoKGMpID0+IG9iamVjdCBpbnN0YW5jZW9mIGMpO1xuXG5sZXQgaWRiUHJveHlhYmxlVHlwZXM7XG5sZXQgY3Vyc29yQWR2YW5jZU1ldGhvZHM7XG4vLyBUaGlzIGlzIGEgZnVuY3Rpb24gdG8gcHJldmVudCBpdCB0aHJvd2luZyB1cCBpbiBub2RlIGVudmlyb25tZW50cy5cbmZ1bmN0aW9uIGdldElkYlByb3h5YWJsZVR5cGVzKCkge1xuICAgIHJldHVybiAoaWRiUHJveHlhYmxlVHlwZXMgfHxcbiAgICAgICAgKGlkYlByb3h5YWJsZVR5cGVzID0gW1xuICAgICAgICAgICAgSURCRGF0YWJhc2UsXG4gICAgICAgICAgICBJREJPYmplY3RTdG9yZSxcbiAgICAgICAgICAgIElEQkluZGV4LFxuICAgICAgICAgICAgSURCQ3Vyc29yLFxuICAgICAgICAgICAgSURCVHJhbnNhY3Rpb24sXG4gICAgICAgIF0pKTtcbn1cbi8vIFRoaXMgaXMgYSBmdW5jdGlvbiB0byBwcmV2ZW50IGl0IHRocm93aW5nIHVwIGluIG5vZGUgZW52aXJvbm1lbnRzLlxuZnVuY3Rpb24gZ2V0Q3Vyc29yQWR2YW5jZU1ldGhvZHMoKSB7XG4gICAgcmV0dXJuIChjdXJzb3JBZHZhbmNlTWV0aG9kcyB8fFxuICAgICAgICAoY3Vyc29yQWR2YW5jZU1ldGhvZHMgPSBbXG4gICAgICAgICAgICBJREJDdXJzb3IucHJvdG90eXBlLmFkdmFuY2UsXG4gICAgICAgICAgICBJREJDdXJzb3IucHJvdG90eXBlLmNvbnRpbnVlLFxuICAgICAgICAgICAgSURCQ3Vyc29yLnByb3RvdHlwZS5jb250aW51ZVByaW1hcnlLZXksXG4gICAgICAgIF0pKTtcbn1cbmNvbnN0IHRyYW5zYWN0aW9uRG9uZU1hcCA9IG5ldyBXZWFrTWFwKCk7XG5jb25zdCB0cmFuc2Zvcm1DYWNoZSA9IG5ldyBXZWFrTWFwKCk7XG5jb25zdCByZXZlcnNlVHJhbnNmb3JtQ2FjaGUgPSBuZXcgV2Vha01hcCgpO1xuZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdW5saXN0ZW4gPSAoKSA9PiB7XG4gICAgICAgICAgICByZXF1ZXN0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3N1Y2Nlc3MnLCBzdWNjZXNzKTtcbiAgICAgICAgICAgIHJlcXVlc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKHdyYXAocmVxdWVzdC5yZXN1bHQpKTtcbiAgICAgICAgICAgIHVubGlzdGVuKCk7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgICAgICAgICAgdW5saXN0ZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdzdWNjZXNzJywgc3VjY2Vzcyk7XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvcik7XG4gICAgfSk7XG4gICAgLy8gVGhpcyBtYXBwaW5nIGV4aXN0cyBpbiByZXZlcnNlVHJhbnNmb3JtQ2FjaGUgYnV0IGRvZXNuJ3QgZXhpc3QgaW4gdHJhbnNmb3JtQ2FjaGUuIFRoaXNcbiAgICAvLyBpcyBiZWNhdXNlIHdlIGNyZWF0ZSBtYW55IHByb21pc2VzIGZyb20gYSBzaW5nbGUgSURCUmVxdWVzdC5cbiAgICByZXZlcnNlVHJhbnNmb3JtQ2FjaGUuc2V0KHByb21pc2UsIHJlcXVlc3QpO1xuICAgIHJldHVybiBwcm9taXNlO1xufVxuZnVuY3Rpb24gY2FjaGVEb25lUHJvbWlzZUZvclRyYW5zYWN0aW9uKHR4KSB7XG4gICAgLy8gRWFybHkgYmFpbCBpZiB3ZSd2ZSBhbHJlYWR5IGNyZWF0ZWQgYSBkb25lIHByb21pc2UgZm9yIHRoaXMgdHJhbnNhY3Rpb24uXG4gICAgaWYgKHRyYW5zYWN0aW9uRG9uZU1hcC5oYXModHgpKVxuICAgICAgICByZXR1cm47XG4gICAgY29uc3QgZG9uZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdW5saXN0ZW4gPSAoKSA9PiB7XG4gICAgICAgICAgICB0eC5yZW1vdmVFdmVudExpc3RlbmVyKCdjb21wbGV0ZScsIGNvbXBsZXRlKTtcbiAgICAgICAgICAgIHR4LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgdHgucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBlcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGNvbXBsZXRlID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgdW5saXN0ZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICByZWplY3QodHguZXJyb3IgfHwgbmV3IERPTUV4Y2VwdGlvbignQWJvcnRFcnJvcicsICdBYm9ydEVycm9yJykpO1xuICAgICAgICAgICAgdW5saXN0ZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgdHguYWRkRXZlbnRMaXN0ZW5lcignY29tcGxldGUnLCBjb21wbGV0ZSk7XG4gICAgICAgIHR4LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICB0eC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGVycm9yKTtcbiAgICB9KTtcbiAgICAvLyBDYWNoZSBpdCBmb3IgbGF0ZXIgcmV0cmlldmFsLlxuICAgIHRyYW5zYWN0aW9uRG9uZU1hcC5zZXQodHgsIGRvbmUpO1xufVxubGV0IGlkYlByb3h5VHJhcHMgPSB7XG4gICAgZ2V0KHRhcmdldCwgcHJvcCwgcmVjZWl2ZXIpIHtcbiAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIElEQlRyYW5zYWN0aW9uKSB7XG4gICAgICAgICAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciB0cmFuc2FjdGlvbi5kb25lLlxuICAgICAgICAgICAgaWYgKHByb3AgPT09ICdkb25lJylcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnNhY3Rpb25Eb25lTWFwLmdldCh0YXJnZXQpO1xuICAgICAgICAgICAgLy8gTWFrZSB0eC5zdG9yZSByZXR1cm4gdGhlIG9ubHkgc3RvcmUgaW4gdGhlIHRyYW5zYWN0aW9uLCBvciB1bmRlZmluZWQgaWYgdGhlcmUgYXJlIG1hbnkuXG4gICAgICAgICAgICBpZiAocHJvcCA9PT0gJ3N0b3JlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWNlaXZlci5vYmplY3RTdG9yZU5hbWVzWzFdXG4gICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIDogcmVjZWl2ZXIub2JqZWN0U3RvcmUocmVjZWl2ZXIub2JqZWN0U3RvcmVOYW1lc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gRWxzZSB0cmFuc2Zvcm0gd2hhdGV2ZXIgd2UgZ2V0IGJhY2suXG4gICAgICAgIHJldHVybiB3cmFwKHRhcmdldFtwcm9wXSk7XG4gICAgfSxcbiAgICBzZXQodGFyZ2V0LCBwcm9wLCB2YWx1ZSkge1xuICAgICAgICB0YXJnZXRbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBoYXModGFyZ2V0LCBwcm9wKSB7XG4gICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBJREJUcmFuc2FjdGlvbiAmJlxuICAgICAgICAgICAgKHByb3AgPT09ICdkb25lJyB8fCBwcm9wID09PSAnc3RvcmUnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3AgaW4gdGFyZ2V0O1xuICAgIH0sXG59O1xuZnVuY3Rpb24gcmVwbGFjZVRyYXBzKGNhbGxiYWNrKSB7XG4gICAgaWRiUHJveHlUcmFwcyA9IGNhbGxiYWNrKGlkYlByb3h5VHJhcHMpO1xufVxuZnVuY3Rpb24gd3JhcEZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAvLyBEdWUgdG8gZXhwZWN0ZWQgb2JqZWN0IGVxdWFsaXR5ICh3aGljaCBpcyBlbmZvcmNlZCBieSB0aGUgY2FjaGluZyBpbiBgd3JhcGApLCB3ZVxuICAgIC8vIG9ubHkgY3JlYXRlIG9uZSBuZXcgZnVuYyBwZXIgZnVuYy5cbiAgICAvLyBDdXJzb3IgbWV0aG9kcyBhcmUgc3BlY2lhbCwgYXMgdGhlIGJlaGF2aW91ciBpcyBhIGxpdHRsZSBtb3JlIGRpZmZlcmVudCB0byBzdGFuZGFyZCBJREIuIEluXG4gICAgLy8gSURCLCB5b3UgYWR2YW5jZSB0aGUgY3Vyc29yIGFuZCB3YWl0IGZvciBhIG5ldyAnc3VjY2Vzcycgb24gdGhlIElEQlJlcXVlc3QgdGhhdCBnYXZlIHlvdSB0aGVcbiAgICAvLyBjdXJzb3IuIEl0J3Mga2luZGEgbGlrZSBhIHByb21pc2UgdGhhdCBjYW4gcmVzb2x2ZSB3aXRoIG1hbnkgdmFsdWVzLiBUaGF0IGRvZXNuJ3QgbWFrZSBzZW5zZVxuICAgIC8vIHdpdGggcmVhbCBwcm9taXNlcywgc28gZWFjaCBhZHZhbmNlIG1ldGhvZHMgcmV0dXJucyBhIG5ldyBwcm9taXNlIGZvciB0aGUgY3Vyc29yIG9iamVjdCwgb3JcbiAgICAvLyB1bmRlZmluZWQgaWYgdGhlIGVuZCBvZiB0aGUgY3Vyc29yIGhhcyBiZWVuIHJlYWNoZWQuXG4gICAgaWYgKGdldEN1cnNvckFkdmFuY2VNZXRob2RzKCkuaW5jbHVkZXMoZnVuYykpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAvLyBDYWxsaW5nIHRoZSBvcmlnaW5hbCBmdW5jdGlvbiB3aXRoIHRoZSBwcm94eSBhcyAndGhpcycgY2F1c2VzIElMTEVHQUwgSU5WT0NBVElPTiwgc28gd2UgdXNlXG4gICAgICAgICAgICAvLyB0aGUgb3JpZ2luYWwgb2JqZWN0LlxuICAgICAgICAgICAgZnVuYy5hcHBseSh1bndyYXAodGhpcyksIGFyZ3MpO1xuICAgICAgICAgICAgcmV0dXJuIHdyYXAodGhpcy5yZXF1ZXN0KTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgIC8vIENhbGxpbmcgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uIHdpdGggdGhlIHByb3h5IGFzICd0aGlzJyBjYXVzZXMgSUxMRUdBTCBJTlZPQ0FUSU9OLCBzbyB3ZSB1c2VcbiAgICAgICAgLy8gdGhlIG9yaWdpbmFsIG9iamVjdC5cbiAgICAgICAgcmV0dXJuIHdyYXAoZnVuYy5hcHBseSh1bndyYXAodGhpcyksIGFyZ3MpKTtcbiAgICB9O1xufVxuZnVuY3Rpb24gdHJhbnNmb3JtQ2FjaGFibGVWYWx1ZSh2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiB3cmFwRnVuY3Rpb24odmFsdWUpO1xuICAgIC8vIFRoaXMgZG9lc24ndCByZXR1cm4sIGl0IGp1c3QgY3JlYXRlcyBhICdkb25lJyBwcm9taXNlIGZvciB0aGUgdHJhbnNhY3Rpb24sXG4gICAgLy8gd2hpY2ggaXMgbGF0ZXIgcmV0dXJuZWQgZm9yIHRyYW5zYWN0aW9uLmRvbmUgKHNlZSBpZGJPYmplY3RIYW5kbGVyKS5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJREJUcmFuc2FjdGlvbilcbiAgICAgICAgY2FjaGVEb25lUHJvbWlzZUZvclRyYW5zYWN0aW9uKHZhbHVlKTtcbiAgICBpZiAoaW5zdGFuY2VPZkFueSh2YWx1ZSwgZ2V0SWRiUHJveHlhYmxlVHlwZXMoKSkpXG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodmFsdWUsIGlkYlByb3h5VHJhcHMpO1xuICAgIC8vIFJldHVybiB0aGUgc2FtZSB2YWx1ZSBiYWNrIGlmIHdlJ3JlIG5vdCBnb2luZyB0byB0cmFuc2Zvcm0gaXQuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gd3JhcCh2YWx1ZSkge1xuICAgIC8vIFdlIHNvbWV0aW1lcyBnZW5lcmF0ZSBtdWx0aXBsZSBwcm9taXNlcyBmcm9tIGEgc2luZ2xlIElEQlJlcXVlc3QgKGVnIHdoZW4gY3Vyc29yaW5nKSwgYmVjYXVzZVxuICAgIC8vIElEQiBpcyB3ZWlyZCBhbmQgYSBzaW5nbGUgSURCUmVxdWVzdCBjYW4geWllbGQgbWFueSByZXNwb25zZXMsIHNvIHRoZXNlIGNhbid0IGJlIGNhY2hlZC5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJREJSZXF1ZXN0KVxuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdCh2YWx1ZSk7XG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSB0cmFuc2Zvcm1lZCB0aGlzIHZhbHVlIGJlZm9yZSwgcmV1c2UgdGhlIHRyYW5zZm9ybWVkIHZhbHVlLlxuICAgIC8vIFRoaXMgaXMgZmFzdGVyLCBidXQgaXQgYWxzbyBwcm92aWRlcyBvYmplY3QgZXF1YWxpdHkuXG4gICAgaWYgKHRyYW5zZm9ybUNhY2hlLmhhcyh2YWx1ZSkpXG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1DYWNoZS5nZXQodmFsdWUpO1xuICAgIGNvbnN0IG5ld1ZhbHVlID0gdHJhbnNmb3JtQ2FjaGFibGVWYWx1ZSh2YWx1ZSk7XG4gICAgLy8gTm90IGFsbCB0eXBlcyBhcmUgdHJhbnNmb3JtZWQuXG4gICAgLy8gVGhlc2UgbWF5IGJlIHByaW1pdGl2ZSB0eXBlcywgc28gdGhleSBjYW4ndCBiZSBXZWFrTWFwIGtleXMuXG4gICAgaWYgKG5ld1ZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICB0cmFuc2Zvcm1DYWNoZS5zZXQodmFsdWUsIG5ld1ZhbHVlKTtcbiAgICAgICAgcmV2ZXJzZVRyYW5zZm9ybUNhY2hlLnNldChuZXdWYWx1ZSwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3VmFsdWU7XG59XG5jb25zdCB1bndyYXAgPSAodmFsdWUpID0+IHJldmVyc2VUcmFuc2Zvcm1DYWNoZS5nZXQodmFsdWUpO1xuXG4vKipcbiAqIE9wZW4gYSBkYXRhYmFzZS5cbiAqXG4gKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBkYXRhYmFzZS5cbiAqIEBwYXJhbSB2ZXJzaW9uIFNjaGVtYSB2ZXJzaW9uLlxuICogQHBhcmFtIGNhbGxiYWNrcyBBZGRpdGlvbmFsIGNhbGxiYWNrcy5cbiAqL1xuZnVuY3Rpb24gb3BlbkRCKG5hbWUsIHZlcnNpb24sIHsgYmxvY2tlZCwgdXBncmFkZSwgYmxvY2tpbmcsIHRlcm1pbmF0ZWQgfSA9IHt9KSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKG5hbWUsIHZlcnNpb24pO1xuICAgIGNvbnN0IG9wZW5Qcm9taXNlID0gd3JhcChyZXF1ZXN0KTtcbiAgICBpZiAodXBncmFkZSkge1xuICAgICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ3VwZ3JhZGVuZWVkZWQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHVwZ3JhZGUod3JhcChyZXF1ZXN0LnJlc3VsdCksIGV2ZW50Lm9sZFZlcnNpb24sIGV2ZW50Lm5ld1ZlcnNpb24sIHdyYXAocmVxdWVzdC50cmFuc2FjdGlvbiksIGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChibG9ja2VkKSB7XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignYmxvY2tlZCcsIChldmVudCkgPT4gYmxvY2tlZChcbiAgICAgICAgLy8gQ2FzdGluZyBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0LURPTS1saWItZ2VuZXJhdG9yL3B1bGwvMTQwNVxuICAgICAgICBldmVudC5vbGRWZXJzaW9uLCBldmVudC5uZXdWZXJzaW9uLCBldmVudCkpO1xuICAgIH1cbiAgICBvcGVuUHJvbWlzZVxuICAgICAgICAudGhlbigoZGIpID0+IHtcbiAgICAgICAgaWYgKHRlcm1pbmF0ZWQpXG4gICAgICAgICAgICBkYi5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsICgpID0+IHRlcm1pbmF0ZWQoKSk7XG4gICAgICAgIGlmIChibG9ja2luZykge1xuICAgICAgICAgICAgZGIuYWRkRXZlbnRMaXN0ZW5lcigndmVyc2lvbmNoYW5nZScsIChldmVudCkgPT4gYmxvY2tpbmcoZXZlbnQub2xkVmVyc2lvbiwgZXZlbnQubmV3VmVyc2lvbiwgZXZlbnQpKTtcbiAgICAgICAgfVxuICAgIH0pXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7IH0pO1xuICAgIHJldHVybiBvcGVuUHJvbWlzZTtcbn1cbi8qKlxuICogRGVsZXRlIGEgZGF0YWJhc2UuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgZGF0YWJhc2UuXG4gKi9cbmZ1bmN0aW9uIGRlbGV0ZURCKG5hbWUsIHsgYmxvY2tlZCB9ID0ge30pIHtcbiAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLmRlbGV0ZURhdGFiYXNlKG5hbWUpO1xuICAgIGlmIChibG9ja2VkKSB7XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignYmxvY2tlZCcsIChldmVudCkgPT4gYmxvY2tlZChcbiAgICAgICAgLy8gQ2FzdGluZyBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0LURPTS1saWItZ2VuZXJhdG9yL3B1bGwvMTQwNVxuICAgICAgICBldmVudC5vbGRWZXJzaW9uLCBldmVudCkpO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcChyZXF1ZXN0KS50aGVuKCgpID0+IHVuZGVmaW5lZCk7XG59XG5cbmNvbnN0IHJlYWRNZXRob2RzID0gWydnZXQnLCAnZ2V0S2V5JywgJ2dldEFsbCcsICdnZXRBbGxLZXlzJywgJ2NvdW50J107XG5jb25zdCB3cml0ZU1ldGhvZHMgPSBbJ3B1dCcsICdhZGQnLCAnZGVsZXRlJywgJ2NsZWFyJ107XG5jb25zdCBjYWNoZWRNZXRob2RzID0gbmV3IE1hcCgpO1xuZnVuY3Rpb24gZ2V0TWV0aG9kKHRhcmdldCwgcHJvcCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIElEQkRhdGFiYXNlICYmXG4gICAgICAgICEocHJvcCBpbiB0YXJnZXQpICYmXG4gICAgICAgIHR5cGVvZiBwcm9wID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoY2FjaGVkTWV0aG9kcy5nZXQocHJvcCkpXG4gICAgICAgIHJldHVybiBjYWNoZWRNZXRob2RzLmdldChwcm9wKTtcbiAgICBjb25zdCB0YXJnZXRGdW5jTmFtZSA9IHByb3AucmVwbGFjZSgvRnJvbUluZGV4JC8sICcnKTtcbiAgICBjb25zdCB1c2VJbmRleCA9IHByb3AgIT09IHRhcmdldEZ1bmNOYW1lO1xuICAgIGNvbnN0IGlzV3JpdGUgPSB3cml0ZU1ldGhvZHMuaW5jbHVkZXModGFyZ2V0RnVuY05hbWUpO1xuICAgIGlmIChcbiAgICAvLyBCYWlsIGlmIHRoZSB0YXJnZXQgZG9lc24ndCBleGlzdCBvbiB0aGUgdGFyZ2V0LiBFZywgZ2V0QWxsIGlzbid0IGluIEVkZ2UuXG4gICAgISh0YXJnZXRGdW5jTmFtZSBpbiAodXNlSW5kZXggPyBJREJJbmRleCA6IElEQk9iamVjdFN0b3JlKS5wcm90b3R5cGUpIHx8XG4gICAgICAgICEoaXNXcml0ZSB8fCByZWFkTWV0aG9kcy5pbmNsdWRlcyh0YXJnZXRGdW5jTmFtZSkpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gYXN5bmMgZnVuY3Rpb24gKHN0b3JlTmFtZSwgLi4uYXJncykge1xuICAgICAgICAvLyBpc1dyaXRlID8gJ3JlYWR3cml0ZScgOiB1bmRlZmluZWQgZ3ppcHBzIGJldHRlciwgYnV0IGZhaWxzIGluIEVkZ2UgOihcbiAgICAgICAgY29uc3QgdHggPSB0aGlzLnRyYW5zYWN0aW9uKHN0b3JlTmFtZSwgaXNXcml0ZSA/ICdyZWFkd3JpdGUnIDogJ3JlYWRvbmx5Jyk7XG4gICAgICAgIGxldCB0YXJnZXQgPSB0eC5zdG9yZTtcbiAgICAgICAgaWYgKHVzZUluZGV4KVxuICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LmluZGV4KGFyZ3Muc2hpZnQoKSk7XG4gICAgICAgIC8vIE11c3QgcmVqZWN0IGlmIG9wIHJlamVjdHMuXG4gICAgICAgIC8vIElmIGl0J3MgYSB3cml0ZSBvcGVyYXRpb24sIG11c3QgcmVqZWN0IGlmIHR4LmRvbmUgcmVqZWN0cy5cbiAgICAgICAgLy8gTXVzdCByZWplY3Qgd2l0aCBvcCByZWplY3Rpb24gZmlyc3QuXG4gICAgICAgIC8vIE11c3QgcmVzb2x2ZSB3aXRoIG9wIHZhbHVlLlxuICAgICAgICAvLyBNdXN0IGhhbmRsZSBib3RoIHByb21pc2VzIChubyB1bmhhbmRsZWQgcmVqZWN0aW9ucylcbiAgICAgICAgcmV0dXJuIChhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICB0YXJnZXRbdGFyZ2V0RnVuY05hbWVdKC4uLmFyZ3MpLFxuICAgICAgICAgICAgaXNXcml0ZSAmJiB0eC5kb25lLFxuICAgICAgICBdKSlbMF07XG4gICAgfTtcbiAgICBjYWNoZWRNZXRob2RzLnNldChwcm9wLCBtZXRob2QpO1xuICAgIHJldHVybiBtZXRob2Q7XG59XG5yZXBsYWNlVHJhcHMoKG9sZFRyYXBzKSA9PiAoe1xuICAgIC4uLm9sZFRyYXBzLFxuICAgIGdldDogKHRhcmdldCwgcHJvcCwgcmVjZWl2ZXIpID0+IGdldE1ldGhvZCh0YXJnZXQsIHByb3ApIHx8IG9sZFRyYXBzLmdldCh0YXJnZXQsIHByb3AsIHJlY2VpdmVyKSxcbiAgICBoYXM6ICh0YXJnZXQsIHByb3ApID0+ICEhZ2V0TWV0aG9kKHRhcmdldCwgcHJvcCkgfHwgb2xkVHJhcHMuaGFzKHRhcmdldCwgcHJvcCksXG59KSk7XG5cbmNvbnN0IGFkdmFuY2VNZXRob2RQcm9wcyA9IFsnY29udGludWUnLCAnY29udGludWVQcmltYXJ5S2V5JywgJ2FkdmFuY2UnXTtcbmNvbnN0IG1ldGhvZE1hcCA9IHt9O1xuY29uc3QgYWR2YW5jZVJlc3VsdHMgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgaXR0clByb3hpZWRDdXJzb3JUb09yaWdpbmFsUHJveHkgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgY3Vyc29ySXRlcmF0b3JUcmFwcyA9IHtcbiAgICBnZXQodGFyZ2V0LCBwcm9wKSB7XG4gICAgICAgIGlmICghYWR2YW5jZU1ldGhvZFByb3BzLmluY2x1ZGVzKHByb3ApKVxuICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtwcm9wXTtcbiAgICAgICAgbGV0IGNhY2hlZEZ1bmMgPSBtZXRob2RNYXBbcHJvcF07XG4gICAgICAgIGlmICghY2FjaGVkRnVuYykge1xuICAgICAgICAgICAgY2FjaGVkRnVuYyA9IG1ldGhvZE1hcFtwcm9wXSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgYWR2YW5jZVJlc3VsdHMuc2V0KHRoaXMsIGl0dHJQcm94aWVkQ3Vyc29yVG9PcmlnaW5hbFByb3h5LmdldCh0aGlzKVtwcm9wXSguLi5hcmdzKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWNoZWRGdW5jO1xuICAgIH0sXG59O1xuYXN5bmMgZnVuY3Rpb24qIGl0ZXJhdGUoLi4uYXJncykge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby10aGlzLWFzc2lnbm1lbnRcbiAgICBsZXQgY3Vyc29yID0gdGhpcztcbiAgICBpZiAoIShjdXJzb3IgaW5zdGFuY2VvZiBJREJDdXJzb3IpKSB7XG4gICAgICAgIGN1cnNvciA9IGF3YWl0IGN1cnNvci5vcGVuQ3Vyc29yKC4uLmFyZ3MpO1xuICAgIH1cbiAgICBpZiAoIWN1cnNvcilcbiAgICAgICAgcmV0dXJuO1xuICAgIGN1cnNvciA9IGN1cnNvcjtcbiAgICBjb25zdCBwcm94aWVkQ3Vyc29yID0gbmV3IFByb3h5KGN1cnNvciwgY3Vyc29ySXRlcmF0b3JUcmFwcyk7XG4gICAgaXR0clByb3hpZWRDdXJzb3JUb09yaWdpbmFsUHJveHkuc2V0KHByb3hpZWRDdXJzb3IsIGN1cnNvcik7XG4gICAgLy8gTWFwIHRoaXMgZG91YmxlLXByb3h5IGJhY2sgdG8gdGhlIG9yaWdpbmFsLCBzbyBvdGhlciBjdXJzb3IgbWV0aG9kcyB3b3JrLlxuICAgIHJldmVyc2VUcmFuc2Zvcm1DYWNoZS5zZXQocHJveGllZEN1cnNvciwgdW53cmFwKGN1cnNvcikpO1xuICAgIHdoaWxlIChjdXJzb3IpIHtcbiAgICAgICAgeWllbGQgcHJveGllZEN1cnNvcjtcbiAgICAgICAgLy8gSWYgb25lIG9mIHRoZSBhZHZhbmNpbmcgbWV0aG9kcyB3YXMgbm90IGNhbGxlZCwgY2FsbCBjb250aW51ZSgpLlxuICAgICAgICBjdXJzb3IgPSBhd2FpdCAoYWR2YW5jZVJlc3VsdHMuZ2V0KHByb3hpZWRDdXJzb3IpIHx8IGN1cnNvci5jb250aW51ZSgpKTtcbiAgICAgICAgYWR2YW5jZVJlc3VsdHMuZGVsZXRlKHByb3hpZWRDdXJzb3IpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIGlzSXRlcmF0b3JQcm9wKHRhcmdldCwgcHJvcCkge1xuICAgIHJldHVybiAoKHByb3AgPT09IFN5bWJvbC5hc3luY0l0ZXJhdG9yICYmXG4gICAgICAgIGluc3RhbmNlT2ZBbnkodGFyZ2V0LCBbSURCSW5kZXgsIElEQk9iamVjdFN0b3JlLCBJREJDdXJzb3JdKSkgfHxcbiAgICAgICAgKHByb3AgPT09ICdpdGVyYXRlJyAmJiBpbnN0YW5jZU9mQW55KHRhcmdldCwgW0lEQkluZGV4LCBJREJPYmplY3RTdG9yZV0pKSk7XG59XG5yZXBsYWNlVHJhcHMoKG9sZFRyYXBzKSA9PiAoe1xuICAgIC4uLm9sZFRyYXBzLFxuICAgIGdldCh0YXJnZXQsIHByb3AsIHJlY2VpdmVyKSB7XG4gICAgICAgIGlmIChpc0l0ZXJhdG9yUHJvcCh0YXJnZXQsIHByb3ApKVxuICAgICAgICAgICAgcmV0dXJuIGl0ZXJhdGU7XG4gICAgICAgIHJldHVybiBvbGRUcmFwcy5nZXQodGFyZ2V0LCBwcm9wLCByZWNlaXZlcik7XG4gICAgfSxcbiAgICBoYXModGFyZ2V0LCBwcm9wKSB7XG4gICAgICAgIHJldHVybiBpc0l0ZXJhdG9yUHJvcCh0YXJnZXQsIHByb3ApIHx8IG9sZFRyYXBzLmhhcyh0YXJnZXQsIHByb3ApO1xuICAgIH0sXG59KSk7XG5cbmV4cG9ydHMuZGVsZXRlREIgPSBkZWxldGVEQjtcbmV4cG9ydHMub3BlbkRCID0gb3BlbkRCO1xuZXhwb3J0cy51bndyYXAgPSB1bndyYXA7XG5leHBvcnRzLndyYXAgPSB3cmFwO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuICB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuICAoZ2xvYmFsID0gZ2xvYmFsIHx8IHNlbGYsIGdsb2JhbC5NdXN0YWNoZSA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuICAvKiFcbiAgICogbXVzdGFjaGUuanMgLSBMb2dpYy1sZXNzIHt7bXVzdGFjaGV9fSB0ZW1wbGF0ZXMgd2l0aCBKYXZhU2NyaXB0XG4gICAqIGh0dHA6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanNcbiAgICovXG5cbiAgdmFyIG9iamVjdFRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIGlzQXJyYXlQb2x5ZmlsbCAob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdFRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICBmdW5jdGlvbiBpc0Z1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3JlIGNvcnJlY3QgdHlwZW9mIHN0cmluZyBoYW5kbGluZyBhcnJheVxuICAgKiB3aGljaCBub3JtYWxseSByZXR1cm5zIHR5cGVvZiAnb2JqZWN0J1xuICAgKi9cbiAgZnVuY3Rpb24gdHlwZVN0ciAob2JqKSB7XG4gICAgcmV0dXJuIGlzQXJyYXkob2JqKSA/ICdhcnJheScgOiB0eXBlb2Ygb2JqO1xuICB9XG5cbiAgZnVuY3Rpb24gZXNjYXBlUmVnRXhwIChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1tcXC1cXFtcXF17fSgpKis/LixcXFxcXFxeJHwjXFxzXS9nLCAnXFxcXCQmJyk7XG4gIH1cblxuICAvKipcbiAgICogTnVsbCBzYWZlIHdheSBvZiBjaGVja2luZyB3aGV0aGVyIG9yIG5vdCBhbiBvYmplY3QsXG4gICAqIGluY2x1ZGluZyBpdHMgcHJvdG90eXBlLCBoYXMgYSBnaXZlbiBwcm9wZXJ0eVxuICAgKi9cbiAgZnVuY3Rpb24gaGFzUHJvcGVydHkgKG9iaiwgcHJvcE5hbWUpIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgKHByb3BOYW1lIGluIG9iaik7XG4gIH1cblxuICAvKipcbiAgICogU2FmZSB3YXkgb2YgZGV0ZWN0aW5nIHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiB0aGluZyBpcyBhIHByaW1pdGl2ZSBhbmRcbiAgICogd2hldGhlciBpdCBoYXMgdGhlIGdpdmVuIHByb3BlcnR5XG4gICAqL1xuICBmdW5jdGlvbiBwcmltaXRpdmVIYXNPd25Qcm9wZXJ0eSAocHJpbWl0aXZlLCBwcm9wTmFtZSkge1xuICAgIHJldHVybiAoXG4gICAgICBwcmltaXRpdmUgIT0gbnVsbFxuICAgICAgJiYgdHlwZW9mIHByaW1pdGl2ZSAhPT0gJ29iamVjdCdcbiAgICAgICYmIHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eVxuICAgICAgJiYgcHJpbWl0aXZlLmhhc093blByb3BlcnR5KHByb3BOYW1lKVxuICAgICk7XG4gIH1cblxuICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2lzc3Vlcy5hcGFjaGUub3JnL2ppcmEvYnJvd3NlL0NPVUNIREItNTc3XG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg5XG4gIHZhciByZWdFeHBUZXN0ID0gUmVnRXhwLnByb3RvdHlwZS50ZXN0O1xuICBmdW5jdGlvbiB0ZXN0UmVnRXhwIChyZSwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIHJlZ0V4cFRlc3QuY2FsbChyZSwgc3RyaW5nKTtcbiAgfVxuXG4gIHZhciBub25TcGFjZVJlID0gL1xcUy87XG4gIGZ1bmN0aW9uIGlzV2hpdGVzcGFjZSAoc3RyaW5nKSB7XG4gICAgcmV0dXJuICF0ZXN0UmVnRXhwKG5vblNwYWNlUmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgZW50aXR5TWFwID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjMzk7JyxcbiAgICAnLyc6ICcmI3gyRjsnLFxuICAgICdgJzogJyYjeDYwOycsXG4gICAgJz0nOiAnJiN4M0Q7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwgKHN0cmluZykge1xuICAgIHJldHVybiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC9bJjw+XCInYD1cXC9dL2csIGZ1bmN0aW9uIGZyb21FbnRpdHlNYXAgKHMpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXBbc107XG4gICAgfSk7XG4gIH1cblxuICB2YXIgd2hpdGVSZSA9IC9cXHMqLztcbiAgdmFyIHNwYWNlUmUgPSAvXFxzKy87XG4gIHZhciBlcXVhbHNSZSA9IC9cXHMqPS87XG4gIHZhciBjdXJseVJlID0gL1xccypcXH0vO1xuICB2YXIgdGFnUmUgPSAvI3xcXF58XFwvfD58XFx7fCZ8PXwhLztcblxuICAvKipcbiAgICogQnJlYWtzIHVwIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHN0cmluZyBpbnRvIGEgdHJlZSBvZiB0b2tlbnMuIElmIHRoZSBgdGFnc2BcbiAgICogYXJndW1lbnQgaXMgZ2l2ZW4gaGVyZSBpdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvIHN0cmluZyB2YWx1ZXM6IHRoZVxuICAgKiBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy4gWyBcIjwlXCIsIFwiJT5cIiBdKS4gT2ZcbiAgICogY291cnNlLCB0aGUgZGVmYXVsdCBpcyB0byB1c2UgbXVzdGFjaGVzIChpLmUuIG11c3RhY2hlLnRhZ3MpLlxuICAgKlxuICAgKiBBIHRva2VuIGlzIGFuIGFycmF5IHdpdGggYXQgbGVhc3QgNCBlbGVtZW50cy4gVGhlIGZpcnN0IGVsZW1lbnQgaXMgdGhlXG4gICAqIG11c3RhY2hlIHN5bWJvbCB0aGF0IHdhcyB1c2VkIGluc2lkZSB0aGUgdGFnLCBlLmcuIFwiI1wiIG9yIFwiJlwiLiBJZiB0aGUgdGFnXG4gICAqIGRpZCBub3QgY29udGFpbiBhIHN5bWJvbCAoaS5lLiB7e215VmFsdWV9fSkgdGhpcyBlbGVtZW50IGlzIFwibmFtZVwiLiBGb3JcbiAgICogYWxsIHRleHQgdGhhdCBhcHBlYXJzIG91dHNpZGUgYSBzeW1ib2wgdGhpcyBlbGVtZW50IGlzIFwidGV4dFwiLlxuICAgKlxuICAgKiBUaGUgc2Vjb25kIGVsZW1lbnQgb2YgYSB0b2tlbiBpcyBpdHMgXCJ2YWx1ZVwiLiBGb3IgbXVzdGFjaGUgdGFncyB0aGlzIGlzXG4gICAqIHdoYXRldmVyIGVsc2Ugd2FzIGluc2lkZSB0aGUgdGFnIGJlc2lkZXMgdGhlIG9wZW5pbmcgc3ltYm9sLiBGb3IgdGV4dCB0b2tlbnNcbiAgICogdGhpcyBpcyB0aGUgdGV4dCBpdHNlbGYuXG4gICAqXG4gICAqIFRoZSB0aGlyZCBhbmQgZm91cnRoIGVsZW1lbnRzIG9mIHRoZSB0b2tlbiBhcmUgdGhlIHN0YXJ0IGFuZCBlbmQgaW5kaWNlcyxcbiAgICogcmVzcGVjdGl2ZWx5LCBvZiB0aGUgdG9rZW4gaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUb2tlbnMgdGhhdCBhcmUgdGhlIHJvb3Qgbm9kZSBvZiBhIHN1YnRyZWUgY29udGFpbiB0d28gbW9yZSBlbGVtZW50czogMSkgYW5cbiAgICogYXJyYXkgb2YgdG9rZW5zIGluIHRoZSBzdWJ0cmVlIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlIGF0XG4gICAqIHdoaWNoIHRoZSBjbG9zaW5nIHRhZyBmb3IgdGhhdCBzZWN0aW9uIGJlZ2lucy5cbiAgICpcbiAgICogVG9rZW5zIGZvciBwYXJ0aWFscyBhbHNvIGNvbnRhaW4gdHdvIG1vcmUgZWxlbWVudHM6IDEpIGEgc3RyaW5nIHZhbHVlIG9mXG4gICAqIGluZGVuZGF0aW9uIHByaW9yIHRvIHRoYXQgdGFnIGFuZCAyKSB0aGUgaW5kZXggb2YgdGhhdCB0YWcgb24gdGhhdCBsaW5lIC1cbiAgICogZWcgYSB2YWx1ZSBvZiAyIGluZGljYXRlcyB0aGUgcGFydGlhbCBpcyB0aGUgdGhpcmQgdGFnIG9uIHRoaXMgbGluZS5cbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgaWYgKCF0ZW1wbGF0ZSlcbiAgICAgIHJldHVybiBbXTtcbiAgICB2YXIgbGluZUhhc05vblNwYWNlID0gZmFsc2U7XG4gICAgdmFyIHNlY3Rpb25zID0gW107ICAgICAvLyBTdGFjayB0byBob2xkIHNlY3Rpb24gdG9rZW5zXG4gICAgdmFyIHRva2VucyA9IFtdOyAgICAgICAvLyBCdWZmZXIgdG8gaG9sZCB0aGUgdG9rZW5zXG4gICAgdmFyIHNwYWNlcyA9IFtdOyAgICAgICAvLyBJbmRpY2VzIG9mIHdoaXRlc3BhY2UgdG9rZW5zIG9uIHRoZSBjdXJyZW50IGxpbmVcbiAgICB2YXIgaGFzVGFnID0gZmFsc2U7ICAgIC8vIElzIHRoZXJlIGEge3t0YWd9fSBvbiB0aGUgY3VycmVudCBsaW5lP1xuICAgIHZhciBub25TcGFjZSA9IGZhbHNlOyAgLy8gSXMgdGhlcmUgYSBub24tc3BhY2UgY2hhciBvbiB0aGUgY3VycmVudCBsaW5lP1xuICAgIHZhciBpbmRlbnRhdGlvbiA9ICcnOyAgLy8gVHJhY2tzIGluZGVudGF0aW9uIGZvciB0YWdzIHRoYXQgdXNlIGl0XG4gICAgdmFyIHRhZ0luZGV4ID0gMDsgICAgICAvLyBTdG9yZXMgYSBjb3VudCBvZiBudW1iZXIgb2YgdGFncyBlbmNvdW50ZXJlZCBvbiBhIGxpbmVcblxuICAgIC8vIFN0cmlwcyBhbGwgd2hpdGVzcGFjZSB0b2tlbnMgYXJyYXkgZm9yIHRoZSBjdXJyZW50IGxpbmVcbiAgICAvLyBpZiB0aGVyZSB3YXMgYSB7eyN0YWd9fSBvbiBpdCBhbmQgb3RoZXJ3aXNlIG9ubHkgc3BhY2UuXG4gICAgZnVuY3Rpb24gc3RyaXBTcGFjZSAoKSB7XG4gICAgICBpZiAoaGFzVGFnICYmICFub25TcGFjZSkge1xuICAgICAgICB3aGlsZSAoc3BhY2VzLmxlbmd0aClcbiAgICAgICAgICBkZWxldGUgdG9rZW5zW3NwYWNlcy5wb3AoKV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGFjZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgaGFzVGFnID0gZmFsc2U7XG4gICAgICBub25TcGFjZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBvcGVuaW5nVGFnUmUsIGNsb3NpbmdUYWdSZSwgY2xvc2luZ0N1cmx5UmU7XG4gICAgZnVuY3Rpb24gY29tcGlsZVRhZ3MgKHRhZ3NUb0NvbXBpbGUpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFnc1RvQ29tcGlsZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHRhZ3NUb0NvbXBpbGUgPSB0YWdzVG9Db21waWxlLnNwbGl0KHNwYWNlUmUsIDIpO1xuXG4gICAgICBpZiAoIWlzQXJyYXkodGFnc1RvQ29tcGlsZSkgfHwgdGFnc1RvQ29tcGlsZS5sZW5ndGggIT09IDIpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzOiAnICsgdGFnc1RvQ29tcGlsZSk7XG5cbiAgICAgIG9wZW5pbmdUYWdSZSA9IG5ldyBSZWdFeHAoZXNjYXBlUmVnRXhwKHRhZ3NUb0NvbXBpbGVbMF0pICsgJ1xcXFxzKicpO1xuICAgICAgY2xvc2luZ1RhZ1JlID0gbmV3IFJlZ0V4cCgnXFxcXHMqJyArIGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzFdKSk7XG4gICAgICBjbG9zaW5nQ3VybHlSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAoJ30nICsgdGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgIH1cblxuICAgIGNvbXBpbGVUYWdzKHRhZ3MgfHwgbXVzdGFjaGUudGFncyk7XG5cbiAgICB2YXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRlbXBsYXRlKTtcblxuICAgIHZhciBzdGFydCwgdHlwZSwgdmFsdWUsIGNociwgdG9rZW4sIG9wZW5TZWN0aW9uO1xuICAgIHdoaWxlICghc2Nhbm5lci5lb3MoKSkge1xuICAgICAgc3RhcnQgPSBzY2FubmVyLnBvcztcblxuICAgICAgLy8gTWF0Y2ggYW55IHRleHQgYmV0d2VlbiB0YWdzLlxuICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChvcGVuaW5nVGFnUmUpO1xuXG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgdmFsdWVMZW5ndGg7ICsraSkge1xuICAgICAgICAgIGNociA9IHZhbHVlLmNoYXJBdChpKTtcblxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoY2hyKSkge1xuICAgICAgICAgICAgc3BhY2VzLnB1c2godG9rZW5zLmxlbmd0aCk7XG4gICAgICAgICAgICBpbmRlbnRhdGlvbiArPSBjaHI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICAgIGxpbmVIYXNOb25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgICBpbmRlbnRhdGlvbiArPSAnICc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdG9rZW5zLnB1c2goWyAndGV4dCcsIGNociwgc3RhcnQsIHN0YXJ0ICsgMSBdKTtcbiAgICAgICAgICBzdGFydCArPSAxO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIHdoaXRlc3BhY2Ugb24gdGhlIGN1cnJlbnQgbGluZS5cbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxuJykge1xuICAgICAgICAgICAgc3RyaXBTcGFjZSgpO1xuICAgICAgICAgICAgaW5kZW50YXRpb24gPSAnJztcbiAgICAgICAgICAgIHRhZ0luZGV4ID0gMDtcbiAgICAgICAgICAgIGxpbmVIYXNOb25TcGFjZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgb3BlbmluZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihvcGVuaW5nVGFnUmUpKVxuICAgICAgICBicmVhaztcblxuICAgICAgaGFzVGFnID0gdHJ1ZTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdHlwZS5cbiAgICAgIHR5cGUgPSBzY2FubmVyLnNjYW4odGFnUmUpIHx8ICduYW1lJztcbiAgICAgIHNjYW5uZXIuc2Nhbih3aGl0ZVJlKTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdmFsdWUuXG4gICAgICBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAneycpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nQ3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgICAgdHlwZSA9ICcmJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIGNsb3NpbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4oY2xvc2luZ1RhZ1JlKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCB0YWcgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgICAgaWYgKHR5cGUgPT0gJz4nKSB7XG4gICAgICAgIHRva2VuID0gWyB0eXBlLCB2YWx1ZSwgc3RhcnQsIHNjYW5uZXIucG9zLCBpbmRlbnRhdGlvbiwgdGFnSW5kZXgsIGxpbmVIYXNOb25TcGFjZSBdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdG9rZW4gPSBbIHR5cGUsIHZhbHVlLCBzdGFydCwgc2Nhbm5lci5wb3MgXTtcbiAgICAgIH1cbiAgICAgIHRhZ0luZGV4Kys7XG4gICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG5cbiAgICAgIGlmICh0eXBlID09PSAnIycgfHwgdHlwZSA9PT0gJ14nKSB7XG4gICAgICAgIHNlY3Rpb25zLnB1c2godG9rZW4pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnLycpIHtcbiAgICAgICAgLy8gQ2hlY2sgc2VjdGlvbiBuZXN0aW5nLlxuICAgICAgICBvcGVuU2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuXG4gICAgICAgIGlmICghb3BlblNlY3Rpb24pXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbm9wZW5lZCBzZWN0aW9uIFwiJyArIHZhbHVlICsgJ1wiIGF0ICcgKyBzdGFydCk7XG5cbiAgICAgICAgaWYgKG9wZW5TZWN0aW9uWzFdICE9PSB2YWx1ZSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgb3BlblNlY3Rpb25bMV0gKyAnXCIgYXQgJyArIHN0YXJ0KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ25hbWUnIHx8IHR5cGUgPT09ICd7JyB8fCB0eXBlID09PSAnJicpIHtcbiAgICAgICAgbm9uU3BhY2UgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnPScpIHtcbiAgICAgICAgLy8gU2V0IHRoZSB0YWdzIGZvciB0aGUgbmV4dCB0aW1lIGFyb3VuZC5cbiAgICAgICAgY29tcGlsZVRhZ3ModmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHN0cmlwU3BhY2UoKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gb3BlbiBzZWN0aW9ucyB3aGVuIHdlJ3JlIGRvbmUuXG4gICAgb3BlblNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgIGlmIChvcGVuU2VjdGlvbilcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBvcGVuU2VjdGlvblsxXSArICdcIiBhdCAnICsgc2Nhbm5lci5wb3MpO1xuXG4gICAgcmV0dXJuIG5lc3RUb2tlbnMoc3F1YXNoVG9rZW5zKHRva2VucykpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbWJpbmVzIHRoZSB2YWx1ZXMgb2YgY29uc2VjdXRpdmUgdGV4dCB0b2tlbnMgaW4gdGhlIGdpdmVuIGB0b2tlbnNgIGFycmF5XG4gICAqIHRvIGEgc2luZ2xlIHRva2VuLlxuICAgKi9cbiAgZnVuY3Rpb24gc3F1YXNoVG9rZW5zICh0b2tlbnMpIHtcbiAgICB2YXIgc3F1YXNoZWRUb2tlbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbiwgbGFzdFRva2VuO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgaWYgKHRva2VuWzBdID09PSAndGV4dCcgJiYgbGFzdFRva2VuICYmIGxhc3RUb2tlblswXSA9PT0gJ3RleHQnKSB7XG4gICAgICAgICAgbGFzdFRva2VuWzFdICs9IHRva2VuWzFdO1xuICAgICAgICAgIGxhc3RUb2tlblszXSA9IHRva2VuWzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNxdWFzaGVkVG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgICAgIGxhc3RUb2tlbiA9IHRva2VuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNxdWFzaGVkVG9rZW5zO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1zIHRoZSBnaXZlbiBhcnJheSBvZiBgdG9rZW5zYCBpbnRvIGEgbmVzdGVkIHRyZWUgc3RydWN0dXJlIHdoZXJlXG4gICAqIHRva2VucyB0aGF0IHJlcHJlc2VudCBhIHNlY3Rpb24gaGF2ZSB0d28gYWRkaXRpb25hbCBpdGVtczogMSkgYW4gYXJyYXkgb2ZcbiAgICogYWxsIHRva2VucyB0aGF0IGFwcGVhciBpbiB0aGF0IHNlY3Rpb24gYW5kIDIpIHRoZSBpbmRleCBpbiB0aGUgb3JpZ2luYWxcbiAgICogdGVtcGxhdGUgdGhhdCByZXByZXNlbnRzIHRoZSBlbmQgb2YgdGhhdCBzZWN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gbmVzdFRva2VucyAodG9rZW5zKSB7XG4gICAgdmFyIG5lc3RlZFRva2VucyA9IFtdO1xuICAgIHZhciBjb2xsZWN0b3IgPSBuZXN0ZWRUb2tlbnM7XG4gICAgdmFyIHNlY3Rpb25zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIHNlY3Rpb247XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgIHN3aXRjaCAodG9rZW5bMF0pIHtcbiAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgIGNhc2UgJ14nOlxuICAgICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBjb2xsZWN0b3IgPSB0b2tlbls0XSA9IFtdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG4gICAgICAgICAgc2VjdGlvbls1XSA9IHRva2VuWzJdO1xuICAgICAgICAgIGNvbGxlY3RvciA9IHNlY3Rpb25zLmxlbmd0aCA+IDAgPyBzZWN0aW9uc1tzZWN0aW9ucy5sZW5ndGggLSAxXVs0XSA6IG5lc3RlZFRva2VucztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lc3RlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHNpbXBsZSBzdHJpbmcgc2Nhbm5lciB0aGF0IGlzIHVzZWQgYnkgdGhlIHRlbXBsYXRlIHBhcnNlciB0byBmaW5kXG4gICAqIHRva2VucyBpbiB0ZW1wbGF0ZSBzdHJpbmdzLlxuICAgKi9cbiAgZnVuY3Rpb24gU2Nhbm5lciAoc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gICAgdGhpcy50YWlsID0gc3RyaW5nO1xuICAgIHRoaXMucG9zID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFpbCBpcyBlbXB0eSAoZW5kIG9mIHN0cmluZykuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5lb3MgPSBmdW5jdGlvbiBlb3MgKCkge1xuICAgIHJldHVybiB0aGlzLnRhaWwgPT09ICcnO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmllcyB0byBtYXRjaCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBSZXR1cm5zIHRoZSBtYXRjaGVkIHRleHQgaWYgaXQgY2FuIG1hdGNoLCB0aGUgZW1wdHkgc3RyaW5nIG90aGVyd2lzZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW4gPSBmdW5jdGlvbiBzY2FuIChyZSkge1xuICAgIHZhciBtYXRjaCA9IHRoaXMudGFpbC5tYXRjaChyZSk7XG5cbiAgICBpZiAoIW1hdGNoIHx8IG1hdGNoLmluZGV4ICE9PSAwKVxuICAgICAgcmV0dXJuICcnO1xuXG4gICAgdmFyIHN0cmluZyA9IG1hdGNoWzBdO1xuXG4gICAgdGhpcy50YWlsID0gdGhpcy50YWlsLnN1YnN0cmluZyhzdHJpbmcubGVuZ3RoKTtcbiAgICB0aGlzLnBvcyArPSBzdHJpbmcubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHN0cmluZztcbiAgfTtcblxuICAvKipcbiAgICogU2tpcHMgYWxsIHRleHQgdW50aWwgdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYmUgbWF0Y2hlZC4gUmV0dXJuc1xuICAgKiB0aGUgc2tpcHBlZCBzdHJpbmcsIHdoaWNoIGlzIHRoZSBlbnRpcmUgdGFpbCBpZiBubyBtYXRjaCBjYW4gYmUgbWFkZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW5VbnRpbCA9IGZ1bmN0aW9uIHNjYW5VbnRpbCAocmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnRhaWwuc2VhcmNoKHJlKSwgbWF0Y2g7XG5cbiAgICBzd2l0Y2ggKGluZGV4KSB7XG4gICAgICBjYXNlIC0xOlxuICAgICAgICBtYXRjaCA9IHRoaXMudGFpbDtcbiAgICAgICAgdGhpcy50YWlsID0gJyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAwOlxuICAgICAgICBtYXRjaCA9ICcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIG1hdGNoID0gdGhpcy50YWlsLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoaW5kZXgpO1xuICAgIH1cblxuICAgIHRoaXMucG9zICs9IG1hdGNoLmxlbmd0aDtcblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHJlbmRlcmluZyBjb250ZXh0IGJ5IHdyYXBwaW5nIGEgdmlldyBvYmplY3QgYW5kXG4gICAqIG1haW50YWluaW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBwYXJlbnQgY29udGV4dC5cbiAgICovXG4gIGZ1bmN0aW9uIENvbnRleHQgKHZpZXcsIHBhcmVudENvbnRleHQpIHtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuY2FjaGUgPSB7ICcuJzogdGhpcy52aWV3IH07XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnRDb250ZXh0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgY29udGV4dCB1c2luZyB0aGUgZ2l2ZW4gdmlldyB3aXRoIHRoaXMgY29udGV4dFxuICAgKiBhcyB0aGUgcGFyZW50LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIHB1c2ggKHZpZXcpIHtcbiAgICByZXR1cm4gbmV3IENvbnRleHQodmlldywgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBnaXZlbiBuYW1lIGluIHRoaXMgY29udGV4dCwgdHJhdmVyc2luZ1xuICAgKiB1cCB0aGUgY29udGV4dCBoaWVyYXJjaHkgaWYgdGhlIHZhbHVlIGlzIGFic2VudCBpbiB0aGlzIGNvbnRleHQncyB2aWV3LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gbG9va3VwIChuYW1lKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcblxuICAgIHZhciB2YWx1ZTtcbiAgICBpZiAoY2FjaGUuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgIHZhbHVlID0gY2FjaGVbbmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjb250ZXh0ID0gdGhpcywgaW50ZXJtZWRpYXRlVmFsdWUsIG5hbWVzLCBpbmRleCwgbG9va3VwSGl0ID0gZmFsc2U7XG5cbiAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgIGlmIChuYW1lLmluZGV4T2YoJy4nKSA+IDApIHtcbiAgICAgICAgICBpbnRlcm1lZGlhdGVWYWx1ZSA9IGNvbnRleHQudmlldztcbiAgICAgICAgICBuYW1lcyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBpbmRleCA9IDA7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBVc2luZyB0aGUgZG90IG5vdGlvbiBwYXRoIGluIGBuYW1lYCwgd2UgZGVzY2VuZCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAqIG5lc3RlZCBvYmplY3RzLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVG8gYmUgY2VydGFpbiB0aGF0IHRoZSBsb29rdXAgaGFzIGJlZW4gc3VjY2Vzc2Z1bCwgd2UgaGF2ZSB0b1xuICAgICAgICAgICAqIGNoZWNrIGlmIHRoZSBsYXN0IG9iamVjdCBpbiB0aGUgcGF0aCBhY3R1YWxseSBoYXMgdGhlIHByb3BlcnR5XG4gICAgICAgICAgICogd2UgYXJlIGxvb2tpbmcgZm9yLiBXZSBzdG9yZSB0aGUgcmVzdWx0IGluIGBsb29rdXBIaXRgLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVGhpcyBpcyBzcGVjaWFsbHkgbmVjZXNzYXJ5IGZvciB3aGVuIHRoZSB2YWx1ZSBoYXMgYmVlbiBzZXQgdG9cbiAgICAgICAgICAgKiBgdW5kZWZpbmVkYCBhbmQgd2Ugd2FudCB0byBhdm9pZCBsb29raW5nIHVwIHBhcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIEluIHRoZSBjYXNlIHdoZXJlIGRvdCBub3RhdGlvbiBpcyB1c2VkLCB3ZSBjb25zaWRlciB0aGUgbG9va3VwXG4gICAgICAgICAgICogdG8gYmUgc3VjY2Vzc2Z1bCBldmVuIGlmIHRoZSBsYXN0IFwib2JqZWN0XCIgaW4gdGhlIHBhdGggaXNcbiAgICAgICAgICAgKiBub3QgYWN0dWFsbHkgYW4gb2JqZWN0IGJ1dCBhIHByaW1pdGl2ZSAoZS5nLiwgYSBzdHJpbmcsIG9yIGFuXG4gICAgICAgICAgICogaW50ZWdlciksIGJlY2F1c2UgaXQgaXMgc29tZXRpbWVzIHVzZWZ1bCB0byBhY2Nlc3MgYSBwcm9wZXJ0eVxuICAgICAgICAgICAqIG9mIGFuIGF1dG9ib3hlZCBwcmltaXRpdmUsIHN1Y2ggYXMgdGhlIGxlbmd0aCBvZiBhIHN0cmluZy5cbiAgICAgICAgICAgKiovXG4gICAgICAgICAgd2hpbGUgKGludGVybWVkaWF0ZVZhbHVlICE9IG51bGwgJiYgaW5kZXggPCBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gbmFtZXMubGVuZ3RoIC0gMSlcbiAgICAgICAgICAgICAgbG9va3VwSGl0ID0gKFxuICAgICAgICAgICAgICAgIGhhc1Byb3BlcnR5KGludGVybWVkaWF0ZVZhbHVlLCBuYW1lc1tpbmRleF0pXG4gICAgICAgICAgICAgICAgfHwgcHJpbWl0aXZlSGFzT3duUHJvcGVydHkoaW50ZXJtZWRpYXRlVmFsdWUsIG5hbWVzW2luZGV4XSlcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaW50ZXJtZWRpYXRlVmFsdWUgPSBpbnRlcm1lZGlhdGVWYWx1ZVtuYW1lc1tpbmRleCsrXV07XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGludGVybWVkaWF0ZVZhbHVlID0gY29udGV4dC52aWV3W25hbWVdO1xuXG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogT25seSBjaGVja2luZyBhZ2FpbnN0IGBoYXNQcm9wZXJ0eWAsIHdoaWNoIGFsd2F5cyByZXR1cm5zIGBmYWxzZWAgaWZcbiAgICAgICAgICAgKiBgY29udGV4dC52aWV3YCBpcyBub3QgYW4gb2JqZWN0LiBEZWxpYmVyYXRlbHkgb21pdHRpbmcgdGhlIGNoZWNrXG4gICAgICAgICAgICogYWdhaW5zdCBgcHJpbWl0aXZlSGFzT3duUHJvcGVydHlgIGlmIGRvdCBub3RhdGlvbiBpcyBub3QgdXNlZC5cbiAgICAgICAgICAgKlxuICAgICAgICAgICAqIENvbnNpZGVyIHRoaXMgZXhhbXBsZTpcbiAgICAgICAgICAgKiBgYGBcbiAgICAgICAgICAgKiBNdXN0YWNoZS5yZW5kZXIoXCJUaGUgbGVuZ3RoIG9mIGEgZm9vdGJhbGwgZmllbGQgaXMge3sjbGVuZ3RofX17e2xlbmd0aH19e3svbGVuZ3RofX0uXCIsIHtsZW5ndGg6IFwiMTAwIHlhcmRzXCJ9KVxuICAgICAgICAgICAqIGBgYFxuICAgICAgICAgICAqXG4gICAgICAgICAgICogSWYgd2Ugd2VyZSB0byBjaGVjayBhbHNvIGFnYWluc3QgYHByaW1pdGl2ZUhhc093blByb3BlcnR5YCwgYXMgd2UgZG9cbiAgICAgICAgICAgKiBpbiB0aGUgZG90IG5vdGF0aW9uIGNhc2UsIHRoZW4gcmVuZGVyIGNhbGwgd291bGQgcmV0dXJuOlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogXCJUaGUgbGVuZ3RoIG9mIGEgZm9vdGJhbGwgZmllbGQgaXMgOS5cIlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogcmF0aGVyIHRoYW4gdGhlIGV4cGVjdGVkOlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogXCJUaGUgbGVuZ3RoIG9mIGEgZm9vdGJhbGwgZmllbGQgaXMgMTAwIHlhcmRzLlwiXG4gICAgICAgICAgICoqL1xuICAgICAgICAgIGxvb2t1cEhpdCA9IGhhc1Byb3BlcnR5KGNvbnRleHQudmlldywgbmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9va3VwSGl0KSB7XG4gICAgICAgICAgdmFsdWUgPSBpbnRlcm1lZGlhdGVWYWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRleHQgPSBjb250ZXh0LnBhcmVudDtcbiAgICAgIH1cblxuICAgICAgY2FjaGVbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwodGhpcy52aWV3KTtcblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQSBXcml0ZXIga25vd3MgaG93IHRvIHRha2UgYSBzdHJlYW0gb2YgdG9rZW5zIGFuZCByZW5kZXIgdGhlbSB0byBhXG4gICAqIHN0cmluZywgZ2l2ZW4gYSBjb250ZXh0LiBJdCBhbHNvIG1haW50YWlucyBhIGNhY2hlIG9mIHRlbXBsYXRlcyB0b1xuICAgKiBhdm9pZCB0aGUgbmVlZCB0byBwYXJzZSB0aGUgc2FtZSB0ZW1wbGF0ZSB0d2ljZS5cbiAgICovXG4gIGZ1bmN0aW9uIFdyaXRlciAoKSB7XG4gICAgdGhpcy50ZW1wbGF0ZUNhY2hlID0ge1xuICAgICAgX2NhY2hlOiB7fSxcbiAgICAgIHNldDogZnVuY3Rpb24gc2V0IChrZXksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlW2tleV0gPSB2YWx1ZTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCAoa2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZVtrZXldO1xuICAgICAgfSxcbiAgICAgIGNsZWFyOiBmdW5jdGlvbiBjbGVhciAoKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlID0ge307XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhpcyB3cml0ZXIuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICBpZiAodHlwZW9mIHRoaXMudGVtcGxhdGVDYWNoZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMudGVtcGxhdGVDYWNoZS5jbGVhcigpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIGB0ZW1wbGF0ZWAgYWNjb3JkaW5nIHRvIHRoZSBnaXZlbiBgdGFnc2Agb3JcbiAgICogYG11c3RhY2hlLnRhZ3NgIGlmIGB0YWdzYCBpcyBvbWl0dGVkLCAgYW5kIHJldHVybnMgdGhlIGFycmF5IG9mIHRva2Vuc1xuICAgKiB0aGF0IGlzIGdlbmVyYXRlZCBmcm9tIHRoZSBwYXJzZS5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLnRlbXBsYXRlQ2FjaGU7XG4gICAgdmFyIGNhY2hlS2V5ID0gdGVtcGxhdGUgKyAnOicgKyAodGFncyB8fCBtdXN0YWNoZS50YWdzKS5qb2luKCc6Jyk7XG4gICAgdmFyIGlzQ2FjaGVFbmFibGVkID0gdHlwZW9mIGNhY2hlICE9PSAndW5kZWZpbmVkJztcbiAgICB2YXIgdG9rZW5zID0gaXNDYWNoZUVuYWJsZWQgPyBjYWNoZS5nZXQoY2FjaGVLZXkpIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKHRva2VucyA9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRva2VucyA9IHBhcnNlVGVtcGxhdGUodGVtcGxhdGUsIHRhZ3MpO1xuICAgICAgaXNDYWNoZUVuYWJsZWQgJiYgY2FjaGUuc2V0KGNhY2hlS2V5LCB0b2tlbnMpO1xuICAgIH1cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBIaWdoLWxldmVsIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHdpdGhcbiAgICogdGhlIGdpdmVuIGB2aWV3YC5cbiAgICpcbiAgICogVGhlIG9wdGlvbmFsIGBwYXJ0aWFsc2AgYXJndW1lbnQgbWF5IGJlIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgKiBuYW1lcyBhbmQgdGVtcGxhdGVzIG9mIHBhcnRpYWxzIHRoYXQgYXJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLiBJdCBtYXlcbiAgICogYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBsb2FkIHBhcnRpYWwgdGVtcGxhdGVzIG9uIHRoZSBmbHlcbiAgICogdGhhdCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudDogdGhlIG5hbWUgb2YgdGhlIHBhcnRpYWwuXG4gICAqXG4gICAqIElmIHRoZSBvcHRpb25hbCBgY29uZmlnYCBhcmd1bWVudCBpcyBnaXZlbiBoZXJlLCB0aGVuIGl0IHNob3VsZCBiZSBhblxuICAgKiBvYmplY3Qgd2l0aCBhIGB0YWdzYCBhdHRyaWJ1dGUgb3IgYW4gYGVzY2FwZWAgYXR0cmlidXRlIG9yIGJvdGguXG4gICAqIElmIGFuIGFycmF5IGlzIHBhc3NlZCwgdGhlbiBpdCB3aWxsIGJlIGludGVycHJldGVkIHRoZSBzYW1lIHdheSBhc1xuICAgKiBhIGB0YWdzYCBhdHRyaWJ1dGUgb24gYSBgY29uZmlnYCBvYmplY3QuXG4gICAqXG4gICAqIFRoZSBgdGFnc2AgYXR0cmlidXRlIG9mIGEgYGNvbmZpZ2Agb2JqZWN0IG11c3QgYmUgYW4gYXJyYXkgd2l0aCB0d29cbiAgICogc3RyaW5nIHZhbHVlczogdGhlIG9wZW5pbmcgYW5kIGNsb3NpbmcgdGFncyB1c2VkIGluIHRoZSB0ZW1wbGF0ZSAoZS5nLlxuICAgKiBbIFwiPCVcIiwgXCIlPlwiIF0pLiBUaGUgZGVmYXVsdCBpcyB0byBtdXN0YWNoZS50YWdzLlxuICAgKlxuICAgKiBUaGUgYGVzY2FwZWAgYXR0cmlidXRlIG9mIGEgYGNvbmZpZ2Agb2JqZWN0IG11c3QgYmUgYSBmdW5jdGlvbiB3aGljaFxuICAgKiBhY2NlcHRzIGEgc3RyaW5nIGFzIGlucHV0IGFuZCBvdXRwdXRzIGEgc2FmZWx5IGVzY2FwZWQgc3RyaW5nLlxuICAgKiBJZiBhbiBgZXNjYXBlYCBmdW5jdGlvbiBpcyBub3QgcHJvdmlkZWQsIHRoZW4gYW4gSFRNTC1zYWZlIHN0cmluZ1xuICAgKiBlc2NhcGluZyBmdW5jdGlvbiBpcyB1c2VkIGFzIHRoZSBkZWZhdWx0LlxuICAgKi9cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIgKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscywgY29uZmlnKSB7XG4gICAgdmFyIHRhZ3MgPSB0aGlzLmdldENvbmZpZ1RhZ3MoY29uZmlnKTtcbiAgICB2YXIgdG9rZW5zID0gdGhpcy5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gICAgdmFyIGNvbnRleHQgPSAodmlldyBpbnN0YW5jZW9mIENvbnRleHQpID8gdmlldyA6IG5ldyBDb250ZXh0KHZpZXcsIHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRva2VucywgY29udGV4dCwgcGFydGlhbHMsIHRlbXBsYXRlLCBjb25maWcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb3ctbGV2ZWwgbWV0aG9kIHRoYXQgcmVuZGVycyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgdXNpbmdcbiAgICogdGhlIGdpdmVuIGBjb250ZXh0YCBhbmQgYHBhcnRpYWxzYC5cbiAgICpcbiAgICogTm90ZTogVGhlIGBvcmlnaW5hbFRlbXBsYXRlYCBpcyBvbmx5IGV2ZXIgdXNlZCB0byBleHRyYWN0IHRoZSBwb3J0aW9uXG4gICAqIG9mIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSB0aGF0IHdhcyBjb250YWluZWQgaW4gYSBoaWdoZXItb3JkZXIgc2VjdGlvbi5cbiAgICogSWYgdGhlIHRlbXBsYXRlIGRvZXNuJ3QgdXNlIGhpZ2hlci1vcmRlciBzZWN0aW9ucywgdGhpcyBhcmd1bWVudCBtYXlcbiAgICogYmUgb21pdHRlZC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyVG9rZW5zID0gZnVuY3Rpb24gcmVuZGVyVG9rZW5zICh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpIHtcbiAgICB2YXIgYnVmZmVyID0gJyc7XG5cbiAgICB2YXIgdG9rZW4sIHN5bWJvbCwgdmFsdWU7XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgIHN5bWJvbCA9IHRva2VuWzBdO1xuXG4gICAgICBpZiAoc3ltYm9sID09PSAnIycpIHZhbHVlID0gdGhpcy5yZW5kZXJTZWN0aW9uKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ14nKSB2YWx1ZSA9IHRoaXMucmVuZGVySW52ZXJ0ZWQodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlLCBjb25maWcpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnPicpIHZhbHVlID0gdGhpcy5yZW5kZXJQYXJ0aWFsKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgY29uZmlnKTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJyYnKSB2YWx1ZSA9IHRoaXMudW5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnbmFtZScpIHZhbHVlID0gdGhpcy5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQsIGNvbmZpZyk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICd0ZXh0JykgdmFsdWUgPSB0aGlzLnJhd1ZhbHVlKHRva2VuKTtcblxuICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIGJ1ZmZlciArPSB2YWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyU2VjdGlvbiA9IGZ1bmN0aW9uIHJlbmRlclNlY3Rpb24gKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBidWZmZXIgPSAnJztcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcmVuZGVyIGFuIGFyYml0cmFyeSB0ZW1wbGF0ZVxuICAgIC8vIGluIHRoZSBjdXJyZW50IGNvbnRleHQgYnkgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLlxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlciAodGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBzZWxmLnJlbmRlcih0ZW1wbGF0ZSwgY29udGV4dCwgcGFydGlhbHMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuXG4gICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBmb3IgKHZhciBqID0gMCwgdmFsdWVMZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGogPCB2YWx1ZUxlbmd0aDsgKytqKSB7XG4gICAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlW2pdKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgYnVmZmVyICs9IHRoaXMucmVuZGVyVG9rZW5zKHRva2VuWzRdLCBjb250ZXh0LnB1c2godmFsdWUpLCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICBpZiAodHlwZW9mIG9yaWdpbmFsVGVtcGxhdGUgIT09ICdzdHJpbmcnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zIHdpdGhvdXQgdGhlIG9yaWdpbmFsIHRlbXBsYXRlJyk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHBvcnRpb24gb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgdGhlIHNlY3Rpb24gY29udGFpbnMuXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCBvcmlnaW5hbFRlbXBsYXRlLnNsaWNlKHRva2VuWzNdLCB0b2tlbls1XSksIHN1YlJlbmRlcik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZyk7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJJbnZlcnRlZCA9IGZ1bmN0aW9uIHJlbmRlckludmVydGVkICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUsIGNvbmZpZykge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcblxuICAgIC8vIFVzZSBKYXZhU2NyaXB0J3MgZGVmaW5pdGlvbiBvZiBmYWxzeS4gSW5jbHVkZSBlbXB0eSBhcnJheXMuXG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8xODZcbiAgICBpZiAoIXZhbHVlIHx8IChpc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApKVxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRva2VuWzRdLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSwgY29uZmlnKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLmluZGVudFBhcnRpYWwgPSBmdW5jdGlvbiBpbmRlbnRQYXJ0aWFsIChwYXJ0aWFsLCBpbmRlbnRhdGlvbiwgbGluZUhhc05vblNwYWNlKSB7XG4gICAgdmFyIGZpbHRlcmVkSW5kZW50YXRpb24gPSBpbmRlbnRhdGlvbi5yZXBsYWNlKC9bXiBcXHRdL2csICcnKTtcbiAgICB2YXIgcGFydGlhbEJ5TmwgPSBwYXJ0aWFsLnNwbGl0KCdcXG4nKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRpYWxCeU5sLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocGFydGlhbEJ5TmxbaV0ubGVuZ3RoICYmIChpID4gMCB8fCAhbGluZUhhc05vblNwYWNlKSkge1xuICAgICAgICBwYXJ0aWFsQnlObFtpXSA9IGZpbHRlcmVkSW5kZW50YXRpb24gKyBwYXJ0aWFsQnlObFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhcnRpYWxCeU5sLmpvaW4oJ1xcbicpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyUGFydGlhbCA9IGZ1bmN0aW9uIHJlbmRlclBhcnRpYWwgKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgY29uZmlnKSB7XG4gICAgaWYgKCFwYXJ0aWFscykgcmV0dXJuO1xuICAgIHZhciB0YWdzID0gdGhpcy5nZXRDb25maWdUYWdzKGNvbmZpZyk7XG5cbiAgICB2YXIgdmFsdWUgPSBpc0Z1bmN0aW9uKHBhcnRpYWxzKSA/IHBhcnRpYWxzKHRva2VuWzFdKSA6IHBhcnRpYWxzW3Rva2VuWzFdXTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgdmFyIGxpbmVIYXNOb25TcGFjZSA9IHRva2VuWzZdO1xuICAgICAgdmFyIHRhZ0luZGV4ID0gdG9rZW5bNV07XG4gICAgICB2YXIgaW5kZW50YXRpb24gPSB0b2tlbls0XTtcbiAgICAgIHZhciBpbmRlbnRlZFZhbHVlID0gdmFsdWU7XG4gICAgICBpZiAodGFnSW5kZXggPT0gMCAmJiBpbmRlbnRhdGlvbikge1xuICAgICAgICBpbmRlbnRlZFZhbHVlID0gdGhpcy5pbmRlbnRQYXJ0aWFsKHZhbHVlLCBpbmRlbnRhdGlvbiwgbGluZUhhc05vblNwYWNlKTtcbiAgICAgIH1cbiAgICAgIHZhciB0b2tlbnMgPSB0aGlzLnBhcnNlKGluZGVudGVkVmFsdWUsIHRhZ3MpO1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRva2VucywgY29udGV4dCwgcGFydGlhbHMsIGluZGVudGVkVmFsdWUsIGNvbmZpZyk7XG4gICAgfVxuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUudW5lc2NhcGVkVmFsdWUgPSBmdW5jdGlvbiB1bmVzY2FwZWRWYWx1ZSAodG9rZW4sIGNvbnRleHQpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpXG4gICAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5lc2NhcGVkVmFsdWUgPSBmdW5jdGlvbiBlc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0LCBjb25maWcpIHtcbiAgICB2YXIgZXNjYXBlID0gdGhpcy5nZXRDb25maWdFc2NhcGUoY29uZmlnKSB8fCBtdXN0YWNoZS5lc2NhcGU7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGVzY2FwZSA9PT0gbXVzdGFjaGUuZXNjYXBlKSA/IFN0cmluZyh2YWx1ZSkgOiBlc2NhcGUodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmF3VmFsdWUgPSBmdW5jdGlvbiByYXdWYWx1ZSAodG9rZW4pIHtcbiAgICByZXR1cm4gdG9rZW5bMV07XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5nZXRDb25maWdUYWdzID0gZnVuY3Rpb24gZ2V0Q29uZmlnVGFncyAoY29uZmlnKSB7XG4gICAgaWYgKGlzQXJyYXkoY29uZmlnKSkge1xuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG4gICAgZWxzZSBpZiAoY29uZmlnICYmIHR5cGVvZiBjb25maWcgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gY29uZmlnLnRhZ3M7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5nZXRDb25maWdFc2NhcGUgPSBmdW5jdGlvbiBnZXRDb25maWdFc2NhcGUgKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgdHlwZW9mIGNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIWlzQXJyYXkoY29uZmlnKSkge1xuICAgICAgcmV0dXJuIGNvbmZpZy5lc2NhcGU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gIH07XG5cbiAgdmFyIG11c3RhY2hlID0ge1xuICAgIG5hbWU6ICdtdXN0YWNoZS5qcycsXG4gICAgdmVyc2lvbjogJzQuMi4wJyxcbiAgICB0YWdzOiBbICd7eycsICd9fScgXSxcbiAgICBjbGVhckNhY2hlOiB1bmRlZmluZWQsXG4gICAgZXNjYXBlOiB1bmRlZmluZWQsXG4gICAgcGFyc2U6IHVuZGVmaW5lZCxcbiAgICByZW5kZXI6IHVuZGVmaW5lZCxcbiAgICBTY2FubmVyOiB1bmRlZmluZWQsXG4gICAgQ29udGV4dDogdW5kZWZpbmVkLFxuICAgIFdyaXRlcjogdW5kZWZpbmVkLFxuICAgIC8qKlxuICAgICAqIEFsbG93cyBhIHVzZXIgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgY2FjaGluZyBzdHJhdGVneSwgYnkgcHJvdmlkaW5nIGFuXG4gICAgICogb2JqZWN0IHdpdGggc2V0LCBnZXQgYW5kIGNsZWFyIG1ldGhvZHMuIFRoaXMgY2FuIGFsc28gYmUgdXNlZCB0byBkaXNhYmxlXG4gICAgICogdGhlIGNhY2hlIGJ5IHNldHRpbmcgaXQgdG8gdGhlIGxpdGVyYWwgYHVuZGVmaW5lZGAuXG4gICAgICovXG4gICAgc2V0IHRlbXBsYXRlQ2FjaGUgKGNhY2hlKSB7XG4gICAgICBkZWZhdWx0V3JpdGVyLnRlbXBsYXRlQ2FjaGUgPSBjYWNoZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGRlZmF1bHQgb3Igb3ZlcnJpZGRlbiBjYWNoaW5nIG9iamVjdCBmcm9tIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICAgKi9cbiAgICBnZXQgdGVtcGxhdGVDYWNoZSAoKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdFdyaXRlci50ZW1wbGF0ZUNhY2hlO1xuICAgIH1cbiAgfTtcblxuICAvLyBBbGwgaGlnaC1sZXZlbCBtdXN0YWNoZS4qIGZ1bmN0aW9ucyB1c2UgdGhpcyB3cml0ZXIuXG4gIHZhciBkZWZhdWx0V3JpdGVyID0gbmV3IFdyaXRlcigpO1xuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgbXVzdGFjaGUuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uIGNsZWFyQ2FjaGUgKCkge1xuICAgIHJldHVybiBkZWZhdWx0V3JpdGVyLmNsZWFyQ2FjaGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIHRlbXBsYXRlIGluIHRoZSBkZWZhdWx0IHdyaXRlciBhbmQgcmV0dXJucyB0aGVcbiAgICogYXJyYXkgb2YgdG9rZW5zIGl0IGNvbnRhaW5zLiBEb2luZyB0aGlzIGFoZWFkIG9mIHRpbWUgYXZvaWRzIHRoZSBuZWVkIHRvXG4gICAqIHBhcnNlIHRlbXBsYXRlcyBvbiB0aGUgZmx5IGFzIHRoZXkgYXJlIHJlbmRlcmVkLlxuICAgKi9cbiAgbXVzdGFjaGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbmRlcnMgdGhlIGB0ZW1wbGF0ZWAgd2l0aCB0aGUgZ2l2ZW4gYHZpZXdgLCBgcGFydGlhbHNgLCBhbmQgYGNvbmZpZ2BcbiAgICogdXNpbmcgdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgbXVzdGFjaGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMsIGNvbmZpZykge1xuICAgIGlmICh0eXBlb2YgdGVtcGxhdGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHRlbXBsYXRlISBUZW1wbGF0ZSBzaG91bGQgYmUgYSBcInN0cmluZ1wiICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnYnV0IFwiJyArIHR5cGVTdHIodGVtcGxhdGUpICsgJ1wiIHdhcyBnaXZlbiBhcyB0aGUgZmlyc3QgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdhcmd1bWVudCBmb3IgbXVzdGFjaGUjcmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyknKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5yZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzLCBjb25maWcpO1xuICB9O1xuXG4gIC8vIEV4cG9ydCB0aGUgZXNjYXBpbmcgZnVuY3Rpb24gc28gdGhhdCB0aGUgdXNlciBtYXkgb3ZlcnJpZGUgaXQuXG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMjQ0XG4gIG11c3RhY2hlLmVzY2FwZSA9IGVzY2FwZUh0bWw7XG5cbiAgLy8gRXhwb3J0IHRoZXNlIG1haW5seSBmb3IgdGVzdGluZywgYnV0IGFsc28gZm9yIGFkdmFuY2VkIHVzYWdlLlxuICBtdXN0YWNoZS5TY2FubmVyID0gU2Nhbm5lcjtcbiAgbXVzdGFjaGUuQ29udGV4dCA9IENvbnRleHQ7XG4gIG11c3RhY2hlLldyaXRlciA9IFdyaXRlcjtcblxuICByZXR1cm4gbXVzdGFjaGU7XG5cbn0pKSk7XG4iXX0=

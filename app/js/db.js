const { openDB } = require('idb');

const DB_NAME = 'sst_database';
const DB_VERSION = 8;
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
                db.createObjectStore(STORE_NAME, { keyPath: 'product_code' });
            }
            if (!db.objectStoreNames.contains("projects")) {
                const store = db.createObjectStore("projects", { keyPath: "uuid" });
                store.createIndex('owner_id', 'owner_id', { unique: false }); // Add owner_id index
            }
            if (!db.objectStoreNames.contains("locations")) {
                const store = db.createObjectStore("locations", { keyPath: "uuid" });
                store.createIndex("project_id_fk", "project_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false }); // Add owner_id index
            }
            if (!db.objectStoreNames.contains("buildings")) {
                const store = db.createObjectStore("buildings", { keyPath: "uuid" });
                store.createIndex("location_id_fk", "location_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false }); // Add owner_id index
            }
            if (!db.objectStoreNames.contains("floors")) {
                const store = db.createObjectStore("floors", { keyPath: "uuid" });
                store.createIndex("building_id_fk", "building_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false }); // Add owner_id index
            }
            if (!db.objectStoreNames.contains("rooms")) {
                const store = db.createObjectStore("rooms", { keyPath: "uuid" });
                store.createIndex("floor_id_fk", "floor_id_fk", { unique: false });
                store.createIndex('owner_id', 'owner_id', { unique: false }); // Add owner_id index
            }
            if (!db.objectStoreNames.contains("products")) {
                const store = db.createObjectStore("products", { keyPath: "uuid" });
                store.createIndex("room_id_fk", "room_id_fk", { unique: false });
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



async function syncData(owner_id) {

    const isEmpty = await isDatabaseEmpty();
    if (!isEmpty) {
        console.log('User data exists, skipping sync.');
        return (false);
    }

    const formData = new FormData();
    formData.append("user_id", owner_id); // Use the owner_id variable
    console.log('get userdata for user: ', owner_id);

    try {
        const response = await fetch("https://sst.tamlite.co.uk/api/get_all_user_data", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log("data from remote: ", data );
        const dbRequest = indexedDB.open(DB_NAME, DB_VERSION);
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(
                ["projects", "locations", "buildings", "floors", "rooms", "products"],
                "readwrite"
            );

            ["projects", "locations", "buildings", "floors", "rooms", "products"].forEach(
                (storeName) => {
                    const store = transaction.objectStore(storeName);
                    store.clear();  // Clear existing data

                    data[storeName].forEach(item => {
                        if (!item.id) {
                            console.error(`Missing ID in ${storeName}:`, item);
                        } else {
                            item.uuid = item.id;  // Map 'id' to 'uuid' for IndexedDB
                            item.owner_id = owner_id; // Add owner_id
                            delete item.id;        // Remove the original 'id' field to avoid conflicts
                            store.put(item);
                        }
                    });
                }
            );
            return(true);
            console.log("Data synced to IndexedDB successfully.");
        };
    } catch (error) {
        console.error("Data sync failed:", error);
    }
}

async function isProductsTableEmpty() {
    const db = await initDB();
    const count = await db.count(STORE_NAME);
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

async function getProducts() {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);    
    return await store.getAll();
}

async function getProjects() {
    const db = await initDB();
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    return await store.getAll();
}

async function getProjectHierarchy(owner_id, project_id) {
    console.log("Fetching from IndexedDB...");
    const db = await initDB();

    let projects = await db.getAllFromIndex('projects', 'owner_id', owner_id);
    console.log("Projects loaded:", projects);

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
    const index = store.index("room_id_fk"); // Assumes you have an index on room_id_fk
    return await index.getAll(roomId);
}

const saveProductToRoom = async (product) => {
    const db = await initDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    console.log("Adding product to room:", product);

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



// Export the functions
module.exports = {
    generateUUID, 
    initDB,
    fetchAndStoreProducts,
    getProducts,
    getProjects,
    syncData,
    saveProductToRoom
    // Add other database-related functions here
};

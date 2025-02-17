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
    if (!navigator.onLine) {
        console.log('Offline - using cached data');
        return false;
    }
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

async function getProjectStructure(projectId) {
    const hierarchy = await getProjectHierarchy(8, projectId); // assuming owner_id 8
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

// Export the functions
module.exports = {
    generateUUID, 
    initDB,
    fetchAndStoreProducts,
    getProducts,
    getProjects,
    syncData,
    saveProductToRoom,
    getProductsForRoom,
    deleteProductFromRoom,
    setSkuQtyForRoom,
    updateProductRef,
    getProjectStructure
    // Add other database-related functions here
};

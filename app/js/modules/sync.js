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

    async getUserData(product) {
        this.init();

        UIkit.notification({message: 'Data Sync Started ...', status: 'warning', pos: 'bottom-center', timeout: 1000 });
        utils.showSpin();
        
        $('#syncicon').addClass('active');

        const user_id = await utils.getCookie('user_id');

        await db.syncData(user_id);
        $('#syncicon').removeClass('active');        
        
        utils.hideSpin();

        UIkit.notification({message: 'Data Sync Complete ...', status: 'success', pos: 'bottom-center', timeout: 1000 });
    }


    async pushAllUserData() {
        this.init();

        UIkit.notification({message: 'Data Push Started ...', status: 'warning', pos: 'bottom-center', timeout: 1000 });
        utils.showSpin();
        
        $('#syncicon').addClass('active');

        const user_id = await utils.getCookie('user_id');

        await db.pushUserData(user_id);
        $('#syncicon').removeClass('active');        
        
        utils.hideSpin();

        UIkit.notification({message: 'Data Push Complete ...', status: 'success', pos: 'bottom-center', timeout: 1000 });

    }



}

module.exports = new SyncModule();
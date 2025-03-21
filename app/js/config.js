const CONFIG = {
    CACHE_NAME: 'sst-cache-v30',
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
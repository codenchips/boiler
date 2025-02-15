class UtilsModule {

    constructor() {
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        Mustache.tags = ["[[", "]]"];
        this.isInitialized = true;        
    }

    async showSpin() {
        $('#spinner').fadeIn('fast');
    }
    
    async hideSpin() {
        $('#spinner').fadeOut('fast');
    }
    

}
module.exports = new UtilsModule();
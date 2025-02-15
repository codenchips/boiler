class UtilsModule {

    constructor() {
        this.isInitialized = false;   
        
        this.iconPlus = function(cell, formatterParams, onRendered) {
            return '<i class="fa-solid fa-circle-plus"></i>';
        };
        this.iconMinus = function(cell, formatterParams, onRendered) {
            return '<i class="fa-solid fa-circle-minus"></i>';
        };
        this.iconX = function(cell, formatterParams, onRendered) {
            return '<span class="icon red" uk-icon="icon: trash; ratio: 1.3" title="Delete this project"></span>';
        };        
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

    async formatDateTime (date) {
        const pad = (num) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    

}
module.exports = new UtilsModule();
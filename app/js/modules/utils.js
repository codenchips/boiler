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
            console.log('Login submitted');
            const form = document.querySelector("#form-login");            
            const user = await db.loginUser(new FormData(form));            
            
            if (user !== false) {
                $('#m_user_id').val(user.uuid);
                await that.setCookie('user_id', user.uuid);;
                await that.setCookie('user_name', user.name);
                UIkit.modal($('#login')).hide();
                window.location.replace("/");
                //updateDashTable();
            } else {
                $('.login-error p').html("There was an error logging in. Please try again.");
                $('.login-error').show();
            }
    
        });
    
        $('#logout').off('click').on('click', function(e) {
            e.preventDefault();
            deleteCookie('user_id');
            deleteCookie('user_name');
            window.open("/?t="+makeid(10), '_self');
        });
    }

    async deleteCookie( name, path, domain ) {
        if( getCookie( name ) ) {
            document.cookie = name + "=" +
                ((path) ? ";path="+path:"")+
                ((domain)?";domain="+domain:"") +
                ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
        }
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

    async deleteCookie( name, path, domain ) {
        if( getCookie( name ) ) {
            document.cookie = name + "=" +
                ((path) ? ";path="+path:"")+
                ((domain)?";domain="+domain:"") +
                ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
        }
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
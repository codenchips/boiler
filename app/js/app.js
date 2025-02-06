$(document).ready(function() {
    const Mustache = require('mustache');
    
    function renderHello() {        
        const template = $('#template');       
        const templateContent = template.html();
        const data = { name: 'Dean' };
        const rendered = Mustache.render(templateContent, data);       
        $('#target').html(rendered);
    }
    renderHello();
});
$(document).ready(function() {
    const Mustache = require('mustache');
    
    function renderHello() {
        console.log('render hello 5');
        const template = $('#template');       
        const templateContent = template.html();
        const data = { name: 'Dean' };
        const rendered = Mustache.render(templateContent, data);       
        $('#target').html(rendered);
    }
    renderHello();
});
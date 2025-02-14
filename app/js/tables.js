async function tablesFunctions() {
    console.log('Running tables functions');
    
    // Initial load of types for default brand
    await updateTypesDropdown('1');

    // Handle brand changes
    $('#form_brand').on('change', async function() {
        const selectedBrand = $(this).val();
        console.log('Brand changed:', selectedBrand);
        await updateTypesDropdown(selectedBrand);
    });
}

async function updateTypesDropdown(brand) {
    const types = await getTypesForBrand(brand);
    renderTypesDropdown(types);
}

async function getTypesForBrand(brand) {
    const products = await db.getProducts();
    return products
        .filter(product => product.site === brand)
        .reduce((acc, product) => {
            if (!acc.some(item => item.type_slug === product.type_slug)) {
                acc.push({ 
                    type_slug: product.type_slug, 
                    type_name: product.type_name 
                });
            }
            return acc;
        }, [])
        .sort((a, b) => a.type_name.localeCompare(b.type_name));
}

function renderTypesDropdown(types) {
    const template = `
        <option value="">Select Type...</option>
        {{#types}}
        <option value="{{type_slug}}">{{type_name}}</option>
        {{/types}}
    `;
    
    const rendered = Mustache.render(template, { types });
    $('#form_type').html(rendered);
}
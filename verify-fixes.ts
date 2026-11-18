const BASE_URL = 'http://localhost:3000/api/guilds/1490619387869139108';

async function testEndpoints() {

    console.log('\n--- Testing Store API ---');
    try {
        const storeItemsRes = await fetch(`${BASE_URL}/store`);
        const storeItems = await storeItemsRes.json();
        console.log('GET /store:', storeItems);

        const newItemRes = await fetch(`${BASE_URL}/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Item',
                description: 'API verification item',
                price: 50,
                icon: '🧪'
            })
        });
        const newItem = await newItemRes.json();
        console.log('POST /store (create):', newItem);

        if (newItem.id) {
            await fetch(`${BASE_URL}/store/${newItem.id}`, { method: 'DELETE' });
            console.log('DELETE /store (cleanup): Success');
        }
    } catch (err) {
        console.error('Store API Error:', err.message);
    }
}

testEndpoints();

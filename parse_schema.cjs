const fs = require('fs');

async function main() {
    console.log('Script started...');
    const url = 'https://jndlmfxjaujjmksbacaz.supabase.co/rest/v1/';
    const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZGxtZnhqYXVqam1rc2JhY2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMTA5OTAsImV4cCI6MjA4Mzc4Njk5MH0.6I6QOI5ub_B4_gPFPYDzn76DpTnurB3f3ZWz2aJhx7w';

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': apikey,
                'Authorization': `Bearer ${apikey}`
            }
        });
        const data = await response.json();

        console.log('--- SUPABASE TABLES ---');
        const definitions = data.definitions;
        for (const tableName in definitions) {
            console.log(`Table: ${tableName}`);
            const properties = definitions[tableName].properties;
            for (const prop in properties) {
                console.log(`  - ${prop}: ${properties[prop].type || properties[prop].format}`);
            }
            console.log('---');
        }
    } catch (error) {
        console.error('Error fetching or parsing schema:', error);
    }
}

main();

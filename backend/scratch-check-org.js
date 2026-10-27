const fs = require('fs');
const cache = JSON.parse(fs.readFileSync('data/firestore_cache.json', 'utf8'));
console.log('Org configs:', Object.keys(cache.organizations || {}));
console.log('MGH Dominicana SRL:', cache.organizations ? cache.organizations['MGH Dominicana SRL'] : null);

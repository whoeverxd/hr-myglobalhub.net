const fs = require('fs');
const cache = JSON.parse(fs.readFileSync('data/firestore_cache.json', 'utf8'));
console.log('User keys:', Object.keys(cache.users || {}));
const zain = Object.values(cache.users || {}).find(u => u.email && u.email.includes('zain'));
console.log('Zain user:', zain);

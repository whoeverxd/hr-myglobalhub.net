const fs = require('fs');
const cache = JSON.parse(fs.readFileSync('data/firestore_cache.json', 'utf8'));

let fixed = 0;
for (const [userId, user] of Object.entries(cache.users || {})) {
  for (const [prop, val] of Object.entries(user)) {
    if (typeof val === 'string' && val.includes('COALESCE(')) {
      console.log(`Corrupted field in user ${userId}: ${prop} = "${val}"`);
      // Restore based on user id/email
      if (userId === 'usr-zain') {
        user.role = 'contractor';
        user.name = 'Zain Rondon';
        user.employee_id = 'MGH-1043';
        user.entity = 'MGH Dominicana SRL';
        user.avatar = null;
        fixed++;
        break;
      }
    }
  }
}

if (fixed > 0) {
  fs.writeFileSync('data/firestore_cache.json', JSON.stringify(cache, null, 2), 'utf8');
  console.log(`Fixed ${fixed} users in cache.`);
} else {
  console.log('No corrupted users found.');
}

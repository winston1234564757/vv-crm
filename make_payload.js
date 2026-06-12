const fs = require('fs');
const schema = fs.readFileSync('supabase/migrations/20260608150000_full_schema.sql', 'utf8');
const query = schema + "\n\nINSERT INTO profiles (id, full_name, role, created_at) VALUES ('7342c166-84e8-4aa9-a956-7c2b6cd0c08b', 'viktor.koshel24@gmail.com', 'sales', '2026-06-08 06:34:56.95909+00');";
const payload = { name: '20260608150000_full_schema', query: query, project_id: 'oihiryfvnsxdchwymbge' };
fs.writeFileSync('apply_payload.json', JSON.stringify(payload, null, 2));
console.log('Written payload.');

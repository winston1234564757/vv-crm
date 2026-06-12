import { writeFileSync } from 'fs';

const url = 'https://oihiryfvnsxdchwymbge.supabase.co/rest/v1/';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9paGlyeWZ2bnN4ZGNod3ltYmdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MzE0OSwiZXhwIjoyMDk2NDI5MTQ5fQ.5oaDlsN_w3ewRavntgD6JZuXeCToilObb5WqqL6JdgE';

async function fetchSchema() {
  console.log('Fetching database OpenAPI schema...');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    const schema = await res.json();
    writeFileSync('schema.json', JSON.stringify(schema, null, 2), 'utf8');
    console.log('✅ Schema fetched and saved to schema.json');
  } catch (error) {
    console.error('❌ Failed to fetch schema:', error);
  }
}

fetchSchema();

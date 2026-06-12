const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Ручне парсення .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    // Прибираємо лапки, якщо вони є
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Connecting to Supabase:', supabaseUrl);
  
  // 1. Спробуємо зробити select колонки repair_status
  console.log('Checking "repair_status" and "repair_parts_replaced" columns in "devices" table...');
  const { data: devicesData, error: devicesError } = await supabase
    .from('devices')
    .select('id, needs_repair, repair_status, repair_parts_replaced')
    .limit(1);

  if (devicesError) {
    console.error('Error selecting from devices:', devicesError);
  } else {
    console.log('Devices table columns exist! Sample data:', devicesData);
  }

  // 2. Спробуємо зробити select колонки origin_type
  console.log('Checking "origin_type" column in "parts" table...');
  const { data: partsData, error: partsError } = await supabase
    .from('parts')
    .select('id, name, origin_type')
    .limit(1);

  if (partsError) {
    console.error('Error selecting from parts:', partsError);
  } else {
    console.log('Parts table origin_type column exists! Sample data:', partsData);
  }
}

check().catch(console.error);

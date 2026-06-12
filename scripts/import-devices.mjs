import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Ініціалізація клієнта Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Помилка: NEXT_PUBLIC_SUPABASE_URL та SUPABASE_SERVICE_ROLE_KEY мають бути встановлені у .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. Допоміжні функції
function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    result.push(fields);
  }
  return result;
}

function parseNumber(val) {
  if (!val) return 0;
  const clean = val.replace(/"/g, "").replace(",", ".").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseModel(modelStr) {
  if (!modelStr) return { brand: "Інше", model: "Невідомо", storage: null };

  let name = modelStr.replace(/"/g, "").trim();

  // Шукаємо конструкцію об'єму пам'яті (наприклад: 4/128, 4/64, 4/127)
  const storageMatch = name.match(/(\d+\/\d+)/);
  let storage = null;
  if (storageMatch) {
    storage = storageMatch[1];
    name = name.replace(storageMatch[0], "").trim();
  }

  // Виділяємо бренд (перше слово) та модель (все інше)
  const parts = name.split(/\s+/);
  const brand = parts[0];
  const model = parts.slice(1).join(" ").trim() || name;

  return { brand, model, storage };
}

// 3. Зчитування та парсинг файлу
const csvPath = "C:\\Users\\Vitossik\\Downloads\\Мобілки - Лист1.csv";
console.log(`Зчитування файлу: ${csvPath}...`);

try {
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(fileContent);

  const devicesToInsert = rows.map((row, idx) => {
    const rawName = row[0];
    const { brand, model, storage } = parseModel(rawName);
    
    const purchasePrice = parseNumber(row[1]);
    const deliveryCost = parseNumber(row[2]);
    const repairCost = parseNumber(row[3]);
    
    // Собівартість
    let costPrice = parseNumber(row[4]);
    if (costPrice === 0) {
      costPrice = purchasePrice + deliveryCost + repairCost;
    }
    
    // Ціна продажу
    const sellPrice = parseNumber(row[5]);
    
    // Визначення статусу
    const rawStatus = row[7]?.toLowerCase() || "";
    let status = "in_stock";
    if (rawStatus.includes("продано")) {
      status = "sold";
    } else if (rawStatus.includes("в дорозі")) {
      status = "transit";
    } else if (rawStatus.includes("у продажу")) {
      status = "in_stock";
    }
    
    // Формування нотатки про ремонт / доставку, якщо були додаткові витрати
    let notes = "";
    if (rawStatus.includes("в дорозі")) {
      notes = "В дорозі. ";
    }
    if (deliveryCost > 0 || repairCost > 0) {
      notes += `Імпорт: Купівля=${purchasePrice}, Доставка=${deliveryCost}, Ремонт=${repairCost}.`;
    }
    notes = notes.trim() || null;

    return {
      type: "phone",
      brand,
      model,
      storage,
      cost_price: costPrice,
      price: sellPrice,
      status,
      notes,
      warranty_months: 12,
      is_visible: true,
      needs_repair: repairCost > 0,
      repair_cost: repairCost
    };
  });

  console.log(`Підготовлено ${devicesToInsert.length} записів для імпорту.`);

  // 4. Вставка в базу даних Supabase
  console.log("Завантаження в базу даних Supabase...");
  const { data, error } = await supabase
    .from("devices")
    .insert(devicesToInsert)
    .select("id, brand, model, status");

  if (error) {
    throw error;
  }

  console.log("✅ Успішно імпортовано!");
  console.log("Деталі імпорту:");
  data.forEach((d, i) => {
    console.log(`- [#${i+1}] ${d.brand} ${d.model} | Статус: ${d.status} | ID: ${d.id}`);
  });

} catch (err) {
  console.error("❌ Помилка під час імпорту:", err);
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Шукаємо категорію 'Закупівля техніки'...");
  let { data: cat } = await supabase.from('expense_categories').select('*').ilike('name', 'Закупівля техніки').maybeSingle();
  
  if (!cat) {
    console.log("Категорії немає. Створюємо...");
    const { data: newCat, error: errCat } = await supabase
      .from('expense_categories')
      .insert({ name: 'Закупівля техніки', description: 'Витрати на закупівлю пристроїв' })
      .select()
      .single();
      
    if (errCat) {
      console.error("Помилка створення категорії:", errCat);
      return;
    }
    cat = newCat;
    console.log("✅ Створено нову категорію:", cat.name);
  } else {
    console.log("✅ Категорію знайдено:", cat.name);
  }

  console.log("Шукаємо транзакцію 9e2830da...");
  const { data: tx, error: errTx } = await supabase
    .from('transactions')
    .select('*')
    .ilike('id', '9e2830da%')
    .single();
  
  if (errTx || !tx) {
    console.error("❌ Транзакцію не знайдено:", errTx);
    return;
  }
  console.log("✅ Транзакцію знайдено. Сума:", tx.amount, "Опис:", tx.description);
  
  let expenseId = tx.reference_id;
  
  if (!expenseId || tx.reference_type !== 'expense') {
     console.log("Транзакція не має прямого зв'язку з витратою, шукаємо витрату за описом або сумою...");
     // Спробуємо знайти через expenses по сумі і даті
     const { data: exp, error: errExp } = await supabase
        .from('expenses')
        .select('*')
        .eq('amount', 3500)
        .ilike('description', '%Tecno%')
        .maybeSingle();
        
     if (exp) {
        expenseId = exp.id;
     } else {
        console.error("❌ Не вдалося знайти відповідну витрату в таблиці expenses");
        return;
     }
  }

  console.log("Оновлюємо витрату...");
  const { data: updatedExp, error: errUpdate } = await supabase
    .from('expenses')
    .update({ category_id: cat.id })
    .eq('id', expenseId)
    .select()
    .single();
  
  if (errUpdate) {
     console.error("❌ Помилка оновлення витрати:", errUpdate);
     return;
  }
  
  console.log("🎉 Успішно оновлено витрату! Вона тепер в категорії 'Закупівля техніки'.");
}

run();

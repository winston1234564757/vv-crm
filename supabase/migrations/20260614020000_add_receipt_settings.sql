-- 20260614020000_add_receipt_settings.sql
-- Add default receipt settings configurations

INSERT INTO public.settings (key, value, description)
VALUES (
  'receipt_settings',
  '{
    "company_name": "VV CRM",
    "company_subtitle": "Магазин та сервісний центр",
    "address": "м. Київ, вул. Хрещатик 1",
    "phone": "+380 99 999 9999",
    "footer_text": "Дякуємо за покупку! Чекаємо Вас знову!",
    "templates": {
      "sale": {
        "title": "ТОВАРНИЙ ЧЕК",
        "show_seller": true,
        "show_buyer": true,
        "warranty_text": "При виявленні несправностей протягом гарантійного періоду товар приймається на діагностику за наявності цього чеку та оригінальної упаковки. Гарантія анулюється при виявленні слідів механічних пошкоджень, вологи або самостійного розкриття пристрою.",
        "show_qr": true
      },
      "repair_acceptance": {
        "title": "КВИТАНЦІЯ ПРИЙМАННЯ",
        "show_seller": true,
        "show_buyer": true,
        "warranty_text": "1. Безкоштовне зберігання готового пристрою - до 14 днів.\n2. СЦ не несе відповідальності за збереження даних на пристрої.\n3. Пристрій приймається без гарантії на інші несправності.",
        "show_qr": true
      },
      "repair_warranty": {
        "title": "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ",
        "show_seller": true,
        "show_buyer": true,
        "warranty_text": "Гарантія поширюється виключно на замінені деталі та виконані роботи. При виявленні слідів вологи, механічних пошкоджень або стороннього втручання гарантія анулюється.",
        "show_qr": true
      }
    }
  }'::jsonb,
  'Налаштування шаблонів чеків та квитанцій'
)
ON CONFLICT (key) DO NOTHING;

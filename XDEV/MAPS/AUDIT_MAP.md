# VV CRM — Глобальна Мапа Системи та Аудиту

Цей документ містить оновлений реєстр усіх сторінок, функціоналу, баз даних та серверних дій додатку **VV CRM**. Він слугуватиме нашою робочою картою для покрокового аудиту та виправлення недоліків.

---

## 🗺️ 1. Реєстр сторінок та роутів (Page Registry)

### 🔓 Блок 1. Авторизація та Базовий Роутинг (Auth & Proxy Guard)
* **Роути:**
  * `/login` — Сторінка авторизації працівників та власника.
  * `/auth/callback` — Тимчасовий обробник OAuth/сервісних сесій.
* **Критичні файли:**
  * `src/app/login/page.tsx`
  * `src/proxy.ts` / `src/middleware.ts` — Основні фільтри роутингу.
* **Функціонал:** Supabase Auth, перевірка сесій, захист роутів за ролями (Role-based RLS).

### 📦 Блок 2. Публічний Трекер Ремонтів (Public Status Tracker)
* **Роути:**
  * `/track/[token]` — Перегляд стану пристрою клієнтом без авторизації.
* **Критичні файли:**
  * `src/app/track/[token]/page.tsx`
* **Функціонал:**
  * Перегляд статусів (Прийнято, Діагностика, В роботі, Готово).
  * Перегляд фото стану пристрою при прийомі.
  * Перегляд номерів ТТН Нової Пошти, прямий зв'язок з СЦ через Viber/Telegram/Телефон.

### 📊 Блок 3. Головний Дашборд (Admin Dashboard Analytics)
* **Роути:**
  * `/admin` — Головний екран аналітики.
* **Критичні файли:**
  * `src/app/admin/page.tsx` — Серверний loader.
  * `src/app/admin/DashboardClient.tsx` — Клієнтська візуалізація.
* **Функціонал:** Оборот, чистий прибуток, активні ремонти, швидка аналітика кас та залишків.

### 🔧 Блок 4. Модуль Ремонтів (Repairs Module)
* **Роути:**
  * `/admin/repairs` — Робоча область ремонтів.
* **Критичні файли:**
  * `src/app/admin/repairs/page.tsx`
  * `src/app/admin/repairs/table.tsx` — Табличний вигляд ремонтів.
  * `src/app/admin/repairs/RepairsKanban.tsx` — Kanban дошка за етапами.
  * `src/components/forms/EditRepairForm.tsx` — Форма редагування та списання деталей.
  * `src/lib/actions/repairs.ts` — Server Actions ремонтів.
* **Функціонал:** Створення та редагування ремонтів, прив'язка запчастин, синхронізація з IMEI пристроїв, інтеграція з Telegram API для сповіщень.

### 🛍️ Блок 5. Продажі & Bento POS (Sales & POS Terminal)
* **Роути:**
  * `/admin/sales` — Журнал та історія всіх продажів.
  * `/admin/sales/pos` — Візуальний мультитоварний термінал продажу.
* **Критичні файли:**
  * `src/app/admin/sales/page.tsx`
  * `src/app/admin/sales/pos/page.tsx`
  * `src/app/admin/sales/pos/POSClient.tsx`
  * `src/lib/actions/sales.ts` — Server Actions продажів.
* **Функціонал:** Мультитоварний кошик (девайси, аксесуари, послуги), split-оплата (каси), розрахунок прибутку з урахуванням собівартості.

### 📱 Блок 6. Складський Облік (Inventory Management)
* **Роути:**
  * `/admin/devices` — Облік одиничних пристроїв (IMEI/серійний номер).
  * `/admin/accessories` — Кількісний облік аксесуарів (чохли, кабелі).
  * `/admin/parts` — Облік деталей для ремонтів.
* **Критичні файли:**
  * `src/app/admin/devices/page.tsx`
  * `src/app/admin/accessories/page.tsx`
  * `src/app/admin/parts/page.tsx`
  * `src/lib/actions/inventory.ts`
  * `src/lib/actions/parts.ts`
* **Функціонал:** Контроль залишків, оприбуткування стіку, сумісність з моделями, списання.

### 💳 Блок 7. Финанси & Каси (Finance & Cash registers)
* **Роути:**
  * `/admin/finance` — Журнал балансів та сейфів.
* **Критичні файли:**
  * `src/app/admin/finance/page.tsx`
  * `src/app/admin/finance/ReconciliationBench.tsx` — Інструмент звірки каси.
  * `src/lib/actions/finance.ts`
* **Функціонал:** Касові ордери (дохід/витрата), перекази між касами, баланси (готівка/термінал).

### 🤝 Блок 8. Контрагенти & Закупівлі (Suppliers, Customers, Partners, Purchases)
* **Роути:**
  * `/admin/purchases` — Оприбуткування поставок.
  * `/admin/suppliers` — База постачальників.
  * `/admin/customers` — База клієнтів СЦ (VIP-рівні, знижки).
  * `/admin/partners` — Партнерська мережа (промокоди, відкати за рекомендації).
* **Критичні файли:**
  * `src/app/admin/purchases/page.tsx`
  * `src/lib/actions/purchases.ts`
  * `src/lib/actions/customers.ts`
  * `src/lib/actions/partners.ts`

### ⚙️ Блок 9. Налаштування та Послуги (Settings & Services Catalog)
* **Роути:**
  * `/admin/settings` — Налаштування фірми, шаблони чеків.
  * `/admin/services` — Прайс-лист послуг.
* **Критичні файли:**
  * `src/app/admin/settings/page.tsx`
  * `src/components/SettingsClient.tsx`
  * `src/lib/actions/settings.ts`

---

## 🛠️ 2. План Покрокового Аудиту (Step-by-Step Audit Plan)

Кожен блок буде проаналізовано за такими напрямками:
1. **DB / RLS Layer:** Перевірка прав та політик безпеки Supabase RLS.
2. **Data Pipeline Layer:** Оцінка N+1 запитів, Server Actions та бізнес-логіки.
3. **UX/UI Layer:** Консистентність інтерфейсу, micro-animations, mobile responsiveness.

### 📋 Черга перевірки та статус:

- [x] **Блок 1: Auth & Proxy Routing**
  - *Результат:* Перевірено. Авторизація працює через `proxy.ts` та `middleware.ts`. Налаштовано коректні RLS.
- [x] **Блок 2: Public Tracker (`/track/[token]`)**
  - *Результат:* Вирішено проблеми U7 та U8 (відображення гарантії, контактів СЦ).
- [x] **Блок 3: Головний Дашборд (`/admin`)**
  - *Результат:* Виправлено дублювання активних ремонтів (баг M5). Додано Bento-блок балансів кас на дашборді. Виправлено розрахунок Net Profit (баг M10) на основі COGS та маржі ремонтів.
- [ ] **Блок 4: Ремонти (`/admin/repairs`)**
  - *Фокус:* Оцінка estimated completion dates, списання запчастин, Kanban-дошка ремонтів, RLS.
- [ ] **Блок 5: Продажі & Bento POS (`/admin/sales`)**
  - *Фокус:* Race conditions при продажах, мультитоварність, split-оплата, `sale_items.unit_cost` інтеграція.
- [ ] **Блок 6: Складський Облік (`/admin/devices`, `/admin/accessories`, `/admin/parts`)**
  - *Фокус:* Списання стіку, контроль `min_stock`, IMEI картки пристроїв.
- [ ] **Блок 7: Фінанси & Каси (`/admin/finance`)**
  - *Фокус:* Звірка балансів, касові ордери, уникнення N+1.
- [ ] **Блок 8: Контрагенти & Закупівлі**
  - *Фокус:* Промокоди, VIP-рівні клієнтів, розкриття позицій закупівлі.
- [ ] **Блок 9: Налаштування & Послуги**
  - *Фокус:* Спліт великих компонентів (SettingsClient), редагування шаблонів чеків.

const TELEGRAM_API_URL = "https://api.telegram.org";

const statusLabels: Record<string, string> = {
  pending: "Прийнято в ремонт",
  diagnosing: "Діагностика",
  waiting_parts: "Очікування запчастин",
  repairing: "Ремонтується",
  ready: "Готовий до видачі",
  completed: "Виконано",
  handed_over: "Видано клієнту",
  cancelled: "Скасовано",
};

/**
 * Escapes HTML characters in user-supplied strings to prevent XSS/injection in Telegram HTML parse mode.
 */
export function escHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sends a telegram message with HTML parse_mode enabled.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: unknown
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN не налаштовано в оточенні.");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Telegram API error: ${response.status} - ${err}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Помилка відправки Telegram повідомлення:", error);
    return false;
  }
}

/**
 * Sends a status update notification to the customer.
 */
export async function notifyCustomerRepairUpdate(
  telegramId: string,
  trackingToken: string,
  deviceName: string,
  status: string,
  price: number
): Promise<boolean> {
  const statusLabel = statusLabels[status] || status;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vv-crm.vercel.app";
  
  const text = [
    `<b>Оновлення статусу вашого ремонту 🛠</b>\n`,
    `<b>Пристрій:</b> ${escHtml(deviceName)}`,
    `<b>Новий статус:</b> <code>${escHtml(statusLabel)}</code>`,
    price > 0 ? `<b>Вартість:</b> <code>${price.toLocaleString()} грн</code>` : "",
    `\nВи можете переглянути детальну історію за посиланням нижче:`,
  ]
    .filter(Boolean)
    .join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "🔗 Відстежити статус ремонту",
          url: `${appUrl}/track/${trackingToken}`,
        },
      ],
    ],
  };

  return sendTelegramMessage(telegramId, text, replyMarkup);
}

/**
 * Sends a notification to the internal staff chat about a new repair order.
 */
export async function notifyStaffNewRepair(
  repairId: string,
  deviceName: string,
  issue: string,
  customerName: string
): Promise<boolean> {
  const staffChatId = process.env.TELEGRAM_STAFF_CHAT_ID;
  if (!staffChatId) return false;

  const text = [
    `<b>🆕 Нова заявка на ремонт!</b>\n`,
    `<b>Код:</b> <code>${escHtml(repairId.substring(0, 8))}</code>`,
    `<b>Пристрій:</b> ${escHtml(deviceName)}`,
    `<b>Несправність:</b> ${escHtml(issue)}`,
    `<b>Клієнт:</b> ${escHtml(customerName)}`,
  ].join("\n");

  return sendTelegramMessage(staffChatId, text);
}

/**
 * Sends a notification to the internal staff chat about low parts stock.
 */
export async function notifyStaffLowStock(
  itemName: string,
  currentStock: number,
  isUrgent: boolean
): Promise<boolean> {
  const staffChatId = process.env.TELEGRAM_STAFF_CHAT_ID;
  if (!staffChatId) return false;

  const text = [
    isUrgent ? `<b>🚨 КРИТИЧНИЙ ЗАПАС ДЕТАЛЕЙ! 🚨</b>` : `<b>⚠️ Низький запас деталей</b>`,
    `\n<b>Позиція:</b> <code>${escHtml(itemName)}</code>`,
    `<b>Залишилось на складі:</b> <code style="color: red;">${currentStock} шт</code>`,
  ].join("\n");

  return sendTelegramMessage(staffChatId, text);
}

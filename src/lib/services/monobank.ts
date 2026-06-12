const MONO_API_URL = "https://api.monobank.ua";

export type MonobankAccount = {
  id: string;
  sendId: string;
  balance: number;
  creditLimit: number;
  type: string;
  currencyCode: number;
  cashbackType: string;
  iban: string;
};

export type MonobankTransaction = {
  id: string;
  time: number;
  description: string;
  mcc: number;
  amount: number; // in kopecks (e.g. 10000 = 100.00 UAH)
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  cashbackAmount: number;
  balance: number;
  hold: boolean;
  comment?: string;
  receiptId?: string;
};

export async function getMonobankClientInfo() {
  const token = process.env.MONOBANK_PERSONAL_TOKEN;
  if (!token) throw new Error("MONOBANK_PERSONAL_TOKEN не знайдено в оточенні");

  const response = await fetch(`${MONO_API_URL}/personal/client-info`, {
    headers: {
      "X-Token": token,
    },
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 60 }, // Cache info for 60 seconds
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Помилка Monobank ClientInfo API: ${response.status} - ${err}`);
  }

  return response.json();
}

export async function getMonobankStatement(from: number, to?: number): Promise<MonobankTransaction[]> {
  const token = process.env.MONOBANK_PERSONAL_TOKEN;
  if (!token) return [];

  try {
    let accountId = process.env.MONOBANK_ACCOUNT_ID;

    // If no account ID is defined, auto-discover the first UAH account
    if (!accountId) {
      const clientInfo = await getMonobankClientInfo();
      const uahAccount = (clientInfo.accounts as MonobankAccount[]).find(
        (acc) => acc.currencyCode === 980 // UAH code
      );
      if (!uahAccount) throw new Error("Гривневий рахунок у Monobank не знайдено");
      accountId = uahAccount.id;
    }

    const toParam = to ? `/${to}` : "";
    const url = `${MONO_API_URL}/personal/statement/${accountId}/${from}${toParam}`;

    const response = await fetch(url, {
      headers: {
        "X-Token": token,
      },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 30 }, // Cache statement requests briefly to stay under rate limits
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("Monobank API rate limited (1 req/60s). Returning empty list.");
        return [];
      }
      const err = await response.text();
      console.error(`Monobank Statement API error: ${response.status} - ${err}`);
      return [];
    }

    return response.json();
  } catch (error) {
    console.error("Помилка під час отримання виписки Monobank:", error);
    return [];
  }
}

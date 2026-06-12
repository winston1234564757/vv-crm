const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";

export type TrackingStatus = {
  Number: string;
  Status: string;
  StatusCode: string;
  WarehouseRecipient: string;
  ActualDeliveryDate: string;
  ScheduledDeliveryDate: string;
  CityRecipient: string;
  RecipientAddress: string;
  PhoneSender: string;
  PhoneRecipient: string;
} | null;

export async function trackTTN(ttn: string): Promise<TrackingStatus> {
  if (!process.env.NOVA_POSHTA_API_KEY) return null;

  try {
    const response = await fetch(NP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: { Documents: [{ DocumentNumber: ttn }] },
      }),
    });
    const json = await response.json();
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

import { z } from "zod";

export class HttpClient {
  constructor(private readonly timeoutMs: number) {}

  async postJson<T = unknown>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

const optionalText = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}, z.string().optional());

const optionalPaymentMethod = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}, z.enum(["bank_transfer", "cod"]).optional());

const classifySchema = z.object({
  intent: z.enum(["catalog_list", "catalog_get", "faq", "order_get", "order_create", "payment_help", "smalltalk"]),
  sku: optionalText,
  orderCode: optionalText,
  query: optionalText,
  paymentMethod: optionalPaymentMethod,
});

export type ClassifyResult = z.infer<typeof classifySchema>;

export function parseClassifierJson(raw: string): ClassifyResult {
  const parsed = JSON.parse(raw);
  return classifySchema.parse(parsed);
}

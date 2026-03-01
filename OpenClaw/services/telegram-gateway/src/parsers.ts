export function getArgs(text: string): string {
  const chunks = text.split(" ");
  return chunks.slice(1).join(" ").trim();
}

export function parseOrderCommand(raw: string, telegramId: string): { ok: true; data: any } | { ok: false } {
  const chunks = raw.split("|").map((item) => item.trim());
  if (chunks.length < 4) {
    return { ok: false };
  }

  const items = chunks[0]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [sku, qtyRaw] = item.split(":").map((part) => part.trim());
      return { sku: sku.toUpperCase(), qty: Number(qtyRaw) };
    })
    .filter((item) => item.sku && Number.isInteger(item.qty) && item.qty > 0);

  if (!items.length) {
    return { ok: false };
  }

  const paymentMethod = chunks[4]?.toLowerCase() === "cod" ? "cod" : "bank_transfer";

  return {
    ok: true,
    data: {
      customer: {
        telegramId,
        name: chunks[1],
        phone: chunks[2],
        address: chunks[3],
      },
      items,
      payment_method: paymentMethod,
    },
  };
}

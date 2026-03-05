export const ORDER_STATUSES = [
  "new",
  "awaiting_payment",
  "payment_review",
  "paid",
  "shipping",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ProductFaq {
  q: string;
  a: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  imageUrl?: string;
  priceVnd: number;
  stockQty: number;
  description: string;
  faq: ProductFaq[];
  isActive: boolean;
}

export type PaymentMethod = "bank_transfer" | "cod";

export interface OrderItem {
  sku: string;
  qty: number;
  unitPriceVnd: number;
  productName?: string;
}

export interface Order {
  id: string;
  orderCode: string;
  customerTelegramId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  note?: string;
  status: OrderStatus;
  stockReleased: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInfo {
  telegramId: string;
  name: string;
  phone: string;
  address: string;
}

export interface CreateOrderInput {
  customer: CustomerInfo;
  items: Array<{ sku: string; qty: number }>;
  payment_method: PaymentMethod;
  note?: string;
  idempotency_key?: string;
}

export interface CatalogListInput {
  query?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface FaqAnswerInput {
  question: string;
  product_sku?: string;
}

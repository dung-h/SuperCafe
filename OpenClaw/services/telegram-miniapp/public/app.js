const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const state = {
  products: [],
  productBySku: new Map(),
  qtyBySku: new Map(),
  categories: [],
  activeCategory: "all",
  currentOrder: null,
  shopConfig: null,
  telegramUser: tg?.initDataUnsafe?.user || null,
  step: 1,
  busyOrder: false,
  busyPayment: false,
};

const els = {
  products: document.getElementById("products"),
  categoryChips: document.getElementById("categoryChips"),
  cartSummary: document.getElementById("cartSummary"),
  cartDetail: document.getElementById("cartDetail"),
  upsellBox: document.getElementById("upsellBox"),
  orderResult: document.getElementById("orderResult"),
  paymentResult: document.getElementById("paymentResult"),
  paymentPanel: document.getElementById("paymentPanel"),
  orderSummary: document.getElementById("orderSummary"),
  statusResult: document.getElementById("statusResult"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerAddress: document.getElementById("customerAddress"),
  paymentMethod: document.getElementById("paymentMethod"),
  orderNote: document.getElementById("orderNote"),
  telegramUserId: document.getElementById("telegramUserId"),
  tgUserLabel: document.getElementById("tgUserLabel"),
  shopName: document.getElementById("shopName"),
  bankInfo: document.getElementById("bankInfo"),
  transferRef: document.getElementById("transferRef"),
  proofText: document.getElementById("proofText"),
  statusOrderCode: document.getElementById("statusOrderCode"),
  searchInput: document.getElementById("searchInput"),
  checkoutSteps: document.getElementById("checkoutSteps"),
  goStep2Btn: document.getElementById("goStep2Btn"),
  newOrderBtn: document.getElementById("newOrderBtn"),
  orderSubmitBtn: document.getElementById("orderSubmitBtn"),
  paySubmitBtn: document.getElementById("paySubmitBtn"),
};

document.getElementById("searchForm").addEventListener("submit", onSearch);
document.getElementById("orderForm").addEventListener("submit", onCreateOrder);
document.getElementById("paymentForm").addEventListener("submit", onSubmitPayment);
document.getElementById("statusForm").addEventListener("submit", onCheckStatus);
els.products.addEventListener("click", onProductGridClick);
els.products.addEventListener("change", onProductGridChange);
els.cartDetail.addEventListener("click", onCartDetailClick);
els.upsellBox.addEventListener("click", onUpsellClick);
els.checkoutSteps.addEventListener("click", onStepClick);
els.goStep2Btn.addEventListener("click", () => goToStep(2));
els.newOrderBtn.addEventListener("click", () => {
  void startNewOrder();
});

for (const button of document.querySelectorAll("[data-go-step]")) {
  button.addEventListener("click", (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const stepRaw = target.getAttribute("data-go-step");
    const step = Number(stepRaw);
    if (Number.isInteger(step)) {
      goToStep(step);
    }
  });
}

void bootstrap();

async function bootstrap() {
  renderTelegramUser();
  await loadConfig();
  await loadCategories();
  await loadProducts();
  renderOrderSummary();
  renderStepState();
}

function renderTelegramUser() {
  if (!state.telegramUser) {
    els.tgUserLabel.textContent = "Không đọc được user Telegram. Bạn vẫn có thể test local bằng Telegram ID thủ công.";
    return;
  }

  const displayName = [state.telegramUser.first_name, state.telegramUser.last_name].filter(Boolean).join(" ");
  els.tgUserLabel.textContent = `Xin chào ${displayName} (ID: ${state.telegramUser.id})`;
  if (displayName) {
    els.customerName.value = displayName;
  }
  els.telegramUserId.value = String(state.telegramUser.id);
}

async function loadConfig() {
  const response = await fetchJson("/api/config");
  if (!response.ok) {
    setStatus(els.orderResult, `Lỗi tải cấu hình: ${readError(response.error)}`, "err");
    return;
  }

  state.shopConfig = response.data;
  els.shopName.textContent = response.data.shopName;
  els.bankInfo.textContent =
    `Ngân hàng: ${response.data.bankName}\n` +
    `Chủ tài khoản: ${response.data.bankAccountName}\n` +
    `Số tài khoản: ${response.data.bankAccountNumber}`;
}

async function loadCategories() {
  const response = await fetchJson("/api/categories");
  if (!response.ok) {
    state.categories = [];
    renderCategoryChips();
    return;
  }
  state.categories = response.data || [];
  renderCategoryChips();
}

function renderCategoryChips() {
  const allCount = state.categories.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const items = [{ name: "all", count: allCount }, ...state.categories];
  els.categoryChips.innerHTML = "";

  for (const category of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${state.activeCategory === category.name ? " active" : ""}`;
    const label = labelForCategory(category.name);
    button.textContent = `${label} (${category.count || 0})`;
    button.addEventListener("click", async () => {
      state.activeCategory = category.name;
      await loadProducts(els.searchInput.value.trim());
      renderCategoryChips();
    });
    els.categoryChips.appendChild(button);
  }
}

async function loadProducts(query = "") {
  els.products.innerHTML = "Đang tải menu...";
  const category = state.activeCategory !== "all" ? state.activeCategory : "";
  const response = await fetchJson(
    `/api/products?query=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`,
  );
  if (!response.ok) {
    els.products.innerHTML = `<p>Lỗi tải menu: ${escapeHtml(readError(response.error))}</p>`;
    return;
  }

  state.products = response.data.items || [];
  for (const product of state.products) {
    state.productBySku.set(product.sku, product);
  }
  renderProducts();
  updateCartViews();
}

function renderProducts() {
  if (state.products.length === 0) {
    els.products.innerHTML = "<p>Không có sản phẩm phù hợp.</p>";
    return;
  }

  els.products.innerHTML = "";
  for (const product of state.products) {
    const qty = state.qtyBySku.get(product.sku) || 0;
    const imageUrl = resolveImageUrl(product);
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image-wrap">
        <img class="product-image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(product.name)}" loading="lazy" />
      </div>
      <div class="product-body">
        <p class="product-name">${escapeHtml(product.name)}</p>
        <p class="product-meta">${escapeHtml(product.sku)} | ${formatVnd(product.priceVnd)} | còn ${product.stockQty}</p>
        <span class="product-category">${escapeHtml(labelForCategory(product.category))}</span>
        <div class="qty-wrap">
          <button type="button" data-sku="${escapeAttr(product.sku)}" data-action="dec">-</button>
          <input data-sku="${escapeAttr(product.sku)}" class="qty-input" type="number" min="0" max="${product.stockQty}" value="${qty}" />
          <button type="button" data-sku="${escapeAttr(product.sku)}" data-action="inc">+</button>
        </div>
      </div>
    `;
    els.products.appendChild(card);
  }
}

function onProductGridClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const sku = target.getAttribute("data-sku");
  const action = target.getAttribute("data-action");
  if (!sku || !action) {
    return;
  }

  const product = state.productBySku.get(sku);
  if (!product) {
    return;
  }

  const current = state.qtyBySku.get(sku) || 0;
  if (action === "inc") {
    setQty(sku, Math.min(current + 1, product.stockQty));
  }
  if (action === "dec") {
    setQty(sku, Math.max(current - 1, 0));
  }
}

function onProductGridChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("qty-input")) {
    return;
  }
  const sku = target.getAttribute("data-sku");
  if (!sku) {
    return;
  }
  setQty(sku, Number(target.value));
}

function onCartDetailClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const sku = target.getAttribute("data-sku");
  const action = target.getAttribute("data-cart-action");
  if (!sku || !action) {
    return;
  }

  const current = state.qtyBySku.get(sku) || 0;
  if (action === "inc") {
    setQty(sku, current + 1);
  }
  if (action === "dec") {
    setQty(sku, current - 1);
  }
  if (action === "remove") {
    setQty(sku, 0);
  }
}

function onStepClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const stepRaw = target.getAttribute("data-step-target");
  const step = Number(stepRaw);
  if (!Number.isInteger(step)) {
    return;
  }
  goToStep(step);
}

function setQty(sku, value) {
  const product = state.productBySku.get(sku);
  if (!product) {
    return;
  }
  const normalized = Math.max(0, Math.min(product.stockQty, Math.floor(value || 0)));
  if (normalized <= 0) {
    state.qtyBySku.delete(sku);
  } else {
    state.qtyBySku.set(sku, normalized);
  }
  renderProducts();
  updateCartViews();
}

function selectedItems() {
  const items = [];
  for (const [sku, qty] of state.qtyBySku.entries()) {
    if (qty <= 0) {
      continue;
    }
    const product = state.productBySku.get(sku);
    if (!product) {
      continue;
    }
    items.push({
      sku,
      qty,
      name: product.name,
      priceVnd: product.priceVnd,
      totalVnd: product.priceVnd * qty,
    });
  }
  return items;
}

function updateCartViews() {
  updateCartSummary();
  renderCartDetail();
  renderUpsell();
}

function updateCartSummary() {
  const items = selectedItems();
  if (items.length === 0) {
    els.cartSummary.textContent = "Chưa chọn món nào.";
    return;
  }

  const total = items.reduce((sum, item) => sum + item.totalVnd, 0);
  const lines = items.map((item) => `- ${item.name} x${item.qty}: ${formatVnd(item.totalVnd)}`);
  els.cartSummary.textContent = `${lines.join("\n")}\nTạm tính: ${formatVnd(total)}`;
}

function renderCartDetail() {
  const items = selectedItems();
  if (items.length === 0) {
    els.cartDetail.innerHTML = `<p class="cart-empty">Giỏ hàng đang trống. Hãy quay lại bước 1 để chọn món.</p>`;
    return;
  }

  const rows = items
    .map(
      (item) => `
      <div class="cart-row">
        <div>
          <div class="cart-name">${escapeHtml(item.name)}</div>
          <div class="cart-meta">${escapeHtml(item.sku)} | ${formatVnd(item.priceVnd)}</div>
        </div>
        <div class="mini-qty">
          <button type="button" data-sku="${escapeAttr(item.sku)}" data-cart-action="dec">-</button>
          <span>x${item.qty}</span>
          <button type="button" data-sku="${escapeAttr(item.sku)}" data-cart-action="inc">+</button>
        </div>
        <button type="button" class="ghost" data-sku="${escapeAttr(item.sku)}" data-cart-action="remove">Bỏ</button>
      </div>
    `,
    )
    .join("");

  const total = items.reduce((sum, item) => sum + item.totalVnd, 0);
  els.cartDetail.innerHTML = `${rows}<div class="cart-total">Tạm tính: ${formatVnd(total)}</div>`;
}

function renderUpsell() {
  const selected = selectedItems();
  const selectedSku = new Set(selected.map((item) => item.sku));
  const selectedCategories = new Set(
    selected.map((item) => state.productBySku.get(item.sku)?.category).filter(Boolean),
  );

  const candidates = [];
  for (const product of state.productBySku.values()) {
    if (selectedSku.has(product.sku) || product.stockQty <= 0) {
      continue;
    }
    const score = selectedCategories.has(product.category) ? 1 : 2;
    candidates.push({ product, score });
  }

  candidates.sort((a, b) => b.score - a.score || b.product.stockQty - a.product.stockQty || a.product.priceVnd - b.product.priceVnd);
  const top = candidates.slice(0, 3).map((item) => item.product);

  if (top.length === 0 || selected.length === 0) {
    els.upsellBox.classList.add("hidden");
    els.upsellBox.innerHTML = "";
    return;
  }

  els.upsellBox.classList.remove("hidden");
  const rows = top
    .map(
      (item) => `
      <div class="upsell-item">
        <div>
          <div class="upsell-name">${escapeHtml(item.name)}</div>
          <div class="upsell-meta">${formatVnd(item.priceVnd)} | ${escapeHtml(labelForCategory(item.category))}</div>
        </div>
        <button type="button" data-upsell-sku="${escapeAttr(item.sku)}">+ Thêm</button>
      </div>
    `,
    )
    .join("");
  els.upsellBox.innerHTML = `
    <p class="upsell-title">Gợi ý mua kèm để tối ưu đơn hàng</p>
    <div class="upsell-list">${rows}</div>
  `;
}

function onUpsellClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const sku = target.getAttribute("data-upsell-sku");
  if (!sku) {
    return;
  }
  const current = state.qtyBySku.get(sku) || 0;
  setQty(sku, current + 1);
}

async function onSearch(event) {
  event.preventDefault();
  await loadProducts(els.searchInput.value.trim());
}

function goToStep(step) {
  const nextStep = Math.max(1, Math.min(3, Number(step) || 1));
  if (nextStep === 2 && selectedItems().length === 0) {
    setStatus(els.orderResult, "Vui lòng chọn ít nhất 1 món ở bước 1.", "err");
    return;
  }
  if (nextStep === 3 && !state.currentOrder) {
    setStatus(els.orderResult, "Bạn cần tạo đơn ở bước 2 trước khi sang thanh toán.", "err");
    return;
  }
  state.step = nextStep;
  renderStepState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStepState() {
  for (const panel of document.querySelectorAll("[data-step-panel]")) {
    if (!(panel instanceof HTMLElement)) {
      continue;
    }
    const step = Number(panel.getAttribute("data-step-panel"));
    panel.classList.toggle("hidden", step !== state.step);
  }

  for (const button of document.querySelectorAll(".step-pill")) {
    if (!(button instanceof HTMLElement)) {
      continue;
    }
    const step = Number(button.getAttribute("data-step-target"));
    button.classList.toggle("active", step === state.step);
    button.classList.toggle("done", step < state.step);
  }
}

async function onCreateOrder(event) {
  event.preventDefault();
  if (state.busyOrder) {
    return;
  }

  state.busyOrder = true;
  setButtonBusy(els.orderSubmitBtn, true, "Đang tạo đơn...");
  setStatus(els.orderResult, "", "");
  setStatus(els.paymentResult, "", "");

  try {
    const items = selectedItems().map((item) => ({ sku: item.sku, qty: item.qty }));
    if (items.length === 0) {
      setStatus(els.orderResult, "Vui lòng chọn ít nhất 1 món.", "err");
      return;
    }

    const payload = {
      customerTelegramId: els.telegramUserId.value.trim(),
      customerName: els.customerName.value.trim(),
      customerPhone: els.customerPhone.value.trim(),
      customerAddress: els.customerAddress.value.trim(),
      paymentMethod: els.paymentMethod.value,
      note: els.orderNote.value.trim() || undefined,
      items,
    };

    const response = await fetchJson("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus(els.orderResult, `Tạo đơn thất bại: ${translateError(response.error)}`, "err");
      return;
    }

    state.currentOrder = response.data;
    els.statusOrderCode.value = response.data.orderCode;
    renderOrderSummary();
    setStatus(
      els.orderResult,
      `Đã tạo đơn ${response.data.orderCode}. Tổng: ${formatVnd(response.data.totalVnd)}. Trạng thái: ${response.data.status}.`,
      "ok",
    );

    if (response.data.paymentMethod === "bank_transfer") {
      els.paymentPanel.classList.remove("hidden");
      setStatus(els.paymentResult, "Vui lòng chuyển khoản và gửi mã giao dịch để shop xác nhận.", "");
    } else {
      els.paymentPanel.classList.add("hidden");
      setStatus(els.paymentResult, "Đơn COD đã ghi nhận. Shop sẽ liên hệ xác nhận giao hàng.", "ok");
    }

    goToStep(3);
  } finally {
    state.busyOrder = false;
    setButtonBusy(els.orderSubmitBtn, false, "Tạo đơn sang bước thanh toán");
  }
}

function renderOrderSummary() {
  if (!state.currentOrder) {
    els.orderSummary.textContent = "Chưa có đơn hàng. Hãy tạo đơn ở bước 2.";
    return;
  }

  const lines = [
    `Mã đơn: ${state.currentOrder.orderCode}`,
    `Khách hàng: ${state.currentOrder.customerName}`,
    `Số điện thoại: ${state.currentOrder.customerPhone}`,
    `Địa chỉ: ${state.currentOrder.customerAddress}`,
    `Thanh toán: ${state.currentOrder.paymentMethod === "bank_transfer" ? "Chuyển khoản" : "COD"}`,
    `Trạng thái: ${state.currentOrder.status}`,
    `Tổng tiền: ${formatVnd(state.currentOrder.totalVnd)}`,
    "Món đã đặt:",
    ...state.currentOrder.items.map((item) => {
      const fallback = state.productBySku.get(item.sku)?.name || item.sku;
      return `- ${fallback} x${item.qty}`;
    }),
  ];
  els.orderSummary.textContent = lines.join("\n");
}

async function onSubmitPayment(event) {
  event.preventDefault();
  if (state.busyPayment) {
    return;
  }

  state.busyPayment = true;
  setButtonBusy(els.paySubmitBtn, true, "Đang gửi thanh toán...");
  setStatus(els.paymentResult, "", "");

  try {
    if (!state.currentOrder) {
      setStatus(els.paymentResult, "Bạn cần tạo đơn trước.", "err");
      return;
    }

    const payload = {
      orderCode: state.currentOrder.orderCode,
      transferRef: els.transferRef.value.trim(),
      proofText: els.proofText.value.trim() || undefined,
      customerTelegramId: els.telegramUserId.value.trim(),
    };

    const response = await fetchJson("/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus(els.paymentResult, `Gửi thanh toán thất bại: ${translateError(response.error)}`, "err");
      return;
    }

    setStatus(els.paymentResult, `Đã gửi xác nhận thanh toán cho ${state.currentOrder.orderCode}.`, "ok");
  } finally {
    state.busyPayment = false;
    setButtonBusy(els.paySubmitBtn, false, "Gửi xác nhận thanh toán");
  }
}

async function startNewOrder() {
  state.currentOrder = null;
  state.qtyBySku.clear();
  els.transferRef.value = "";
  els.proofText.value = "";
  els.orderNote.value = "";
  setStatus(els.orderResult, "", "");
  setStatus(els.paymentResult, "", "");
  els.paymentPanel.classList.add("hidden");
  renderOrderSummary();
  await loadProducts(els.searchInput.value.trim());
  goToStep(1);
}

async function onCheckStatus(event) {
  event.preventDefault();
  els.statusResult.textContent = "Đang kiểm tra...";
  const orderCode = els.statusOrderCode.value.trim().toUpperCase();
  if (!orderCode) {
    els.statusResult.textContent = "Vui lòng nhập mã đơn.";
    return;
  }

  const telegramId = els.telegramUserId.value.trim();
  const response = await fetchJson(
    `/api/orders/${encodeURIComponent(orderCode)}?telegramUserId=${encodeURIComponent(telegramId)}`,
  );

  if (!response.ok) {
    els.statusResult.textContent = `Lỗi: ${translateError(response.error)}`;
    return;
  }

  const order = response.data;
  const lines = [
    `Đơn: ${order.orderCode}`,
    `Trạng thái: ${order.status}`,
    `Khách: ${order.customerName}`,
    `Tổng: ${formatVnd(order.totalVnd)}`,
    "Sản phẩm:",
    ...order.items.map((item) => `- ${item.sku} x${item.qty}`),
  ];
  els.statusResult.textContent = lines.join("\n");
}

function setButtonBusy(button, busy, busyLabel) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent || "";
  }
  button.disabled = busy;
  button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
}

function setStatus(element, text, type) {
  element.textContent = text;
  element.classList.remove("ok", "err");
  if (type) {
    element.classList.add(type);
  }
}

function resolveImageUrl(product) {
  if (typeof product.imageUrl === "string" && product.imageUrl.trim() !== "") {
    return product.imageUrl.trim();
  }
  return `https://placehold.co/640x420/png?text=${encodeURIComponent(product.name || product.sku || "Drink")}`;
}

function labelForCategory(category) {
  const fromConfig = state.shopConfig?.categoryLabels?.[category];
  if (fromConfig) {
    return fromConfig;
  }
  if (category === "all") {
    return "Tất cả";
  }
  return category || "Khác";
}

function formatVnd(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function translateError(error) {
  const text = readError(error);
  const lower = text.toLowerCase();
  if (lower.includes("insufficient stock")) {
    return "Số lượng vượt quá tồn kho hiện tại. Vui lòng giảm số lượng và thử lại.";
  }
  if (lower.includes("order is not accepting payment submission")) {
    return "Đơn chưa sẵn sàng nhận thanh toán. Kiểm tra lại trạng thái đơn.";
  }
  if (lower.includes("payment_review")) {
    return "Đơn chưa ở trạng thái chờ duyệt thanh toán. Vui lòng kiểm tra lại.";
  }
  return text;
}

function readError(error) {
  if (!error) {
    return "unknown";
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

async function fetchJson(url, options) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    const json = safeParseJson(text);
    if (!response.ok) {
      return { ok: false, error: json?.error || `HTTP ${response.status}` };
    }
    return json || { ok: false, error: "invalid response" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function safeParseJson(raw) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

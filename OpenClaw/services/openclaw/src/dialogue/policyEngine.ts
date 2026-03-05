import { createHash } from "node:crypto";
import type { SalesBackend } from "../backends";
import type { OpenClawConfig } from "../config";
import { extractOrderCode, inferActionFromText, isValidPhone, parseActionPayload } from "./actionParser";
import {
  categoryLabel,
  categorySuggestions,
  confirmSuggestions,
  formatVnd,
  handoffSuggestions,
  menuUi,
  orderStepSuggestions,
  paymentSuggestions,
  rootSuggestions,
  suggestion,
} from "./responseBuilder";
import {
  getMissingFields,
  getNextWizardState,
  getPreviousWizardState,
  isWizardState,
  stateForMissingField,
} from "./stateMachine";
import {
  defaultSessionContext,
  type DialogueOrderContext,
  type DialogueSession,
  type DialogueSessionContext,
  type DialogueStateName,
  type MenuItem,
  type PolicyInput,
  type PolicyResult,
  type UiSuggestion,
} from "./types";

export type PolicyExecution = PolicyResult & {
  nextState: DialogueStateName;
  nextContext: DialogueSessionContext;
};
const QUANTITY_WORD_PATTERN = "(?:mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)";
const VI_QUANTITY_MAP: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};

export class DialoguePolicyEngine {
  constructor(
    private readonly config: OpenClawConfig,
    private readonly backend: SalesBackend,
  ) {}

  async run(input: PolicyInput, session: DialogueSession): Promise<PolicyExecution> {
    let action = parseActionPayload(input.actionPayload) ?? inferActionFromText(input.message);
    const stateBefore = session.state;
    const context = sanitizeContext(session.context, input.profile);
    let state = stateBefore;
    const toolCalls: string[] = [];
    const freeText = input.message.trim();

    if (!action && context.pendingOrderSuggestion && freeText) {
      if (isAffirmativeText(freeText)) {
        upsertOrderItem(context, context.pendingOrderSuggestion.sku, context.pendingOrderSuggestion.qty);
        const accepted = { ...context.pendingOrderSuggestion };
        delete context.pendingOrderSuggestion;
        const lines = context.order.items.map((item) => `- ${item.sku} x${item.qty}`);
        return buildExecution(
          "ORDER_COLLECT_ITEMS",
          context,
          `Đã thêm ${accepted.qty} x ${accepted.name} vào giỏ.\n${lines.join("\n")}\nBấm 'Tiếp tục' để sang bước nhập thông tin nhận hàng.`,
          menuUi("Bước 1/6: Chọn món", [], [...categorySuggestions(), ...orderStepSuggestions()]),
          toolCalls,
          "order_natural_confirm_yes_text",
        );
      }
      if (isNegativeText(freeText)) {
        delete context.pendingOrderSuggestion;
        return buildExecution(
          "ORDER_COLLECT_ITEMS",
          context,
          "Ok, mình không thêm món đó. Bạn chọn món khác hoặc bấm 'Xem menu' nhé.",
          menuUi("Bước 1/6: Chọn món", [], [...categorySuggestions(), ...orderStepSuggestions()]),
          toolCalls,
          "order_natural_confirm_no_text",
        );
      }
    }

    if (state === "HANDOFF_WAITING" && action?.type !== "ACTION_HANDOFF_RESUME") {
      return buildExecution(
        "HANDOFF_WAITING",
        context,
        "Phiên của bạn đang chờ tư vấn viên hỗ trợ. Nhắn 'tiếp tục với bot' để quay lại tự động.",
        menuUi("Đang chờ tư vấn viên", [], handoffSuggestions()),
        toolCalls,
        "handoff_waiting",
      );
    }

    if (action?.type === "ACTION_HANDOFF_REQUEST") {
      context.handoffRequestedAt = new Date().toISOString();
      return buildExecution(
        "HANDOFF_WAITING",
        context,
        "Mình đã chuyển cuộc trò chuyện sang tư vấn viên. Khi muốn quay lại bot, bạn bấm 'Tiếp tục với bot'.",
        menuUi("Hỗ trợ trực tiếp", [], handoffSuggestions()),
        toolCalls,
        "handoff_request",
      );
    }

    if (action?.type === "ACTION_HANDOFF_RESUME") {
      delete context.handoffRequestedAt;
      return buildExecution(
        "IDLE",
        context,
        "Bot đã hoạt động lại. Bạn muốn xem menu, đặt đơn hay kiểm tra đơn?",
        menuUi("Bot đã sẵn sàng", [], rootSuggestions()),
        toolCalls,
        "handoff_resume",
      );
    }

    if (action?.type === "ACTION_HELP") {
      return buildExecution(
        state,
        context,
        [
          "Mình hỗ trợ các việc sau:",
          "1) Xem menu: bấm 'Xem menu' hoặc chọn danh mục.",
          "2) Đặt đơn theo wizard: chọn món -> tên -> SĐT -> địa chỉ -> thanh toán.",
          "3) Kiểm tra đơn: bấm 'Kiểm tra đơn' rồi gửi mã ORD-YYYYMMDD-XXXX.",
          "4) Gặp tư vấn viên: bấm 'Gặp tư vấn viên'.",
        ].join("\n"),
        menuUi("Trợ giúp", [], rootSuggestions()),
        toolCalls,
        "help",
      );
    }

    if (action?.type === "ACTION_VIEW_MENU" || action?.type === "ACTION_CATEGORY") {
      const category = action.type === "ACTION_CATEGORY" ? action.category : undefined;
      toolCalls.push("catalog_list");
      const listed = await this.backend.postTool<any>(
        "catalog_list",
        { category, page: 1, limit: 12 },
        input.correlationId,
      );

      const items = normalizeItems(listed.data?.items);
      if (!items.length) {
        return buildExecution(
          "BROWSING_MENU",
          context,
          "Hiện chưa có món phù hợp với bộ lọc này. Bạn thử danh mục khác nhé.",
          menuUi("Danh mục đồ uống", [], categorySuggestions()),
          toolCalls,
          "catalog_empty",
        );
      }

      const cta: UiSuggestion[] = [
        suggestion("Bắt đầu đặt đơn", "ACTION_ORDER_START"),
        suggestion("Kiểm tra đơn", "ACTION_ORDER_STATUS"),
        suggestion("Gặp tư vấn viên", "ACTION_HANDOFF_REQUEST"),
      ];

      const title = category ? `Menu ${categoryLabel(category)}` : "Menu đồ uống";
      const reply = category
        ? `Đây là một số món thuộc nhóm ${categoryLabel(category).toLowerCase()}. Bạn có thể bấm đặt nhanh theo từng món.`
        : "Đây là menu nổi bật hiện tại. Bạn muốn chọn món nào?";

      return buildExecution(
        "BROWSING_MENU",
        context,
        reply,
        menuUi(title, items.slice(0, 8), cta),
        toolCalls,
        "catalog_list",
      );
    }

    if (action?.type === "ACTION_ORDER_STATUS") {
      const orderCode = action.orderCode || extractOrderCode(input.message);
      if (!orderCode) {
        return buildExecution(
          state,
          context,
          "Bạn gửi mã đơn theo dạng ORD-YYYYMMDD-XXXX để mình kiểm tra nhé.",
          menuUi("Kiểm tra đơn hàng", [], [
            suggestion("Xem menu", "ACTION_VIEW_MENU"),
            suggestion("Đặt đơn", "ACTION_ORDER_START"),
          ]),
          toolCalls,
          "order_status_missing_code",
        );
      }

      toolCalls.push("order_get");
      const orderResult = await this.backend.postTool<any>("order_get", { order_code: orderCode }, input.correlationId);
      if (!orderResult.data) {
        return buildExecution(
          state,
          context,
          `Không tìm thấy đơn ${orderCode}. Bạn kiểm tra lại mã đơn giúp mình.`,
          menuUi("Không tìm thấy đơn", [], rootSuggestions()),
          toolCalls,
          "order_status_not_found",
        );
      }

      if (String(orderResult.data.customerTelegramId || "") !== input.userId) {
        return buildExecution(
          state,
          context,
          "Bạn không có quyền xem đơn này.",
          menuUi("Không đủ quyền", [], rootSuggestions()),
          toolCalls,
          "order_status_denied",
        );
      }

      const rendered = renderOrder(orderResult.data);
      return buildExecution(
        state,
        context,
        rendered,
        menuUi("Đơn hàng của bạn", [], [
          suggestion("Xem menu", "ACTION_VIEW_MENU"),
          suggestion("Đặt đơn mới", "ACTION_ORDER_START"),
          suggestion("Gặp tư vấn viên", "ACTION_HANDOFF_REQUEST"),
        ]),
        toolCalls,
        "order_status_found",
      );
    }

    if (action?.type === "ACTION_ORDER_CANCEL") {
      return buildExecution(
        "IDLE",
        defaultSessionContext(),
        "Đã hủy luồng đặt đơn hiện tại. Khi cần, bạn bấm 'Đặt đơn' để bắt đầu lại.",
        menuUi("Đơn đã hủy", [], rootSuggestions()),
        toolCalls,
        "order_cancel",
      );
    }

    if (action?.type === "ACTION_ORDER_START") {
      resetOrderFlowContext(context, input);
      state = "ORDER_COLLECT_ITEMS";
      return buildExecution(
        state,
        context,
        "Bắt đầu đặt đơn. Bạn chọn món bằng nút gợi ý hoặc gửi theo mẫu SKU:SL (ví dụ CAFE-SUA:2).",
        menuUi("Bước 1/6: Chọn món", [], [...categorySuggestions(), ...orderStepSuggestions().slice(0, 3)]),
        toolCalls,
        "order_start",
      );
    }

    if (isWizardState(state) || isOrderAction(action?.type)) {
      if (!isWizardState(state)) {
        state = "ORDER_COLLECT_ITEMS";
      }

      if (!action) {
        if (state === "ORDER_CONFIRM" && freeText) {
          if (isAffirmativeText(freeText)) {
            action = { type: "ACTION_ORDER_CONFIRM", raw: freeText };
          } else if (isNegativeText(freeText)) {
            return buildExecution(
              state,
              context,
              "Mình chưa xác nhận đơn. Bạn có thể bấm 'Quay lại' để chỉnh thông tin, hoặc 'Hủy đơn' nếu muốn dừng.",
              menuForState(state, context),
              toolCalls,
              "order_confirm_declined_text",
            );
          }
        }
      }

      const handled = applyWizardFieldFromAction(state, context, action);
      if (handled.error) {
        return buildExecution(state, context, handled.error, menuForState(state, context), toolCalls, "wizard_invalid_input");
      }

      if (handled.shouldAutoAdvance) {
        state = getNextWizardState(state);
      }

      if (action?.type === "ACTION_ORDER_ADD" || action?.type === "ACTION_ORDER_SET_QTY") {
        ensureOrderFlowId(context, input);
        delete context.pendingOrderSuggestion;
        state = "ORDER_COLLECT_ITEMS";
        const lines = context.order.items.map((item) => `- ${item.sku} x${item.qty}`);
        return buildExecution(
          state,
          context,
          `Đã cập nhật giỏ tạm:\n${lines.join("\n") || "(trống)"}\nBấm 'Tiếp tục' để sang bước nhập thông tin nhận hàng.`,
          menuUi("Bước 1/6: Chọn món", [], [...categorySuggestions(), ...orderStepSuggestions()]),
          toolCalls,
          "order_item_update",
        );
      }

      if (state === "ORDER_COLLECT_ITEMS" && !action) {
        const parsedItems = parseItemListFromText(input.message);
        if (parsedItems.length) {
          ensureOrderFlowId(context, input);
          delete context.pendingOrderSuggestion;
          for (const item of parsedItems) {
            upsertOrderItem(context, item.sku, item.qty);
          }
          return buildExecution(
            state,
            context,
            `Đã ghi nhận ${parsedItems.length} món trong giỏ. Bấm 'Tiếp tục' để sang bước nhập tên người nhận.`,
            menuUi("Bước 1/6: Chọn món", [], orderStepSuggestions()),
            toolCalls,
            "order_item_text_update",
          );
        }

        const naturalOrder = await resolveNaturalOrderCandidate(input.message, this.backend, input.correlationId, toolCalls);
        if (naturalOrder) {
          return buildNaturalOrderExecution(context, naturalOrder, toolCalls);
        }
      }

      if (!action) {
        if (state === "ORDER_COLLECT_NAME" && freeText) {
          context.order.name = freeText;
          state = "ORDER_COLLECT_PHONE";
        } else if (state === "ORDER_COLLECT_PHONE" && freeText) {
          if (!isValidPhone(freeText)) {
            if (looksLikeHumanName(freeText)) {
              context.order.name = freeText;
              return buildExecution(
                state,
                context,
                "Mình đã cập nhật tên người nhận. Bạn nhập số điện thoại giúp mình nhé.",
                menuForState(state, context),
                toolCalls,
                "phone_step_received_name",
              );
            }
            return buildExecution(state, context, "Số điện thoại chưa hợp lệ, bạn nhập lại giúp mình nhé.", menuForState(state, context), toolCalls, "invalid_phone");
          }
          context.order.phone = digitsOnly(freeText);
          state = "ORDER_COLLECT_ADDRESS";
        } else if (state === "ORDER_COLLECT_ADDRESS" && freeText) {
          if (!isValidAddressInput(freeText)) {
            return buildExecution(
              state,
              context,
              "Địa chỉ chưa đủ rõ. Bạn gửi link Google Maps hoặc nhập theo mẫu: Số nhà, phường/xã, quận/huyện, tỉnh/thành.",
              menuForState(state, context),
              toolCalls,
              "invalid_address",
            );
          }
          context.order.address = freeText;
          state = "ORDER_COLLECT_PAYMENT";
        } else if (state === "ORDER_COLLECT_PAYMENT") {
          const method = inferPaymentMethodFromText(freeText);
          if (method) {
            context.order.paymentMethod = method;
            state = "ORDER_CONFIRM";
          }
        }
      }

      if (action?.type === "ACTION_ORDER_BACK") {
        state = getPreviousWizardState(state);
        return buildExecution(state, context, promptForState(state), menuForState(state, context), toolCalls, "order_back");
      }

      if (action?.type === "ACTION_ORDER_NEXT") {
        if (state === "ORDER_COLLECT_ITEMS" && !context.order.items.length) {
          return buildExecution(state, context, "Bạn chưa chọn món nào. Hãy thêm ít nhất 1 món trước khi tiếp tục.", menuForState(state, context), toolCalls, "order_next_missing_items");
        }
        if (state === "ORDER_COLLECT_NAME" && !context.order.name) {
          return buildExecution(state, context, "Bạn nhập tên người nhận trước khi tiếp tục nhé.", menuForState(state, context), toolCalls, "order_next_missing_name");
        }
        if (state === "ORDER_COLLECT_PHONE" && !context.order.phone) {
          return buildExecution(state, context, "Bạn nhập số điện thoại trước khi tiếp tục nhé.", menuForState(state, context), toolCalls, "order_next_missing_phone");
        }
        if (state === "ORDER_COLLECT_ADDRESS" && !context.order.address) {
          return buildExecution(state, context, "Bạn nhập địa chỉ nhận hàng trước khi tiếp tục nhé.", menuForState(state, context), toolCalls, "order_next_missing_address");
        }
        if (state === "ORDER_COLLECT_PAYMENT" && !context.order.paymentMethod) {
          return buildExecution(state, context, "Bạn chọn phương thức thanh toán trước khi tiếp tục nhé.", menuForState(state, context), toolCalls, "order_next_missing_payment");
        }

        state = advanceToNextRequiredState(state, context);
        return buildExecution(state, context, promptForState(state), menuForState(state, context), toolCalls, "order_next");
      }

      if (action?.type === "ACTION_ORDER_CONFIRM") {
        const missing = getMissingFields(context);
        if (missing.length) {
          state = stateForMissingField(missing[0]);
          return buildExecution(state, context, `Mình còn thiếu ${fieldLabel(missing[0])}. Bạn bổ sung giúp mình nhé.`, menuForState(state, context), toolCalls, "order_confirm_missing");
        }

        ensureOrderFlowId(context, input);
        const idempotencyKey = buildOrderIdempotencyKey(input, context.order);
        toolCalls.push("order_create");
        const created = await this.backend.postTool<any>(
          "order_create",
          {
            customer: {
              telegramId: input.userId,
              name: context.order.name,
              phone: context.order.phone,
              address: context.order.address,
            },
            items: context.order.items,
            payment_method: context.order.paymentMethod,
            idempotency_key: idempotencyKey,
          },
          input.correlationId,
        );

        if (!created.data?.orderCode) {
          return buildExecution(
            "ORDER_CONFIRM",
            context,
            "Tạo đơn chưa thành công. Bạn thử xác nhận lại hoặc liên hệ tư vấn viên.",
            menuUi("Xác nhận đơn", [], confirmSuggestions(confirmExtraSuggestions(context))),
            toolCalls,
            "order_create_failed",
          );
        }

        const orderCode = String(created.data.orderCode);
        const totalVnd = Number(created.data.totalVnd || 0);
        const isBank = String(created.data.paymentMethod || context.order.paymentMethod) === "bank_transfer";
        const paymentGuide = isBank
          ? `\nChuyển khoản: ${this.config.bankName} - ${this.config.bankAccountNumber} (${this.config.bankAccountName})\nNội dung: ${orderCode}`
          : "";

        const alerts =
          input.channel === "telegram"
            ? [`Đơn mới ${orderCode} | ${context.order.name} | ${formatVnd(totalVnd)} | ${String(created.data.status || "new")}`]
            : undefined;

        const nextContext = defaultSessionContext();
        nextContext.lastOrderCode = orderCode;
        return {
          ...buildExecution(
            "IDLE",
            nextContext,
            `Đã tạo đơn ${orderCode} thành công. Tổng thanh toán: ${formatVnd(totalVnd)}.${paymentGuide}`,
            menuUi("Đơn đã tạo", [], [
              suggestion("Kiểm tra đơn", "ACTION_ORDER_STATUS"),
              suggestion("Xem menu", "ACTION_VIEW_MENU"),
              suggestion("Đặt đơn mới", "ACTION_ORDER_START"),
            ]),
            toolCalls,
            "order_create_success",
          ),
          alerts,
        };
      }

      const missing = getMissingFields(context);
      if (state === "ORDER_CONFIRM") {
        return buildExecution(
          state,
          context,
          renderOrderSummary(context),
          menuUi("Bước 6/6: Xác nhận đơn", [], confirmSuggestions(confirmExtraSuggestions(context))),
          toolCalls,
          "order_summary",
        );
      }

      return buildExecution(state, context, promptForState(state), menuForState(state, context), toolCalls, "wizard_prompt", missing);
    }

    if (input.message.trim().length === 0) {
      return buildExecution(
        "IDLE",
        context,
        "Bạn gửi nội dung cần hỗ trợ nhé.",
        menuUi("Bắt đầu", [], rootSuggestions()),
        toolCalls,
        "empty_message",
      );
    }

    const naturalOrder = await resolveNaturalOrderCandidate(input.message, this.backend, input.correlationId, toolCalls);
    if (naturalOrder) {
      return buildNaturalOrderExecution(context, naturalOrder, toolCalls);
    }

    return buildExecution(
      "IDLE",
      context,
      "Mình chưa có thông tin chính xác lúc này. Bạn thử chọn một hành động bên dưới để mình hỗ trợ nhanh hơn.",
      menuUi("Gợi ý thao tác", [], rootSuggestions()),
      toolCalls,
      "fallback",
    );
  }
}

function sanitizeContext(
  context: DialogueSessionContext,
  profile?: { name?: string; phone?: string; address?: string },
): DialogueSessionContext {
  const base = defaultSessionContext();
  const output: DialogueSessionContext = {
    ...base,
    ...context,
    order: {
      ...base.order,
      ...(context.order || {}),
      items: Array.isArray(context.order?.items)
        ? context.order.items
            .map((item) => ({ sku: String(item.sku || "").toUpperCase(), qty: Number(item.qty || 0) }))
            .filter((item) => !!item.sku && Number.isInteger(item.qty) && item.qty > 0)
        : [],
    },
  };

  if (!output.order.name && profile?.name) {
    output.order.name = profile.name;
  }
  if (!output.order.phone && profile?.phone && isValidPhone(profile.phone)) {
    output.order.phone = digitsOnly(profile.phone);
  }
  if (!output.order.address && profile?.address) {
    output.order.address = profile.address;
  }

  return output;
}

function resetOrderFlowContext(context: DialogueSessionContext, input: PolicyInput): void {
  const nextOrder: DialogueOrderContext = {
    items: [],
    flowId: createOrderFlowId(input),
  };
  if (context.order.name) {
    nextOrder.name = context.order.name;
  }
  if (context.order.phone) {
    nextOrder.phone = context.order.phone;
  }
  if (context.order.address) {
    nextOrder.address = context.order.address;
  }
  context.order = nextOrder;
  delete context.pendingOrderSuggestion;
}

function ensureOrderFlowId(context: DialogueSessionContext, input: PolicyInput): string {
  if (!context.order.flowId) {
    context.order.flowId = createOrderFlowId(input);
  }
  return context.order.flowId;
}

function createOrderFlowId(input: PolicyInput): string {
  const seed = `${input.channel}|${input.userId}|${input.correlationId}|${Date.now()}`;
  return `flow-${createHash("sha1").update(seed).digest("hex").slice(0, 16)}`;
}

function buildOrderIdempotencyKey(input: PolicyInput, order: DialogueOrderContext): string {
  const normalizedItems = [...order.items]
    .map((item) => ({
      sku: String(item.sku || "").trim().toUpperCase(),
      qty: Number(item.qty || 0),
    }))
    .filter((item) => item.sku && Number.isInteger(item.qty) && item.qty > 0)
    .sort((a, b) => (a.sku === b.sku ? a.qty - b.qty : a.sku.localeCompare(b.sku)));

  const canonical = JSON.stringify({
    flowId: order.flowId || "flow-missing",
    channel: input.channel,
    userId: input.userId,
    customerName: order.name || "",
    customerPhone: order.phone || "",
    customerAddress: order.address || "",
    paymentMethod: order.paymentMethod || "",
    items: normalizedItems,
  });

  return `ocv1:${createHash("sha256").update(canonical).digest("hex").slice(0, 64)}`;
}

function parseItemListFromText(input: string): Array<{ sku: string; qty: number }> {
  const chunk = input
    .replace(/^\/?order\s+/i, "")
    .split("|")[0]
    .trim();
  if (!chunk.includes(":")) {
    return [];
  }

  return chunk
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [skuRaw, qtyRaw] = part.split(":");
      return {
        sku: String(skuRaw || "").trim().toUpperCase(),
        qty: Number(String(qtyRaw || "").trim()),
      };
    })
    .filter((item) => !!item.sku && Number.isInteger(item.qty) && item.qty > 0);
}

function applyWizardFieldFromAction(
  state: DialogueStateName,
  context: DialogueSessionContext,
  action?: { type: string; sku?: string; qty?: number; text?: string; paymentMethod?: "bank_transfer" | "cod" } | null,
): { shouldAutoAdvance?: boolean; error?: string } {
  if (!action) {
    return {};
  }

  if (action.type === "ACTION_ORDER_ADD") {
    if (!action.sku || !action.qty) {
      return { error: "Payload chọn món chưa hợp lệ." };
    }
    upsertOrderItem(context, action.sku, action.qty);
    return {};
  }

  if (action.type === "ACTION_ORDER_SET_QTY") {
    if (!action.sku || !action.qty) {
      return { error: "Payload số lượng chưa hợp lệ." };
    }
    upsertOrderItem(context, action.sku, action.qty);
    return {};
  }

  if (action.type === "ACTION_ORDER_SET_NAME") {
    if (!action.text) {
      return { error: "Bạn nhập tên người nhận giúp mình." };
    }
    context.order.name = action.text;
    return { shouldAutoAdvance: state === "ORDER_COLLECT_NAME" };
  }

  if (action.type === "ACTION_ORDER_SET_PHONE") {
    if (!action.text || !isValidPhone(action.text)) {
      return { error: "Số điện thoại chưa hợp lệ." };
    }
    context.order.phone = digitsOnly(action.text);
    return { shouldAutoAdvance: state === "ORDER_COLLECT_PHONE" };
  }

  if (action.type === "ACTION_ORDER_SET_ADDRESS") {
    if (!action.text || !isValidAddressInput(action.text)) {
      return { error: "Bạn nhập địa chỉ nhận hàng giúp mình." };
    }
    context.order.address = action.text;
    return { shouldAutoAdvance: state === "ORDER_COLLECT_ADDRESS" };
  }

  if (action.type === "ACTION_ORDER_SET_PAYMENT") {
    if (!action.paymentMethod) {
      return { error: "Phương thức thanh toán chưa hợp lệ." };
    }
    context.order.paymentMethod = action.paymentMethod;
    return { shouldAutoAdvance: state === "ORDER_COLLECT_PAYMENT" };
  }

  return {};
}

function menuForState(state: DialogueStateName, context: DialogueSessionContext) {
  if (state === "ORDER_COLLECT_ITEMS") {
    return menuUi("Bước 1/6: Chọn món", [], [...categorySuggestions(), ...orderStepSuggestions()]);
  }
  if (state === "ORDER_COLLECT_NAME") {
    return menuUi("Bước 2/6: Tên người nhận", [], orderStepSuggestions());
  }
  if (state === "ORDER_COLLECT_PHONE") {
    return menuUi("Bước 3/6: Số điện thoại", [], orderStepSuggestions());
  }
  if (state === "ORDER_COLLECT_ADDRESS") {
    return menuUi("Bước 4/6: Địa chỉ nhận hàng", [], orderStepSuggestions());
  }
  if (state === "ORDER_COLLECT_PAYMENT") {
    return menuUi("Bước 5/6: Thanh toán", [], paymentSuggestions());
  }
  if (state === "ORDER_CONFIRM") {
    return menuUi("Bước 6/6: Xác nhận", [], confirmSuggestions(confirmExtraSuggestions(context)));
  }
  return menuUi("Tùy chọn", [], rootSuggestions());
}

function advanceToNextRequiredState(state: DialogueStateName, context: DialogueSessionContext): DialogueStateName {
  const next = getNextWizardState(state);
  if (next === "ORDER_CONFIRM") {
    return "ORDER_CONFIRM";
  }

  const missing = getMissingFields(context);
  if (!missing.length) {
    return "ORDER_CONFIRM";
  }

  const target = stateForMissingField(missing[0]);
  const order: DialogueStateName[] = [
    "ORDER_COLLECT_ITEMS",
    "ORDER_COLLECT_NAME",
    "ORDER_COLLECT_PHONE",
    "ORDER_COLLECT_ADDRESS",
    "ORDER_COLLECT_PAYMENT",
    "ORDER_CONFIRM",
  ];

  return order.indexOf(target) >= order.indexOf(next) ? target : next;
}

function promptForState(state: DialogueStateName): string {
  if (state === "ORDER_COLLECT_ITEMS") {
    return "Bạn chọn món bằng nút gợi ý hoặc gửi theo mẫu SKU:SL (ví dụ CAFE-SUA:2).";
  }
  if (state === "ORDER_COLLECT_NAME") {
    return "Bạn cho mình tên người nhận đơn.";
  }
  if (state === "ORDER_COLLECT_PHONE") {
    return "Bạn cho mình số điện thoại người nhận.";
  }
  if (state === "ORDER_COLLECT_ADDRESS") {
    return "Bạn cho mình địa chỉ giao hàng. Bạn có thể gửi link Google Maps (ví dụ https://www.google.com/maps/...) hoặc nhập theo mẫu: Số nhà, phường/xã, quận/huyện, tỉnh/thành.";
  }
  if (state === "ORDER_COLLECT_PAYMENT") {
    return "Bạn chọn phương thức thanh toán: bank_transfer hoặc cod.";
  }
  if (state === "ORDER_CONFIRM") {
    return "Bạn kiểm tra thông tin và bấm 'Xác nhận đặt đơn'.";
  }
  return "Bạn muốn làm gì tiếp theo?";
}

function renderOrderSummary(context: DialogueSessionContext): string {
  const lines = context.order.items.map((item) => `- ${item.sku} x${item.qty}`);
  return [
    "Vui lòng kiểm tra trước khi xác nhận:",
    `Món: ${lines.join(", ") || "(chưa có)"}`,
    `Tên: ${context.order.name || "(thiếu)"}`,
    `SĐT: ${context.order.phone || "(thiếu)"}`,
    `Địa chỉ: ${context.order.address || "(thiếu)"}`,
    `Thanh toán: ${context.order.paymentMethod || "(thiếu)"}`,
  ].join("\n");
}

function fieldLabel(field: string): string {
  if (field === "items") return "món trong giỏ";
  if (field === "name") return "tên người nhận";
  if (field === "phone") return "số điện thoại";
  if (field === "address") return "địa chỉ giao hàng";
  if (field === "paymentMethod") return "phương thức thanh toán";
  return field;
}

function isOrderAction(type?: string | null): boolean {
  return Boolean(type && type.startsWith("ACTION_ORDER_"));
}

function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

function inferPaymentMethodFromText(text: string): "bank_transfer" | "cod" | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("cod") || normalized.includes("tien mat")) {
    return "cod";
  }
  if (normalized.includes("chuyen khoan") || normalized.includes("bank") || normalized.includes("transfer")) {
    return "bank_transfer";
  }
  return null;
}

function isValidAddressInput(text: string): boolean {
  const value = text.trim();
  if (!value) {
    return false;
  }
  if (isGoogleMapsLink(value)) {
    return true;
  }
  return value.length >= 8;
}

function isGoogleMapsLink(text: string): boolean {
  return /^https?:\/\/(?:www\.)?(?:maps\.app\.goo\.gl(?:\/|$)|goo\.gl\/maps(?:\/|$)|maps\.google\.[^\/]+(?:\/|$)|google\.[^\/]+\/maps(?:\/|$|\?)|www\.google\.[^\/]+\/maps(?:\/|$|\?))/i.test(
    text.trim(),
  );
}

function confirmExtraSuggestions(context: DialogueSessionContext): UiSuggestion[] {
  const payload = serializeOrderReviewPayload(context.order);
  if (!payload) {
    return [];
  }
  return [suggestion("Xem ảnh món trên web", `OPEN_WEB_REVIEW:${payload}`)];
}

function serializeOrderReviewPayload(order: DialogueOrderContext): string {
  const itemsPayload = serializeOrderItems(order.items);
  if (!itemsPayload) {
    return "";
  }

  const chunks = [itemsPayload];
  const encodedName = encodeReviewField(order.name, 180);
  const encodedAddress = encodeReviewField(order.address, 460);
  const normalizedPhone = order.phone ? digitsOnly(order.phone).slice(0, 15) : "";
  const paymentMethod = order.paymentMethod === "cod" ? "cod" : order.paymentMethod === "bank_transfer" ? "bank_transfer" : "";

  if (encodedName) {
    chunks.push(`n=${encodedName}`);
  }
  if (normalizedPhone) {
    chunks.push(`p=${normalizedPhone}`);
  }
  if (encodedAddress) {
    chunks.push(`a=${encodedAddress}`);
  }
  if (paymentMethod) {
    chunks.push(`m=${paymentMethod}`);
  }

  const compact = chunks.join("|");
  if (compact.length > 900) {
    return itemsPayload;
  }
  return compact;
}

function encodeReviewField(value: string | undefined, maxLength: number): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const encoded = Buffer.from(trimmed, "utf8").toString("base64url");
  if (!encoded || encoded.length > maxLength) {
    return "";
  }
  return encoded;
}

function serializeOrderItems(items: Array<{ sku: string; qty: number }>): string {
  const normalized = items
    .map((item) => ({
      sku: String(item.sku || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, ""),
      qty: Number(item.qty || 0),
    }))
    .filter((item) => item.sku.length >= 2 && Number.isInteger(item.qty) && item.qty > 0)
    .slice(0, 20)
    .map((item) => `${item.sku}:${item.qty}`)
    .join(",");

  if (!normalized || normalized.length > 700) {
    return "";
  }
  return normalized;
}

function upsertOrderItem(context: DialogueSessionContext, sku: string, qty: number): void {
  const normalizedSku = sku.toUpperCase();
  const index = context.order.items.findIndex((item) => item.sku === normalizedSku);
  if (index >= 0) {
    context.order.items[index].qty = qty;
    return;
  }
  context.order.items.push({ sku: normalizedSku, qty });
}

function normalizeItems(items: unknown): Array<{
  sku: string;
  name: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  priceVnd: number;
  stockQty: number;
}> {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      sku: String((item as any)?.sku || ""),
      name: String((item as any)?.name || ""),
      category: (item as any)?.category ? String((item as any)?.category) : undefined,
      description: (item as any)?.description ? String((item as any)?.description) : undefined,
      imageUrl: (item as any)?.imageUrl ? String((item as any)?.imageUrl) : undefined,
      priceVnd: Number((item as any)?.priceVnd || 0),
      stockQty: Number((item as any)?.stockQty || 0),
    }))
    .filter((item) => !!item.sku && !!item.name);
}

type NaturalOrderCandidate = {
  qty: number;
  exact: boolean;
  top: MenuItem;
  alternatives: MenuItem[];
  previewItems: MenuItem[];
};

async function resolveNaturalOrderCandidate(
  message: string,
  backend: SalesBackend,
  correlationId: string,
  toolCalls: string[],
): Promise<NaturalOrderCandidate | null> {
  const parsed = parseNaturalOrderRequest(message);
  if (!parsed) {
    return null;
  }

  toolCalls.push("catalog_list");
  const listed = await backend.postTool<any>(
    "catalog_list",
    { query: parsed.queryRaw, page: 1, limit: 12 },
    correlationId,
  );
  let items = normalizeItems(listed.data?.items);
  if (items.length < 4) {
    items = await mergeCatalogFallbackPages(items, backend, correlationId, toolCalls);
  }
  if (!items.length) {
    return null;
  }

  const scored = items
    .map((item) => {
      const score = scoreOrderCandidate(parsed.queryNormalized, item);
      const exact = isExactOrderMatch(parsed.queryNormalized, item);
      return { item, score, exact };
    })
    .filter((entry) => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return null;
  }

  const top = scored[0];
  const exact = top.exact;
  if (!exact && top.score < 0.66) {
    return null;
  }
  const alternatives = scored.slice(1, 4).map((entry) => entry.item);
  return {
    qty: parsed.qty,
    exact,
    top: top.item,
    alternatives,
    previewItems: scored.slice(0, 4).map((entry) => entry.item),
  };
}

function parseNaturalOrderRequest(message: string): { qty: number; queryRaw: string; queryNormalized: string } | null {
  const raw = message.trim();
  if (!raw) {
    return null;
  }

  const normalized = normalizeVietnamese(raw);
  if (!looksLikeNaturalOrderPhrase(normalized)) {
    return null;
  }

  const parsedQty = parseQuantityFromNormalized(normalized);
  const qty = parsedQty && Number.isInteger(parsedQty) && parsedQty > 0 ? Math.min(20, parsedQty) : 1;

  const queryRaw = raw
    .replace(/^(cho|lay|them|dat|mua|goi|muon|muốn|minh muon|mình muốn|toi muon|tôi muốn)\s+/i, "")
    .replace(/\b(?:\d{1,2}|một|mot|hai|ba|bốn|bon|tư|tu|năm|nam|sáu|sau|bảy|bay|tám|tam|chín|chin|mười|muoi)\s*(?:ly|cốc|coc|chai|phan|phần)?\b/gi, " ")
    .replace(/\b(ly|cốc|coc|chai|phan|phần|nhe|voi|giup|mình|minh|em|anh|chi|toi|tôi|muon|muốn|can|cần|vui long)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const queryNormalized = normalizeVietnamese(queryRaw);
  if (queryNormalized.length < 2) {
    return null;
  }

  return { qty, queryRaw, queryNormalized };
}

function parseQuantityFromNormalized(normalized: string): number | null {
  const numericMatch = normalized.match(/\b(\d{1,2})\s*(?:ly|coc|chai|phan)?\b/);
  if (numericMatch) {
    const value = Number(numericMatch[1]);
    if (Number.isInteger(value) && value > 0) {
      return value;
    }
  }

  const wordRegex = new RegExp(`\\b(${QUANTITY_WORD_PATTERN})\\s*(?:ly|coc|chai|phan)?\\b`);
  const wordMatch = normalized.match(wordRegex);
  if (!wordMatch) {
    return null;
  }
  const key = wordMatch[1];
  return VI_QUANTITY_MAP[key] ?? null;
}

function scoreOrderCandidate(query: string, item: MenuItem): number {
  const name = normalizeVietnamese(item.name);
  const sku = normalizeVietnamese(item.sku).replace(/\s+/g, "");
  const q = query.trim();
  if (!q) {
    return 0;
  }

  if (name.includes(q)) {
    return 1;
  }

  const qNoSpace = q.replace(/\s+/g, "");
  if (sku.includes(qNoSpace)) {
    return 0.95;
  }

  const qTokens = q.split(" ").map((part) => part.trim()).filter((part) => part.length >= 2);
  const nTokens = name.split(" ").map((part) => part.trim()).filter((part) => part.length >= 2);
  if (!hasTokenSoftMatch(qTokens, nTokens)) {
    return 0;
  }

  const overlap = tokenOverlap(qTokens, nTokens);
  const phraseSim = bestPhraseSimilarity(qTokens, nTokens);
  const similarity = similarityScore(q, name);
  return Math.max(overlap, phraseSim, similarity * 0.85);
}

function tokenOverlap(queryTokens: string[], nameTokens: string[]): number {
  if (!queryTokens.length) {
    return 0;
  }
  let matched = 0;
  for (const queryToken of queryTokens) {
    if (nameTokens.some((nameToken) => areTokensSimilar(queryToken, nameToken))) {
      matched += 1;
    }
  }
  return matched / queryTokens.length;
}

function similarityScore(a: string, b: string): number {
  const left = a.replace(/\s+/g, " ").trim();
  const right = b.replace(/\s+/g, " ").trim();
  if (!left || !right) {
    return 0;
  }
  const dist = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) {
    return 0;
  }
  return Math.max(0, 1 - dist / maxLen);
}

function hasTokenSoftMatch(queryTokens: string[], nameTokens: string[]): boolean {
  if (!queryTokens.length || !nameTokens.length) {
    return false;
  }
  return queryTokens.some((qToken) =>
    nameTokens.some((nameToken) => areTokensSimilar(qToken, nameToken)),
  );
}

function areTokensSimilar(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  if (left.length >= 3 && right.length >= 3) {
    const leftPrefix = left.slice(0, 3);
    const rightPrefix = right.slice(0, 3);
    if (leftPrefix === rightPrefix) {
      return true;
    }
  }

  const distance = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length);
  if (maxLen >= 6 && distance <= 2) {
    return true;
  }
  if (maxLen >= 4 && distance <= 1) {
    return true;
  }
  return false;
}

function bestPhraseSimilarity(queryTokens: string[], nameTokens: string[]): number {
  if (!queryTokens.length || !nameTokens.length) {
    return 0;
  }
  const size = queryTokens.length;
  if (nameTokens.length < size) {
    return similarityScore(queryTokens.join(" "), nameTokens.join(" "));
  }
  let best = 0;
  for (let i = 0; i <= nameTokens.length - size; i += 1) {
    const phrase = nameTokens.slice(i, i + size).join(" ");
    const score = similarityScore(queryTokens.join(" "), phrase);
    if (score > best) {
      best = score;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

function truncateLabel(value: string, maxLength: number): string {
  const raw = String(value || "").trim();
  if (raw.length <= maxLength) {
    return raw;
  }
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function isExactOrderMatch(query: string, item: MenuItem): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return false;
  }
  const normalizedName = normalizeVietnamese(item.name);
  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }
  const normalizedSku = normalizeVietnamese(item.sku).replace(/\s+/g, "");
  const queryNoSpace = normalizedQuery.replace(/\s+/g, "");
  return queryNoSpace.length >= 2 && normalizedSku.includes(queryNoSpace);
}

async function mergeCatalogFallbackPages(
  current: MenuItem[],
  backend: SalesBackend,
  correlationId: string,
  toolCalls: string[],
): Promise<MenuItem[]> {
  const deduped = new Map<string, MenuItem>();
  for (const item of current) {
    deduped.set(item.sku, item);
  }

  for (let page = 1; page <= 3; page += 1) {
    toolCalls.push("catalog_list");
    const listed = await backend.postTool<any>(
      "catalog_list",
      { page, limit: 50 },
      correlationId,
    );
    const pageItems = normalizeItems(listed.data?.items);
    for (const item of pageItems) {
      if (!deduped.has(item.sku)) {
        deduped.set(item.sku, item);
      }
    }

    const total = Number((listed as any)?.data?.total || 0);
    const limit = Math.max(1, Number((listed as any)?.data?.limit || 50));
    if (total > 0 && page * limit >= total) {
      break;
    }
    if (!pageItems.length && total <= 0) {
      break;
    }
  }

  return Array.from(deduped.values());
}

function buildNaturalOrderExecution(
  context: DialogueSessionContext,
  naturalOrder: NaturalOrderCandidate,
  toolCalls: string[],
): PolicyExecution {
  const state: DialogueStateName = "ORDER_COLLECT_ITEMS";
  if (naturalOrder.exact) {
    delete context.pendingOrderSuggestion;
    upsertOrderItem(context, naturalOrder.top.sku, naturalOrder.qty);
    const lines = context.order.items.map((item) => `- ${item.sku} x${item.qty}`);
    return buildExecution(
      state,
      context,
      `Đã thêm ${naturalOrder.qty} x ${naturalOrder.top.name} vào giỏ.\n${lines.join("\n")}\nBấm 'Tiếp tục' để sang bước nhập thông tin nhận hàng.`,
      menuUi("Bước 1/6: Chọn món", naturalOrder.previewItems, orderStepSuggestions()),
      toolCalls,
      "order_natural_exact_match",
    );
  }

  context.pendingOrderSuggestion = {
    sku: naturalOrder.top.sku,
    qty: naturalOrder.qty,
    name: naturalOrder.top.name,
  };
  const confirmOptions: UiSuggestion[] = [
    suggestion(`Đúng, thêm x${naturalOrder.qty}`, `ACTION_ORDER_SET_QTY:${naturalOrder.top.sku}:${naturalOrder.qty}`),
  ];
  for (const alternative of naturalOrder.alternatives.slice(0, 2)) {
    confirmOptions.push(
      suggestion(`Đổi sang ${truncateLabel(alternative.name, 12)}`, `ACTION_ORDER_SET_QTY:${alternative.sku}:${naturalOrder.qty}`),
    );
  }
  confirmOptions.push(suggestion("Không, xem menu", "ACTION_VIEW_MENU"));

  return buildExecution(
    state,
    context,
    `Mình đoán bạn muốn đặt ${naturalOrder.qty} x ${naturalOrder.top.name}. Bạn xác nhận giúp mình nhé?`,
    menuUi("Xác nhận món gần đúng", naturalOrder.previewItems, confirmOptions),
    toolCalls,
    "order_natural_fuzzy_confirm",
  );
}

function normalizeVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAffirmativeText(input: string): boolean {
  const normalized = normalizeVietnamese(input);
  if (!normalized) {
    return false;
  }
  const terms = [
    "ok",
    "oke",
    "okela",
    "dong y",
    "dung",
    "dung roi",
    "chinh no",
    "chinh xac",
    "chuan",
    "chuan roi",
    "phai roi",
    "xac nhan",
    "yes",
    "u",
    "uh",
    "uhm",
    "um",
  ];
  return containsNormalizedTerm(normalized, terms);
}

function isNegativeText(input: string): boolean {
  const normalized = normalizeVietnamese(input);
  if (!normalized) {
    return false;
  }
  const terms = [
    "khong",
    "ko",
    "k",
    "khong dung",
    "khong phai",
    "khong phai roi",
    "no",
    "sai roi",
    "doi mon",
    "khong dung roi",
  ];
  return containsNormalizedTerm(normalized, terms);
}

function looksLikeHumanName(input: string): boolean {
  const raw = String(input || "").trim();
  if (!raw || raw.length < 2) {
    return false;
  }
  const digits = raw.replace(/\D+/g, "");
  if (digits.length >= 3) {
    return false;
  }
  const normalized = normalizeVietnamese(raw);
  if (!normalized) {
    return false;
  }
  const alphaChars = normalized.replace(/[^a-z]/g, "");
  if (alphaChars.length < 2) {
    return false;
  }
  return /\s/.test(normalized) || alphaChars.length >= 4;
}

function containsNormalizedTerm(normalized: string, terms: string[]): boolean {
  return terms.some((term) => {
    if (normalized === term) {
      return true;
    }
    if (normalized.startsWith(`${term} `)) {
      return true;
    }
    if (normalized.endsWith(` ${term}`)) {
      return true;
    }
    return normalized.includes(` ${term} `);
  });
}

function looksLikeNaturalOrderPhrase(normalized: string): boolean {
  if (!normalized) {
    return false;
  }
  if (new RegExp(`\\b(?:\\d{1,2}|${QUANTITY_WORD_PATTERN})\\s*(ly|coc|chai|phan)\\b`).test(normalized)) {
    return true;
  }
  if (containsNormalizedTerm(normalized, ["dat hang", "dat mon", "bat dau dat", "goi mon"])) {
    return false;
  }
  return /^(cho|lay|them|mua|goi)\b/.test(normalized);
}

function renderOrder(order: any): string {
  const lines = Array.isArray(order.items)
    ? order.items.map((item: any) => `- ${item.sku} x${item.qty} = ${formatVnd(Number(item.qty || 0) * Number(item.unitPriceVnd || 0))}`)
    : [];

  return [
    `Đơn ${String(order.orderCode || "")}`,
    `Trạng thái: ${String(order.status || "unknown")}`,
    `Tổng: ${formatVnd(Number(order.totalVnd || 0))}`,
    "Sản phẩm:",
    ...(lines.length ? lines : ["- (không có dữ liệu)"]),
  ].join("\n");
}

function buildExecution(
  nextState: DialogueStateName,
  nextContext: DialogueSessionContext,
  reply: string,
  ui: ReturnType<typeof menuUi> | undefined,
  toolCalls: string[],
  intent: string,
  forcedMissingFields?: string[],
): PolicyExecution {
  return {
    reply,
    ui,
    nextState,
    nextContext,
    confidence: intentConfidenceScore(intent),
    state: {
      name: nextState,
      missingFields: forcedMissingFields ?? getMissingFields(nextContext),
    },
    intent,
    toolCalls,
  };
}

function intentConfidenceScore(intent: string): number {
  const low: Record<string, number> = {
    fallback: 0.2,
    wizard_invalid_input: 0.35,
    invalid_phone: 0.45,
    invalid_address: 0.45,
    order_natural_fuzzy_confirm: 0.55,
    order_status_missing_code: 0.5,
  };
  if (intent in low) {
    return low[intent];
  }
  if (intent.startsWith("order_next_missing_")) {
    return 0.55;
  }
  if (intent.startsWith("order_natural_confirm_")) {
    return 0.65;
  }
  return 0.9;
}

import fs from "node:fs";
import path from "node:path";
import type { SalesBackend } from "../src/backends";
import type { OpenClawConfig } from "../src/config";
import { inferActionFromText } from "../src/dialogue/actionParser";
import { DialoguePolicyEngine } from "../src/dialogue/policyEngine";
import { defaultSessionContext, type DialogueSession } from "../src/dialogue/types";

type ParserEvalCase = {
  text: string;
  expected: string | null;
  bucket: string;
};

type PolicyEvalCase = {
  text: string;
  actionPayload?: string;
  expectFallback: boolean;
  label: string;
};

type EvalFailure = {
  text: string;
  expected: string | null;
  got: string | null;
  bucket?: string;
};

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

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function buildPhrases(cores: string[], prefixes: string[], suffixes: string[]): string[] {
  const output: string[] = [];
  for (const core of cores) {
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        output.push(`${prefix}${core}${suffix}`.replace(/\s+/g, " ").trim());
      }
    }
  }
  return dedupe(output);
}

function parserCases(): ParserEvalCase[] {
  const commonPrefixes = ["", "cho mình ", "cho tôi ", "shop ơi ", "bot ơi "];
  const commonSuffixes = ["", " nhé", " với", " đi"];

  const cases: ParserEvalCase[] = [];
  const push = (texts: string[], expected: string | null, bucket: string) => {
    for (const text of texts) {
      cases.push({ text, expected, bucket });
    }
  };

  push(
    buildPhrases(
      ["xem menu", "menu", "thuc don", "danh muc", "danh sach mon", "xem mon", "xem san pham", "co mon gi", "co cac mon nao", "goi y mon", "mon ban chay"],
      commonPrefixes,
      commonSuffixes,
    ),
    "ACTION_VIEW_MENU",
    "view_menu",
  );

  push(
    buildPhrases(
      ["dat mon", "goi mon", "dat hang", "bat dau dat", "tao don", "dat ngay", "len don", "cho toi dat", "minh muon dat", "toi muon dat", "chot mon", "order", "mua"],
      ["", "cho minh ", "cho toi ", "shop oi ", "bot oi "],
      commonSuffixes,
    ),
    "ACTION_ORDER_START",
    "order_start",
  );

  push(
    buildPhrases(
      ["kiem tra don", "kiem tra don hang", "tinh trang don", "trang thai don", "xem don", "ma don", "theo doi don", "order status", "track order", "don toi dau roi", "ship toi dau"],
      ["", "cho minh ", "cho toi ", "shop oi "],
      commonSuffixes,
    ),
    "ACTION_ORDER_STATUS",
    "order_status",
  );

  push(
    buildPhrases(
      ["tro giup", "help", "huong dan", "bot lam duoc gi", "lam duoc gi", "co the lam gi", "giup duoc gi", "chi toi cach dat", "huong dan dat mon", "chi toi cach dung"],
      ["", "cho minh ", "cho toi ", "bot oi "],
      commonSuffixes,
    ),
    "ACTION_HELP",
    "help",
  );

  push(
    buildPhrases(
      ["gap tu van vien", "gap nhan vien", "noi chuyen nguoi that", "noi chuyen voi nguoi that", "nguoi that", "tu van truc tiep", "cho minh gap admin", "live agent"],
      ["", "cho minh ", "cho toi ", "shop oi "],
      commonSuffixes,
    ),
    "ACTION_HANDOFF_REQUEST",
    "handoff_request",
  );

  push(
    buildPhrases(
      ["tiep tuc voi bot", "quay lai bot", "tro lai bot", "resume bot", "bot xu ly tiep"],
      ["", "ok ", "minh muon ", "cho minh "],
      ["", " nhé"],
    ),
    "ACTION_HANDOFF_RESUME",
    "handoff_resume",
  );

  push(buildPhrases(["tiep", "tiep tuc", "xong", "next", "continue", "qua buoc tiep", "sang buoc tiep"], ["", "ok ", "minh "], ["", " nhe"]), "ACTION_ORDER_NEXT", "wizard_next");
  push(buildPhrases(["quay lai", "tro lai", "back", "lui", "ve buoc truoc"], ["", "ok ", "minh "], ["", " nhe"]), "ACTION_ORDER_BACK", "wizard_back");
  push(buildPhrases(["huy", "huy don", "cancel", "dung dat", "thoi khong dat", "khong dat nua"], ["", "ok ", "minh "], ["", " nhe"]), "ACTION_ORDER_CANCEL", "wizard_cancel");
  push(buildPhrases(["xac nhan", "xac nhan dat don", "chot don", "confirm order", "xac nhan don"], ["", "ok ", "minh "], ["", " nhe"]), "ACTION_ORDER_CONFIRM", "wizard_confirm");

  push(
    buildPhrases(["ca phe", "bac xiu", "americano", "cold brew", "cappuccino", "espresso"], ["", "mon ", "nhom ", "xem "], ["", " nhe"]),
    "ACTION_CATEGORY",
    "category_coffee",
  );
  push(
    buildPhrases(["tra sua", "matcha latte", "tran chau", "milk tea"], ["", "mon ", "nhom ", "xem "], ["", " nhe"]),
    "ACTION_CATEGORY",
    "category_milk_tea",
  );
  push(
    buildPhrases(["tra trai cay", "tra dao", "tra vai", "tra hoa qua", "fruit tea"], ["", "mon ", "nhom ", "xem "], ["", " nhe"]),
    "ACTION_CATEGORY",
    "category_fruit_tea",
  );
  push(
    buildPhrases(["nuoc ep", "juice", "cam ep", "detox", "sinh to"], ["", "mon ", "nhom ", "xem "], ["", " nhe"]),
    "ACTION_CATEGORY",
    "category_juice",
  );

  push(
    dedupe([
      "cho 2 ly bạc xỉu",
      "mình muốn hai ly bạc xỉu",
      "cho 1 ly bac siu",
      "cho 3 ly americano",
      "lay 2 coc nuoc ep cam",
      "gọi 4 ly trà sữa",
      "them 2 ly tra dao",
      "mua 1 chai cold brew",
      "cho mot ly bac xiu",
      "cho ba ly cafe sua",
      "cho 5 ly bac siu",
      "cho 2 ly bac xiu nha",
      "lay 2 ly ca phe sua",
      "goi 2 ly sua tuoi tran chau",
      "mua 2 ly tra vai",
      "them 1 ly nuoc ep",
    ]),
    null,
    "natural_order_defer",
  );

  return cases;
}

function policyCases(): PolicyEvalCase[] {
  const actionable: PolicyEvalCase[] = [];
  const fallback: PolicyEvalCase[] = [];

  for (const text of [
    "xem menu",
    "menu có món gì",
    "danh mục đồ uống",
    "cho mình xem món",
    "co cac mon nao",
    "goi y mon",
    "món bán chạy",
    "xem thực đơn",
    "shop ơi menu",
    "xem sản phẩm",
    "mình muốn xem menu",
    "cho tôi xem menu nhé",
  ]) {
    actionable.push({ text, expectFallback: false, label: "view_menu" });
  }

  for (const text of [
    "đặt đơn",
    "đặt món",
    "gọi món",
    "đặt hàng",
    "mình muốn đặt món",
    "cho tôi đặt hàng",
    "bat dau dat",
    "tao don",
    "len don",
    "dat ngay",
  ]) {
    actionable.push({ text, expectFallback: false, label: "order_start" });
  }

  for (const text of [
    "kiểm tra đơn",
    "kiểm tra đơn hàng",
    "đơn tới đâu rồi",
    "trạng thái đơn",
    "track order",
    "order status",
    "xem đơn",
    "theo dõi đơn",
  ]) {
    actionable.push({ text, expectFallback: false, label: "order_status" });
  }

  for (const text of [
    "trợ giúp",
    "help",
    "hướng dẫn",
    "bot làm được gì",
    "có thể làm gì",
    "cách dùng bot",
  ]) {
    actionable.push({ text, expectFallback: false, label: "help" });
  }

  for (const text of [
    "gặp tư vấn viên",
    "nói chuyện người thật",
    "live agent",
    "human support",
    "cho mình gặp nhân viên",
  ]) {
    actionable.push({ text, expectFallback: false, label: "handoff_request" });
  }

  for (const text of ["tiếp tục với bot", "quay lại bot", "trở lại bot", "resume bot"]) {
    actionable.push({ text, expectFallback: false, label: "handoff_resume" });
  }

  for (const text of [
    "cho 2 ly bạc xỉu",
    "cho 1 ly bac siu",
    "mình muốn hai ly bạc xỉu",
    "cho 3 ly americano",
    "lay 2 ly nuoc ep cam",
    "goi 1 ly tra vai",
  ]) {
    actionable.push({ text, expectFallback: false, label: "natural_order" });
  }

  actionable.push({ text: "", actionPayload: "ACTION_ORDER_START", expectFallback: false, label: "action_payload" });
  actionable.push({ text: "", actionPayload: "ACTION_VIEW_MENU", expectFallback: false, label: "action_payload" });
  actionable.push({ text: "", actionPayload: "ACTION_HANDOFF_REQUEST", expectFallback: false, label: "action_payload" });
  actionable.push({ text: "", actionPayload: "ACTION_HELP", expectFallback: false, label: "action_payload" });

  for (const text of [
    "hôm nay trời đẹp",
    "bạn khỏe không",
    "kể chuyện vui đi",
    "bạn tên gì",
    "nói gì đó đi",
    "alo alo",
    "sao vậy",
    "hmm",
    "xyz123",
    "asdasd",
    "hello ???",
    "test test",
  ]) {
    fallback.push({ text, expectFallback: true, label: "fallback_expected" });
  }

  return [...actionable, ...fallback];
}

function createConfig(): OpenClawConfig {
  return {
    host: "0.0.0.0",
    port: 8082,
    llmBaseUrl: "https://api.openai.com/v1",
    llmApiKey: "eval-key",
    llmModel: "eval-model",
    llmTimeoutMs: 20_000,
    salesMcpUrl: "http://sales-mcp:8081",
    salesMcpApiKey: "sales-key",
    webBridgeBaseUrl: "http://lowland_app",
    webBridgeApiKey: "bridge-key",
    timeoutMs: 20_000,
    bankName: "Vietcombank",
    bankAccountName: "Lowland Coffee",
    bankAccountNumber: "123456789",
    openclawDbHost: "lowland_db",
    openclawDbPort: 3306,
    openclawDbName: "lowland_coffee",
    openclawDbUser: "web251",
    openclawDbPass: "Webhk251!",
    dialogEngineV2Enabled: true,
    dialogSessionTtlHours: 24,
  };
}

function createBackend(): SalesBackend {
  const catalog = [
    { sku: "WEB-P01", name: "Americano", category: "coffee", priceVnd: 35000, stockQty: 100, description: "Cafe den dam" },
    { sku: "WEB-P02", name: "Cà phê Bạc Xỉu", category: "coffee", priceVnd: 40000, stockQty: 100, description: "Bac xiu sua tuoi" },
    { sku: "WEB-P03", name: "Cà phê Sữa Đá", category: "coffee", priceVnd: 38000, stockQty: 100, description: "Cafe sua da" },
    { sku: "WEB-P04", name: "Trà Sữa Truyền Thống", category: "milk_tea", priceVnd: 45000, stockQty: 100, description: "Tra sua dam vi" },
    { sku: "WEB-P05", name: "Trà Đào Cam Sả", category: "fruit_tea", priceVnd: 42000, stockQty: 100, description: "Tra dao cam sa" },
    { sku: "WEB-P06", name: "Trà Lài Vải", category: "fruit_tea", priceVnd: 43000, stockQty: 100, description: "Tra vai thanh mat" },
    { sku: "WEB-P07", name: "Nước Ép Cam", category: "juice", priceVnd: 40000, stockQty: 100, description: "Nuoc ep cam tuoi" },
    { sku: "WEB-P08", name: "Dừa Tươi", category: "juice", priceVnd: 40000, stockQty: 100, description: "Dua tuoi nguyen trai" },
  ];

  return {
    channel: "web",
    postTool: async <T>(tool: any, body: any): Promise<{ ok: boolean; data: T; error?: string }> => {
      if (tool === "catalog_list") {
        const query = normalizeVietnamese(String(body?.query || ""));
        const category = String(body?.category || "").trim().toLowerCase();
        const filtered = catalog.filter((item) => {
          const passCategory = !category || item.category === category;
          if (!passCategory) {
            return false;
          }
          if (!query) {
            return true;
          }
          const haystack = normalizeVietnamese(`${item.name} ${item.sku} ${item.description || ""}`);
          return haystack.includes(query);
        });
        const page = Number(body?.page || 1);
        const limit = Number(body?.limit || 50);
        return { ok: true, data: { items: filtered, page, limit, total: filtered.length } as T };
      }

      if (tool === "catalog_get") {
        const target = normalizeVietnamese(String(body?.sku_or_id || ""));
        const found = catalog.find((item) => normalizeVietnamese(item.sku) === target || normalizeVietnamese(item.name) === target);
        return { ok: true, data: (found || null) as T };
      }

      if (tool === "order_get") {
        const orderCode = String(body?.order_code || "ORD-20260305-0001").toUpperCase();
        return {
          ok: true,
          data: {
            orderCode,
            status: "new",
            totalVnd: 80000,
            customerTelegramId: "eval-user",
            items: [{ sku: "WEB-P02", qty: 2, unitPriceVnd: 40000 }],
          } as T,
        };
      }

      if (tool === "order_create") {
        return {
          ok: true,
          data: {
            orderCode: "ORD-20260305-1234",
            totalVnd: 120000,
            paymentMethod: String(body?.payment_method || "cod"),
            status: "new",
          } as T,
        };
      }

      if (tool === "faq_answer") {
        return { ok: true, data: { answer: "Lowland Coffee mở cửa từ 7:00-22:00." } as T };
      }

      return { ok: false, data: {} as T, error: `unsupported_tool_${String(tool)}` };
    },
  };
}

function evaluateParser(): {
  total: number;
  accuracy: number;
  mismatches: EvalFailure[];
  byBucket: Record<string, { total: number; passed: number; accuracy: number }>;
} {
  const cases = parserCases();
  const mismatches: EvalFailure[] = [];
  const byBucket: Record<string, { total: number; passed: number; accuracy: number }> = {};

  let passed = 0;
  for (const testCase of cases) {
    const got = inferActionFromText(testCase.text)?.type ?? null;
    const ok = testCase.expected === "ACTION_CATEGORY" ? got === "ACTION_CATEGORY" : got === testCase.expected;
    if (!ok) {
      mismatches.push({ text: testCase.text, expected: testCase.expected, got, bucket: testCase.bucket });
    } else {
      passed += 1;
    }

    if (!byBucket[testCase.bucket]) {
      byBucket[testCase.bucket] = { total: 0, passed: 0, accuracy: 0 };
    }
    byBucket[testCase.bucket].total += 1;
    if (ok) {
      byBucket[testCase.bucket].passed += 1;
    }
  }

  for (const bucket of Object.keys(byBucket)) {
    const item = byBucket[bucket];
    item.accuracy = item.total > 0 ? item.passed / item.total : 0;
  }

  return {
    total: cases.length,
    accuracy: cases.length > 0 ? passed / cases.length : 0,
    mismatches,
    byBucket,
  };
}

async function evaluatePolicy(): Promise<{
  total: number;
  actionable: number;
  fallbackOnActionable: number;
  fallbackRate: number;
  falsePositiveActionable: number;
  failures: EvalFailure[];
}> {
  const backend = createBackend();
  const engine = new DialoguePolicyEngine(createConfig(), backend);
  const cases = policyCases();
  const failures: EvalFailure[] = [];

  let actionable = 0;
  let fallbackOnActionable = 0;
  let falsePositiveActionable = 0;

  for (let index = 0; index < cases.length; index += 1) {
    const entry = cases[index];
    const session: DialogueSession = {
      channel: "web",
      userId: `eval-user-${index}`,
      state: "IDLE",
      context: defaultSessionContext(),
      version: 1,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };

    const result = await engine.run(
      {
        userId: "eval-user",
        channel: "web",
        message: entry.text,
        actionPayload: entry.actionPayload,
        correlationId: `dialogue-eval-${index}`,
        profile: { name: "Eval User", phone: "0909000001" },
      },
      session,
    );

    const gotFallback = result.intent === "fallback";
    if (!entry.expectFallback) {
      actionable += 1;
      if (gotFallback) {
        fallbackOnActionable += 1;
        failures.push({
          text: entry.text || entry.actionPayload || "(empty)",
          expected: "non_fallback",
          got: result.intent || null,
          bucket: entry.label,
        });
      }
    } else if (!gotFallback) {
      falsePositiveActionable += 1;
    }
  }

  return {
    total: cases.length,
    actionable,
    fallbackOnActionable,
    fallbackRate: actionable > 0 ? fallbackOnActionable / actionable : 0,
    falsePositiveActionable,
    failures,
  };
}

async function main(): Promise<void> {
  const parser = evaluateParser();
  const policy = await evaluatePolicy();

  const minParserTotal = Number(process.env.DIALOG_EVAL_MIN_TOTAL || 250);
  const minParserAccuracy = Number(process.env.DIALOG_EVAL_MIN_ACCURACY || 0.93);
  const maxPolicyFallbackRate = Number(process.env.DIALOG_EVAL_MAX_FALLBACK_RATE || 0.12);

  const checks = {
    parserTotal: parser.total >= minParserTotal,
    parserAccuracy: parser.accuracy >= minParserAccuracy,
    policyFallback: policy.fallbackRate <= maxPolicyFallbackRate,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    thresholds: {
      minParserTotal,
      minParserAccuracy,
      maxPolicyFallbackRate,
    },
    parser: {
      total: parser.total,
      accuracy: parser.accuracy,
      mismatchCount: parser.mismatches.length,
      byBucket: parser.byBucket,
      mismatches: parser.mismatches.slice(0, 40),
    },
    policy: {
      total: policy.total,
      actionable: policy.actionable,
      fallbackOnActionable: policy.fallbackOnActionable,
      fallbackRate: policy.fallbackRate,
      falsePositiveActionable: policy.falsePositiveActionable,
      failures: policy.failures.slice(0, 40),
    },
  };

  const reportDir = path.resolve(__dirname, "..", ".artifacts");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "dialogue-eval-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[dialogue-eval] parser_total=${parser.total}`);
  console.log(`[dialogue-eval] parser_accuracy=${(parser.accuracy * 100).toFixed(2)}%`);
  console.log(`[dialogue-eval] policy_fallback_rate=${(policy.fallbackRate * 100).toFixed(2)}%`);
  console.log(`[dialogue-eval] report=${reportPath}`);

  if (!checks.parserTotal || !checks.parserAccuracy || !checks.policyFallback) {
    console.error("[dialogue-eval] FAILED thresholds", checks);
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error("[dialogue-eval] fatal", error);
  process.exit(1);
});

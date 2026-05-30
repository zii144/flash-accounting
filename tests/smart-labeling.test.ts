import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GLOSSARY_PREFERENCES } from "../utils/glossary-defaults";
import { buildSemanticPatterns } from "../utils/glossary-merge";
import {
  canonicalizeConsumptionLabel,
  getConsumptionSuggestions,
  type SemanticPattern,
} from "../utils/smart-consumption";

const zhPatterns = buildSemanticPatterns(
  DEFAULT_GLOSSARY_PREFERENCES,
  (key) =>
    ({
      dinner: "晚餐",
      lunch: "午餐",
      breakfast: "早餐",
      coffee: "咖啡",
      groceries: "日用品",
      transport: "交通",
      shopping: "購物",
      subscription: "訂閱",
      rent: "房租",
      salary: "薪水",
      freelance: "接案",
      refund: "退款",
    })[key] ?? key,
  "zh",
);

test("canonicalize maps locale terms to localized labels", () => {
  assert.equal(canonicalizeConsumptionLabel("捷運", zhPatterns, "未標記"), "交通");
  assert.equal(canonicalizeConsumptionLabel("晚餐", zhPatterns, "未標記"), "晚餐");
});

test("custom glossary entries take priority over built-ins", () => {
  const patterns: SemanticPattern[] = [
    {
      label: "Bubble Tea",
      type: "expense",
      terms: ["boba", "bubble tea"],
    },
    {
      label: "Coffee",
      type: "expense",
      terms: ["coffee", "latte"],
    },
  ];

  assert.equal(canonicalizeConsumptionLabel("boba run", patterns), "Bubble Tea");
});

test("longest matching term wins when multiple patterns overlap", () => {
  const patterns: SemanticPattern[] = [
    {
      label: "Lunch",
      type: "expense",
      terms: ["meal"],
    },
    {
      label: "Lunch Special",
      type: "expense",
      terms: ["noon meal"],
    },
  ];

  assert.equal(canonicalizeConsumptionLabel("noon meal deal", patterns), "Lunch Special");
});

test("suggestions stay empty until there is input", () => {
  assert.deepEqual(getConsumptionSuggestions("", [], new Date(), zhPatterns), []);
});

test("suggestions include localized dinner label for partial dine input", () => {
  const suggestions = getConsumptionSuggestions("di", [], new Date("2026-05-30T19:00:00"), zhPatterns);
  const dinner = suggestions.find((item) => item.label === "晚餐");

  assert.ok(dinner);
  assert.equal(dinner?.inferredType, "expense");
});

test("disabled built-ins are excluded from effective patterns", () => {
  const resolveLabel = (key: string) =>
    ({
      dinner: "晚餐",
      lunch: "午餐",
      coffee: "咖啡",
    })[key] ?? key;

  const patterns = buildSemanticPatterns(
    {
      ...DEFAULT_GLOSSARY_PREFERENCES,
      builtinOverrides: {
        dinner: { disabled: true },
      },
    },
    resolveLabel,
    "zh",
  );

  assert.equal(patterns.some((pattern) => pattern.label === "晚餐"), false);
  assert.equal(
    getConsumptionSuggestions("di", [], new Date("2026-05-30T19:00:00"), patterns).some(
      (item) => item.label === "晚餐",
    ),
    false,
  );
});

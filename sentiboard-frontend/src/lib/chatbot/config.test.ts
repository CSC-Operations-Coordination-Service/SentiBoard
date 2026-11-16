import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatbotEnabled,
  chatbotTimeoutMs,
  chatbotUrl,
  resetChatbotConfigWarnings,
} from "./config";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetChatbotConfigWarnings();
  vi.stubEnv("CHATBOT_ENABLED", "");
  vi.stubEnv("CHATBOT_URL", "");
  vi.stubEnv("CHATBOT_TIMEOUT_MS", "");
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("chatbotEnabled", () => {
  it("is off by default", () => {
    expect(chatbotEnabled()).toBe(false);
  });

  it.each(["false", "TRUE", "1", "yes", " true"])("is off for %j", (value) => {
    vi.stubEnv("CHATBOT_ENABLED", value);
    vi.stubEnv("CHATBOT_URL", "http://chatbot.test");
    expect(chatbotEnabled()).toBe(false);
  });

  it("is on for exactly \"true\" with a URL", () => {
    vi.stubEnv("CHATBOT_ENABLED", "true");
    vi.stubEnv("CHATBOT_URL", "http://chatbot.test");
    expect(chatbotEnabled()).toBe(true);
  });

  it("stays off without a URL, and warns once", () => {
    vi.stubEnv("CHATBOT_ENABLED", "true");
    expect(chatbotEnabled()).toBe(false);
    expect(chatbotEnabled()).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("chatbotUrl", () => {
  it("trims whitespace and trailing slashes", () => {
    vi.stubEnv("CHATBOT_URL", " http://chatbot.test:8000/// ");
    expect(chatbotUrl()).toBe("http://chatbot.test:8000");
  });

  it("is null when unset or blank", () => {
    expect(chatbotUrl()).toBeNull();
    vi.stubEnv("CHATBOT_URL", "   ");
    expect(chatbotUrl()).toBeNull();
  });
});

describe("chatbotTimeoutMs", () => {
  it("defaults to 60 s", () => {
    expect(chatbotTimeoutMs()).toBe(60_000);
  });

  it("reads a positive number", () => {
    vi.stubEnv("CHATBOT_TIMEOUT_MS", "15000");
    expect(chatbotTimeoutMs()).toBe(15_000);
  });

  it.each(["0", "-5", "abc"])("falls back to the default for %j", (value) => {
    vi.stubEnv("CHATBOT_TIMEOUT_MS", value);
    expect(chatbotTimeoutMs()).toBe(60_000);
  });
});

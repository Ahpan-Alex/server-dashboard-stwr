import { describe, expect, it } from "vitest";
import { normaliserTelephoneWhatsapp } from "../lib/envoi-document.js";

describe("normaliserTelephoneWhatsapp", () => {
  it("passe un n° malgache 0… en 261…", () => {
    expect(normaliserTelephoneWhatsapp("032 00 000 00")).toBe("261320000000");
  });

  it("garde un préfixe 261", () => {
    expect(normaliserTelephoneWhatsapp("+261 32 00 000 00")).toBe(
      "261320000000",
    );
  });

  it("accepte 9 chiffres locaux", () => {
    expect(normaliserTelephoneWhatsapp("320000000")).toBe("261320000000");
  });

  it("refuse un numéro trop court", () => {
    expect(normaliserTelephoneWhatsapp("123")).toBeNull();
  });
});

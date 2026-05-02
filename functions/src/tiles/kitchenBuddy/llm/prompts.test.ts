import { describe, expect, it } from "vitest";
import {
  buildGenerateMealPlanUserPrompt,
  type GenerateMealPlanContext,
} from "./prompts";
import { createMockProvider } from "./mock";

const SAMPLE_CTX: GenerateMealPlanContext = {
  dateDebutISO: "2026-05-04",
  dateFinISO: "2026-05-10",
  saison: "printemps",
  profils: [
    {
      id: "p-julie",
      nom: "Julie",
      regimes: [],
      aversions: ["coriandre"],
      objectifsNutrition: ["+ protéines"],
      prefsCuisson: [],
      notes: undefined,
    },
    {
      id: "p-adele",
      nom: "Adèle",
      regimes: ["sans porc"],
      aversions: ["courgettes"],
      objectifsNutrition: [],
      prefsCuisson: ["rapide <20min"],
      notes: "ne mange pas de légumineuses entières",
    },
  ],
  presence: [
    { slotId: "0-petitDej", jour: 0, repas: "petitDej", profilIds: ["p-julie", "p-adele"] },
    { slotId: "0-dej", jour: 0, repas: "dej", profilIds: ["p-adele"] },
    { slotId: "0-diner", jour: 0, repas: "diner", profilIds: [] },
  ],
  contexte: {
    batchCookingOk: true,
    style: "léger, plus végé",
    frigoTexte: "reste de poulet, 3 courgettes",
  },
};

describe("buildGenerateMealPlanUserPrompt", () => {
  it("inclut tous les profils avec leurs contraintes", () => {
    const prompt = buildGenerateMealPlanUserPrompt(SAMPLE_CTX);
    expect(prompt).toContain("Julie");
    expect(prompt).toContain("Adèle");
    expect(prompt).toContain("coriandre");
    expect(prompt).toContain("sans porc");
    expect(prompt).toContain("courgettes");
    expect(prompt).toContain("rapide <20min");
    expect(prompt).toContain("légumineuses entières");
  });

  it("indique correctement les slots PERSONNE", () => {
    const prompt = buildGenerateMealPlanUserPrompt(SAMPLE_CTX);
    expect(prompt).toContain("dimanche");
    expect(prompt).toContain("PERSONNE");
  });

  it("inclut le frigo et le style", () => {
    const prompt = buildGenerateMealPlanUserPrompt(SAMPLE_CTX);
    expect(prompt).toContain("reste de poulet");
    expect(prompt).toContain("léger, plus végé");
  });

  it("active la mention batch cooking si OK", () => {
    const prompt = buildGenerateMealPlanUserPrompt(SAMPLE_CTX);
    expect(prompt).toContain("OUI");
    expect(prompt).toContain("batch");
  });

  it("désactive le batch cooking si OFF", () => {
    const ctx = { ...SAMPLE_CTX, contexte: { ...SAMPLE_CTX.contexte, batchCookingOk: false } };
    const prompt = buildGenerateMealPlanUserPrompt(ctx);
    expect(prompt).toContain("NON");
  });

  it("référence chaque slotId dans le prompt", () => {
    const prompt = buildGenerateMealPlanUserPrompt(SAMPLE_CTX);
    expect(prompt).toContain('slotId="0-petitDej"');
    expect(prompt).toContain('slotId="0-dej"');
    expect(prompt).toContain('slotId="0-diner"');
  });

  it("inclut un message par défaut pour profil sans contrainte", () => {
    const ctx: GenerateMealPlanContext = {
      ...SAMPLE_CTX,
      profils: [
        {
          id: "p-guillaume",
          nom: "Guillaume",
          regimes: [],
          aversions: [],
          objectifsNutrition: [],
          prefsCuisson: [],
        },
      ],
    };
    const prompt = buildGenerateMealPlanUserPrompt(ctx);
    expect(prompt).toContain("Aucune contrainte particulière");
  });
});

describe("createMockProvider", () => {
  it("retourne un plan factice valide via generateStructured", async () => {
    const provider = createMockProvider();
    const res = await provider.generateStructured<{
      recettes: unknown[];
      slots: unknown[];
      courses: unknown[];
    }>({
      systemPrompt: "test",
      userPrompt: "test",
      schema: {},
    });
    expect(res.data.recettes.length).toBeGreaterThan(0);
    expect(res.data.slots.length).toBe(21);
    expect(res.data.courses.length).toBeGreaterThan(0);
    expect(res.usage.inputTokens).toBeGreaterThan(0);
  });

  it("scripte les réponses chat en séquence", async () => {
    const provider = createMockProvider({
      chatScript: [
        {
          assistantMessage: "Je déplace les lasagnes au jeudi.",
          toolCalls: [
            { name: "swapSlots", args: { slotIdA: "1-diner", slotIdB: "3-diner" } },
            { name: "respondToUser", args: { message: "C'est fait." } },
          ],
        },
        {
          assistantMessage: "Adèle absente vendredi soir, je régénère.",
          toolCalls: [
            { name: "updatePresence", args: { slotId: "4-diner", profilIds: [] } },
          ],
        },
      ],
    });

    const r1 = await provider.chat({
      systemPrompt: "",
      history: [],
      userMessage: "déplace les lasagnes au jeudi",
      tools: [],
    });
    expect(r1.toolCalls[0].name).toBe("swapSlots");
    expect(r1.assistantMessage).toContain("jeudi");

    const r2 = await provider.chat({
      systemPrompt: "",
      history: [],
      userMessage: "Adèle absente vendredi",
      tools: [],
    });
    expect(r2.toolCalls[0].name).toBe("updatePresence");
  });

  it("fallback sur respondToUser si pas de script", async () => {
    const provider = createMockProvider();
    const r = await provider.chat({
      systemPrompt: "",
      history: [],
      userMessage: "?",
      tools: [],
    });
    expect(r.toolCalls[0].name).toBe("respondToUser");
  });
});

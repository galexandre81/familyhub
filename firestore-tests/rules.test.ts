import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "..", "firestore.rules");

const HID = "h1";
const MEMBER_UID = "member-1";
const OUTSIDER_UID = "outsider-1";
const DISPLAY_ID = "disp-1";
const DISPLAY_UID = `display:${DISPLAY_ID}`;

// Custom claims carried by a kiosk/display custom token (cf. functions exchangeSetupToken).
const DISPLAY_CLAIMS = {
  isDisplay: true,
  householdId: HID,
  displayId: DISPLAY_ID,
};

let testEnv: RulesTestEnvironment;

/** Firestore handle for a household MEMBER. */
function memberDb() {
  return testEnv.authenticatedContext(MEMBER_UID).firestore();
}
/** Firestore handle for the kiosk DISPLAY (custom claims). */
function displayDb() {
  return testEnv.authenticatedContext(DISPLAY_UID, DISPLAY_CLAIMS).firestore();
}
/** Firestore handle for an authenticated NON-member. */
function outsiderDb() {
  return testEnv.authenticatedContext(OUTSIDER_UID).firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-fh",
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed baseline data with rules disabled.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "households", HID), {
      nom: "Foyer Test",
      ownerUid: MEMBER_UID,
      membres: [MEMBER_UID],
      parametres: { localisation: {}, langue: "fr", systemeUnites: "metric", themeId: "caractere" },
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households", HID, "profils", "p1"), {
      nom: "Léo",
      couleur: "#E07A5F",
      initiale: "L",
      regimes: [],
      aversions: [],
      objectifsNutrition: [],
      prefsCuisson: [],
      contraintesMedicales: [{ terme: "arachide", type: "medical" }],
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households", HID, "mealPlans", "mp1"), {
      nom: "Semaine 1",
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households", HID, "recettes", "r1"), {
      titre: "Soupe",
      statut: "propose",
      excluded: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households", HID, "tiles", "t1"), {
      type: "weather",
      createdAt: 1,
    });
    await setDoc(doc(db, "households", HID, "shoppingLists", "sl1"), {
      nom: "Courses",
      items: [],
      updatedAt: 1,
    });
    await setDoc(doc(db, "households", HID, "timers", "tm1"), {
      label: "Pâtes",
      durationSeconds: 600,
    });
    await setDoc(doc(db, "households", HID, "displays", DISPLAY_ID), {
      nom: "Cuisine",
      layout: [],
      updatedAt: 1,
    });
    await setDoc(
      doc(db, "households", HID, "displays", DISPLAY_ID, "snapshot", "current"),
      { generatedAt: 1, ttlSeconds: 3600, tiles: {} },
    );
  });
});

describe("member access", () => {
  it("can read + write household", async () => {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, "households", HID)));
    await assertSucceeds(updateDoc(doc(db, "households", HID), { updatedAt: 2 }));
  });

  it("can read + write profils (medical data)", async () => {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, "households", HID, "profils", "p1")));
    await assertSucceeds(updateDoc(doc(db, "households", HID, "profils", "p1"), { updatedAt: 2 }));
  });

  it("can read + write mealPlans", async () => {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, "households", HID, "mealPlans", "mp1")));
    await assertSucceeds(updateDoc(doc(db, "households", HID, "mealPlans", "mp1"), { updatedAt: 2 }));
  });

  it("can read + write recettes", async () => {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, "households", HID, "recettes", "r1")));
    await assertSucceeds(updateDoc(doc(db, "households", HID, "recettes", "r1"), { titre: "Velouté" }));
  });

  it("can read + write tiles", async () => {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, "households", HID, "tiles", "t1")));
    await assertSucceeds(setDoc(doc(db, "households", HID, "tiles", "t2"), { type: "clock" }));
  });

  it("can read + write shoppingLists", async () => {
    const db = memberDb();
    await assertSucceeds(getDoc(doc(db, "households", HID, "shoppingLists", "sl1")));
    await assertSucceeds(updateDoc(doc(db, "households", HID, "shoppingLists", "sl1"), { updatedAt: 2 }));
  });

  it("cannot change ownerUid via update", async () => {
    const db = memberDb();
    await assertFails(updateDoc(doc(db, "households", HID), { ownerUid: OUTSIDER_UID }));
  });

  it("cannot change membres via update", async () => {
    const db = memberDb();
    await assertFails(updateDoc(doc(db, "households", HID), { membres: [MEMBER_UID, OUTSIDER_UID] }));
  });
});

describe("display (kiosk) allowed reads", () => {
  it("can read household doc", async () => {
    await assertSucceeds(getDoc(doc(displayDb(), "households", HID)));
  });
  it("can read tiles", async () => {
    await assertSucceeds(getDoc(doc(displayDb(), "households", HID, "tiles", "t1")));
  });
  it("can read its display doc", async () => {
    await assertSucceeds(getDoc(doc(displayDb(), "households", HID, "displays", DISPLAY_ID)));
  });
  it("can read its snapshot/current", async () => {
    await assertSucceeds(
      getDoc(doc(displayDb(), "households", HID, "displays", DISPLAY_ID, "snapshot", "current")),
    );
  });
  it("can read recettes", async () => {
    await assertSucceeds(getDoc(doc(displayDb(), "households", HID, "recettes", "r1")));
  });
  it("can read shoppingLists", async () => {
    await assertSucceeds(getDoc(doc(displayDb(), "households", HID, "shoppingLists", "sl1")));
  });
  it("can read timers", async () => {
    await assertSucceeds(getDoc(doc(displayDb(), "households", HID, "timers", "tm1")));
  });
});

describe("display (kiosk) forbidden reads", () => {
  it("CANNOT read profils (medical data)", async () => {
    await assertFails(getDoc(doc(displayDb(), "households", HID, "profils", "p1")));
  });
  it("CANNOT read mealPlans", async () => {
    await assertFails(getDoc(doc(displayDb(), "households", HID, "mealPlans", "mp1")));
  });
});

describe("display (kiosk) writes", () => {
  it("can update a recette statut/excluded/updatedAt", async () => {
    await assertSucceeds(
      updateDoc(doc(displayDb(), "households", HID, "recettes", "r1"), {
        statut: "accepte",
        excluded: true,
        updatedAt: 2,
      }),
    );
  });

  it("CANNOT update other recette fields", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID, "recettes", "r1"), { titre: "Hacked" }),
    );
  });

  it("CANNOT write profils", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID, "profils", "p1"), { nom: "Hacked" }),
    );
  });

  it("can update household parametres.themeId", async () => {
    await assertSucceeds(
      updateDoc(doc(displayDb(), "households", HID), {
        parametres: {
          localisation: {},
          langue: "fr",
          systemeUnites: "metric",
          themeId: "ocean",
        },
        updatedAt: 2,
      }),
    );
  });

  it("CANNOT change membres", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID), { membres: [MEMBER_UID, "x"] }),
    );
  });

  it("CANNOT change ownerUid", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID), { ownerUid: "x" }),
    );
  });
});

describe("non-member access", () => {
  it("cannot read household", async () => {
    await assertFails(getDoc(doc(outsiderDb(), "households", HID)));
  });
  it("cannot read profils", async () => {
    await assertFails(getDoc(doc(outsiderDb(), "households", HID, "profils", "p1")));
  });
});

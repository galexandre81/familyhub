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
const OTHER_DISPLAY_ID = "disp-2";
const HID_B = "h2";

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
      roles: { [MEMBER_UID]: "parent" },
      parametres: { localisation: {}, langue: "fr", systemeUnites: "metric" },
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "invitations", "ABCDEFGHJK"), {
      householdId: HID,
      createdBy: MEMBER_UID,
      createdAt: 1,
      expiresAt: 9_999_999_999_999,
      role: "parent",
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
      config: { selectedLocationId: "loc1" },
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
    // Un second écran du même foyer : son doc porte ses propres jetons.
    await setDoc(doc(db, "households", HID, "displays", OTHER_DISPLAY_ID), {
      nom: "Salon",
      layout: [],
      authToken: "secret-de-l-autre-ecran",
      updatedAt: 1,
    });
    await setDoc(
      doc(db, "households", HID, "displays", OTHER_DISPLAY_ID, "snapshot", "current"),
      { generatedAt: 1, ttlSeconds: 3600, tiles: {} },
    );
    await setDoc(doc(db, "households", HID, "private", "calendar"), {
      icalUrl: "https://calendar.google.com/calendar/ical/x/private-y/basic.ics",
    });
    // Un autre foyer, avec son timer.
    await setDoc(doc(db, "households", HID_B), {
      nom: "Foyer B",
      ownerUid: OUTSIDER_UID,
      membres: [OUTSIDER_UID],
      parametres: {},
      createdAt: 1,
      updatedAt: 1,
    });
    await setDoc(doc(db, "households", HID_B, "timers", "tmB"), { label: "Riz" });
    await setDoc(doc(db, "households", HID_B, "tiles", "tB"), {
      type: "weather",
      config: { selectedLocationId: "loc1" },
      createdAt: 1,
    });
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

  it("cannot change roles via update (ajout d'un parent)", async () => {
    const db = memberDb();
    await assertFails(
      updateDoc(doc(db, "households", HID), {
        roles: { [MEMBER_UID]: "parent", [OUTSIDER_UID]: "parent" },
      }),
    );
  });

  it("cannot change roles via update (chemin pointé)", async () => {
    const db = memberDb();
    await assertFails(updateDoc(doc(db, "households", HID), { [`roles.${MEMBER_UID}`]: "enfant" }));
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

  it("CANNOT update household parametres", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID), {
        parametres: { localisation: {}, langue: "en", systemeUnites: "metric" },
        updatedAt: 2,
      }),
    );
  });

  it("can update tile config.selectedLocationId", async () => {
    await assertSucceeds(
      updateDoc(doc(displayDb(), "households", HID, "tiles", "t1"), {
        "config.selectedLocationId": "loc2",
        updatedAt: 2,
      }),
    );
  });

  it("CANNOT update tile config.url", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID, "tiles", "t1"), {
        "config.url": "https://evil.example",
        updatedAt: 2,
      }),
    );
  });

  it("CANNOT update tile config.selectedLocationId with a non-string value", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID, "tiles", "t1"), {
        "config.selectedLocationId": 42,
        updatedAt: 2,
      }),
    );
  });

  it("CANNOT update tile from another household's display", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID_B, "tiles", "tB"), {
        "config.selectedLocationId": "loc2",
        updatedAt: 2,
      }),
    );
  });

  it("CANNOT update tile type", async () => {
    await assertFails(
      updateDoc(doc(displayDb(), "households", HID, "tiles", "t1"), { type: "clock" }),
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

describe("création de foyer", () => {
  const base = {
    nom: "Mon foyer",
    parametres: {},
    createdAt: 1,
    updatedAt: 1,
  };

  it("un compte crée un foyer dont il est le seul membre", async () => {
    await assertSucceeds(
      setDoc(doc(outsiderDb(), "households", "neuf"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID],
      }),
    );
  });

  it("REFUSE d'inscrire l'uid d'un autre dans membres", async () => {
    await assertFails(
      setDoc(doc(outsiderDb(), "households", "piege"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID, MEMBER_UID],
      }),
    );
  });

  it("REFUSE les champs inconnus", async () => {
    await assertFails(
      setDoc(doc(outsiderDb(), "households", "piege2"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID],
        admin: true,
      }),
    );
  });

  it("accepte roles = { moi: parent }", async () => {
    await assertSucceeds(
      setDoc(doc(outsiderDb(), "households", "avecRoles"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID],
        roles: { [OUTSIDER_UID]: "parent" },
      }),
    );
  });

  it("REFUSE roles = { autre: parent }", async () => {
    await assertFails(
      setDoc(doc(outsiderDb(), "households", "piegeRoles"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID],
        roles: { [MEMBER_UID]: "parent" },
      }),
    );
  });

  it("REFUSE roles = { moi: parent, autre: parent }", async () => {
    await assertFails(
      setDoc(doc(outsiderDb(), "households", "piegeRoles2"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID],
        roles: { [OUTSIDER_UID]: "parent", [MEMBER_UID]: "parent" },
      }),
    );
  });

  it("REFUSE roles = { moi: enfant }", async () => {
    await assertFails(
      setDoc(doc(outsiderDb(), "households", "piegeRoles3"), {
        ...base,
        ownerUid: OUTSIDER_UID,
        membres: [OUTSIDER_UID],
        roles: { [OUTSIDER_UID]: "enfant" },
      }),
    );
  });

  it("REFUSE la création par un écran", async () => {
    await assertFails(
      setDoc(doc(displayDb(), "households", "piege3"), {
        ...base,
        ownerUid: DISPLAY_UID,
        membres: [DISPLAY_UID],
      }),
    );
  });
});

describe("cloisonnement des écrans", () => {
  it("un écran NE lit PAS le doc d'un autre écran du foyer", async () => {
    await assertFails(getDoc(doc(displayDb(), "households", HID, "displays", OTHER_DISPLAY_ID)));
  });

  it("un écran NE lit PAS le snapshot d'un autre écran", async () => {
    await assertFails(
      getDoc(doc(displayDb(), "households", HID, "displays", OTHER_DISPLAY_ID, "snapshot", "current")),
    );
  });

  it("un écran NE lit PAS un autre foyer", async () => {
    await assertFails(getDoc(doc(displayDb(), "households", HID_B)));
    await assertFails(getDoc(doc(displayDb(), "households", HID_B, "timers", "tmB")));
  });

  it("un membre lit tous les écrans de son foyer", async () => {
    await assertSucceeds(getDoc(doc(memberDb(), "households", HID, "displays", OTHER_DISPLAY_ID)));
  });
});

describe("adresse iCal privée du foyer", () => {
  it("un membre la lit et l'écrit", async () => {
    const ref = doc(memberDb(), "households", HID, "private", "calendar");
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref, { icalUrl: "https://exemple.org/a.ics" }));
  });

  it("un écran NE la lit PAS", async () => {
    await assertFails(getDoc(doc(displayDb(), "households", HID, "private", "calendar")));
  });

  it("un non-membre NE la lit PAS", async () => {
    await assertFails(getDoc(doc(outsiderDb(), "households", HID, "private", "calendar")));
  });
});

describe("invitations (Functions uniquement)", () => {
  it("un membre NE lit PAS une invitation", async () => {
    await assertFails(getDoc(doc(memberDb(), "invitations", "ABCDEFGHJK")));
  });

  it("un non-membre NE lit PAS une invitation", async () => {
    await assertFails(getDoc(doc(outsiderDb(), "invitations", "ABCDEFGHJK")));
  });

  it("personne N'écrit une invitation (ni création, ni marquage utilisé)", async () => {
    await assertFails(
      setDoc(doc(outsiderDb(), "invitations", "NOUVEAU234"), {
        householdId: HID,
        createdBy: OUTSIDER_UID,
        role: "parent",
      }),
    );
    await assertFails(
      updateDoc(doc(memberDb(), "invitations", "ABCDEFGHJK"), { usedBy: OUTSIDER_UID }),
    );
  });

  it("un écran NE lit PAS une invitation", async () => {
    await assertFails(getDoc(doc(displayDb(), "invitations", "ABCDEFGHJK")));
  });
});

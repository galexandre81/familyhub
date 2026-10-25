import { describe, expect, it } from "vitest";
import { ecrireParLots } from "./ecritureParLots";

interface FauxLot {
  ops: number[];
  commit: () => Promise<void>;
  committed: boolean;
}

function fabrique() {
  const lots: FauxLot[] = [];
  const creer = () => {
    const lot: FauxLot = {
      ops: [],
      committed: false,
      commit: async () => {
        lot.committed = true;
      },
    };
    lots.push(lot);
    return lot;
  };
  return { lots, creer };
}

const op = (n: number) => (b: FauxLot) => {
  b.ops.push(n);
};

describe("ecrireParLots", () => {
  it("1 001 opérations → 3 lots (450, 450, 101), tous validés, dans l'ordre", async () => {
    const { lots, creer } = fabrique();
    const ops = Array.from({ length: 1001 }, (_, i) => op(i));
    await ecrireParLots(creer, ops);
    expect(lots.map((l) => l.ops.length)).toEqual([450, 450, 101]);
    expect(lots.every((l) => l.committed)).toBe(true);
    expect(lots.flatMap((l) => l.ops)).toEqual(Array.from({ length: 1001 }, (_, i) => i));
  });

  it("taille personnalisée ; aucune opération → aucun lot", async () => {
    const a = fabrique();
    await ecrireParLots(a.creer, [op(1), op(2), op(3)], 2);
    expect(a.lots.map((l) => l.ops)).toEqual([[1, 2], [3]]);
    const vide = fabrique();
    await ecrireParLots(vide.creer, []);
    expect(vide.lots).toHaveLength(0);
  });

  it("un lot qui échoue arrête la suite (les lots suivants ne partent pas)", async () => {
    const lots: FauxLot[] = [];
    const creer = () => {
      const lot: FauxLot = {
        ops: [],
        committed: false,
        commit: async () => {
          throw new Error("refusé");
        },
      };
      lots.push(lot);
      return lot;
    };
    await expect(ecrireParLots(creer, [op(1), op(2), op(3)], 2)).rejects.toThrow("refusé");
    expect(lots).toHaveLength(1);
  });
});

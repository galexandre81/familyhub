import { expect, it } from "vitest";
import { AMBIANCES, hexToRgbTriplet } from "./tokens";
it("jetons jour verbatim", () => expect(AMBIANCES.jour.action).toBe("#2D56C8"));
it("triplet RGB", () => expect(hexToRgbTriplet("#EEF4EA")).toBe("238 244 234"));

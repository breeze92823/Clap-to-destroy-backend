import assert from "assert";

import { CURRENCY_MAX } from "../src/constants.js";
import { sanitizeProgress } from "../src/sanitize.js";

describe("sanitizeProgress", () => {
  it("rejects non-objects and bounds numbers", () => {
    assert.strictEqual(sanitizeProgress(null), null);
    assert.strictEqual(sanitizeProgress([1]), null);
    const out = sanitizeProgress({ wins: 1e40, skill: -5, candy: NaN, rebirths: 3.7, level: 0, autoRebirth: "yes", hack: "x" })!;
    assert.strictEqual(out.wins, CURRENCY_MAX);
    assert.strictEqual(out.skill, 0);
    assert.strictEqual(out.candy, undefined);
    assert.strictEqual(out.rebirths, 3);
    assert.strictEqual(out.level, 1);
    assert.strictEqual(out.autoRebirth, undefined);
    assert.ok(!("hack" in out));
  });

  it("keeps well-formed catalog ids and only equips an owned one", () => {
    const out = sanitizeProgress({ owned: ["classic", "aloha", "aloha", "Bad Id!", 7], equipped: "aloha", trails: ["red"], trail: "blue" })!;
    assert.deepStrictEqual(out.owned, ["classic", "aloha"]);
    assert.strictEqual(out.equipped, "aloha");
    assert.deepStrictEqual(out.trails, ["red"]);
    assert.strictEqual(out.trail, undefined, "an unowned trail is not equipped");
    assert.strictEqual(sanitizeProgress({ equipped: null })!.equipped, "");
    assert.strictEqual(sanitizeProgress({ trail: "white" })!.trail, "white");
  });

  it("keeps well-formed pets and caps the equipped ones at the slots", () => {
    const out = sanitizeProgress({
      petSlots: 2,
      pets: [
        { id: 1, kind: "puppy", equipped: true, locked: false },
        { id: 1, kind: "kitty", equipped: true },
        { id: 2.5, kind: "kitty" },
        { id: 3, kind: "Bad Id!" },
        { id: 4, kind: "foxy", equipped: true, locked: true },
        { id: 5, kind: "bear", equipped: true },
        "x",
      ],
      petsSeen: ["puppy", "puppy", "Bad Id!", "dragon"],
    })!;
    assert.deepStrictEqual(out.pets, [
      { id: 1, kind: "puppy", equipped: true, locked: false },
      { id: 4, kind: "foxy", equipped: true, locked: true },
      { id: 5, kind: "bear", equipped: false, locked: false },
    ]);
    assert.deepStrictEqual(out.petsSeen, ["puppy", "dragon"]);
  });

  it("bounds eggs, boosts and permanent boosts", () => {
    const out = sanitizeProgress({
      eggs: { epic: 2.9, "bad id": 1, mythical: "x" },
      boosts: { skill: 3, wins: -1 },
      boostUntil: { skill: 1e20, wins: 5 },
      perm: { skill: true, wins: "yes" },
      giftLeft: -4,
      autoClapOwned: true,
    })!;
    assert.deepStrictEqual(out.eggs, { epic: 2 });
    assert.deepStrictEqual(out.boosts, { skill: 3, wins: 0 });
    assert.ok(out.boostUntil!.skill < 1e20 && out.boostUntil!.wins === 5);
    assert.deepStrictEqual(out.perm, { skill: true });
    assert.strictEqual(out.giftLeft, 0);
    assert.strictEqual(out.autoClapOwned, true);
  });

  it("keeps everything the client's snapshot carries", () => {
    const snap = {
      skill: 12.5, wins: 340, candy: 2, rebirths: 1, level: 3, pumpkins: 4, owned: ["classic"], equipped: "classic", playTime: 10.2,
      pets: [{ id: 1, kind: "puppy", equipped: true }, { id: 2, kind: "kitty", equipped: false, locked: true }], petsSeen: ["puppy"],
      nextPetId: 3, petSlots: 3, autoDelete: false, eggs: { epic: 2 }, boosts: { skill: 1, wins: 0 }, boostUntil: { skill: 0, wins: 0 },
      perm: { skill: false, wins: false }, autoClapOwned: false, trails: ["white"], trail: "white", autoRebirth: false,
    };
    const out = sanitizeProgress(snap)!;
    for (const key of Object.keys(snap)) assert.ok(key in out, `${key} is saved`);
    assert.deepStrictEqual(out.pets, [{ id: 1, kind: "puppy", equipped: true, locked: false }, { id: 2, kind: "kitty", equipped: false, locked: true }]);
    assert.strictEqual(out.playTime, 10);
    assert.strictEqual(sanitizeProgress({ equipped: null })!.equipped, "");
  });
});

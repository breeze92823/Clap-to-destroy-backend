import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { __setPlayersForTest, type PlayerDoc } from "../src/db.js";
import { LEADERBOARD_SIZE } from "../src/constants.js";
import { __resetLeaderboardForTest } from "../src/leaderboard.js";
import { fakePlayers, sleep } from "./fakePlayers.js";
import { testServer } from "./server.js";

const doc = (id: string, f: Partial<PlayerDoc>): PlayerDoc => ({ _id: id, version: 1, updatedAt: new Date(), ...f });

describe("leaderboard", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  before(async () => (colyseus = await testServer()));
  beforeEach(async () => {
    await colyseus.cleanup();
    __resetLeaderboardForTest();
  });
  afterEach(() => __setPlayersForTest(null));

  it("sends the top saved players per stat and the player's own ranks after the load", async () => {
    const seed = [
      doc("u1", { username: "Ann", level: 3, wins: 500, playTime: 60, skill: 0 }),
      doc("u2", { username: "Bo", level: 9, wins: 100, playTime: 7200 }),
      ...Array.from({ length: 15 }, (_, i) => doc(`x${i}`, { username: `P${i}`, wins: 1000 + i })),
    ];
    const fake = fakePlayers(seed);
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "u1", username: "Ann" });
    let got: any = null;
    c.onMessage("leaderboard", (m: any) => (got = m));
    c.onMessage("progress", () => {});
    c.onMessage("spins", () => {});
    c.onMessage("daily", () => {});
    fake.release();
    await sleep(200);
    assert.ok(got, "leaderboard sent after the load");
    assert.deepStrictEqual(got.boards.level, [{ name: "Bo", value: 9 }, { name: "Ann", value: 3 }]);
    assert.strictEqual(got.boards.wins.length, LEADERBOARD_SIZE);
    assert.deepStrictEqual(got.boards.wins[0], { name: "P14", value: 1014 });
    assert.deepStrictEqual(got.boards.level.map((r: any) => r.name), ["Bo", "Ann"], "players without a score are left out");
    assert.strictEqual(got.boards.playTime[0].name, "Bo");
    assert.deepStrictEqual(got.ranks, { level: 2, wins: 16, playTime: 2, skill: null });
  });

  it("gives a player with no save the lists and no ranks", async () => {
    const fake = fakePlayers([doc("u1", { username: "Ann", level: 3 })]);
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "u9", username: "New" });
    let got: any = null;
    c.onMessage("leaderboard", (m: any) => (got = m));
    c.onMessage("noProgress", () => {});
    c.onMessage("spins", () => {});
    c.onMessage("daily", () => {});
    fake.release();
    await sleep(200);
    assert.deepStrictEqual(got?.boards.level, [{ name: "Ann", value: 3 }]);
    assert.deepStrictEqual(got?.ranks, { level: null, wins: null, playTime: null, skill: null });
  });
});

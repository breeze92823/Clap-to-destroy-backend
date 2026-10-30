import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { AVATAR_MAX_LEN, FX_RANGE_MAX, POSE_BOUNDS, PRESENCE_PETS_MAX } from "../src/constants.js";
import { sleep } from "./fakePlayers.js";
import { testServer } from "./server.js";

describe("presence", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  before(async () => (colyseus = await testServer()));
  beforeEach(async () => await colyseus.cleanup());

  it("takes the pose, gear and look from the join options", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, {
      userId: "guest-a",
      pose: { x: 3, y: 0.5, z: -12, yaw: Math.PI, speed: 4 },
      loadout: { gauntlet: "aloha", trail: "red", pets: [{ kind: "puppy" }, { kind: "kitty" }], world: "city" },
      avatar: '{"equipped":{}}',
    });
    await sleep(50);
    const p = room.state.players.get(a.sessionId)!;
    assert.deepStrictEqual([p.x, p.y, p.z, p.speed], [3, 0.5, -12, 4]);
    assert.ok(Math.abs(Math.abs(p.yaw) - Math.PI) < 1e-5);
    assert.deepStrictEqual([p.gauntlet, p.trail, p.pets, p.world], ["aloha", "red", "puppy,kitty", "city"]);
    assert.strictEqual(p.avatar, '{"equipped":{}}');
  });

  it("bounds poses and gear and relays them to the others", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a" });
    const b = await colyseus.connectTo(room, { userId: "guest-b" });
    await sleep(50);
    a.send("pose", { x: 1e9, y: "high", z: -1e12, yaw: 7, speed: -3 });
    const pets = Array.from({ length: 20 }, () => ({ kind: "kitty" }));
    a.send("loadout", { gauntlet: "Bad Id!", trail: "red", pets: [...pets, { kind: "Bad Id!" }], world: "Bad World!" });
    a.send("setAvatar", { avatar: "x".repeat(AVATAR_MAX_LEN + 1) });
    await sleep(100);
    const p = room.state.players.get(a.sessionId)!;
    assert.strictEqual(p.x, POSE_BOUNDS.xy);
    assert.strictEqual(p.y, 0, "a non-number is ignored");
    assert.strictEqual(p.z, -POSE_BOUNDS.xy);
    assert.ok(Math.abs(p.yaw - Math.atan2(Math.sin(7), Math.cos(7))) < 1e-5, "yaw wrapped to -PI..PI");
    assert.strictEqual(p.speed, 0);
    assert.strictEqual(p.gauntlet, "", "a malformed id is ignored");
    assert.strictEqual(p.world, "", "a malformed world is ignored");
    assert.deepStrictEqual([p.trail], ["red"]);
    assert.strictEqual(p.pets.split(",").length, PRESENCE_PETS_MAX);
    assert.strictEqual(p.avatar, "", "an oversized look is ignored");

    // b's synced copy of the roster sees a's presence.
    const seen = (b.state as any).players.get(a.sessionId);
    assert.strictEqual(seen.trail, "red");
    assert.strictEqual(seen.x, POSE_BOUNDS.xy);
  });

  it("relays clap effects to the others only, bounded and rate-limited", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a" });
    const b = await colyseus.connectTo(room, { userId: "guest-b" });
    await sleep(50);
    const got: any[] = [];
    const mine: any[] = [];
    b.onMessage("fx", (m: any) => got.push(m));
    a.onMessage("fx", (m: any) => mine.push(m));

    a.send("pose", { x: 1, y: 0, z: 2, yaw: 0, speed: 0, grounded: false });
    a.send("fx", { kind: "wave", x: 1, y: 0, z: 2, yaw: 7, range: 9999 });
    a.send("fx", { kind: "wave", x: 1, y: 0, z: 2, yaw: 0, range: 5 }); // too soon after the first
    a.send("fx", { kind: "clap", x: 1e9, y: 0, z: 2, yaw: 0 });
    a.send("fx", { kind: "nuke", x: 0, y: 0, z: 0 });
    a.send("fx", { kind: "clap", x: "far", y: 0, z: 0 });
    await sleep(100);
    assert.strictEqual(room.state.players.get(a.sessionId)!.grounded, false);
    assert.deepStrictEqual(got.map((m) => m.kind), ["wave", "clap"]);
    assert.strictEqual(got[0].id, a.sessionId);
    assert.strictEqual(got[0].range, FX_RANGE_MAX);
    assert.ok(Math.abs(got[0].yaw - Math.atan2(Math.sin(7), Math.cos(7))) < 1e-5);
    assert.strictEqual(got[1].x, POSE_BOUNDS.xy);
    assert.strictEqual(mine.length, 0, "the sender does not get its own effect back");
  });
});

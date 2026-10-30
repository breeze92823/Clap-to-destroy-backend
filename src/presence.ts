import { AVATAR_MAX_LEN, FX_KINDS, FX_MIN_GAP_MS, FX_RANGE_MAX, ID_PATTERN, POSE_BOUNDS, PRESENCE_PETS_MAX, type FxKind } from "./constants.js";
import type { PlayerState } from "./rooms/schema/WorldState.js";

// Presence: what the other clients need to draw a player in the world (client remotePlayers.js).
// Relayed through the roster as sent, only bounded here -- like the rest of the game it is
// client-authoritative and purely cosmetic.

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);

// `pose` { x, y, z, yaw, speed, grounded }: the player's feet position, heading (rad), speed (m/s)
// and whether they stand on the ground.
export function applyPose(p: PlayerState, msg: unknown): void {
  if (!msg || typeof msg !== "object") return;
  const m = msg as Record<string, unknown>;
  const b = POSE_BOUNDS;
  if (finite(m.x)) p.x = clamp(m.x, -b.xy, b.xy);
  if (finite(m.y)) p.y = clamp(m.y, -b.xy, b.xy);
  if (finite(m.z)) p.z = clamp(m.z, -b.xy, b.xy);
  if (finite(m.yaw)) p.yaw = Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw));
  if (finite(m.speed)) p.speed = clamp(m.speed, 0, b.speed);
  if (typeof m.grounded === "boolean") p.grounded = m.grounded;
}

// `loadout` { gauntlet, trail, pets: [{ kind }], world }: equipped catalog ids ("" = none) and the
// world the player is in (clients only draw players in their own world). Pets travel as their kinds
// joined by commas, capped at PRESENCE_PETS_MAX.
export function applyLoadout(p: PlayerState, msg: unknown): void {
  if (!msg || typeof msg !== "object") return;
  const m = msg as Record<string, unknown>;
  for (const key of ["gauntlet", "trail", "world"] as const) {
    const v = m[key];
    if (v === "" || isId(v)) p[key] = v as string;
  }
  if (Array.isArray(m.pets)) {
    const pets: string[] = [];
    for (const pet of m.pets) {
      if (pets.length >= PRESENCE_PETS_MAX) break;
      const k = (pet as { kind?: unknown })?.kind;
      if (isId(k)) pets.push(k);
    }
    p.pets = pets.join(",");
  }
}

// `setAvatar` { avatar }: the Bloxity look as an opaque JSON string ("" = default), length-capped.
export function applyAvatar(p: PlayerState, msg: unknown): void {
  const a = (msg as { avatar?: unknown })?.avatar;
  if (typeof a === "string" && a.length <= AVATAR_MAX_LEN) p.avatar = a;
}

// A clap effect another client should play (`fx` { kind, x, y, z, yaw, range? }), or null when it is
// malformed or this kind came too soon after the sender's last one (`last`: kind -> epoch ms,
// updated here). Bounded like the pose; purely cosmetic.
export function sanitizeFx(msg: unknown, last: Map<string, number>, now = Date.now()): { kind: FxKind; x: number; y: number; z: number; yaw: number; range: number } | null {
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  const kind = FX_KINDS.find((k) => k === m.kind);
  if (!kind || !finite(m.x) || !finite(m.y) || !finite(m.z)) return null;
  if (now - (last.get(kind) ?? -Infinity) < FX_MIN_GAP_MS[kind]) return null;
  last.set(kind, now);
  const b = POSE_BOUNDS.xy;
  return {
    kind,
    x: clamp(m.x, -b, b),
    y: clamp(m.y, -b, b),
    z: clamp(m.z, -b, b),
    yaw: finite(m.yaw) ? Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)) : 0,
    range: kind === "wave" && finite(m.range) ? clamp(m.range, 0, FX_RANGE_MAX) : 0,
  };
}

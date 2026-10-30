import {
  CURRENCY_MAX, CANDY_MAX, REBIRTHS_MAX, LEVEL_MAX, PLAY_SECONDS_MAX, OWNED_MAX, PETS_MAX, PET_SLOTS_MAX,
  PET_ID_MAX, EGG_KINDS_MAX, BOOST_KINDS_MAX, COUNT_MAX, ID_PATTERN,
} from "./constants.js";
import type { PlayerDoc, SavedPet } from "./db.js";

export function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
export function clampNum(v: number, max: number): number {
  return Math.min(max, Math.max(0, v));
}
export function clampInt(v: number, max: number, min = 0): number {
  return Math.min(max, Math.max(min, Math.floor(v)));
}
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);

// Catalog ids (gauntlets, trails, pet kinds): slug strings, no duplicates, bounded count.
export function sanitizeIds(raw: unknown, max = OWNED_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isId))].slice(0, max);
}

// Owned pets { id, kind, equipped, locked }: unique integer ids, slug kinds, at most PETS_MAX, and
// no more than `slots` of them equipped (the extra ones are unequipped, never dropped).
export function sanitizePets(raw: unknown, slots = PET_SLOTS_MAX): SavedPet[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedPet[] = [];
  const ids = new Set<number>();
  let equipped = 0;
  for (const p of raw) {
    if (out.length >= PETS_MAX) break;
    if (!isObject(p) || !isId(p.kind) || !Number.isInteger(p.id) || (p.id as number) < 0 || (p.id as number) > PET_ID_MAX || ids.has(p.id as number)) continue;
    ids.add(p.id as number);
    const on = p.equipped === true && equipped < slots;
    if (on) equipped++;
    out.push({ id: p.id as number, kind: p.kind, equipped: on, locked: p.locked === true });
  }
  return out;
}

// { key: n } maps (eggs waiting, potions owned): slug keys, whole non-negative counts, bounded kinds.
function sanitizeCounts(raw: unknown, maxKinds: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [id, n] of Object.entries(raw)) {
    if (Object.keys(out).length >= maxKinds) break;
    if (isId(id) && finite(n)) out[id] = clampInt(n, COUNT_MAX);
  }
  return out;
}

// { key: ms } map (when each running boost ends): slug keys, epoch ms, at most a year ahead.
function sanitizeUntil(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  const limit = Date.now() + PLAY_SECONDS_MAX * 1000;
  for (const [id, n] of Object.entries(raw)) {
    if (Object.keys(out).length >= BOOST_KINDS_MAX) break;
    if (isId(id) && finite(n)) out[id] = clampInt(n, limit);
  }
  return out;
}

// { key: bool } map (the permanent boosts bought).
function sanitizeFlags(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isObject(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= BOOST_KINDS_MAX) break;
    if (isId(id) && typeof v === "boolean") out[id] = v;
  }
  return out;
}

// One owned list + its equipped id. The equipped one must be owned ("" or null = none); when this
// save doesn't carry the list, trust the id's shape only.
function ownedPair(raw: Record<string, unknown>, out: Partial<PlayerDoc>, listKey: "owned" | "trails", idKey: "equipped" | "trail") {
  if (raw[listKey] !== undefined) out[listKey] = sanitizeIds(raw[listKey]);
  const id = raw[idKey];
  const owned = out[listKey];
  if (id === "" || id === null) out[idKey] = "";
  else if (isId(id) && (!owned || owned.includes(id))) out[idKey] = id;
}

// The game is client-authoritative -- no server-side gameplay validation. What IS enforced:
// shape and bounds, so a malformed payload can never corrupt this player's own Mongo document.
// A forged number can only ever affect the sender's own save.
export function sanitizeProgress(raw: unknown): Partial<PlayerDoc> | null {
  if (!isObject(raw)) return null;
  const out: Partial<PlayerDoc> = {};

  if (finite(raw.skill)) out.skill = clampNum(raw.skill, CURRENCY_MAX);
  if (finite(raw.wins)) out.wins = clampNum(raw.wins, CURRENCY_MAX);
  if (finite(raw.candy)) out.candy = clampNum(raw.candy, CANDY_MAX);
  if (finite(raw.rebirths)) out.rebirths = clampInt(raw.rebirths, REBIRTHS_MAX);
  if (finite(raw.level)) out.level = clampInt(raw.level, LEVEL_MAX, 1);
  if (finite(raw.pumpkins)) out.pumpkins = clampInt(raw.pumpkins, LEVEL_MAX);
  if (typeof raw.autoRebirth === "boolean") out.autoRebirth = raw.autoRebirth;
  if (typeof raw.autoDelete === "boolean") out.autoDelete = raw.autoDelete;
  if (typeof raw.autoClapOwned === "boolean") out.autoClapOwned = raw.autoClapOwned;
  if (finite(raw.playTime)) out.playTime = clampInt(raw.playTime, PLAY_SECONDS_MAX);
  if (finite(raw.giftLeft)) out.giftLeft = clampNum(raw.giftLeft, PLAY_SECONDS_MAX);
  if (finite(raw.lastSeen)) out.lastSeen = clampInt(raw.lastSeen, Date.now() + 10 * 60 * 1000);

  ownedPair(raw, out, "owned", "equipped");
  ownedPair(raw, out, "trails", "trail");

  if (finite(raw.petSlots)) out.petSlots = clampInt(raw.petSlots, PET_SLOTS_MAX, 1);
  if (finite(raw.nextPetId)) out.nextPetId = clampInt(raw.nextPetId, PET_ID_MAX + 1, 1);
  if (raw.pets !== undefined) out.pets = sanitizePets(raw.pets, out.petSlots ?? PET_SLOTS_MAX);
  if (raw.petsSeen !== undefined) out.petsSeen = sanitizeIds(raw.petsSeen);

  if (raw.eggs !== undefined) out.eggs = sanitizeCounts(raw.eggs, EGG_KINDS_MAX);
  if (raw.boosts !== undefined) out.boosts = sanitizeCounts(raw.boosts, BOOST_KINDS_MAX);
  if (raw.boostUntil !== undefined) out.boostUntil = sanitizeUntil(raw.boostUntil);
  if (raw.perm !== undefined) out.perm = sanitizeFlags(raw.perm);
  return out;
}

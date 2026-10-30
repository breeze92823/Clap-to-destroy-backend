import { MongoClient, type Collection } from "mongodb";

import { LEADERBOARD_STATS } from "./constants.js";

// Bloxity Legion hosting injects MONGODB_URI per game+channel -- an isolated database with
// scoped credentials. A local `npm start` normally has no Mongo reachable, so a missing or
// unreachable URI must degrade to "no persistence" rather than crash the room.

// The persisted client state (what `saveProgress` carries, see sanitize.ts). The client keeps
// nothing in the browser: this document is the player's only save.
export interface PlayerDoc {
  _id: string; // Bloxity user id -- see WorldRoom.ts (guests are never saved)
  username?: string; // display name as of the last save
  skill?: number; // SKILL (the power bar)
  wins?: number; // Wins (the shop currency)
  candy?: number; // pumpkin candy
  rebirths?: number;
  autoRebirth?: boolean;
  level?: number; // the level bar
  pumpkins?: number; // pumpkins collected toward the next level
  playTime?: number; // s played in total
  owned?: string[]; // owned gauntlet ids (client GAUNTLETS + REWARD_GAUNTLETS)
  equipped?: string; // the equipped gauntlet (an owned one), "" = none
  trails?: string[]; // owned trail ids (client TRAILS)
  trail?: string; // the equipped trail, "" = none
  pets?: SavedPet[]; // owned pets (client pets.js), at most PETS_MAX
  petsSeen?: string[]; // pet kinds ever hatched (the NEW! tag)
  nextPetId?: number; // the id the next pet gets
  petSlots?: number; // pets equipped at once
  autoDelete?: boolean; // Auto Delete in My Pets
  eggs?: Record<string, number>; // egg key -> count waiting in the Inventory
  boosts?: Record<string, number>; // boost type -> potions owned
  boostUntil?: Record<string, number>; // boost type -> epoch ms its running potion ends
  perm?: Record<string, boolean>; // permanent 5X SKILL / 2x WINS bought
  autoClapOwned?: boolean; // AUTO CLAP bought
  giftLeft?: number; // s until the next FREE REWARD
  lastSeen?: number; // epoch ms of the last activity
  // Daily Reward (daily.ts): written by the server only, never by saveProgress.
  dailyDay?: number; // days unlocked this cycle
  dailyLast?: number; // UTC day index of the last unlock
  dailyClaimed?: number[]; // claimed day indexes this cycle
  version: number;
  updatedAt: Date;
}

// One owned pet: its own id (client `nextPetId`), its kind (client PET_KINDS key), and flags.
export interface SavedPet {
  id: number;
  kind: string;
  equipped: boolean;
  locked: boolean;
}

let client: MongoClient | null = null;
let players: Collection<PlayerDoc> | null = null;

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI not set -- player progress will not persist");
    return;
  }
  try {
    client = new MongoClient(uri);
    await client.connect();
    // No dbName passed to .db() -- the injected URI already points at this game+channel's database.
    players = client.db().collection<PlayerDoc>("players");
    console.log("[db] connected to MongoDB");
    // The leaderboards sort and count by these (leaderboard.ts).
    for (const stat of LEADERBOARD_STATS) {
      players.createIndex({ [stat]: -1 }).catch((err) => console.warn(`[db] index on ${stat} failed`, err));
    }
  } catch (err) {
    console.warn("[db] connect failed -- player progress will not persist:", err);
    client = null;
    players = null;
  }
}

// Null whenever Mongo is unset/unreachable -- every caller must treat that as "skip persistence".
export function getPlayers(): Collection<PlayerDoc> | null {
  return players;
}

// Test-only seam: exercise the save/load logic against an in-memory fake collection.
export function __setPlayersForTest(fake: Collection<PlayerDoc> | null): void {
  players = fake;
}

// Keep in step with the client's src/config.js by hand.
export const ROOM_MAX_CLIENTS = 50;

// Longest accepted strings.
export const NAME_MAX = 64;
// Profile picture URL (Bloxity `pfp`), relayed so other players can draw it.
export const PFP_MAX_LEN = 512;
// Presence (presence.ts): the Bloxity avatar JSON relayed for the others to draw, the most pets
// drawn per player, and the pose bounds (|x|, |y|, |z| up to `xy` m; speed in m/s).
export const AVATAR_MAX_LEN = 3000;
export const PRESENCE_PETS_MAX = 8;
export const POSE_BOUNDS = { xy: 5000, speed: 2000 };
// Clap effects (`fx` message, presence.ts): what each client may send, and the least time between
// two of the same kind from one player (ms), so a macro cannot flood the room. `range` is the
// shockwave's reach in metres (client WAVE.maxRange, with slack).
export const FX_KINDS = ["clap", "wave", "train"] as const;
export type FxKind = (typeof FX_KINDS)[number];
export const FX_MIN_GAP_MS: Record<FxKind, number> = { clap: 100, wave: 1500, train: 600 };
export const FX_RANGE_MAX = 400;

// Colyseus drops the whole connection for a WebSocket message above this (default 4 KB).
export const MAX_PAYLOAD_BYTES = 128 * 1024;

// How long a dropped connection (WiFi blip, backgrounded tab) may reconnect with the same session.
export const RECONNECT_SECONDS = 20;

// Upper bounds for saved values, so a forged payload cannot store a bogus number. Generous
// ceilings, not game rules (client SKILL / Wins reach ~1e15+ with the top trail and pets).
export const CURRENCY_MAX = 1e33; // skill, wins
export const CANDY_MAX = 1e15; // candy (pumpkins)
export const REBIRTHS_MAX = 1e9;
export const LEVEL_MAX = 1e6; // the level bar (client `level`, `pumpkins`)
export const PLAY_SECONDS_MAX = 31_536_000; // ~1 year

// Owned gauntlet ids (client GAUNTLETS + REWARD_GAUNTLETS ~14) and trail ids (TRAILS 7), with slack.
export const OWNED_MAX = 64;
// Pets (client PETS): at most PETS_MAX owned, slots the counter can grow to, a pet's own id.
export const PETS_MAX = 1000;
export const PET_SLOTS_MAX = 50;
export const PET_ID_MAX = 1e9;
// Eggs waiting in the Inventory (EGGS keys) and boost potions (BOOSTS keys): kinds and counts.
export const EGG_KINDS_MAX = 32;
export const BOOST_KINDS_MAX = 8;
export const COUNT_MAX = 1e9;
// Daily Reward (client DAILY.days): days in one calendar cycle.
export const DAILY_DAYS = 7;

// Leaderboards (leaderboard.ts; client plaza.js boards Top Level / Time Played / Top Skills / Wins): the
// saved doc fields ranked, rows per board and how often the lists are re-read and re-sent.
export const LEADERBOARD_STATS = ["level", "playTime", "skill", "wins"] as const;
export type LeaderboardStat = (typeof LEADERBOARD_STATS)[number];
export const LEADERBOARD_SIZE = 10;
export const LEADERBOARD_EVERY_MS = 60 * 1000;

// Ids from the client's catalogs (gauntlets, trails, pet kinds, eggs, boosts): camelCase slugs, so nothing odd is stored.
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

// The client's per-browser fallback id for players who are not signed in to Bloxity.
// Guests are never persisted.
export const GUEST_ID_PREFIX = "guest-";

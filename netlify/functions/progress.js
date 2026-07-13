// Netlify serverless function: reads/writes each learner's Deutsch100 progress
// (level, daily streak, milestone badges) using Netlify Blobs, keyed by
// USERNAME. This is what makes progress follow a person across any
// device/browser that opens the deployed site, instead of being trapped in
// one browser's localStorage.
//
// GET  /.netlify/functions/progress?username=alex
//      -> { exists: boolean, username, state }
//         exists=false means this is a brand-new username (caller should
//         start it at Level 1); exists=true means saved progress was found.
//
// POST /.netlify/functions/progress   { username, unlockedLevelMax, stats, badges }
//      -> validates + saves the given state under that username, creating
//         the profile if it doesn't exist yet. Returns { ok: true, state }.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "deutsch100";

const DEFAULT_STATE = {
  unlockedLevelMax: 1,
  stats: { lastActiveDate: null, streakCount: 0, levelsToday: 0 },
  badges: []
};

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const USERNAME_PATTERN = /^[a-z0-9_-]{3,20}$/;

// Usernames are the primary key for progress, so they're normalized and
// validated the same way here as on the frontend (trim, lowercase).
// Only a-z, 0-9, underscore and hyphen are allowed, 3-20 chars.
function normalizeUsername(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return USERNAME_PATTERN.test(normalized) ? normalized : null;
}

function blobKey(username) {
  return `user:${username}`;
}

// Never trust the client blindly — clamp/validate every field before saving.
function sanitizeState(input) {
  const raw = input || {};
  const rawStats = raw.stats || {};

  return {
    unlockedLevelMax: Number.isInteger(raw.unlockedLevelMax)
      ? Math.max(1, Math.min(100, raw.unlockedLevelMax))
      : DEFAULT_STATE.unlockedLevelMax,
    stats: {
      lastActiveDate: typeof rawStats.lastActiveDate === "string" ? rawStats.lastActiveDate : null,
      streakCount: Number.isInteger(rawStats.streakCount) ? Math.max(0, rawStats.streakCount) : 0,
      levelsToday: Number.isInteger(rawStats.levelsToday) ? Math.max(0, rawStats.levelsToday) : 0
    },
    badges: Array.isArray(raw.badges)
      ? [...new Set(raw.badges.filter(n => Number.isInteger(n) && n >= 10 && n <= 100 && n % 10 === 0))]
      : []
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const store = getStore(STORE_NAME);

  if (event.httpMethod === "GET") {
    const username = normalizeUsername(event.queryStringParameters && event.queryStringParameters.username);
    if (!username) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing or invalid username (3-20 chars: letters, numbers, _ or -)" })
      };
    }

    try {
      const saved = await store.get(blobKey(username), { type: "json" });
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          exists: !!saved,
          username,
          state: saved || DEFAULT_STATE
        })
      };
    } catch (err) {
      console.error("Blob read failed:", err);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ exists: false, username, state: DEFAULT_STATE })
      };
    }
  }

  if (event.httpMethod === "POST") {
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body || "{}");
    } catch (err) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid JSON body" })
      };
    }

    const username = normalizeUsername(parsedBody.username);
    if (!username) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing or invalid username (3-20 chars: letters, numbers, _ or -)" })
      };
    }

    const safeState = sanitizeState(parsedBody);
    const key = blobKey(username);

    try {
      // Preserve createdAt across updates; set it only the first time this
      // username is ever saved.
      const existing = await store.get(key, { type: "json" });
      const nowIso = new Date().toISOString();
      const record = {
        ...safeState,
        username,
        createdAt: (existing && existing.createdAt) || nowIso,
        lastPlayed: nowIso
      };

      await store.setJSON(key, record);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: true, state: record })
      };
    } catch (err) {
      console.error("Blob write failed:", err);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to save progress" })
      };
    }
  }

  return {
    statusCode: 405,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: "Method not allowed" })
  };
};






// database/index.js – FULL, CORRECT, PRODUCTION-READY
const Database = require('better-sqlite3');
const path = require('path');
const { logger } = require('../utils/logger');
const bcrypt = require('bcrypt');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { verbose: null });

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// ==================== CREATE ALL TABLES ====================
db.exec(`
  -- Guilds
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT,
    enabled INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Admins
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(guild_id, user_id)
  );

  -- Warboard metadata
  CREATE TABLE IF NOT EXISTS warboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    war_date TEXT NOT NULL,
    channel_id TEXT,
    message_id TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(guild_id, war_date)
  );

  -- Warboard assignments
  CREATE TABLE IF NOT EXISTS warboard_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    war_date TEXT NOT NULL,
    user_id TEXT,
    username TEXT NOT NULL,
    base TEXT NOT NULL,
    might TEXT,
    mention INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- DM permissions
  CREATE TABLE IF NOT EXISTS dm_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    granted_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, permission)
  );

  -- DM roles
  CREATE TABLE IF NOT EXISTS dm_roles (
    guild_id TEXT NOT NULL,
    role_type TEXT NOT NULL,
    role_id TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    PRIMARY KEY (guild_id, role_type)
  );

  -- DM deletion jobs
  CREATE TABLE IF NOT EXISTS dm_deletion_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    delete_at INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(message_id)
  );

  -- Self‑role panels
  CREATE TABLE IF NOT EXISTS selfrole_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    panel_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    footer TEXT,
    mode TEXT NOT NULL CHECK(mode IN ('single', 'multi')),
    max_roles INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    last_sent_channel_id TEXT,
    last_sent_message_id TEXT,
    UNIQUE(guild_id, panel_name)
  );

  -- Self‑role buttons
  CREATE TABLE IF NOT EXISTS selfrole_buttons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    panel_id INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    style TEXT NOT NULL DEFAULT 'secondary',
    position INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (panel_id) REFERENCES selfrole_panels(id) ON DELETE CASCADE,
    UNIQUE(panel_id, role_id)
  );

  -- Self‑role admins
  CREATE TABLE IF NOT EXISTS selfrole_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    granted_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(guild_id, user_id)
  );

  -- ========== GREETINGS TABLES ==========
  CREATE TABLE IF NOT EXISTS greetings_settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel_id TEXT,
    farewell_channel_id TEXT,
    ban_channel_id TEXT,
    kick_channel_id TEXT,
    welcome_enabled INTEGER DEFAULT 0,
    farewell_enabled INTEGER DEFAULT 0,
    ban_enabled INTEGER DEFAULT 0,
    kick_enabled INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS welcome_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK(message_type IN ('welcome', 'farewell', 'ban', 'kick', 'dm')),
    content TEXT,
    embed_title TEXT,
    embed_description TEXT,
    embed_color TEXT,
    embed_footer TEXT,
    embed_thumbnail TEXT,
    embed_image TEXT,
    embed_author TEXT,
    embed_author_icon TEXT,
    embed_author_url TEXT,
    embed_title_url TEXT,
    embed_footer_icon TEXT,
    embed_timestamp TEXT,
    embed_fields TEXT,
    use_embed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_by TEXT,
    UNIQUE(guild_id, message_type)
  );

  CREATE TABLE IF NOT EXISTS greetings_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT,
    executed_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- ========== INVITE TRACKING TABLES ==========
  CREATE TABLE IF NOT EXISTS invite_tracking (
    guild_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    invitee_id TEXT NOT NULL,
    invite_code TEXT,
    joined_at INTEGER NOT NULL,
    left_at INTEGER,
    is_fake INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, invitee_id)
  );

  CREATE TABLE IF NOT EXISTS invite_counts (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total_invites INTEGER DEFAULT 0,
    regular_invites INTEGER DEFAULT 0,
    left_invites INTEGER DEFAULT 0,
    fake_invites INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    invite_tracking_enabled INTEGER DEFAULT 0,
    might_report_channel TEXT
  );

  -- ========== DM GREETINGS TABLES ==========
  CREATE TABLE IF NOT EXISTS dm_greetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK(message_type IN ('welcome_dm', 'farewell_dm')),
    enabled INTEGER DEFAULT 0,
    content TEXT,
    embed_title TEXT,
    embed_description TEXT,
    embed_color TEXT,
    embed_footer TEXT,
    embed_thumbnail TEXT,
    embed_image TEXT,
    embed_author TEXT,
    embed_author_icon TEXT,
    embed_author_url TEXT,
    embed_title_url TEXT,
    embed_footer_icon TEXT,
    embed_timestamp TEXT,
    embed_fields TEXT,
    use_embed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_by TEXT,
    UNIQUE(guild_id, message_type)
  );

  -- ========== MIGHT TRACKING TABLE ==========
  CREATE TABLE IF NOT EXISTS might_tracking (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    previous_might REAL DEFAULT 0,
    current_might REAL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  -- Ticket Panels
  CREATE TABLE IF NOT EXISTS ticket_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    panel_name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    category_id TEXT,
    support_role_id TEXT,
    ticket_name_format TEXT DEFAULT 'ticket-{number}',
    welcome_message TEXT,
    use_embed INTEGER DEFAULT 1,
    embed_color TEXT DEFAULT '#5865F2',
    button_label TEXT DEFAULT 'Open Ticket',
    button_emoji TEXT,
    button_style TEXT DEFAULT 'primary',
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(guild_id, panel_name)
  );

  -- Tickets
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    panel_id INTEGER NOT NULL,
    ticket_number INTEGER NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    closed_at TEXT,
    closed_by TEXT,
    FOREIGN KEY (panel_id) REFERENCES ticket_panels(id) ON DELETE CASCADE
  );

  -- Ticket messages
  CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_tag TEXT NOT NULL,
    content TEXT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );

  -- Ticket claims
  CREATE TABLE IF NOT EXISTS ticket_claims (
    ticket_id INTEGER PRIMARY KEY,
    claimed_by TEXT NOT NULL,
    claimed_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );

  -- Ticket settings
  CREATE TABLE IF NOT EXISTS ticket_settings (
    guild_id TEXT PRIMARY KEY,
    transcript_channel_id TEXT,
    dm_on_open INTEGER DEFAULT 1,
    dm_on_close INTEGER DEFAULT 1,
    dm_on_claim INTEGER DEFAULT 0
  );

  -- Table: assignments (duplicate, but kept for compatibility)
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    war_date TEXT NOT NULL,
    user_id TEXT,
    username TEXT NOT NULL,
    base TEXT NOT NULL,
    might REAL DEFAULT 0,
    mention INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id, war_date) REFERENCES warboards(guild_id, war_date) ON DELETE CASCADE
  );

  -- Table: players
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT,
    username TEXT NOT NULL,
    might REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_assignments_guild_date ON assignments(guild_id, war_date);
  CREATE INDEX IF NOT EXISTS idx_players_guild ON players(guild_id);

  -- Web users
  CREATE TABLE IF NOT EXISTS web_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    discord_id TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active'
);

  -- Activity logs
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    category TEXT DEFAULT 'general'
  );
  CREATE INDEX IF NOT EXISTS idx_activity_guild ON activity_logs(guild_id);
  CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_logs(timestamp);

  -- Web sessions
  CREATE TABLE IF NOT EXISTS web_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME,
    ip TEXT,
    session_id TEXT,
    user_agent TEXT
  );

  -- Might history
  CREATE TABLE IF NOT EXISTS might_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    might REAL NOT NULL,
    recorded_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_might_history_guild_user_time ON might_history(guild_id, user_id, recorded_at);

  -- Might submissions
  CREATE TABLE IF NOT EXISTS might_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    in_game_name TEXT NOT NULL,
    submitted_might REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    submitted_at INTEGER NOT NULL,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    admin_notes TEXT
  );

  -- Admin tasks
  CREATE TABLE IF NOT EXISTS admin_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    task TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Might submission DMs
  CREATE TABLE IF NOT EXISTS might_submission_dms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    admin_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (submission_id) REFERENCES might_submissions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_might_dms_submission ON might_submission_dms(submission_id);

  -- Questions table with scheduled_at
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT,
    message_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    footer TEXT,
    suffix TEXT DEFAULT '',
    max_interactions INTEGER DEFAULT 1,
    scheduled_at INTEGER,
    status TEXT DEFAULT 'draft',
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Question options
  CREATE TABLE IF NOT EXISTS question_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    answer_text TEXT,
    answer_number REAL,
    emoji TEXT,
    style TEXT DEFAULT 'primary',
    position INTEGER NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

  -- Question responses
  CREATE TABLE IF NOT EXISTS question_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    option_id INTEGER NOT NULL,
    responded_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES question_options(id) ON DELETE CASCADE,
    UNIQUE(question_id, user_id)
  );

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    tracks TEXT NOT NULL, -- JSON array of track objects (title, url, duration)
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(guild_id, user_id, name)
);
CREATE TABLE IF NOT EXISTS pin_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_message_id TEXT,
    content TEXT,
    use_embed INTEGER DEFAULT 0,
    embed_title TEXT,
    embed_description TEXT,
    embed_color TEXT DEFAULT '#5865F2',
    embed_footer TEXT,
    embed_thumbnail TEXT,
    embed_image TEXT,
    embed_author TEXT,
    embed_author_icon TEXT,
    embed_author_url TEXT,
    embed_title_url TEXT,
    embed_footer_icon TEXT,
    embed_timestamp TEXT,
    embed_fields TEXT DEFAULT '[]',
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id)
  );


   CREATE TABLE IF NOT EXISTS user_languages (
    user_id TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en'

    );

    CREATE TABLE IF NOT EXISTS banned_discord (
    discord_id TEXT PRIMARY KEY,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    banned_by TEXT,
    reason TEXT,
    username TEXT
);


-- IP rules
CREATE TABLE IF NOT EXISTS ip_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('whitelist', 'blacklist')),
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Error logs
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT,
  stack TEXT,
  url TEXT,
  user_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User settings (theme, dashboard layout)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'dark',
  custom_css TEXT,
  dashboard_layout TEXT
);


`);





// ==================== FALLBACK: Ensure scheduled_at column exists ====================
try {
    const cols = db.prepare("PRAGMA table_info(questions)").all();
 //   console.log('✅ Questions columns:', cols.map(c => c.name));
    const hasScheduled = cols.some(c => c.name === 'scheduled_at');
    if (!hasScheduled) {
//       console.log('⚠️ scheduled_at missing – adding now...');
        db.exec(`ALTER TABLE questions ADD COLUMN scheduled_at INTEGER`);
  //      console.log('✅ scheduled_at added via ALTER');
    } else {
 //       console.log('✅ scheduled_at already exists');
    }
} catch (e) {
    console.error('❌ Error checking questions table:', e.message);
}

// ==================== POST‑CREATION CHECKS ====================
const tableInfo = db.prepare("PRAGMA table_info(warboard_assignments)").all();
const userIdCol = tableInfo.find(col => col.name === 'user_id');
if (userIdCol && userIdCol.notnull === 1) {
    logger.warn('user_id column is NOT NULL – migrating table to allow NULL');
    db.exec(`
        CREATE TABLE warboard_assignments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            war_date TEXT NOT NULL,
            user_id TEXT,
            username TEXT NOT NULL,
            base TEXT NOT NULL,
            might TEXT,
            mention INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
        INSERT INTO warboard_assignments_new (id, guild_id, war_date, user_id, username, base, might, mention, created_at)
        SELECT id, guild_id, war_date, user_id, username, base, might, mention, created_at FROM warboard_assignments;
        DROP TABLE warboard_assignments;
        ALTER TABLE warboard_assignments_new RENAME TO warboard_assignments;
    `);
    logger.success('Migration complete: user_id now nullable');
}

logger.success('Database connected and tables verified');









// ==================== GUILD FUNCTIONS ====================
function createGuild(guildId, guildName = null) {
  const stmt = db.prepare('INSERT OR IGNORE INTO guilds (guild_id, guild_name) VALUES (?, ?)');
  stmt.run(guildId, guildName);
}

function updateGuildName(guildId, guildName) {
  const stmt = db.prepare('UPDATE guilds SET guild_name = ? WHERE guild_id = ?');
  stmt.run(guildName, guildId);
}

function getGuildName(guildId) {
  const stmt = db.prepare('SELECT guild_name FROM guilds WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.guild_name : null;
}

function enableGuild(guildId) {
  const stmt = db.prepare('UPDATE guilds SET enabled = 1 WHERE guild_id = ?');
  stmt.run(guildId);
}

function disableGuild(guildId) {
  const stmt = db.prepare('UPDATE guilds SET enabled = 0 WHERE guild_id = ?');
  stmt.run(guildId);
}

function isGuildEnabled(guildId) {
  const stmt = db.prepare('SELECT enabled FROM guilds WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.enabled === 1 : false;
}

function getGuild(guildId) {
  const stmt = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
  return stmt.get(guildId);
}

function getAllGuilds() {
  const stmt = db.prepare('SELECT guild_id, guild_name, enabled FROM guilds');
  return stmt.all();
}

// ==================== ADMIN FUNCTIONS ====================
function addAdmin(guildId, userId) {
  const stmt = db.prepare('INSERT OR IGNORE INTO admins (guild_id, user_id) VALUES (?, ?)');
  stmt.run(guildId, userId);
}

function removeAdmin(guildId, userId) {
  const stmt = db.prepare('DELETE FROM admins WHERE guild_id = ? AND user_id = ?');
  stmt.run(guildId, userId);
}

function isAdmin(guildId, userId) {
  const stmt = db.prepare('SELECT 1 FROM admins WHERE guild_id = ? AND user_id = ?');
  return !!stmt.get(guildId, userId);
}

function getAdmins(guildId) {
  const stmt = db.prepare('SELECT user_id FROM admins WHERE guild_id = ?');
  return stmt.all(guildId).map(row => row.user_id);
}

function getGuildAdmins(guildId) {
  return getAdmins(guildId);
}

function getUserAccessibleGuilds(userId) {
  if (userId === process.env.OWNER_ID) return null; // owner has access to all
  const stmt = db.prepare('SELECT guild_id FROM admins WHERE user_id = ?');
  return stmt.all(userId).map(row => row.guild_id);
}

// ==================== WARBOARD FUNCTIONS ====================
function createWarboard(guildId, warDate) {
  const stmt = db.prepare('INSERT OR IGNORE INTO warboards (guild_id, war_date) VALUES (?, ?)');
  stmt.run(guildId, warDate);
}

function saveWarboardMessage(guildId, warDate, channelId, messageId) {
  const stmt = db.prepare(`
    UPDATE warboards 
    SET channel_id = ?, message_id = ? 
    WHERE guild_id = ? AND war_date = ?
  `);
  stmt.run(channelId, messageId, guildId, warDate);
}

function getWarboard(guildId, warDate) {
  const stmt = db.prepare('SELECT * FROM warboards WHERE guild_id = ? AND war_date = ?');
  return stmt.get(guildId, warDate);
}

/**
 * Save or update an assignment.
 * @param {string} guildId - Discord guild ID
 * @param {string} warDate - War date in YYYY-MM-DD
 * @param {string|null} userId - Discord user ID (null if not a Discord member)
 * @param {string} username - Display name (in‑game name or Discord tag)
 * @param {string} base - Base name
 * @param {string} might - Might value
 * @param {number} mention - 1 to mention, 0 to use plain username (only relevant if userId not null)
 */
function saveAssignment(guildId, warDate, userId, username, base, might, mention = 1) {
  // Delete any existing assignment for the same user/name on that date
  let del;
  if (userId) {
    del = db.prepare('DELETE FROM warboard_assignments WHERE guild_id = ? AND war_date = ? AND user_id = ?');
    del.run(guildId, warDate, userId);
  } else {
    del = db.prepare('DELETE FROM warboard_assignments WHERE guild_id = ? AND war_date = ? AND username = ?');
    del.run(guildId, warDate, username);
  }
  
  const ins = db.prepare(`
    INSERT INTO warboard_assignments (guild_id, war_date, user_id, username, base, might, mention)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  ins.run(guildId, warDate, userId, username, base, might, mention);

  // 🔁 NEW: Update might tracking for Discord users
  if (userId) {
    updatePlayerMight(guildId, userId, username, parseFloat(might) || 0);
  }
}

function removeAssignment(guildId, warDate, userId) {
  const stmt = db.prepare('DELETE FROM warboard_assignments WHERE guild_id = ? AND war_date = ? AND user_id = ?');
  stmt.run(guildId, warDate, userId);
}

function getAssignments(guildId, warDate) {
  const stmt = db.prepare(`
    SELECT * FROM warboard_assignments 
    WHERE guild_id = ? AND war_date = ?
    ORDER BY base, created_at
  `);
  return stmt.all(guildId, warDate);
}

function getWarboardDates(guildId) {
  const stmt = db.prepare('SELECT war_date FROM warboards WHERE guild_id = ? ORDER BY war_date DESC');
  return stmt.all(guildId).map(row => row.war_date);
}

function getBaseCounts(guildId, warDate) {
  const stmt = db.prepare(`
    SELECT base, COUNT(*) as count
    FROM warboard_assignments
    WHERE guild_id = ? AND war_date = ?
    GROUP BY base
  `);
  const rows = stmt.all(guildId, warDate);
  const map = new Map();
  rows.forEach(row => map.set(row.base, row.count));
  return map;
}

// ==================== NEW: Get latest might for a user ====================
function getLatestMight(guildId, userId) {
  const stmt = db.prepare(`
    SELECT might FROM warboard_assignments
    WHERE guild_id = ? AND user_id = ?
    ORDER BY war_date DESC, created_at DESC
    LIMIT 1
  `);
  const row = stmt.get(guildId, userId);
  return row ? parseFloat(row.might) : null;
}

// ==================== NEW: Copy assignments from one date to another ====================
function copyAssignments(guildId, sourceDate, targetDate, maxPerBase = null) {
  const sourceAssignments = getAssignments(guildId, sourceDate);
  if (sourceAssignments.length === 0) return 0;

  // Optionally limit per base
  let toCopy = sourceAssignments;
  if (maxPerBase && maxPerBase > 0) {
    const baseMap = new Map();
    toCopy = [];
    for (const ass of sourceAssignments) {
      if (!baseMap.has(ass.base)) baseMap.set(ass.base, 0);
      if (baseMap.get(ass.base) < maxPerBase) {
        baseMap.set(ass.base, baseMap.get(ass.base) + 1);
        toCopy.push(ass);
      }
    }
  }

  const insert = db.prepare(`
    INSERT INTO warboard_assignments (guild_id, war_date, user_id, username, base, might, mention, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  const transaction = db.transaction(() => {
    for (const ass of toCopy) {
      insert.run(guildId, targetDate, ass.user_id, ass.username, ass.base, ass.might, ass.mention);
    }
  });
  transaction();

  return toCopy.length;
}

// ==================== LINK IN‑GAME NAME TO DISCORD USER ====================
function linkNameToUser(guildId, inGameName, userId, userTag) {
  // Update all assignments where username matches the given name and user_id is NULL
  const stmt = db.prepare(`
    UPDATE warboard_assignments
    SET user_id = ?, mention = 1, username = ?
    WHERE guild_id = ? AND username = ? AND user_id IS NULL
  `);
  stmt.run(userId, userTag, guildId, inGameName);
  // Also update might tracking for the user if not exists
  const mightRecord = db.prepare('SELECT current_might FROM might_tracking WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (!mightRecord) {
    // Try to get the might from the most recent assignment for this name
    const latest = db.prepare(`
      SELECT might FROM warboard_assignments
      WHERE guild_id = ? AND username = ? AND user_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(guildId, inGameName);
    if (latest) {
      db.prepare(`
        INSERT INTO might_tracking (guild_id, user_id, username, previous_might, current_might, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(guildId, userId, userTag, 0, parseFloat(latest.might) || 0, Date.now());
    }
  }
}

// ==================== DM PERMISSION FUNCTIONS ====================
function grantDMPermission(userId, permission, grantedBy) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO dm_permissions (user_id, permission, granted_by)
    VALUES (?, ?, ?)
  `);
  stmt.run(userId, permission, grantedBy);
}

function revokeDMPermission(userId, permission) {
  const stmt = db.prepare(`
    DELETE FROM dm_permissions
    WHERE user_id = ? AND permission = ?
  `);
  stmt.run(userId, permission);
}

function hasDMPermission(userId, permission = null) {
  if (permission) {
    const stmt = db.prepare('SELECT 1 FROM dm_permissions WHERE user_id = ? AND permission = ?');
    return !!stmt.get(userId, permission);
  } else {
    const stmt = db.prepare('SELECT 1 FROM dm_permissions WHERE user_id = ?');
    return !!stmt.get(userId);
  }
}

function getAllDMPermissions() {
  const stmt = db.prepare(`
    SELECT user_id, permission, granted_by, granted_at
    FROM dm_permissions
    ORDER BY user_id, permission
  `);
  const rows = stmt.all();
  const result = {};
  rows.forEach(row => {
    if (!result[row.user_id]) {
      result[row.user_id] = {
        userId: row.user_id,
        permissions: [],
        grantedAt: row.granted_at
      };
    }
    result[row.user_id].permissions.push(row.permission);
  });
  return Object.values(result);
}

// ==================== DM ROLE FUNCTIONS ====================
function setDMRole(guildId, roleType, roleId, updatedBy) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO dm_roles (guild_id, role_type, role_id, updated_by)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(guildId, roleType, roleId, updatedBy);
}

function getDMRole(guildId, roleType) {
  const stmt = db.prepare('SELECT role_id FROM dm_roles WHERE guild_id = ? AND role_type = ?');
  const row = stmt.get(guildId, roleType);
  return row ? row.role_id : null;
}

function getAllDMRoles(guildId) {
  const stmt = db.prepare('SELECT role_type, role_id FROM dm_roles WHERE guild_id = ?');
  const rows = stmt.all(guildId);
  const result = {};
  rows.forEach(row => { result[row.role_type] = row.role_id; });
  return result;
}

// ==================== DM DELETION FUNCTIONS ====================
function addDMDeletionJob(userId, messageId, deleteAt) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO dm_deletion_jobs (user_id, message_id, delete_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(userId, messageId, deleteAt);
}

function removeDMDeletionJob(messageId) {
  const stmt = db.prepare('DELETE FROM dm_deletion_jobs WHERE message_id = ?');
  stmt.run(messageId);
}

function getAllDMDeletionJobs() {
  const stmt = db.prepare('SELECT * FROM dm_deletion_jobs ORDER BY delete_at');
  return stmt.all();
}

function getExpiredDMDeletionJobs() {
  const now = Date.now();
  const stmt = db.prepare('SELECT * FROM dm_deletion_jobs WHERE delete_at <= ?');
  return stmt.all(now);
}

// ==================== SELF-ROLE PANEL FUNCTIONS ====================
function createSelfRolePanel(guildId, panelName, title, description, footer, mode, maxRoles, createdBy) {
  const stmt = db.prepare(`
    INSERT INTO selfrole_panels (guild_id, panel_name, title, description, footer, mode, max_roles, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);
  stmt.run(guildId, panelName, title, description || null, footer || null, mode, maxRoles || 0, createdBy);
  return getSelfRolePanel(guildId, panelName);
}

function getSelfRolePanel(guildId, panelName) {
  const stmt = db.prepare(`
    SELECT * FROM selfrole_panels WHERE guild_id = ? AND panel_name = ?
  `);
  return stmt.get(guildId, panelName);
}

function getSelfRolePanels(guildId) {
  const stmt = db.prepare(`
    SELECT * FROM selfrole_panels WHERE guild_id = ? ORDER BY panel_name
  `);
  return stmt.all(guildId);
}

function updateSelfRolePanel(guildId, panelName, updates) {
  const { title, description, footer, mode, max_roles } = updates;
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (footer !== undefined) { fields.push('footer = ?'); values.push(footer); }
  if (mode !== undefined) { fields.push('mode = ?'); values.push(mode); }
  if (max_roles !== undefined) { fields.push('max_roles = ?'); values.push(max_roles); }
  if (fields.length === 0) return false;
  fields.push('updated_at = datetime("now", "localtime")');
  values.push(guildId, panelName);
  const stmt = db.prepare(`
    UPDATE selfrole_panels SET ${fields.join(', ')} WHERE guild_id = ? AND panel_name = ?
  `);
  stmt.run(...values);
  return true;
}

function deleteSelfRolePanel(guildId, panelName) {
  const stmt = db.prepare(`
    DELETE FROM selfrole_panels WHERE guild_id = ? AND panel_name = ?
  `);
  stmt.run(guildId, panelName);
}

function setSelfRoleMessage(guildId, panelName, channelId, messageId) {
  const stmt = db.prepare(`
    UPDATE selfrole_panels SET last_sent_channel_id = ?, last_sent_message_id = ?
    WHERE guild_id = ? AND panel_name = ?
  `);
  stmt.run(channelId, messageId, guildId, panelName);
}

function selfRolePanelExists(guildId, panelName) {
  const stmt = db.prepare('SELECT 1 FROM selfrole_panels WHERE guild_id = ? AND panel_name = ?');
  return !!stmt.get(guildId, panelName);
}

// ==================== SELF-ROLE BUTTON FUNCTIONS ====================
function addSelfRoleButton(guildId, panelName, roleId, emoji, style, position) {
  const panel = getSelfRolePanel(guildId, panelName);
  if (!panel) throw new Error('Panel not found');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO selfrole_buttons (panel_id, role_id, emoji, style, position)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(panel.id, roleId, emoji, style, position);
}

function removeSelfRoleButton(guildId, panelName, roleId) {
  const panel = getSelfRolePanel(guildId, panelName);
  if (!panel) return false;
  const stmt = db.prepare(`
    DELETE FROM selfrole_buttons WHERE panel_id = ? AND role_id = ?
  `);
  stmt.run(panel.id, roleId);
  return true;
}

function getSelfRoleButtons(guildId, panelName) {
  const panel = getSelfRolePanel(guildId, panelName);
  if (!panel) return [];
  const stmt = db.prepare(`
    SELECT * FROM selfrole_buttons WHERE panel_id = ? ORDER BY position
  `);
  return stmt.all(panel.id);
}

// ==================== SELF-ROLE ADMIN FUNCTIONS ====================
function addSelfRoleAdmin(guildId, userId, grantedBy) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO selfrole_admins (guild_id, user_id, granted_by)
    VALUES (?, ?, ?)
  `);
  stmt.run(guildId, userId, grantedBy);
}

function removeSelfRoleAdmin(guildId, userId) {
  const stmt = db.prepare(`
    DELETE FROM selfrole_admins WHERE guild_id = ? AND user_id = ?
  `);
  stmt.run(guildId, userId);
}

function isSelfRoleAdmin(guildId, userId) {
  const stmt = db.prepare('SELECT 1 FROM selfrole_admins WHERE guild_id = ? AND user_id = ?');
  return !!stmt.get(guildId, userId);
}

function getSelfRoleAdmins(guildId) {
  const stmt = db.prepare('SELECT user_id FROM selfrole_admins WHERE guild_id = ?');
  return stmt.all(guildId).map(row => row.user_id);
}

// ==================== GREETINGS SETTINGS FUNCTIONS ====================
function setGreetingsChannel(guildId, channelType, channelId, updatedBy) {
  const stmt = db.prepare(`
    INSERT INTO greetings_settings (guild_id, ${channelType}_channel_id, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(guild_id) DO UPDATE SET
      ${channelType}_channel_id = excluded.${channelType}_channel_id,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `);
  stmt.run(guildId, channelId, updatedBy);
}

function getGreetingsChannel(guildId, channelType) {
  const stmt = db.prepare(`SELECT ${channelType}_channel_id FROM greetings_settings WHERE guild_id = ?`);
  const row = stmt.get(guildId);
  return row ? row[`${channelType}_channel_id`] : null;
}

function enableGreeting(guildId, greetingType, enabled, updatedBy) {
  const stmt = db.prepare(`
    INSERT INTO greetings_settings (guild_id, ${greetingType}_enabled, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(guild_id) DO UPDATE SET
      ${greetingType}_enabled = excluded.${greetingType}_enabled,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `);
  stmt.run(guildId, enabled ? 1 : 0, updatedBy);
}

function isGreetingEnabled(guildId, greetingType) {
  const stmt = db.prepare(`SELECT ${greetingType}_enabled FROM greetings_settings WHERE guild_id = ?`);
  const row = stmt.get(guildId);
  return row ? row[`${greetingType}_enabled`] === 1 : false;
}

function getGreetingsSettings(guildId) {
  const stmt = db.prepare('SELECT * FROM greetings_settings WHERE guild_id = ?');
  return stmt.get(guildId) || {
    guild_id: guildId,
    welcome_channel_id: null,
    farewell_channel_id: null,
    welcome_enabled: 0,
    farewell_enabled: 0,
    ban_enabled: 0,
    kick_enabled: 0
  };
}

// ==================== GREETINGS MESSAGE FUNCTIONS ====================
function saveGreetingMessage(guildId, messageType, data, updatedBy) {
  const fields = ['guild_id', 'message_type', 'updated_by', 'updated_at'];
  const values = [guildId, messageType, updatedBy, new Date().toISOString()];
  const placeholders = ['?', '?', '?', '?'];
  const updateFields = [];

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      fields.push(key);
      values.push(data[key]);
      placeholders.push('?');
      updateFields.push(`${key} = excluded.${key}`);
    }
  });

  const insertSQL = `
    INSERT INTO welcome_messages (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT(guild_id, message_type) DO UPDATE SET
      ${updateFields.join(', ')},
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `;
  const stmt = db.prepare(insertSQL);
  stmt.run(...values);
}

function getGreetingMessage(guildId, messageType) {
  const stmt = db.prepare('SELECT * FROM welcome_messages WHERE guild_id = ? AND message_type = ?');
  const row = stmt.get(guildId, messageType);
  if (row && row.embed_fields) {
    try {
      row.embed_fields = JSON.parse(row.embed_fields);
    } catch {
      row.embed_fields = [];
    }
  }
  return row;
}


function deleteGreetingMessage(guildId, messageType) {
  const stmt = db.prepare('DELETE FROM welcome_messages WHERE guild_id = ? AND message_type = ?');
  stmt.run(guildId, messageType);
}

function getGreetingMessageWithFormat(guildId, messageType) {
  return getGreetingMessage(guildId, messageType);
}

// ==================== GREETINGS STATS FUNCTIONS ====================
function addGreetingStat(guildId, eventType, userId, userTag) {
  const stmt = db.prepare(`
    INSERT INTO greetings_stats (guild_id, event_type, user_id, user_tag)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(guildId, eventType, userId, userTag);
}

function getGreetingStats(guildId, eventType, limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM greetings_stats 
    WHERE guild_id = ? AND event_type = ?
    ORDER BY executed_at DESC
    LIMIT ?
  `);
  return stmt.all(guildId, eventType, limit);
}

// ==================== INVITE TRACKING FUNCTIONS ====================
function setInviteTrackingEnabled(guildId, enabled) {
  const stmt = db.prepare(`
    INSERT INTO guild_settings (guild_id, invite_tracking_enabled)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET invite_tracking_enabled = excluded.invite_tracking_enabled
  `);
  stmt.run(guildId, enabled ? 1 : 0);
}

function isInviteTrackingEnabled(guildId) {
  const stmt = db.prepare('SELECT invite_tracking_enabled FROM guild_settings WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.invite_tracking_enabled === 1 : false;
}

function addInviteRecord(guildId, inviterId, inviteeId, inviteCode, joinedAt) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO invite_tracking (guild_id, inviter_id, invitee_id, invite_code, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(guildId, inviterId, inviteeId, inviteCode, joinedAt);
  updateInviteCounts(guildId, inviterId);
}

function markInviteeLeft(guildId, inviteeId) {
  const stmt = db.prepare(`
    UPDATE invite_tracking SET left_at = ? WHERE guild_id = ? AND invitee_id = ?
  `);
  stmt.run(Date.now(), guildId, inviteeId);
  const inviter = db.prepare('SELECT inviter_id FROM invite_tracking WHERE guild_id = ? AND invitee_id = ?').get(guildId, inviteeId);
  if (inviter) updateInviteCounts(guildId, inviter.inviter_id);
}

function markInviteeFake(guildId, inviteeId) {
  const stmt = db.prepare(`
    UPDATE invite_tracking SET is_fake = 1 WHERE guild_id = ? AND invitee_id = ?
  `);
  stmt.run(guildId, inviteeId);
  const inviter = db.prepare('SELECT inviter_id FROM invite_tracking WHERE guild_id = ? AND invitee_id = ?').get(guildId, inviteeId);
  if (inviter) updateInviteCounts(guildId, inviter.inviter_id);
}

function updateInviteCounts(guildId, userId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN left_at IS NULL AND is_fake = 0 THEN 1 ELSE 0 END) as regular,
      SUM(CASE WHEN left_at IS NOT NULL AND is_fake = 0 THEN 1 ELSE 0 END) as left,
      SUM(is_fake) as fake
    FROM invite_tracking 
    WHERE guild_id = ? AND inviter_id = ?
  `).get(guildId, userId);
  
  const stmt = db.prepare(`
    INSERT INTO invite_counts (guild_id, user_id, total_invites, regular_invites, left_invites, fake_invites, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      total_invites = excluded.total_invites,
      regular_invites = excluded.regular_invites,
      left_invites = excluded.left_invites,
      fake_invites = excluded.fake_invites,
      updated_at = excluded.updated_at
  `);
  stmt.run(guildId, userId, stats.total || 0, stats.regular || 0, stats.left || 0, stats.fake || 0, Date.now());
}

function getInviter(guildId, inviteeId) {
  const stmt = db.prepare('SELECT inviter_id FROM invite_tracking WHERE guild_id = ? AND invitee_id = ?');
  const row = stmt.get(guildId, inviteeId);
  return row ? row.inviter_id : null;
}

function getInviteCounts(guildId, userId) {
  const stmt = db.prepare('SELECT * FROM invite_counts WHERE guild_id = ? AND user_id = ?');
  return stmt.get(guildId, userId) || { total_invites: 0, regular_invites: 0, left_invites: 0, fake_invites: 0 };
}

// ==================== DM GREETINGS FUNCTIONS ====================
function setDMGreetingEnabled(guildId, messageType, enabled, updatedBy) {
  const stmt = db.prepare(`
    INSERT INTO dm_greetings (guild_id, message_type, enabled, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(guild_id, message_type) DO UPDATE SET
      enabled = excluded.enabled,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `);
  stmt.run(guildId, messageType, enabled ? 1 : 0, updatedBy);
}

function isDMGreetingEnabled(guildId, messageType) {
  const stmt = db.prepare('SELECT enabled FROM dm_greetings WHERE guild_id = ? AND message_type = ?');
  const row = stmt.get(guildId, messageType);
  return row ? row.enabled === 1 : false;
}

function saveDMGreetingMessage(guildId, messageType, data, updatedBy) {
  const fields = ['guild_id', 'message_type', 'updated_by', 'updated_at'];
  const values = [guildId, messageType, updatedBy, new Date().toISOString()];
  const placeholders = ['?', '?', '?', '?'];
  const updateFields = [];

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      fields.push(key);
      values.push(data[key]);
      placeholders.push('?');
      updateFields.push(`${key} = excluded.${key}`);
    }
  });

  const insertSQL = `
    INSERT INTO dm_greetings (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT(guild_id, message_type) DO UPDATE SET
      ${updateFields.join(', ')},
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `;
  const stmt = db.prepare(insertSQL);
  stmt.run(...values);
}

function getDMGreetingMessage(guildId, messageType) {
  const stmt = db.prepare('SELECT * FROM dm_greetings WHERE guild_id = ? AND message_type = ?');
  const row = stmt.get(guildId, messageType);
  if (row && row.embed_fields) {
    try {
      row.embed_fields = JSON.parse(row.embed_fields);
    } catch {
      row.embed_fields = [];
    }
  }
  return row;
}


function deleteDMGreetingMessage(guildId, messageType) {
  const stmt = db.prepare('DELETE FROM dm_greetings WHERE guild_id = ? AND message_type = ?');
  stmt.run(guildId, messageType);
}

function getDMGreetingMessageWithFormat(guildId, messageType) {
  return getDMGreetingMessage(guildId, messageType);
}

// ==================== MIGHT TRACKING FUNCTIONS ====================
function updatePlayerMight(guildId, userId, username, might) {
  const now = Date.now();

  // Update might_tracking (upsert)
  const existing = db.prepare('SELECT * FROM might_tracking WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (!existing) {
    db.prepare(`
      INSERT INTO might_tracking (guild_id, user_id, username, previous_might, current_might, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId, userId, username, might, might, now);
  } else {
    db.prepare(`
      UPDATE might_tracking SET current_might = ?, username = ?, updated_at = ?
      WHERE guild_id = ? AND user_id = ?
    `).run(might, username, now, guildId, userId);
  }

  // 🔥 RECORD HISTORY SNAPSHOT
  db.prepare(`
    INSERT INTO might_history (guild_id, user_id, username, might, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, userId, username, might, now);
}

function getMightDifferences(guildId) {
  const stmt = db.prepare(`
    SELECT user_id, username, previous_might, current_might,
           (current_might - previous_might) AS change
    FROM might_tracking
    WHERE guild_id = ?
    ORDER BY current_might DESC
  `);
  return stmt.all(guildId);
}

function resetMightBaseline(guildId) {
  const stmt = db.prepare(`
    UPDATE might_tracking SET previous_might = current_might WHERE guild_id = ?
  `);
  stmt.run(guildId);
}

function setMightReportChannel(guildId, channelId) {
  const stmt = db.prepare(`
    INSERT INTO guild_settings (guild_id, might_report_channel)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET might_report_channel = excluded.might_report_channel
  `);
  stmt.run(guildId, channelId);
}

function getMightReportChannel(guildId) {
  const stmt = db.prepare('SELECT might_report_channel FROM guild_settings WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.might_report_channel : null;
}

// ==================== GET SINGLE ASSIGNMENT ====================
function getAssignmentByUser(guildId, warDate, userId) {
  const stmt = db.prepare('SELECT * FROM warboard_assignments WHERE guild_id = ? AND war_date = ? AND user_id = ?');
  return stmt.get(guildId, warDate, userId);
}

function getAssignmentByName(guildId, warDate, username) {
  const stmt = db.prepare('SELECT * FROM warboard_assignments WHERE guild_id = ? AND war_date = ? AND username = ?');
  return stmt.get(guildId, warDate, username);
}

// ==================== NEW: Get distinct usernames for autocomplete ====================
function getDistinctUsernames(guildId, search = '', limit = 25) {
  const stmt = db.prepare(`
    SELECT DISTINCT username FROM warboard_assignments
    WHERE guild_id = ? AND username LIKE ?
    ORDER BY username
    LIMIT ?
  `);
  return stmt.all(guildId, `%${search}%`, limit).map(row => row.username);
}

// ==================== NEW: Remove assignment by name ====================
function removeAssignmentByName(guildId, warDate, username) {
  const stmt = db.prepare('DELETE FROM warboard_assignments WHERE guild_id = ? AND war_date = ? AND username = ?');
  stmt.run(guildId, warDate, username);
}

// ==================== NEW: Get only unlinked usernames (user_id IS NULL) for autocomplete ====================
function getUnlinkedUsernames(guildId, search = '', limit = 25) {
  const stmt = db.prepare(`
    SELECT DISTINCT username FROM warboard_assignments
    WHERE guild_id = ? AND user_id IS NULL AND username LIKE ?
    ORDER BY username
    LIMIT ?
  `);
  return stmt.all(guildId, `%${search}%`, limit).map(row => row.username);
}



// ==================== TICKET PANELS ====================
function createTicketPanel(guildId, panelName, channelId, categoryId, supportRoleId, ticketNameFormat, welcomeMessage, embedColor, buttonLabel, buttonEmoji, buttonStyle, createdBy) {
    const stmt = db.prepare(`
        INSERT INTO ticket_panels (guild_id, panel_name, channel_id, category_id, support_role_id, ticket_name_format, welcome_message, embed_color, button_label, button_emoji, button_style, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(guildId, panelName, channelId, categoryId, supportRoleId, ticketNameFormat, welcomeMessage, embedColor, buttonLabel, buttonEmoji, buttonStyle, createdBy);
}

function getTicketPanels(guildId) {
    return db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ? ORDER BY panel_name').all(guildId);
}

function getTicketPanel(guildId, panelName) {
    return db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ? AND panel_name = ?').get(guildId, panelName);
}

function updateTicketPanel(guildId, panelName, updates) {
    const fields = [];
    const values = [];
    Object.entries(updates).forEach(([key, val]) => {
        if (val !== undefined) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    });
    if (fields.length === 0) return;
    fields.push('updated_at = datetime("now", "localtime")');
    values.push(guildId, panelName);
    const sql = `UPDATE ticket_panels SET ${fields.join(', ')} WHERE guild_id = ? AND panel_name = ?`;
    db.prepare(sql).run(...values);
}

function deleteTicketPanel(guildId, panelName) {
    db.prepare('DELETE FROM ticket_panels WHERE guild_id = ? AND panel_name = ?').run(guildId, panelName);
}

function setTicketPanelMessage(guildId, panelName, messageId) {
    db.prepare('UPDATE ticket_panels SET message_id = ? WHERE guild_id = ? AND panel_name = ?').run(messageId, guildId, panelName);
}

// ==================== TICKETS ====================
function getTicketByChannel(channelId) {
    return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

function getOpenTickets(guildId) {
    return db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND status = "open"').all(guildId);
}

function getTicketMessages(ticketId) {
    return db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY timestamp').all(ticketId);
}

// ==================== TICKET SETTINGS ====================
function setTicketSetting(guildId, key, value) {
    const stmt = db.prepare(`
        INSERT INTO ticket_settings (guild_id, ${key})
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET ${key} = excluded.${key}
    `);
    stmt.run(guildId, value);
}

function getTicketSetting(guildId, key) {
    const row = db.prepare(`SELECT ${key} FROM ticket_settings WHERE guild_id = ?`).get(guildId);
    return row ? row[key] : null;
}

// Add to database/index.js

/**
 * Copy assignments from source date to target date
 * @param {string} guildId - Guild ID
 * @param {string} sourceDate - Source date in YYYY-MM-DD
 * @param {string} targetDate - Target date in YYYY-MM-DD
 * @param {number} maxPerBase - Optional maximum players per base to copy
 * @returns {number} Number of assignments copied
 */
function copyAssignments(guildId, sourceDate, targetDate, maxPerBase = null) {
  // Get source assignments
  const sourceAssignments = getAssignments(guildId, sourceDate);
  
  if (sourceAssignments.length === 0) return 0;
  
  let copied = 0;
  const baseCounts = new Map();
  
  // Use a transaction for safety
  const transaction = db.transaction(() => {
    for (const ass of sourceAssignments) {
      // Check per-base limit if specified
      if (maxPerBase !== null) {
        const currentCount = baseCounts.get(ass.base) || 0;
        if (currentCount >= maxPerBase) continue;
        baseCounts.set(ass.base, currentCount + 1);
      }
      
      // Copy assignment
      saveAssignment(
        guildId,
        targetDate,
        ass.user_id,
        ass.username,
        ass.base,
        ass.might,
        ass.mention
      );
      copied++;
    }
  });
  
  transaction();
  return copied;
}
// ========== PLAYER MANAGEMENT ==========
/**
 * Get all players for a guild
 */
function getPlayers(guildId) {
  const stmt = db.prepare('SELECT * FROM players WHERE guild_id = ? ORDER BY username');
  return stmt.all(guildId);
}

/**
 * Get player count for a guild
 */
function getPlayerCount(guildId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM players WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.count : 0;
}

/**
 * Add a new player
 */
function addPlayer(guildId, userId, username, might) {
  const stmt = db.prepare(`
    INSERT INTO players (guild_id, user_id, username, might)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(guildId, userId, username, might);
}

/**
 * Update a player
 */
function updatePlayer(id, guildId, username, might) {
  const stmt = db.prepare(`
    UPDATE players SET username = ?, might = ?
    WHERE id = ? AND guild_id = ?
  `);
  stmt.run(username, might, id, guildId);
}

/**
 * Delete a player
 */
function deletePlayer(id, guildId) {
  const stmt = db.prepare('DELETE FROM players WHERE id = ? AND guild_id = ?');
  stmt.run(id, guildId);
}

// ========== WARBOARD COUNTS ==========
/**
 * Get number of warboards for a guild
 */
function getWarboardCount(guildId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM warboards WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.count : 0;
}

/**
 * Get total number of assignments for a guild
 */
function getAssignmentCount(guildId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM assignments WHERE guild_id = ?');
  const row = stmt.get(guildId);
  return row ? row.count : 0;
}

/**
 * Get the latest war date for a guild
 */
function getLatestWarDate(guildId) {
  const stmt = db.prepare('SELECT war_date FROM warboards WHERE guild_id = ? ORDER BY war_date DESC LIMIT 1');
  const row = stmt.get(guildId);
  return row ? row.war_date : null;
}

/**
 * Delete a warboard and its assignments
 */
function deleteWarboard(guildId, date) {
  const deleteAssignments = db.prepare('DELETE FROM warboard_assignments WHERE guild_id = ? AND war_date = ?');
  const deleteWarboard = db.prepare('DELETE FROM warboards WHERE guild_id = ? AND war_date = ?');
  
  const transaction = db.transaction(() => {
    deleteAssignments.run(guildId, date);
    deleteWarboard.run(guildId, date);
  });
  
  transaction();
}

/**
 * Delete a specific assignment by its ID
 */
function deleteAssignmentById(assignmentId, guildId, date) {
  const stmt = db.prepare('DELETE FROM assignments WHERE id = ? AND guild_id = ? AND war_date = ?');
  stmt.run(assignmentId, guildId, date);
}



// Function to create a web user
function createWebUser(username, password, createdBy, discordId = null) {
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO web_users (username, password_hash, discord_id, created_by) VALUES (?, ?, ?, ?)');
  return stmt.run(username, hash, discordId, createdBy);
}

// Function to validate a web user
function validateWebUser(username, password) {
  console.log(`validateWebUser called with username: ${username}`);
  const stmt = db.prepare('SELECT * FROM web_users WHERE username = ?');
  const user = stmt.get(username);
  console.log(`User found: ${user ? 'yes' : 'no'}`);
  if (!user) return null;
  
  // Log the stored hash for debugging
  console.log(`Stored hash: ${user.password_hash.substring(0, 20)}...`);
  
  const match = bcrypt.compareSync(password, user.password_hash);
  console.log(`Password match: ${match}`);
  
  // If password doesn't match, show the correct expected hash for this password
  if (!match) {
    // Generate the correct hash for 'meetpatel1883' to show what it should be
    const correctHashForPassword = bcrypt.hashSync('meetpatel1883', 10);
    console.log(`Correct hash for 'meetpatel1883' should be: ${correctHashForPassword}`);
    console.log(`Your current hash is: ${user.password_hash}`);
    console.log(`👉 Update with: UPDATE web_users SET password_hash = '${correctHashForPassword}' WHERE username = '${username}';`);
  }
  
  if (match) {
    return { id: user.id, username: user.username, discord_id: user.discord_id };
  }
  return null;
}

// Function to get web user by Discord ID
function getWebUserByDiscordId(discordId) {
  const stmt = db.prepare('SELECT * FROM web_users WHERE discord_id = ?');
  return stmt.get(discordId);
}

// Function to list all web users (for owner panel)
function getAllWebUsers() {
  return db.prepare('SELECT id, username, discord_id, created_by, created_at, status FROM web_users').all();
}

// Function to delete a web user
function deleteWebUser(id) {
  return db.prepare('DELETE FROM web_users WHERE id = ?').run(id);
}

// Function to update a web user (password or discord_id)
function updateWebUser(id, { password, discordId }) {
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE web_users SET password_hash = ? WHERE id = ?').run(hash, id);
  }
  if (discordId !== undefined) {
    db.prepare('UPDATE web_users SET discord_id = ? WHERE id = ?').run(discordId, id);
  }
}

function seedDefaultUser() {
  console.log('Checking for default user...');
  const stmt = db.prepare('SELECT * FROM web_users WHERE username = ?');
  const existing = stmt.get('meetpatel');
  if (!existing) {
    const hash = bcrypt.hashSync('meetpatel1883', 10);
    const insert = db.prepare('INSERT INTO web_users (username, password_hash, created_by) VALUES (?, ?, ?)');
    insert.run('meetpatel', hash, 'system');
    console.log('Default web user created: meetpatel');
  } else {
    console.log('Default user already exists');
  }
}

function addActivityLog(guildId, userId, username, action, details = null, ip = null) {
  console.log(`addActivityLog: guild=${guildId}, user=${userId}, action=${action}`);
  const stmt = db.prepare('INSERT INTO activity_logs (guild_id, user_id, username, action, details, ip) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(guildId, userId, username, action, details, ip);
}

function getActivityLogs(guildId, limit = 50) {
  return db.prepare('SELECT * FROM activity_logs WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?').all(guildId, limit);
}

// Helper to record web session  
function recordWebSession(userId, username, avatar, ip, sessionId, userAgent) {
  db.prepare(`
    INSERT INTO web_sessions (user_id, username, avatar, login_time, last_active, ip, session_id, user_agent)
    VALUES (?, ?, ?, datetime('now','localtime'), datetime('now','localtime'), ?, ?, ?)
  `).run(userId, username, avatar, ip, sessionId, userAgent);
}


// Record a might snapshot (used by cron or when might changes)
function recordMightSnapshot(guildId, userId, username, might) {
  const stmt = db.prepare(`
    INSERT INTO might_history (guild_id, user_id, username, might, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(guildId, userId, username, might, Date.now());
}

// Get might history for a specific user (chronological)
function getMightHistoryForUser(guildId, userId, limit = 50) {
  const stmt = db.prepare(`
    SELECT id, might, recorded_at
    FROM might_history
    WHERE guild_id = ? AND user_id = ?
    ORDER BY recorded_at ASC
    LIMIT ?
  `);
  return stmt.all(guildId, userId, limit);
}


function getHistoryById(id) {
  const stmt = db.prepare('SELECT * FROM might_history WHERE id = ?');
  return stmt.get(id);
}



// Get latest might for all users (from might_tracking)
function getAllCurrentMight(guildId) {
  const stmt = db.prepare(`
    SELECT user_id, username, current_might as might
    FROM might_tracking
    WHERE guild_id = ?
    ORDER BY username
  `);
  return stmt.all(guildId);
}

// Submit a new might
function submitMight(guildId, userId, username, inGameName, might) {
  const stmt = db.prepare(`
    INSERT INTO might_submissions (guild_id, user_id, username, in_game_name, submitted_might, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(guildId, userId, username, inGameName, might, Date.now());
}

// Get pending submissions for a guild
function getPendingSubmissions(guildId) {
  return db.prepare(`
    SELECT * FROM might_submissions
    WHERE guild_id = ? AND status = 'pending'
    ORDER BY submitted_at DESC
  `).all(guildId);
}

function approveSubmission(submissionId, adminId, notes = '') {
  // Atomic update only if still pending
  const updateStmt = db.prepare(`
    UPDATE might_submissions 
    SET status = 'approved', reviewed_by = ?, reviewed_at = ?, admin_notes = ?
    WHERE id = ? AND status = 'pending'
  `);
  const result = updateStmt.run(adminId, Date.now(), notes, submissionId);

  if (result.changes === 0) {
    logger.debug(`Submission ${submissionId} not updated (already processed or not found)`);
    return;
  }

  // Fetch submission details
  const submission = db.prepare('SELECT * FROM might_submissions WHERE id = ?').get(submissionId);
  if (!submission) return;

  // Update might_tracking – this already inserts a history record
  updatePlayerMight(submission.guild_id, submission.user_id, submission.username, submission.submitted_might);
}

function rejectSubmission(submissionId, adminId, notes = '') {
  const updateStmt = db.prepare(`
    UPDATE might_submissions 
    SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, admin_notes = ?
    WHERE id = ? AND status = 'pending'
  `);
  const result = updateStmt.run(adminId, Date.now(), notes, submissionId);
  
  if (result.changes === 0) {
    logger.debug(`Submission ${submissionId} not updated (already processed or not found)`);
  }
}

// Delete a might history point (admin only)
function deleteMightHistory(historyId) {
  db.prepare('DELETE FROM might_history WHERE id = ?').run(historyId);
}

function getGuildAdmins(guildId) {
  const stmt = db.prepare('SELECT user_id FROM admins WHERE guild_id = ?');
  return stmt.all(guildId).map(row => row.user_id);
}
function getUserPendingSubmissions(guildId, userId) {
  const stmt = db.prepare(`
    SELECT * FROM might_submissions
    WHERE guild_id = ? AND user_id = ? AND status = 'pending'
    ORDER BY submitted_at DESC
  `);
  return stmt.all(guildId, userId);
}

function getSubmissionById(submissionId) {
  const stmt = db.prepare('SELECT * FROM might_submissions WHERE id = ?');
  return stmt.get(submissionId);
}

function storeSubmissionDM(submissionId, adminId, channelId, messageId) {
  const stmt = db.prepare(`
    INSERT INTO might_submission_dms (submission_id, admin_id, channel_id, message_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(submissionId, adminId, channelId, messageId, Date.now());
}

function getSubmissionDMs(submissionId) {
  const stmt = db.prepare('SELECT * FROM might_submission_dms WHERE submission_id = ?');
  return stmt.all(submissionId);
}

function deleteSubmissionDMs(submissionId) {
  const stmt = db.prepare('DELETE FROM might_submission_dms WHERE submission_id = ?');
  stmt.run(submissionId);
}

// database/index.js – add near other might functions
function deleteMightHistory(historyId) {
  const stmt = db.prepare('DELETE FROM might_history WHERE id = ?');
  return stmt.run(historyId);
}

function getLatestMight(guildId, userId) {
  const stmt = db.prepare(`
    SELECT might FROM might_history
    WHERE guild_id = ? AND user_id = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `);
  const row = stmt.get(guildId, userId);
  return row ? parseFloat(row.might) : null;
}

// Paginated might history (newest first)
function getMightHistoryPaginated(guildId, userId, limit, offset) {
  const stmt = db.prepare(`
    SELECT id, might, recorded_at
    FROM might_history
    WHERE guild_id = ? AND user_id = ?
    ORDER BY recorded_at DESC
    LIMIT ? OFFSET ?
  `);
  const history = stmt.all(guildId, userId, limit, offset);
  const countStmt = db.prepare('SELECT COUNT(*) as total FROM might_history WHERE guild_id = ? AND user_id = ?');
  const total = countStmt.get(guildId, userId).total;
  return { history, total };
}

// Paginated submission history (approved/rejected, newest first)
function getUserSubmissionsPaginated(guildId, userId, limit, offset) {
  const stmt = db.prepare(`
    SELECT id, in_game_name, submitted_might, status, admin_notes, submitted_at
    FROM might_submissions
    WHERE guild_id = ? AND user_id = ? AND status IN ('approved', 'rejected')
    ORDER BY submitted_at DESC
    LIMIT ? OFFSET ?
  `);
  const submissions = stmt.all(guildId, userId, limit, offset);
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM might_submissions
    WHERE guild_id = ? AND user_id = ? AND status IN ('approved', 'rejected')
  `);
  const total = countStmt.get(guildId, userId).total;
  return { submissions, total };
}

// Get might history within a date range (timestamps in ms)
function getMightHistoryInRange(guildId, userId, start, end) {
  let query = `
    SELECT id, might, recorded_at
    FROM might_history
    WHERE guild_id = ? AND user_id = ?
  `;
  const params = [guildId, userId];
  if (start) {
    query += ` AND recorded_at >= ?`;
    params.push(start);
  }
  if (end) {
    query += ` AND recorded_at <= ?`;
    params.push(end);
  }
  query += ` ORDER BY recorded_at ASC`;
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// Questions
function createQuestion(guildId, title, description, footer, suffix, maxInteractions, createdBy) {
    const stmt = db.prepare(`
        INSERT INTO questions (guild_id, title, description, footer, suffix, max_interactions, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
    `);
    return stmt.run(guildId, title, description, footer, suffix, maxInteractions, createdBy);
}

function getQuestion(questionId) {
    const stmt = db.prepare('SELECT * FROM questions WHERE id = ?');
    return stmt.get(questionId);
}

function getQuestions(guildId, status = null) {
    let sql = 'SELECT * FROM questions WHERE guild_id = ?';
    const params = [guildId];
    if (status) {
        sql += ' AND status = ?';
        params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    return stmt.all(...params);
}

function setQuestionMessage(questionId, channelId, messageId) {
    const stmt = db.prepare('UPDATE questions SET channel_id = ?, message_id = ? WHERE id = ?');
    stmt.run(channelId, messageId, questionId);
}

function setQuestionStatus(questionId, status) {
    const stmt = db.prepare('UPDATE questions SET status = ? WHERE id = ?');
    stmt.run(status, questionId);
}

function deleteQuestion(questionId) {
    const stmt = db.prepare('DELETE FROM questions WHERE id = ?');
    stmt.run(questionId);
}

// Options
function addQuestionOption(questionId, label, answerText, answerNumber, emoji, style, position) {
    const stmt = db.prepare(`
        INSERT INTO question_options (question_id, label, answer_text, answer_number, emoji, style, position)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(questionId, label, answerText, answerNumber, emoji, style, position);
}

function getQuestionOptions(questionId) {
    const stmt = db.prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY position');
    return stmt.all(questionId);
}

function deleteQuestionOptions(questionId) {
    const stmt = db.prepare('DELETE FROM question_options WHERE question_id = ?');
    stmt.run(questionId);
}

// Responses
function addQuestionResponse(questionId, userId, optionId) {
    const stmt = db.prepare(`
        INSERT INTO question_responses (question_id, user_id, option_id)
        VALUES (?, ?, ?)
    `);
    stmt.run(questionId, userId, optionId);
}

function getQuestionResponses(questionId) {
    const stmt = db.prepare('SELECT * FROM question_responses WHERE question_id = ?');
    return stmt.all(questionId);
}

function getUserResponsesForQuestion(questionId, userId) {
    const stmt = db.prepare('SELECT * FROM question_responses WHERE question_id = ? AND user_id = ?');
    return stmt.all(questionId, userId);
}

function deleteQuestionResponses(questionId) {
    const stmt = db.prepare('DELETE FROM question_responses WHERE question_id = ?');
    stmt.run(questionId);
}
function setQuestionScheduled(questionId, scheduledAt) {
    const stmt = db.prepare('UPDATE questions SET scheduled_at = ?, status = ? WHERE id = ?');
    stmt.run(scheduledAt, 'scheduled', questionId);
}

function getDueScheduledQuestions() {
    const now = Date.now();
    const sql = 'SELECT * FROM questions WHERE status = \'scheduled\' AND scheduled_at <= ?';
    // console.log('Executing SQL:', Done);
    try {
        const stmt = db.prepare(sql);
        const result = stmt.all(now);
  //      console.log(`✅ Found ${result.length} due questions`);
        return result;
    } catch (err) {
        console.error('❌ SQL error in getDueScheduledQuestions:', err);
        throw err;
    }
}

function setQuestionChannel(questionId, channelId) {
    const stmt = db.prepare('UPDATE questions SET channel_id = ? WHERE id = ?');
    stmt.run(channelId, questionId);
}
// Playlists
function createPlaylist(guildId, userId, name, tracks = []) {
    const stmt = db.prepare('INSERT INTO playlists (guild_id, user_id, name, tracks) VALUES (?, ?, ?, ?)');
    return stmt.run(guildId, userId, name, JSON.stringify(tracks));
}

function getUserPlaylists(guildId, userId) {
    const stmt = db.prepare('SELECT id, name, tracks, created_at FROM playlists WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC');
    return stmt.all(guildId, userId);
}

function getPlaylist(guildId, userId, name) {
    const stmt = db.prepare('SELECT * FROM playlists WHERE guild_id = ? AND user_id = ? AND name = ?');
    return stmt.get(guildId, userId, name);
}

function updatePlaylistTracks(guildId, userId, name, tracks) {
    const stmt = db.prepare('UPDATE playlists SET tracks = ? WHERE guild_id = ? AND user_id = ? AND name = ?');
    stmt.run(JSON.stringify(tracks), guildId, userId, name);
}

function deletePlaylist(guildId, userId, name) {
    const stmt = db.prepare('DELETE FROM playlists WHERE guild_id = ? AND user_id = ? AND name = ?');
    stmt.run(guildId, userId, name);
}

// inside database.js
function getPinChannel(channelId) {
  return db.prepare('SELECT * FROM pin_channels WHERE channel_id = ?').get(channelId);
}

function addPinChannel(guildId, channelId, userId) {
  db.prepare('INSERT OR IGNORE INTO pin_channels (guild_id, channel_id, created_by) VALUES (?, ?, ?)')
    .run(guildId, channelId, userId);
}

function removePinChannel(channelId) {
  db.prepare('DELETE FROM pin_channels WHERE channel_id = ?').run(channelId);
}

function getPinChannelsByGuild(guildId) {
  return db.prepare('SELECT * FROM pin_channels WHERE guild_id = ?').all(guildId);
}

function updatePinLastMessage(channelId, messageId) {
  db.prepare('UPDATE pin_channels SET last_message_id = ? WHERE channel_id = ?')
    .run(messageId, channelId);
}
function updatePinMessage(channelId, data) {
  const allowedFields = [
    'content', 'use_embed', 'embed_title', 'embed_description', 'embed_color',
    'embed_footer', 'embed_thumbnail', 'embed_image', 'embed_author',
    'embed_author_icon', 'embed_author_url', 'embed_title_url', 'embed_footer_icon',
    'embed_timestamp', 'embed_fields'
  ];

  const assignments = [];
  const values = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      assignments.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (assignments.length === 0) return;

  values.push(channelId); // for the WHERE clause
  const sql = `UPDATE pin_channels SET ${assignments.join(', ')} WHERE channel_id = ?`;
  db.prepare(sql).run(...values);
}

function getUserLanguage(userId) {
  const row = db.prepare('SELECT language FROM user_languages WHERE user_id = ?').get(userId);
  return row?.language || null;            // null means “not set”
}

function setUserLanguage(userId, lang) {
  db.prepare('INSERT OR REPLACE INTO user_languages (user_id, language) VALUES (?, ?)').run(userId, lang);
}

// ========== WEB USER STATUS ==========
function setWebUserStatus(userId, status) {
  db.prepare('UPDATE web_users SET status = ? WHERE id = ?').run(status, userId);
}

function getWebUserStatus(userId) {
  const row = db.prepare('SELECT status FROM web_users WHERE id = ?').get(userId);
  return row?.status || 'active';
}

// ========== BANNED DISCORD IDS ==========
function banDiscordId(discordId, username, reason, byUserId) {
  db.prepare(`
    INSERT OR REPLACE INTO banned_discord (discord_id, username, banned_at, banned_by, reason)
    VALUES (?, ?, datetime('now','localtime'), ?, ?)
  `).run(discordId, username, byUserId, reason);
}

function unbanDiscordId(discordId) {
  db.prepare('DELETE FROM banned_discord WHERE discord_id = ?').run(discordId);
}

function isDiscordBanned(discordId) {
  const row = db.prepare('SELECT 1 FROM banned_discord WHERE discord_id = ?').get(discordId);
  return !!row;
}

function getBannedDiscordIds() {
  return db.prepare('SELECT * FROM banned_discord ORDER BY banned_at DESC').all();
}

function getWebUserById(id) {
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(id);
}

// IP rules
function getIpRules() {
  return db.prepare('SELECT * FROM ip_rules ORDER BY created_at DESC').all();
}
function addIpRule(ip, type, createdBy) {
  return db.prepare('INSERT INTO ip_rules (ip, type, created_by) VALUES (?, ?, ?)').run(ip, type, createdBy);
}
function deleteIpRule(id) {
  return db.prepare('DELETE FROM ip_rules WHERE id = ?').run(id);
}

// Error logs
function logError(message, stack, url, userId) {
  db.prepare('INSERT INTO error_logs (message, stack, url, user_id) VALUES (?, ?, ?, ?)').run(message, stack, url, userId);
}
function getErrorLogs(limit = 50) {
  return db.prepare('SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
}

// User settings
function getUserSettings(userId) {
  const row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  return row || { theme: 'dark', custom_css: '', dashboard_layout: '[]' };
}
function setUserSettings(userId, settings) {
  const { theme, custom_css, dashboard_layout } = settings;
  db.prepare(`
    INSERT INTO user_settings (user_id, theme, custom_css, dashboard_layout)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      theme = COALESCE(excluded.theme, theme),
      custom_css = COALESCE(excluded.custom_css, custom_css),
      dashboard_layout = COALESCE(excluded.dashboard_layout, dashboard_layout)
  `).run(userId, theme, custom_css, dashboard_layout);
}


// ==================== EXPORT ALL ====================
module.exports = {
  db,
  // Guild
  createGuild,
  updateGuildName,
  getGuildName,
  enableGuild,
  disableGuild,
  isGuildEnabled,
  getGuild,
  getAllGuilds,
  // Admin
  addAdmin,
  removeAdmin,
  isAdmin,
  getAdmins,
  getGuildAdmins,
    getUserAccessibleGuilds,
  // Warboard
  createWarboard,
  saveWarboardMessage,
  getWarboard,
  saveAssignment,
  removeAssignment,
  getAssignments,
  getWarboardDates,
  getBaseCounts,
  linkNameToUser,
  // NEW
  getLatestMight,
  copyAssignments,
  // DM Permissions
  grantDMPermission,
  revokeDMPermission,
  hasDMPermission,
  getAllDMPermissions,
  // DM Roles
  setDMRole,
  getDMRole,
  getAllDMRoles,
  // DM Deletion
  addDMDeletionJob,
  removeDMDeletionJob,
  getAllDMDeletionJobs,
  getExpiredDMDeletionJobs,
  // Self‑Role Panels
  createSelfRolePanel,
  getSelfRolePanel,
  getSelfRolePanels,
  updateSelfRolePanel,
  deleteSelfRolePanel,
  setSelfRoleMessage,
  selfRolePanelExists,
  // Self‑Role Buttons
  addSelfRoleButton,
  removeSelfRoleButton,
  getSelfRoleButtons,
  // Self‑Role Admins
  addSelfRoleAdmin,
  removeSelfRoleAdmin,
  isSelfRoleAdmin,
  getSelfRoleAdmins,
  // Greetings Settings
  setGreetingsChannel,
  getGreetingsChannel,
  enableGreeting,
  isGreetingEnabled,
  getGreetingsSettings,
  // Greetings Messages
  saveGreetingMessage,
  getGreetingMessage,
  deleteGreetingMessage,
  getGreetingMessageWithFormat,
  // Greetings Stats
  addGreetingStat,
  getGreetingStats,
  // Invite Tracking
  setInviteTrackingEnabled,
  isInviteTrackingEnabled,
  addInviteRecord,
  markInviteeLeft,
  markInviteeFake,
  updateInviteCounts,
  getInviter,
  getInviteCounts,
  // DM Greetings
  setDMGreetingEnabled,
  isDMGreetingEnabled,
  saveDMGreetingMessage,
  getDMGreetingMessage,
  deleteDMGreetingMessage,
  getDMGreetingMessageWithFormat,
  // Might Tracking
  updatePlayerMight,
  getMightDifferences,
  resetMightBaseline,
  setMightReportChannel,
  getMightReportChannel,
    
    getAssignmentByUser,
    getAssignmentByName,
      getDistinctUsernames,
  removeAssignmentByName,
      getUnlinkedUsernames,
    //ticket
    getTicketSetting,
    setTicketSetting,
    getTicketMessages,
    getOpenTickets,
    getTicketByChannel,
    setTicketPanelMessage,
    deleteTicketPanel,
    updateTicketPanel,
    getTicketPanel,
    getTicketPanels,
    createTicketPanel,
    copyAssignments,
    getPlayers,
    getPlayerCount,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getWarboardCount,
    getAssignmentCount,
    getLatestWarDate,
    deleteWarboard,
    deleteAssignmentById,
    createWebUser,
    validateWebUser,
    getWebUserByDiscordId,
    getAllWebUsers,
    deleteWebUser,
    updateWebUser,
    //logs web
    addActivityLog,
  getActivityLogs,
    recordWebSession,
    //might history
    recordMightSnapshot,
getMightHistoryForUser,
getAllCurrentMight,
submitMight,
getPendingSubmissions,
approveSubmission,
rejectSubmission,
getUserPendingSubmissions,
getSubmissionById,
    storeSubmissionDM,
  getSubmissionDMs,
    deleteSubmissionDMs,
    getHistoryById,
    deleteMightHistory,
    getLatestMight,
    getMightHistoryPaginated,
    getUserSubmissionsPaginated,
    getMightHistoryInRange,
    //question 
    createQuestion,
    getQuestion,
    getQuestions,
    setQuestionMessage,
    setQuestionStatus,
    setQuestionScheduled,
    getDueScheduledQuestions,
    deleteQuestion,
    addQuestionOption,
    getQuestionOptions,
    addQuestionResponse,
    deleteQuestionOptions,
    deleteQuestionResponses,
    getUserResponsesForQuestion,
    getQuestionResponses,
    setQuestionChannel,
    createPlaylist,
    getUserPlaylists,
    getPlaylist,
    updatePlaylistTracks,
    deletePlaylist,
    getPinChannel,
    addPinChannel,
    removePinChannel,
    getPinChannelsByGuild,
    updatePinLastMessage,
    updatePinMessage,
    getUserLanguage,
    setUserLanguage,

    setWebUserStatus,
    getWebUserStatus,
    banDiscordId,
    unbanDiscordId,
    isDiscordBanned,
    getBannedDiscordIds,
     getWebUserById,

     getIpRules,
     addIpRule,
     deleteIpRule,
     logError,
     getErrorLogs,
     getUserSettings,
     setUserSettings
};
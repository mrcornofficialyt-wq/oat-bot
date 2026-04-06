const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs-extra');

const DB_PATH = path.join(__dirname, '..', 'data', 'bot.db');
let db = null;

// Save DB to disk
function saveToDisk() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.ensureDirSync(path.dirname(DB_PATH));
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

// Auto-save every 30 seconds
let saveInterval = null;

async function initialize() {
  const SQL = await initSqlJs();
  fs.ensureDirSync(path.dirname(DB_PATH));

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  saveInterval = setInterval(saveToDisk, 30000);
  console.log('✅ Database initialized');
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      prefix TEXT DEFAULT '?',
      language TEXT DEFAULT 'en',
      owner_id TEXT,
      automod_status INTEGER DEFAULT 0,
      antiraid_status INTEGER DEFAULT 0,
      jail_status INTEGER DEFAULT 1,
      leveling_status INTEGER DEFAULT 1,
      tickets_status INTEGER DEFAULT 0,
      games_status INTEGER DEFAULT 1,
      logging_status INTEGER DEFAULT 1,
      welcome_status INTEGER DEFAULT 0,
      leaving_status INTEGER DEFAULT 0,
      counting_status INTEGER DEFAULT 0,
      suggestions_status INTEGER DEFAULT 0,
      starboard_status INTEGER DEFAULT 0,
      economy_status INTEGER DEFAULT 0,
      giveaway_status INTEGER DEFAULT 1,
      verification_status INTEGER DEFAULT 0,
      welcome_channel TEXT,
      leaving_channel TEXT,
      modlog_channel TEXT,
      jail_log_channel TEXT,
      ticket_category TEXT,
      suggestion_channel TEXT,
      counting_channel TEXT,
      bot_commands_channel TEXT,
      dev_log_channel TEXT,
      bot_status_channel TEXT,
      bot_status_message_id TEXT,
      starboard_channel TEXT,
      admin_roles TEXT DEFAULT '[]',
      mod_roles TEXT DEFAULT '[]',
      jail_role TEXT,
      verified_role TEXT,
      autorole TEXT,
      unjail_give_role TEXT,
      mute_role TEXT,
      banned_words TEXT DEFAULT '[]',
      spam_detection INTEGER DEFAULT 1,
      caps_filter INTEGER DEFAULT 1,
      link_filter INTEGER DEFAULT 0,
      invite_filter INTEGER DEFAULT 1,
      link_whitelist TEXT DEFAULT '[]',
      automod_action TEXT DEFAULT 'warn',
      antiraid_threshold INTEGER DEFAULT 10,
      antiraid_timewindow INTEGER DEFAULT 10,
      xp_rate INTEGER DEFAULT 10,
      xp_cooldown INTEGER DEFAULT 60,
      voice_xp_rate INTEGER DEFAULT 5,
      level_rewards TEXT DEFAULT '[]',
      starboard_threshold INTEGER DEFAULT 3,
      bot_status_mode TEXT DEFAULT 'ONLINE',
      bot_status_message TEXT DEFAULT 'Bot is fully operational',
      jail_message TEXT DEFAULT 'Welcome! Please respond to this message and wait for a staff member.',
      command_cooldowns TEXT DEFAULT '{}',
      disabled_commands TEXT DEFAULT '[]',
      scheduled_messages TEXT DEFAULT '[]',
      custom_commands TEXT DEFAULT '[]',
      auto_responses TEXT DEFAULT '[]',
      media_only_channels TEXT DEFAULT '[]',
      locked_channels TEXT DEFAULT '[]',
      nickname_locks TEXT DEFAULT '{}',
      all_commands_locked_users TEXT DEFAULT '[]',
      admin_blocked_users TEXT DEFAULT '[]',
      afk_users TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      messages INTEGER DEFAULT 0,
      voice_minutes INTEGER DEFAULT 0,
      warnings INTEGER DEFAULT 0,
      economy_balance INTEGER DEFAULT 100,
      daily_streak INTEGER DEFAULT 0,
      last_daily INTEGER DEFAULT 0,
      last_xp INTEGER DEFAULT 0,
      country TEXT,
      timezone TEXT,
      achievements TEXT DEFAULT '[]',
      invite_count INTEGER DEFAULT 0,
      invited_by TEXT,
      UNIQUE(guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS mod_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT DEFAULT 'No reason provided',
      duration TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      claimed_by TEXT,
      panel_id TEXT,
      status TEXT DEFAULT 'open',
      transcript TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      closed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS ticket_panels (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      embed_title TEXT NOT NULL,
      embed_description TEXT NOT NULL,
      embed_color TEXT DEFAULT '#8000FF',
      buttons TEXT NOT NULL DEFAULT '[]',
      ping_roles TEXT DEFAULT '[]',
      ticket_category TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS jail_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      transcript TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      closed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      host_id TEXT NOT NULL,
      prize TEXT NOT NULL,
      winners INTEGER DEFAULT 1,
      ends_at INTEGER NOT NULL,
      ended INTEGER DEFAULT 0,
      winner_ids TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (giveaway_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT,
      message TEXT NOT NULL,
      remind_at INTEGER NOT NULL,
      sent INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS counting (
      guild_id TEXT PRIMARY KEY,
      current_count INTEGER DEFAULT 0,
      last_user_id TEXT,
      channel_id TEXT
    );

    CREATE TABLE IF NOT EXISTS reaction_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      role_id TEXT NOT NULL,
      type TEXT DEFAULT 'toggle'
    );

    CREATE TABLE IF NOT EXISTS invite_tracking (
      guild_id TEXT NOT NULL,
      invite_code TEXT NOT NULL,
      inviter_id TEXT NOT NULL,
      uses INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, invite_code)
    );

    CREATE TABLE IF NOT EXISTS command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      command TEXT NOT NULL,
      used_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT,
      action TEXT NOT NULL,
      extra TEXT,
      logged_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
  saveToDisk();
}

// ── Core query helpers ──────────────────────────────────────────────────────

function query(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  // Return lastInsertRowid equivalent
  const row = get('SELECT last_insert_rowid() as id');
  saveToDisk();
  return { lastInsertRowid: row ? row.id : null };
}

// ── Guild config ────────────────────────────────────────────────────────────

function getGuildConfig(guildId) {
  if (!db) throw new Error('DB not initialized');
  let config = get('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
  if (!config) {
    run('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)', [guildId]);
    config = get('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
  }
  const jsonFields = ['admin_roles','mod_roles','banned_words','link_whitelist','level_rewards',
    'command_cooldowns','disabled_commands','scheduled_messages','custom_commands',
    'auto_responses','media_only_channels','locked_channels','nickname_locks',
    'all_commands_locked_users','admin_blocked_users','afk_users'];
  for (const field of jsonFields) {
    if (config[field]) {
      try { config[field] = JSON.parse(config[field]); } catch(e) {}
    }
  }
  return config;
}

function updateGuildConfig(guildId, updates) {
  if (!db) throw new Error('DB not initialized');
  const stringified = {};
  for (const [key, val] of Object.entries(updates)) {
    stringified[key] = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
  }
  stringified.updated_at = Math.floor(Date.now() / 1000);
  const sets = Object.keys(stringified).map(k => `${k} = ?`).join(', ');
  run(`UPDATE guild_config SET ${sets} WHERE guild_id = ?`, [...Object.values(stringified), guildId]);
}

// ── Users ───────────────────────────────────────────────────────────────────

function getUser(guildId, userId) {
  let user = get('SELECT * FROM users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  if (!user) {
    run('INSERT OR IGNORE INTO users (id, guild_id, user_id) VALUES (?, ?, ?)', [`${guildId}_${userId}`, guildId, userId]);
    user = get('SELECT * FROM users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  }
  return user;
}

function updateUser(guildId, userId, updates) {
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  run(`UPDATE users SET ${sets} WHERE guild_id = ? AND user_id = ?`, [...Object.values(updates), guildId, userId]);
}

// ── Mod logs ────────────────────────────────────────────────────────────────

function addModLog(guildId, userId, moderatorId, action, reason = 'No reason provided', duration = null) {
  run('INSERT INTO mod_logs (guild_id, user_id, moderator_id, action, reason, duration) VALUES (?, ?, ?, ?, ?, ?)',
    [guildId, userId, moderatorId, action, reason, duration]);
}

function getModLogs(guildId, userId) {
  return query('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, userId]);
}

function getAllModLogs(guildId, limit = 100, offset = 0, filters = {}) {
  let sql = 'SELECT * FROM mod_logs WHERE guild_id = ?';
  const params = [guildId];
  if (filters.user_id) { sql += ' AND user_id = ?'; params.push(filters.user_id); }
  if (filters.action) { sql += ' AND action = ?'; params.push(filters.action); }
  if (filters.from) { sql += ' AND created_at >= ?'; params.push(filters.from); }
  if (filters.to) { sql += ' AND created_at <= ?'; params.push(filters.to); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return query(sql, params);
}

function getDB() { return db; }

module.exports = {
  initialize, saveToDisk, getGuildConfig, updateGuildConfig,
  getUser, updateUser, addModLog, getModLogs, getAllModLogs,
  getDB, query, run, get
};

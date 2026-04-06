const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./database');

const COLORS = {
  GREEN: 0x00FF00,
  RED: 0xFF0000,
  YELLOW: 0xFFFF00,
  BLUE: 0x0099FF,
  PURPLE: 0x8000FF,
};

function isAdmin(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminRoles = Array.isArray(config.admin_roles) ? config.admin_roles : JSON.parse(config.admin_roles || '[]');
  const modRoles = Array.isArray(config.mod_roles) ? config.mod_roles : JSON.parse(config.mod_roles || '[]');
  const allRoles = [...adminRoles, ...modRoles];
  return member.roles.cache.some(r => allRoles.includes(r.id));
}

function isOwner(userId) {
  return userId === process.env.OWNER_ID;
}

function isAllCommandsLocked(config, userId) {
  const locked = Array.isArray(config.all_commands_locked_users)
    ? config.all_commands_locked_users
    : JSON.parse(config.all_commands_locked_users || '[]');
  return locked.includes(userId);
}

function isAdminBlocked(config, userId) {
  const blocked = Array.isArray(config.admin_blocked_users)
    ? config.admin_blocked_users
    : JSON.parse(config.admin_blocked_users || '[]');
  return blocked.includes(userId);
}

function embed(color, title, description, fields = []) {
  const e = new EmbedBuilder()
    .setColor(color)
    .setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  for (const f of fields) e.addFields(f);
  return e;
}

function successEmbed(title, description, fields) {
  return embed(COLORS.GREEN, title, description, fields);
}

function errorEmbed(title, description) {
  return embed(COLORS.RED, title, description);
}

function infoEmbed(title, description, fields) {
  return embed(COLORS.BLUE, title, description, fields);
}

function warnEmbed(title, description) {
  return embed(COLORS.YELLOW, title, description);
}

function specialEmbed(title, description, fields) {
  return embed(COLORS.PURPLE, title, description, fields);
}

async function tempReply(message, embedOrContent, seconds = 5) {
  try {
    const msg = typeof embedOrContent === 'string'
      ? await message.channel.send({ content: embedOrContent })
      : await message.channel.send({ embeds: [embedOrContent] });
    setTimeout(() => msg.delete().catch(() => {}), seconds * 1000);
    return msg;
  } catch (e) {}
}

async function deleteCommand(message) {
  try { await message.delete(); } catch (e) {}
}

async function logToDevChannel(guild, config, content) {
  try {
    if (!config.dev_log_channel) return;
    const ch = guild.channels.cache.get(config.dev_log_channel);
    if (ch) await ch.send(content);
  } catch (e) {}
}

async function logModAction(guild, config, title, description, fields = []) {
  try {
    if (!config.modlog_channel) return;
    const ch = guild.channels.cache.get(config.modlog_channel);
    if (ch) {
      await ch.send({ embeds: [infoEmbed(title, description, fields)] });
    }
  } catch (e) {}
}

function parseTime(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const [, amt, unit] = match;
  const n = parseInt(amt);
  switch (unit.toLowerCase()) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 3600 * 1000;
    case 'd': return n * 86400 * 1000;
  }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function trackCommandUsage(guildId, userId, command) {
  try {
    db.run('INSERT INTO command_usage (guild_id, user_id, command) VALUES (?, ?, ?)', [guildId, userId, command]);
  } catch (e) {}
}

module.exports = {
  COLORS, isAdmin, isOwner, isAllCommandsLocked, isAdminBlocked,
  embed, successEmbed, errorEmbed, infoEmbed, warnEmbed, specialEmbed,
  tempReply, deleteCommand, logToDevChannel, logModAction,
  parseTime, formatDuration, trackCommandUsage
};

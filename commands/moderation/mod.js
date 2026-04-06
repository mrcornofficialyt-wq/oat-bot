const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');
const { successEmbed, errorEmbed, tempReply, parseTime, isAdmin } = require('../../utils/helpers');

// BAN
const ban = {
  name: 'ban',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user to ban.'));
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await target.send({ embeds: [errorEmbed('🔨 Banned', `You have been banned from **${message.guild.name}**.\nReason: ${reason}`)] }).catch(() => {});
      await target.ban({ reason });
      db.addModLog(message.guild.id, target.id, message.author.id, 'ban', reason);
      await tempReply(message, successEmbed('🔨 User Banned', `<@${target.id}> has been banned.\nReason: ${reason}`));
      require('../../utils/helpers').logModAction(message.guild, config, '🔨 User Banned', `**User:** <@${target.id}>\n**Reason:** ${reason}\n**Moderator:** <@${message.author.id}>`);
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', 'Could not ban this user.'));
    }
  }
};

// TEMPBAN
const tempban = {
  name: 'tempban',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    const duration = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    if (!target || !duration) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?tempban @user <duration> [reason]'));
    const ms = parseTime(duration);
    if (!ms) return tempReply(message, errorEmbed('❌ Error', 'Invalid duration. Use e.g. 1d, 2h, 30m'));
    try {
      await target.send({ embeds: [errorEmbed('🔨 Temp Banned', `You have been temporarily banned from **${message.guild.name}** for ${duration}.\nReason: ${reason}`)] }).catch(() => {});
      await target.ban({ reason });
      db.addModLog(message.guild.id, target.id, message.author.id, 'tempban', reason, duration);
      await tempReply(message, successEmbed('🔨 User Temp Banned', `<@${target.id}> banned for ${duration}.\nReason: ${reason}`));
      setTimeout(async () => {
        await message.guild.members.unban(target.id).catch(() => {});
      }, ms);
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', 'Could not temp ban this user.'));
    }
  }
};

// KICK
const kick = {
  name: 'kick',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user to kick.'));
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await target.send({ embeds: [errorEmbed('👢 Kicked', `You have been kicked from **${message.guild.name}**.\nReason: ${reason}`)] }).catch(() => {});
      await target.kick(reason);
      db.addModLog(message.guild.id, target.id, message.author.id, 'kick', reason);
      await tempReply(message, successEmbed('👢 User Kicked', `<@${target.id}> has been kicked.\nReason: ${reason}`));
      require('../../utils/helpers').logModAction(message.guild, config, '👢 User Kicked', `**User:** <@${target.id}>\n**Reason:** ${reason}\n**Moderator:** <@${message.author.id}>`);
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', 'Could not kick this user.'));
    }
  }
};

// VCMUTE
const vcmute = {
  name: 'vcmute',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await target.voice.setMute(true, reason);
      db.addModLog(message.guild.id, target.id, message.author.id, 'vcmute', reason);
      await tempReply(message, successEmbed('🔇 VC Muted', `<@${target.id}> has been voice muted.\nReason: ${reason}`));
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', 'Could not VC mute this user. Are they in a voice channel?'));
    }
  }
};

// TIMEOUT
const timeout = {
  name: 'timeout',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    const duration = args[1] || '10m';
    const reason = args.slice(2).join(' ') || 'No reason provided';
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
    const ms = parseTime(duration);
    if (!ms) return tempReply(message, errorEmbed('❌ Error', 'Invalid duration.'));
    try {
      await target.timeout(ms, reason);
      db.addModLog(message.guild.id, target.id, message.author.id, 'timeout', reason, duration);
      await tempReply(message, successEmbed('⏱ Timeout', `<@${target.id}> has been timed out for ${duration}.\nReason: ${reason}`));
      require('../../utils/helpers').logModAction(message.guild, config, '⏱ Timeout', `**User:** <@${target.id}>\n**Duration:** ${duration}\n**Reason:** ${reason}\n**Moderator:** <@${message.author.id}>`);
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', 'Could not timeout this user.'));
    }
  }
};

// WARN
const warn = {
  name: 'warn',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
    const reason = args.slice(1).join(' ') || 'No reason provided';
    db.addModLog(message.guild.id, target.id, message.author.id, 'warn', reason);
    const user = db.getUser(message.guild.id, target.id);
    db.updateUser(message.guild.id, target.id, { warnings: user.warnings + 1 });
    await target.send({ embeds: [require('../../utils/helpers').warnEmbed('⚠️ Warning', `You have been warned in **${message.guild.name}**.\nReason: ${reason}`)] }).catch(() => {});
    await tempReply(message, successEmbed('⚠️ Warning Issued', `<@${target.id}> has been warned.\nReason: ${reason}`));
    require('../../utils/helpers').logModAction(message.guild, config, '⚠️ Warning', `**User:** <@${target.id}>\n**Reason:** ${reason}\n**Moderator:** <@${message.author.id}>`);
  }
};

// MODLOG
const modlog = {
  name: 'modlog',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.users.first();
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
    const logs = db.getModLogs(message.guild.id, target.id);
    if (!logs.length) return tempReply(message, require('../../utils/helpers').infoEmbed(`📋 Mod Logs for ${target.tag}`, 'No moderation logs found for this user.'));
    const fields = logs.slice(0, 10).map((l, i) => ({
      name: `#${i + 1} — ${l.action.toUpperCase()}`,
      value: `**Reason:** ${l.reason}\n**By:** <@${l.moderator_id}>\n**Date:** <t:${l.created_at}:R>`,
    }));
    await tempReply(message, require('../../utils/helpers').infoEmbed(`📋 Mod Logs for ${target.tag}`, `Showing ${Math.min(10, logs.length)} of ${logs.length} logs.`, fields), 15);
  }
};

module.exports = { ban, tempban, kick, vcmute, timeout, warn, modlog };

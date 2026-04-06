const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (!message.guild || message.author?.bot) return;
    const config = db.getGuildConfig(message.guild.id);
    if (config.logging_status !== 1) return;
    if (!config.modlog_channel) return;

    // Try to find who deleted it via audit log
    let deletedBy = 'Unknown';
    try {
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target.id === message.author?.id && (Date.now() - entry.createdTimestamp) < 5000) {
        deletedBy = `<@${entry.executor.id}>`;
      }
    } catch (e) {}

    const ch = message.guild.channels.cache.get(config.modlog_channel);
    if (!ch) return;

    const e = new EmbedBuilder()
      .setColor(COLORS.RED)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author', value: message.author ? `<@${message.author.id}>` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Deleted By', value: deletedBy, inline: true },
        { name: 'Content', value: message.content?.substring(0, 1024) || 'No content' }
      )
      .setTimestamp();
    await ch.send({ embeds: [e] }).catch(() => {});

    // Save to DB
    db.run('INSERT INTO message_logs (guild_id, channel_id, user_id, content, action) VALUES (?, ?, ?, ?, ?)',
      [message.guild.id, message.channel.id, message.author?.id || 'unknown', message.content || '', 'deleted']);
  }
};

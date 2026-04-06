const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const config = db.getGuildConfig(newMessage.guild.id);
    if (config.logging_status !== 1 || !config.modlog_channel) return;

    const ch = newMessage.guild.channels.cache.get(config.modlog_channel);
    if (!ch) return;

    const e = new EmbedBuilder()
      .setColor(COLORS.BLUE)
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: 'Author', value: `<@${newMessage.author.id}>`, inline: true },
        { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'Before', value: oldMessage.content?.substring(0, 512) || 'Unknown' },
        { name: 'After', value: newMessage.content?.substring(0, 512) || 'Unknown' }
      )
      .setTimestamp();
    await ch.send({ embeds: [e] }).catch(() => {});

    db.run('INSERT INTO message_logs (guild_id, channel_id, user_id, content, action, extra) VALUES (?, ?, ?, ?, ?, ?)',
      [newMessage.guild.id, newMessage.channel.id, newMessage.author.id, newMessage.content, 'edited', oldMessage.content]);
  }
};

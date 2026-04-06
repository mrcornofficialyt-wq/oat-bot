const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

let startTime = Date.now();

async function initBotStatusChannels(client) {
  startTime = Date.now();
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const config = db.getGuildConfig(guildId);
      if (config.bot_status_channel) {
        await updateStatusEmbed(guild, config, client);
      }
    } catch (e) {}
  }
  // Update every 5 minutes
  setInterval(async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const config = db.getGuildConfig(guildId);
        if (config.bot_status_channel) await updateStatusEmbed(guild, config, client);
      } catch (e) {}
    }
  }, 5 * 60 * 1000);
}

async function updateStatusEmbed(guild, config, client) {
  try {
    const ch = guild.channels.cache.get(config.bot_status_channel);
    if (!ch) return;

    const uptime = Date.now() - startTime;
    const hours = Math.floor(uptime / 3600000);
    const mins = Math.floor((uptime % 3600000) / 60000);
    const secs = Math.floor((uptime % 60000) / 1000);
    const uptimeStr = `${hours}h ${mins}m ${secs}s`;

    const mode = config.bot_status_mode || 'ONLINE';
    const statusColors = { ONLINE: COLORS.GREEN, MAINTENANCE: COLORS.YELLOW, DEVELOPMENT: COLORS.YELLOW, OFFLINE: COLORS.RED };
    const statusEmoji = { ONLINE: '🟢', MAINTENANCE: '🟡', DEVELOPMENT: '🟡', OFFLINE: '🔴' };

    const systemStatus = (val) => val === 1 ? '🟢' : val === 2 ? '🟡' : '🔴';

    const e = new EmbedBuilder()
      .setColor(statusColors[mode] || COLORS.GREEN)
      .setTitle('🤖 Bot Status')
      .setDescription(config.bot_status_message || 'Bot is fully operational.')
      .addFields(
        { name: 'Status', value: `${statusEmoji[mode]} **${mode}**`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Uptime', value: uptimeStr, inline: true },
        { name: '─── Systems ───', value: '\u200b', inline: false },
        { name: 'AutoMod', value: systemStatus(config.automod_status), inline: true },
        { name: 'Tickets', value: systemStatus(config.tickets_status), inline: true },
        { name: 'Games', value: systemStatus(config.games_status), inline: true },
        { name: 'Jail', value: systemStatus(config.jail_status), inline: true },
        { name: 'Leveling', value: systemStatus(config.leveling_status), inline: true },
        { name: 'Anti-Raid', value: systemStatus(config.antiraid_status), inline: true },
        { name: 'Logging', value: systemStatus(config.logging_status), inline: true },
        { name: 'Welcome', value: systemStatus(config.welcome_status), inline: true },
        { name: 'Economy', value: systemStatus(config.economy_status), inline: true },
      )
      .setFooter({ text: 'Last Updated' })
      .setTimestamp();

    if (config.bot_status_message_id) {
      try {
        const msg = await ch.messages.fetch(config.bot_status_message_id);
        await msg.edit({ embeds: [e] });
        return;
      } catch (err) {}
    }

    // Send new message
    const msg = await ch.send({ embeds: [e] });
    db.updateGuildConfig(guild.id, { bot_status_message_id: msg.id });
  } catch (e) {
    console.error('Status embed error:', e);
  }
}

function getStartTime() { return startTime; }

module.exports = { initBotStatusChannels, updateStatusEmbed, getStartTime };

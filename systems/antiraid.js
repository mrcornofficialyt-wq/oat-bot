const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

async function triggerAntiRaid(guild, config, client) {
  try {
    const modCh = config.modlog_channel ? guild.channels.cache.get(config.modlog_channel) : null;
    if (modCh) {
      await modCh.send({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.RED)
          .setTitle('🚨 RAID DETECTED')
          .setDescription(`Mass join detected! Locking all channels and muting new users.`)
          .setTimestamp()]
      });
    }

    // Lock all text channels
    for (const [, channel] of guild.channels.cache) {
      if (channel.type === 0) {
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => {});
      }
    }

    // Store raid state
    if (!client.raidMode) client.raidMode = {};
    client.raidMode[guild.id] = true;

    // Auto-unlock after 5 minutes
    setTimeout(async () => {
      if (client.raidMode?.[guild.id]) {
        for (const [, channel] of guild.channels.cache) {
          if (channel.type === 0) {
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: null }).catch(() => {});
          }
        }
        client.raidMode[guild.id] = false;
        if (modCh) await modCh.send({ embeds: [new EmbedBuilder().setColor(COLORS.GREEN).setTitle('✅ Raid Mode Lifted').setDescription('Channels have been unlocked.').setTimestamp()] });
      }
    }, 5 * 60 * 1000);

  } catch (e) {
    console.error('Anti-raid error:', e);
  }
}

module.exports = { triggerAntiRaid };

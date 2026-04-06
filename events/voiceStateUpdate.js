const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    if (!newState.guild) return;
    const config = db.getGuildConfig(newState.guild.id);

    // Voice XP tracking
    if (config.leveling_status === 1) {
      if (!client.voiceJoinTimes) client.voiceJoinTimes = {};
      const key = `${newState.guild.id}_${newState.id}`;
      if (!oldState.channelId && newState.channelId) {
        client.voiceJoinTimes[key] = Date.now();
      } else if (oldState.channelId && !newState.channelId) {
        const joinTime = client.voiceJoinTimes[key];
        if (joinTime) {
          const minutes = Math.floor((Date.now() - joinTime) / 60000);
          if (minutes > 0) {
            const user = db.getUser(newState.guild.id, newState.id);
            const xpGain = minutes * (config.voice_xp_rate || 5);
            db.updateUser(newState.guild.id, newState.id, {
              voice_minutes: user.voice_minutes + minutes,
              xp: user.xp + xpGain
            });
          }
          delete client.voiceJoinTimes[key];
        }
      }
    }

    // Voice logging
    if (config.logging_status !== 1 || !config.modlog_channel) return;
    const ch = newState.guild.channels.cache.get(config.modlog_channel);
    if (!ch) return;

    let action = null;
    if (!oldState.channelId && newState.channelId) action = `Joined <#${newState.channelId}>`;
    else if (oldState.channelId && !newState.channelId) action = `Left <#${oldState.channelId}>`;
    else if (oldState.channelId !== newState.channelId) action = `Moved from <#${oldState.channelId}> to <#${newState.channelId}>`;
    else if (!oldState.mute && newState.mute) action = 'Server Muted';
    else if (oldState.mute && !newState.mute) action = 'Server Unmuted';

    if (!action) return;

    const e = new EmbedBuilder()
      .setColor(COLORS.BLUE)
      .setTitle('🔊 Voice Activity')
      .addFields(
        { name: 'User', value: `<@${newState.id}>`, inline: true },
        { name: 'Action', value: action, inline: true }
      )
      .setTimestamp();
    await ch.send({ embeds: [e] }).catch(() => {});
  }
};

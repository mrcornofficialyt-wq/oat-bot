const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const config = db.getGuildConfig(member.guild.id);

    // Leaving message
    if (config.leaving_status === 1 && config.leaving_channel) {
      const ch = member.guild.channels.cache.get(config.leaving_channel);
      if (ch) {
        const e = new EmbedBuilder()
          .setColor(COLORS.RED)
          .setTitle('👋 Goodbye!')
          .setDescription(`**${member.user.tag}** has left the server.`)
          .addFields({ name: 'Member Count', value: `${member.guild.memberCount}`, inline: true })
          .setTimestamp();
        await ch.send({ embeds: [e] }).catch(() => {});
      }
    }

    // Cleanup jail if user leaves mid-jail
    const session = db.get('SELECT * FROM jail_sessions WHERE guild_id = ? AND user_id = ? AND status != ?',
      [member.guild.id, member.id, 'closed']);
    if (session) {
      // Clean up channel and role
      try {
        const jailChannel = member.guild.channels.cache.get(session.channel_id);
        if (jailChannel) await jailChannel.delete().catch(() => {});
        const jailRole = member.guild.roles.cache.get(session.role_id);
        if (jailRole) await jailRole.delete().catch(() => {});
      } catch (e) {}
      db.run('UPDATE jail_sessions SET status = ? WHERE id = ?', ['closed', session.id]);
      if (client.jailIntervals?.[session.channel_id]) {
        clearInterval(client.jailIntervals[session.channel_id]);
      }
    }
  }
};

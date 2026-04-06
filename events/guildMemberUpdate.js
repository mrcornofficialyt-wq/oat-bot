const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const config = db.getGuildConfig(newMember.guild.id);

    // Nickname lock
    const nickLocks = typeof config.nickname_locks === 'object' ? config.nickname_locks : JSON.parse(config.nickname_locks || '{}');
    if (nickLocks[newMember.id] && newMember.nickname !== nickLocks[newMember.id]) {
      await newMember.setNickname(nickLocks[newMember.id]).catch(() => {});
    }

    // Admin blocked users - remove admin roles if given
    const adminBlocked = Array.isArray(config.admin_blocked_users) ? config.admin_blocked_users : JSON.parse(config.admin_blocked_users || '[]');
    const adminRoles = Array.isArray(config.admin_roles) ? config.admin_roles : JSON.parse(config.admin_roles || '[]');
    if (adminBlocked.includes(newMember.id)) {
      const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      const adminRolesAdded = addedRoles.filter(r => adminRoles.includes(r.id));
      if (adminRolesAdded.size > 0) {
        await newMember.roles.remove(adminRolesAdded).catch(() => {});
      }
    }

    // Role logging
    if (config.logging_status !== 1 || !config.modlog_channel) return;
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (!addedRoles.size && !removedRoles.size) return;

    const ch = newMember.guild.channels.cache.get(config.modlog_channel);
    if (!ch) return;

    const e = new EmbedBuilder().setColor(COLORS.BLUE).setTitle('🎭 Role Update').setTimestamp();
    e.addFields({ name: 'User', value: `<@${newMember.id}>`, inline: true });
    if (addedRoles.size) e.addFields({ name: 'Added', value: addedRoles.map(r => r.name).join(', '), inline: true });
    if (removedRoles.size) e.addFields({ name: 'Removed', value: removedRoles.map(r => r.name).join(', '), inline: true });
    await ch.send({ embeds: [e] }).catch(() => {});
  }
};

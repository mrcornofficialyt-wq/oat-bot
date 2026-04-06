const db = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed, tempReply } = require('../../utils/helpers');

// ADMINBLOCK
const adminblock = {
  name: 'adminblock',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'list') {
      const blocked = Array.isArray(config.admin_blocked_users) ? config.admin_blocked_users : JSON.parse(config.admin_blocked_users || '[]');
      if (!blocked.length) return tempReply(message, infoEmbed('Admin Block List', 'No users are admin blocked.'));
      return tempReply(message, infoEmbed('Admin Block List', blocked.map(id => `<@${id}>`).join('\n')));
    }
    const target = message.mentions.members.first();
    if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
    const blocked = Array.isArray(config.admin_blocked_users) ? config.admin_blocked_users : JSON.parse(config.admin_blocked_users || '[]');
    const adminRoles = Array.isArray(config.admin_roles) ? config.admin_roles : JSON.parse(config.admin_roles || '[]');

    if (!blocked.includes(target.id)) {
      blocked.push(target.id);
      // Remove any admin roles from user
      for (const roleId of adminRoles) {
        const role = message.guild.roles.cache.get(roleId);
        if (role && target.roles.cache.has(roleId)) {
          await target.roles.remove(role).catch(() => {});
        }
      }
    }
    db.updateGuildConfig(message.guild.id, { admin_blocked_users: blocked });
    await tempReply(message, successEmbed('🚫 Admin Blocked', `<@${target.id}> has been admin blocked. All admin roles removed and they cannot receive admin roles.`));
  }
};

// NICKNAME LOCK
const nickname = {
  name: 'nickname',
  adminOnly: true,
  async execute(message, args, client, config) {
    const sub = args[0]?.toLowerCase();
    const nickLocks = typeof config.nickname_locks === 'object' ? config.nickname_locks : JSON.parse(config.nickname_locks || '{}');

    if (sub === 'lock') {
      if (args[1] === 'all') {
        for (const [, member] of message.guild.members.cache) {
          if (!member.user.bot) nickLocks[member.id] = member.displayName;
        }
        db.updateGuildConfig(message.guild.id, { nickname_locks: nickLocks });
        return tempReply(message, successEmbed('🔒 Nicknames Locked', 'All nicknames have been locked to their current values.'));
      }
      if (args[1] === 'new') {
        const target = message.mentions.members.first();
        if (!target) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?nickname lock new [name] @user'));
        const newName = args.slice(2, args.indexOf(args.find(a => a.startsWith('<@'))))?.join(' ');
        if (!newName) return tempReply(message, errorEmbed('❌ Error', 'Please provide a new name.'));
        await target.setNickname(newName).catch(() => {});
        nickLocks[target.id] = newName;
        db.updateGuildConfig(message.guild.id, { nickname_locks: nickLocks });
        return tempReply(message, successEmbed('🔒 Nickname Locked', `<@${target.id}>'s nickname has been set and locked to **${newName}**.`));
      }
      // Lock current nickname
      const target = message.mentions.members.first();
      if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
      nickLocks[target.id] = target.displayName;
      db.updateGuildConfig(message.guild.id, { nickname_locks: nickLocks });
      return tempReply(message, successEmbed('🔒 Nickname Locked', `<@${target.id}>'s nickname is locked to **${target.displayName}**.`));
    }

    if (sub === 'unlock') {
      if (args[1] === 'all') {
        db.updateGuildConfig(message.guild.id, { nickname_locks: {} });
        return tempReply(message, successEmbed('🔓 Nicknames Unlocked', 'All nickname locks have been removed.'));
      }
      const target = message.mentions.members.first();
      if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
      delete nickLocks[target.id];
      db.updateGuildConfig(message.guild.id, { nickname_locks: nickLocks });
      return tempReply(message, successEmbed('🔓 Nickname Unlocked', `<@${target.id}>'s nickname is now unlocked.`));
    }

    if (sub === 'change') {
      const type = args[1]; // 'bot' or 'human'
      const newName = args.slice(2).join(' ');
      if (!newName) return tempReply(message, errorEmbed('❌ Error', 'Please provide a name.'));
      for (const [, member] of message.guild.members.cache) {
        if (type === 'bot' && member.user.bot) await member.setNickname(newName).catch(() => {});
        if (type === 'human' && !member.user.bot) await member.setNickname(newName).catch(() => {});
      }
      return tempReply(message, successEmbed('✏️ Nicknames Changed', `All ${type} nicknames have been changed to **${newName}**.`));
    }

    tempReply(message, errorEmbed('❌ Error', 'Usage: ?nickname lock/@user | ?nickname unlock/@user | ?nickname lock all | ?nickname unlock all | ?nickname lock new [name] @user | ?nickname change [bot/human] [name]'));
  }
};

// ALLCOMMANDS LOCK
const allcommands = {
  name: 'allcommands',
  adminOnly: true,
  async execute(message, args, client, config) {
    const sub = args[0]?.toLowerCase();
    const locked = Array.isArray(config.all_commands_locked_users) ? config.all_commands_locked_users : JSON.parse(config.all_commands_locked_users || '[]');

    if (sub === 'lock') {
      const target = message.mentions.members.first();
      if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
      if (!locked.includes(target.id)) locked.push(target.id);
      db.updateGuildConfig(message.guild.id, { all_commands_locked_users: locked });
      return tempReply(message, successEmbed('🔒 Commands Locked', `<@${target.id}> can no longer use any bot commands.`));
    }
    if (sub === 'unlock') {
      const target = message.mentions.members.first();
      if (!target) return tempReply(message, errorEmbed('❌ Error', 'Please mention a user.'));
      const idx = locked.indexOf(target.id);
      if (idx > -1) locked.splice(idx, 1);
      db.updateGuildConfig(message.guild.id, { all_commands_locked_users: locked });
      return tempReply(message, successEmbed('🔓 Commands Unlocked', `<@${target.id}> can now use bot commands.`));
    }
    if (sub === 'locked' && args[1] === 'list') {
      if (!locked.length) return tempReply(message, infoEmbed('Locked Users', 'No users are command locked.'));
      return tempReply(message, infoEmbed('Command Locked Users', locked.map(id => `<@${id}>`).join('\n')));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?allcommands lock @user | ?allcommands unlock @user | ?allcommands locked list'));
  }
};

module.exports = { adminblock, nickname, allcommands };

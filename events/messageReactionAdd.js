const db = require('../utils/database');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    const guild = reaction.message.guild;
    if (!guild) return;

    const rr = db.get('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?',
      [guild.id, reaction.message.id, reaction.emoji.name || reaction.emoji.id]);
    if (!rr) return;

    const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
    const role = guild.roles.cache.get(rr.role_id);
    if (member && role) await member.roles.add(role).catch(() => {});
  }
};

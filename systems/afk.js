const db = require('../utils/database');

async function checkMentions(message, config) {
  const afkUsers = typeof config.afk_users === 'object' ? config.afk_users : JSON.parse(config.afk_users || '{}');
  for (const mentioned of message.mentions.users.values()) {
    if (afkUsers[mentioned.id]) {
      await message.channel.send(`💤 **${mentioned.username}** is AFK: ${afkUsers[mentioned.id]}`).catch(() => {});
    }
  }
}

async function clearAfk(message, config) {
  const afkUsers = typeof config.afk_users === 'object' ? config.afk_users : JSON.parse(config.afk_users || '{}');
  if (afkUsers[message.author.id]) {
    delete afkUsers[message.author.id];
    db.updateGuildConfig(message.guild.id, { afk_users: afkUsers });
    const reply = await message.channel.send(`✅ Welcome back <@${message.author.id}>! Your AFK has been removed.`).catch(() => null);
    if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
  }
}

module.exports = { checkMentions, clearAfk };

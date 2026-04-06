const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

async function addXP(message, config, client) {
  const userId = message.author.id;
  const guildId = message.guild.id;
  const user = db.getUser(guildId, userId);

  // Cooldown
  const cooldown = (config.xp_cooldown || 60) * 1000;
  if (Date.now() - user.last_xp < cooldown) return;

  const xpGain = config.xp_rate || 10;
  const newXp = user.xp + xpGain;
  const newMessages = user.messages + 1;
  let newLevel = user.level;

  // Check level up
  let leveled = false;
  while (newXp >= xpForLevel(newLevel)) {
    newLevel++;
    leveled = true;
  }

  db.updateUser(guildId, userId, {
    xp: newXp,
    level: newLevel,
    messages: newMessages,
    last_xp: Date.now()
  });

  if (leveled) {
    // Level up announcement
    const e = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🎉 Level Up!')
      .setDescription(`<@${userId}> has reached **Level ${newLevel}**!`)
      .setTimestamp();
    await message.channel.send({ embeds: [e] });

    // Check role rewards
    const rewards = Array.isArray(config.level_rewards) ? config.level_rewards : JSON.parse(config.level_rewards || '[]');
    for (const reward of rewards) {
      if (reward.level <= newLevel) {
        const role = message.guild.roles.cache.get(reward.role_id);
        if (role && !message.member.roles.cache.has(role.id)) {
          await message.member.roles.add(role).catch(() => {});
        }
      }
    }
  }
}

async function getRankCard(member, user) {
  const level = user.level;
  const xp = user.xp;
  const needed = xpForLevel(level);
  const progress = Math.min(100, Math.floor((xp / needed) * 100));
  
  return new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setTitle(`📊 ${member.displayName}'s Rank Card`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Level', value: `${level}`, inline: true },
      { name: 'XP', value: `${xp} / ${needed}`, inline: true },
      { name: 'Progress', value: `${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))} ${progress}%`, inline: false },
      { name: 'Messages', value: `${user.messages}`, inline: true },
      { name: 'Voice Minutes', value: `${user.voice_minutes}`, inline: true },
    )
    .setTimestamp();
}

module.exports = { addXP, getRankCard, xpForLevel };

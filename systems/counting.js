const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/helpers');

async function process(message, config) {
  const record = db.get('SELECT * FROM counting WHERE guild_id = ?', [message.guild.id]);
  const current = record?.current_count || 0;
  const expected = current + 1;
  const num = parseInt(message.content.trim());

  if (isNaN(num) || num !== expected) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.RED)
        .setTitle('❌ Incorrect Number')
        .setDescription(`That is not the correct number! The next number is **${expected}**.`)]
    });
    return;
  }

  // Correct number - upsert
  const existing = db.get('SELECT guild_id FROM counting WHERE guild_id = ?', [message.guild.id]);
  if (existing) {
    db.run('UPDATE counting SET current_count = ?, last_user_id = ? WHERE guild_id = ?',
      [expected, message.author.id, message.guild.id]);
  } else {
    db.run('INSERT INTO counting (guild_id, current_count, last_user_id, channel_id) VALUES (?, ?, ?, ?)',
      [message.guild.id, expected, message.author.id, message.channel.id]);
  }

  await message.react('✅').catch(() => {});
}

async function setup(guild, config) {
  let ch = config.counting_channel ? guild.channels.cache.get(config.counting_channel) : null;
  if (!ch) {
    ch = await guild.channels.create({ name: 'counting', type: 0 });
    db.updateGuildConfig(guild.id, { counting_channel: ch.id });
  }

  const e = new EmbedBuilder()
    .setColor(COLORS.BLUE)
    .setTitle('🔢 Counting Channel')
    .setDescription('Start counting from **1**! Each person must count one number at a time.\n\n❌ Wrong numbers will be deleted.\n✅ Correct numbers will be confirmed.')
    .setTimestamp();
  await ch.send({ embeds: [e] });

  const existing = db.get('SELECT guild_id FROM counting WHERE guild_id = ?', [guild.id]);
  if (existing) {
    db.run('UPDATE counting SET current_count = 0, channel_id = ? WHERE guild_id = ?', [ch.id, guild.id]);
  } else {
    db.run('INSERT INTO counting (guild_id, current_count, channel_id) VALUES (?, 0, ?)', [guild.id, ch.id]);
  }
  return ch;
}

module.exports = { process, setup };

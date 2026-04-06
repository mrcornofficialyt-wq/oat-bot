const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { COLORS } = require('./helpers');

async function endGiveaway(gId, guild, client, reroll = false) {
  try {
    const giveaway = db.get('SELECT * FROM giveaways WHERE id = ?', [gId]);
    if (!giveaway) return;

    const entries = db.query('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?', [gId]);
    if (!entries.length) {
      const ch = guild.channels.cache.get(giveaway.channel_id);
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(COLORS.RED).setTitle('🎉 Giveaway Ended').setDescription('No entries — no winners.').setTimestamp()] });
      db.run('UPDATE giveaways SET ended = 1 WHERE id = ?', [gId]);
      return;
    }

    const shuffled = entries.sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, giveaway.winners).map(e => e.user_id);
    db.run('UPDATE giveaways SET ended = 1, winner_ids = ? WHERE id = ?', [JSON.stringify(winners), gId]);

    const ch = guild.channels.cache.get(giveaway.channel_id);
    if (ch) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      await ch.send({
        content: winnerMentions,
        embeds: [new EmbedBuilder()
          .setColor(COLORS.GREEN)
          .setTitle(reroll ? '🎉 Giveaway Rerolled!' : '🎉 Giveaway Ended!')
          .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winnerMentions}`)
          .setTimestamp()]
      });

      // Edit original message if possible
      if (giveaway.message_id) {
        const msg = await ch.messages.fetch(giveaway.message_id).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [new EmbedBuilder()
              .setColor(COLORS.RED)
              .setTitle('🎉 GIVEAWAY ENDED')
              .setDescription(`**${giveaway.prize}**`)
              .addFields({ name: 'Winners', value: winnerMentions })
              .setTimestamp()],
            components: []
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error('Giveaway end error:', e);
  }
}

module.exports = { endGiveaway };

const cron = require('node-cron');
const db = require('./database');
const { EmbedBuilder } = require('discord.js');

function startSchedulers(client) {
  // Check scheduled messages every minute
  cron.schedule('* * * * *', async () => {
    try {
      const guilds = db.query('SELECT guild_id, scheduled_messages FROM guild_config WHERE scheduled_messages != ?', ['[]']);
      for (const row of guilds) {
        const msgs = JSON.parse(row.scheduled_messages || '[]');
        let updated = false;
        for (const sm of msgs) {
          if (!sm.interval || !sm.channel_id) continue;
          const now = Date.now();
          if (now - sm.last_sent >= sm.interval) {
            try {
              const guild = client.guilds.cache.get(row.guild_id);
              const ch = guild?.channels.cache.get(sm.channel_id);
              if (ch) {
                await ch.send(sm.message);
                sm.last_sent = now;
                updated = true;
              }
            } catch (e) {}
          }
        }
        if (updated) db.updateGuildConfig(row.guild_id, { scheduled_messages: msgs });
      }
    } catch (e) {}
  });

  // Check reminders every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const reminders = db.query('SELECT * FROM reminders WHERE remind_at <= ? AND sent = 0', [now]);
      for (const r of reminders) {
        try {
          const user = await client.users.fetch(r.user_id).catch(() => null);
          if (user) {
            await user.send({ embeds: [new EmbedBuilder().setColor(0x0099FF).setTitle('⏰ Reminder!').setDescription(r.message).setTimestamp()] });
          }
          db.run('UPDATE reminders SET sent = 1 WHERE id = ?', [r.id]);
        } catch (e) {}
      }
    } catch (e) {}
  });

  // Auto-db backup every 6 hours
  cron.schedule('0 */6 * * *', () => {
    try {
      const fs = require('fs-extra');
      const src = './data/bot.db';
      const dest = `./data/backup_auto_${Date.now()}.db`;
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      // Keep only last 5 backups
      const backups = fs.readdirSync('./data').filter(f => f.startsWith('backup_auto_')).sort();
      while (backups.length > 5) {
        fs.unlinkSync(`./data/${backups.shift()}`);
      }
    } catch (e) {}
  });

  console.log('✅ Schedulers started');
}

module.exports = { startSchedulers };

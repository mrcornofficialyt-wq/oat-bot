const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed, specialEmbed, tempReply, parseTime, COLORS } = require('../../utils/helpers');
const leveling = require('../../systems/leveling');

// USERSTATS
const userstats = {
  name: 'userstats',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first() || message.member;
    const user = db.getUser(message.guild.id, target.id);
    const logs = db.getModLogs(message.guild.id, target.id);
    await message.channel.send({ embeds: [infoEmbed(`📊 Stats for ${target.displayName}`, null, [
      { name: 'Level', value: `${user.level}`, inline: true },
      { name: 'XP', value: `${user.xp}`, inline: true },
      { name: 'Messages', value: `${user.messages}`, inline: true },
      { name: 'Voice (min)', value: `${user.voice_minutes}`, inline: true },
      { name: 'Warnings', value: `${user.warnings}`, inline: true },
      { name: 'Balance', value: `💰 ${user.economy_balance}`, inline: true },
      { name: 'Invites', value: `${user.invite_count}`, inline: true },
      { name: 'Mod Actions', value: `${logs.length}`, inline: true },
    ])] });
  }
};

// SERVERSTATS
const serverstats = {
  name: 'serverstats',
  adminOnly: true,
  async execute(message, args, client, config) {
    const guild = message.guild;
    await guild.members.fetch();
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.memberCount - bots;
    const totalMessages = db.get('SELECT SUM(messages) as t FROM users WHERE guild_id = ?', [guild.id]);
    const openTickets = db.get('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = ?', [guild.id, 'open']);
    await message.channel.send({ embeds: [infoEmbed(`📊 Server Stats — ${guild.name}`, null, [
      { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
      { name: 'Humans', value: `${humans}`, inline: true },
      { name: 'Bots', value: `${bots}`, inline: true },
      { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
      { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Open Tickets', value: `${openTickets?.c || 0}`, inline: true },
      { name: 'Total Messages', value: `${totalMessages?.t || 0}`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
    ])] });
  }
};

// MESSAGESTATS
const messagestats = {
  name: 'messagestats',
  adminOnly: true,
  async execute(message, args, client, config) {
    const top = db.query('SELECT user_id, messages FROM users WHERE guild_id = ? ORDER BY messages DESC LIMIT 10', [message.guild.id]);
    const fields = top.map((u, i) => ({ name: `#${i + 1}`, value: `<@${u.user_id}> — ${u.messages} messages`, inline: false }));
    await message.channel.send({ embeds: [infoEmbed('💬 Message Stats', 'Top 10 most active members:', fields)] });
  }
};

// VSSTATS (voice stats)
const vsstats = {
  name: 'vsstats',
  adminOnly: true,
  async execute(message, args, client, config) {
    const top = db.query('SELECT user_id, voice_minutes FROM users WHERE guild_id = ? ORDER BY voice_minutes DESC LIMIT 10', [message.guild.id]);
    const fields = top.map((u, i) => ({ name: `#${i + 1}`, value: `<@${u.user_id}> — ${u.voice_minutes} minutes`, inline: false }));
    await message.channel.send({ embeds: [infoEmbed('🔊 Voice Stats', 'Top 10 voice members:', fields)] });
  }
};

// RANK
const rank = {
  name: 'rank',
  cooldown: 5,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first() || message.member;
    const user = db.getUser(message.guild.id, target.id);
    const card = await leveling.getRankCard(target, user);
    await message.channel.send({ embeds: [card] });
  }
};

// LEADERBOARD
const leaderboard = {
  name: 'leaderboard',
  cooldown: 10,
  async execute(message, args, client, config) {
    const top = db.query('SELECT user_id, level, xp FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT 10', [message.guild.id]);
    const fields = top.map((u, i) => ({ name: `#${i + 1}`, value: `<@${u.user_id}> — Level ${u.level} (${u.xp} XP)`, inline: false }));
    await message.channel.send({ embeds: [specialEmbed('🏆 Leaderboard', 'Top 10 members by XP:', fields)] });
  }
};

// GIVEAWAY
const giveaway = {
  name: 'giveaway',
  adminOnly: false,
  async execute(message, args, client, config) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'start') {
      const duration = args[1];
      const winners = parseInt(args[2]) || 1;
      const prize = args.slice(3).join(' ');
      if (!duration || !prize) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?giveaway start <duration> <winners> <prize>'));
      const ms = parseTime(duration);
      if (!ms) return tempReply(message, errorEmbed('❌ Error', 'Invalid duration.'));
      const endsAt = Math.floor((Date.now() + ms) / 1000);
      const result = db.run('INSERT INTO giveaways (guild_id, channel_id, host_id, prize, winners, ends_at) VALUES (?, ?, ?, ?, ?, ?)',
        [message.guild.id, message.channel.id, message.author.id, prize, winners, endsAt]);
      const gId = result.lastInsertRowid;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_enter_${gId}`).setLabel('🎉 Enter').setStyle(ButtonStyle.Primary)
      );
      const e = new EmbedBuilder()
        .setColor(COLORS.PURPLE)
        .setTitle('🎉 GIVEAWAY!')
        .setDescription(`**${prize}**`)
        .addFields(
          { name: 'Hosted by', value: `<@${message.author.id}>`, inline: true },
          { name: 'Winners', value: `${winners}`, inline: true },
          { name: 'Ends', value: `<t:${endsAt}:R>`, inline: true }
        )
        .setTimestamp();
      const msg = await message.channel.send({ embeds: [e], components: [row] });
      db.run('UPDATE giveaways SET message_id = ? WHERE id = ?', [msg.id, gId]);

      // Auto-end
      setTimeout(async () => {
        const { endGiveaway } = require('../../utils/giveaway');
        await endGiveaway(gId, message.guild, client);
      }, ms);
      return;
    }

    if (sub === 'reroll') {
      const gId = args[1];
      if (!gId) return tempReply(message, errorEmbed('❌ Error', 'Please provide a giveaway ID or message ID.'));
      const { endGiveaway } = require('../../utils/giveaway');
      await endGiveaway(gId, message.guild, client, true);
      return;
    }
  }
};

// REMINDME
const remindme = {
  name: 'remindme',
  cooldown: 5,
  async execute(message, args, client, config) {
    const duration = args[0];
    const reminder = args.slice(1).join(' ');
    if (!duration || !reminder) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?remindme <time> <reminder>'));
    const ms = parseTime(duration);
    if (!ms) return tempReply(message, errorEmbed('❌ Error', 'Invalid duration. Use e.g. 10m, 2h, 1d'));
    const remindAt = Math.floor((Date.now() + ms) / 1000);
    db.run('INSERT INTO reminders (user_id, guild_id, message, remind_at) VALUES (?, ?, ?, ?)',
      [message.author.id, message.guild.id, reminder, remindAt]);
    await tempReply(message, successEmbed('⏰ Reminder Set', `I'll remind you about: **${reminder}** in ${duration}.`));
    setTimeout(async () => {
      try {
        await message.author.send({ embeds: [infoEmbed('⏰ Reminder!', reminder)] });
      } catch (e) {}
    }, ms);
  }
};

// AFK
const afk = {
  name: 'afk',
  cooldown: 5,
  async execute(message, args, client, config) {
    const reason = args.join(' ') || 'AFK';
    const afkUsers = typeof config.afk_users === 'object' ? config.afk_users : JSON.parse(config.afk_users || '{}');
    afkUsers[message.author.id] = reason;
    db.updateGuildConfig(message.guild.id, { afk_users: afkUsers });
    const reply = await message.channel.send({ embeds: [successEmbed('💤 AFK', `<@${message.author.id}> is now AFK: ${reason}`)] });
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  }
};

// SUGGEST
const suggest = {
  name: 'suggest',
  cooldown: 30,
  async execute(message, args, client, config) {
    const text = args.join(' ');
    if (!text) return tempReply(message, errorEmbed('❌ Error', 'Please provide a suggestion.'));
    if (!config.suggestion_channel) return tempReply(message, errorEmbed('❌ Error', 'No suggestion channel set.'));
    const ch = message.guild.channels.cache.get(config.suggestion_channel);
    if (!ch) return tempReply(message, errorEmbed('❌ Error', 'Suggestion channel not found.'));
    const e = new EmbedBuilder()
      .setColor(COLORS.BLUE)
      .setTitle('💡 New Suggestion')
      .setDescription(text)
      .addFields({ name: 'Submitted by', value: `<@${message.author.id}>` })
      .setTimestamp();
    const msg = await ch.send({ embeds: [e] });
    await msg.react('👍');
    await msg.react('👎');
    tempReply(message, successEmbed('✅ Suggestion', 'Your suggestion has been submitted!'));
  }
};

// POLL
const poll = {
  name: 'poll',
  adminOnly: true,
  async execute(message, args, client, config) {
    const parts = message.content.match(/"([^"]+)"/g);
    if (!parts || parts.length < 2) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?poll "Question" "Option1" "Option2" ...'));
    const question = parts[0].replace(/"/g, '');
    const options = parts.slice(1).map(p => p.replace(/"/g, ''));
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = options.map((o, i) => `${emojis[i]} ${o}`).join('\n');
    const e = new EmbedBuilder().setColor(COLORS.BLUE).setTitle('📊 ' + question).setDescription(desc).setTimestamp();
    const msg = await message.channel.send({ embeds: [e] });
    for (let i = 0; i < Math.min(options.length, 10); i++) await msg.react(emojis[i]);
  }
};

// PROFILE
const profile = {
  name: 'profile',
  cooldown: 5,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first() || message.member;
    const user = db.getUser(message.guild.id, target.id);
    const achievements = Array.isArray(user.achievements) ? user.achievements : JSON.parse(user.achievements || '[]');
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`👤 ${target.displayName}'s Profile`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Level', value: `${user.level}`, inline: true },
        { name: 'XP', value: `${user.xp}`, inline: true },
        { name: 'Balance', value: `💰 ${user.economy_balance}`, inline: true },
        { name: 'Messages', value: `${user.messages}`, inline: true },
        { name: 'Voice (min)', value: `${user.voice_minutes}`, inline: true },
        { name: 'Invites', value: `${user.invite_count}`, inline: true },
        { name: 'Achievements', value: achievements.length ? achievements.join(', ') : 'None yet', inline: false },
      )
      .setTimestamp()] });
  }
};

// TIME
const time = {
  name: 'time',
  cooldown: 5,
  async execute(message, args, client, config) {
    const user = db.getUser(message.guild.id, message.author.id);
    if (!user.timezone) {
      return tempReply(message, infoEmbed('⏰ Time', 'Please set your timezone with `?timeset [Country/City]`.'));
    }
    try {
      const now = new Date();
      const tz = new Intl.DateTimeFormat('en-AU', { timeZone: user.timezone, dateStyle: 'full', timeStyle: 'long' }).format(now);
      await message.channel.send({ embeds: [infoEmbed('⏰ Current Time', `**${tz}**\nTimezone: \`${user.timezone}\``)] });
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', 'Invalid timezone. Please reset with ?timeset.'));
    }
  }
};

// TIMESET
const timeset = {
  name: 'timeset',
  cooldown: 10,
  async execute(message, args, client, config) {
    const country = args.join(' ');
    if (!country) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?timeset [Country/City]\nExample: ?timeset Australia'));

    // Map common countries to their timezones
    const commonTimezones = {
      'australia': ['Australia/Sydney (AEDT)', 'Australia/Brisbane (AEST)', 'Australia/Melbourne (AEDT)', 'Australia/Perth (AWST)', 'Australia/Adelaide (ACDT)', 'Australia/Darwin (ACST)', 'Australia/Hobart (AEDT)'],
      'usa': ['America/New_York (ET)', 'America/Chicago (CT)', 'America/Denver (MT)', 'America/Los_Angeles (PT)', 'America/Anchorage (AKT)', 'Pacific/Honolulu (HST)'],
      'canada': ['America/Toronto (ET)', 'America/Winnipeg (CT)', 'America/Edmonton (MT)', 'America/Vancouver (PT)'],
      'uk': ['Europe/London (GMT/BST)'],
      'india': ['Asia/Kolkata (IST)'],
    };

    const key = country.toLowerCase();
    const tzList = commonTimezones[key];
    if (tzList) {
      return tempReply(message, infoEmbed(`⏰ Timezones for ${country}`,
        `Multiple timezones found. Please use ?timeset with the specific timezone:\n\n${tzList.map(t => `\`${t}\``).join('\n')}`
      ), 20);
    }

    // Try to set directly
    try {
      new Intl.DateTimeFormat('en', { timeZone: country });
      db.updateUser(message.guild.id, message.author.id, { timezone: country, country });
      tempReply(message, successEmbed('✅ Timezone Set', `Your timezone has been set to \`${country}\`.`));
    } catch (e) {
      tempReply(message, errorEmbed('❌ Error', `Timezone \`${country}\` not found. Try a format like \`Australia/Sydney\` or \`America/New_York\`.`));
    }
  }
};

// AI
const ai = {
  name: 'ai',
  cooldown: 10,
  async execute(message, args, client, config) {
    const question = args.join(' ');
    if (!question) return tempReply(message, errorEmbed('❌ Error', 'Please provide a question.'));
    if (!process.env.OPENAI_API_KEY) return tempReply(message, errorEmbed('❌ Error', 'AI is not configured.'));
    const typing = await message.channel.send('🤔 Thinking...');
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: question }],
        max_tokens: 500,
      });
      const answer = res.choices[0].message.content;
      await typing.delete().catch(() => {});
      await message.channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.PURPLE).setTitle('🤖 AI Response').setDescription(answer.substring(0, 4096)).setTimestamp()] });
    } catch (e) {
      await typing.delete().catch(() => {});
      tempReply(message, errorEmbed('❌ Error', 'AI request failed.'));
    }
  }
};

// BACKUP
const backup = {
  name: 'backup',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'create') {
      const id = `backup_${message.guild.id}_${Date.now()}`;
      const channels = message.guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type }));
      const roles = message.guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }));
      const data = { id, config, channels, roles, timestamp: Date.now() };
      db.run('INSERT OR REPLACE INTO guild_config (guild_id) VALUES (?)', [message.guild.id]);
      // Store backup as file or in db
      require('fs-extra').outputFileSync(`./data/backup_${id}.json`, JSON.stringify(data, null, 2));
      return tempReply(message, successEmbed('✅ Backup Created', `Backup ID: \`${id}\``));
    }
    if (args[0] === 'load') {
      return tempReply(message, infoEmbed('Backup', 'Contact server admin to load backup `' + args[1] + '`.'));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?backup create | ?backup load [id]'));
  }
};

module.exports = { userstats, serverstats, messagestats, vsstats, rank, leaderboard, giveaway, remindme, afk, suggest, poll, profile, time, timeset, ai, backup };

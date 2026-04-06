const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed, tempReply, COLORS } = require('../../utils/helpers');

const help = {
  name: 'help',
  ownerOnly: true,
  async execute(message, args, client, config) {
    const prefix = config.prefix || '?';
    const helpText = `
**📋 ADMIN COMMANDS**
\`${prefix}ban @user [reason]\` — Ban a user
\`${prefix}kick @user [reason]\` — Kick a user
\`${prefix}vcmute @user [reason]\` — Mute in voice
\`${prefix}timeout @user [time] [reason]\` — Timeout a user
\`${prefix}warn @user [reason]\` — Warn a user
\`${prefix}tempban @user [time] [reason]\` — Temp ban a user
\`${prefix}modlog @user\` — View mod logs
\`${prefix}adminblock @user / list\` — Admin block user
\`${prefix}nickname lock/unlock @user\` — Lock/unlock nicknames
\`${prefix}nickname lock all / unlock all\` — Lock/unlock all nicks
\`${prefix}nickname lock new [name] @user\` — Lock to new name
\`${prefix}nickname change [bot/human] [name]\` — Change all nicks
\`${prefix}allcommands lock/unlock @user\` — Block commands
\`${prefix}allcommands locked list\` — List locked users
\`${prefix}addcmd [name] [output]\` — Add custom command
\`${prefix}delcmd [id]\` — Delete custom command
\`${prefix}customcmd list\` — List custom commands
\`${prefix}schedule #channel [msg]\` — Schedule a message
\`${prefix}announce [msg] [ping]\` — Announce a message
\`${prefix}embed [msg]\` — Send embed
\`${prefix}joining #ch [on/off]\` — Welcome messages
\`${prefix}leaving #ch [on/off]\` — Leave messages
\`${prefix}userstats @user\` — User statistics
\`${prefix}serverstats\` — Server statistics
\`${prefix}messagestats\` — Message statistics
\`${prefix}vsstats\` — Voice statistics
\`${prefix}lock/unlock [#ch]\` — Lock/unlock channel
\`${prefix}slowmode [#ch] [time/off]\` — Slowmode
\`${prefix}temprole @user @role [time]\` — Temp role
\`${prefix}autorole set/remove @role\` — Auto role
\`${prefix}prefix set [prefix]\` — Change prefix
\`${prefix}jail on/off\` — Toggle jail system
\`${prefix}jail logs setup\` — Setup jail logs
\`${prefix}unjail give role @role\` — Set unjail role
\`${prefix}jailmessage [msg]\` — Set jail message
\`${prefix}automod addword/removeword/listwords [word]\` — AutoMod words
\`${prefix}giveaway start [time] [winners] [prize]\` — Start giveaway
\`${prefix}giveaway reroll [id]\` — Reroll giveaway
\`${prefix}poll "Q" "Opt1" "Opt2"\` — Create poll
\`${prefix}suggest [msg]\` — Suggest something
\`${prefix}backup create/load [id]\` — Server backup
\`${prefix}counting on/off\` — Counting channel

**🎮 USER COMMANDS**
\`${prefix}rank [@user]\` — View rank card
\`${prefix}leaderboard\` — Top users leaderboard
\`${prefix}profile [@user]\` — View profile
\`${prefix}remindme [time] [msg]\` — Set a reminder
\`${prefix}afk [reason]\` — Set AFK status
\`${prefix}time\` — Show your time
\`${prefix}timeset [country/zone]\` — Set your timezone
\`${prefix}ai [question]\` — Ask AI a question
\`${prefix}tictactoe @user\` — Play Tic Tac Toe
\`${prefix}rps @user\` — Rock Paper Scissors
\`${prefix}trivia\` — Play trivia
\`${prefix}daily\` — Claim daily reward
\`${prefix}balance [@user]\` — Check balance
\`${prefix}pay @user [amount]\` — Pay a user
`;

    try {
      await message.author.send({ embeds: [new EmbedBuilder().setColor(COLORS.PURPLE).setTitle('📋 Bot Commands').setDescription(helpText.substring(0, 4096)).setTimestamp()] });
      await tempReply(message, successEmbed('📬 Help Sent', 'A list of commands has been sent to your DMs.'));
    } catch (e) {
      await tempReply(message, errorEmbed('❌ Error', 'Could not send DM. Please enable DMs.'));
    }
  }
};

const automodCmd = {
  name: 'automod',
  adminOnly: true,
  async execute(message, args, client, config) {
    const sub = args[0]?.toLowerCase();
    const bannedWords = Array.isArray(config.banned_words) ? config.banned_words : JSON.parse(config.banned_words || '[]');

    if (sub === 'addword') {
      const word = args[1];
      if (!word) return tempReply(message, errorEmbed('❌ Error', 'Please provide a word.'));
      if (!bannedWords.includes(word.toLowerCase())) bannedWords.push(word.toLowerCase());
      db.updateGuildConfig(message.guild.id, { banned_words: bannedWords });
      return tempReply(message, successEmbed('✅ Word Added', `\`${word}\` added to banned words.`));
    }
    if (sub === 'removeword') {
      const word = args[1];
      const idx = bannedWords.indexOf(word?.toLowerCase());
      if (idx > -1) bannedWords.splice(idx, 1);
      db.updateGuildConfig(message.guild.id, { banned_words: bannedWords });
      return tempReply(message, successEmbed('✅ Word Removed', `\`${word}\` removed from banned words.`));
    }
    if (sub === 'listwords') {
      if (!bannedWords.length) return tempReply(message, infoEmbed('Banned Words', 'No banned words.'));
      return tempReply(message, infoEmbed('Banned Words', bannedWords.map(w => `\`${w}\``).join(', ')));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?automod addword/removeword/listwords [word]'));
  }
};

const counting = {
  name: 'counting',
  adminOnly: true,
  async execute(message, args, client, config) {
    const sub = args[0]?.toLowerCase();
    if (sub === 'on') {
      const { setup } = require('../../systems/counting');
      const ch = await setup(message.guild, config);
      db.updateGuildConfig(message.guild.id, { counting_status: 1 });
      return tempReply(message, successEmbed('✅ Counting', `Counting channel set up at <#${ch.id}>.`));
    }
    if (sub === 'off') {
      db.updateGuildConfig(message.guild.id, { counting_status: 0 });
      return tempReply(message, successEmbed('✅ Counting', 'Counting system disabled.'));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?counting on | ?counting off'));
  }
};

module.exports = { help, automodCmd, counting };

const db = require('../utils/database');
const { isAdmin, isOwner, isAllCommandsLocked, deleteCommand, tempReply, errorEmbed, trackCommandUsage, logToDevChannel } = require('../utils/helpers');
const automod = require('../systems/automod');
const leveling = require('../systems/leveling');
const counting = require('../systems/counting');
const afk = require('../systems/afk');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const config = db.getGuildConfig(message.guild.id);
    const prefix = config.prefix || '?';

    // Media only channel check
    const mediaOnly = Array.isArray(config.media_only_channels) ? config.media_only_channels : JSON.parse(config.media_only_channels || '[]');
    if (mediaOnly.includes(message.channel.id)) {
      if (!message.attachments.size && !message.embeds.length) {
        await message.delete().catch(() => {});
        return;
      }
    }

    // AFK check - notify if someone is mentioned
    await afk.checkMentions(message, config);

    // Clear AFK if user sends a message
    await afk.clearAfk(message, config);

    // AutoMod (runs before commands)
    if (config.automod_status === 1 || config.automod_status === 2) {
      const stopped = await automod.process(message, config, client);
      if (stopped) return;
    }

    // Leveling XP
    if (config.leveling_status === 1) {
      await leveling.addXP(message, config, client);
    }

    // Auto responses
    const autoResponses = Array.isArray(config.auto_responses) ? config.auto_responses : JSON.parse(config.auto_responses || '[]');
    for (const ar of autoResponses) {
      if (message.content.toLowerCase().includes(ar.trigger.toLowerCase())) {
        await message.channel.send(ar.response).catch(() => {});
        break;
      }
    }

    // Counting
    if (config.counting_status >= 1 && message.channel.id === config.counting_channel) {
      await counting.process(message, config);
      return;
    }

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // Check if user is allcommands locked
    if (isAllCommandsLocked(config, message.author.id) && !isOwner(message.author.id)) {
      await deleteCommand(message);
      try {
        await message.author.send({ embeds: [errorEmbed('⛔ Blocked', 'You are not allowed to use any bot commands.')] });
      } catch (e) {}
      return;
    }

    // Disabled commands check
    const disabledCmds = Array.isArray(config.disabled_commands) ? config.disabled_commands : JSON.parse(config.disabled_commands || '[]');
    if (disabledCmds.includes(commandName)) {
      await deleteCommand(message);
      await tempReply(message, errorEmbed('❌ Disabled', 'This command has been disabled.'));
      return;
    }

    // Check custom commands first
    const customCmds = Array.isArray(config.custom_commands) ? config.custom_commands : JSON.parse(config.custom_commands || '[]');
    const customCmd = customCmds.find(c => c.name === commandName);
    if (customCmd) {
      await deleteCommand(message);
      await message.channel.send(customCmd.output);
      trackCommandUsage(message.guild.id, message.author.id, commandName);
      return;
    }

    const command = client.commands.get(commandName);
    if (!command) return;

    // Delete the command message immediately
    await deleteCommand(message);

    // Permission check
    if (command.adminOnly && !isAdmin(message.member, config) && !isOwner(message.author.id)) {
      await tempReply(message, errorEmbed('⛔ No Permission', 'This command requires admin permissions.'));
      return;
    }

    if (command.ownerOnly && !isOwner(message.author.id)) {
      await tempReply(message, errorEmbed('⛔ No Permission', 'This command can only be used by the bot owner.'));
      return;
    }

    // Cooldown check
    if (command.cooldown) {
      const now = Date.now();
      const key = `${message.guild.id}_${message.author.id}_${commandName}`;
      const lastUsed = client.cooldowns.get(key);
      if (lastUsed && now - lastUsed < command.cooldown * 1000) {
        const remaining = ((command.cooldown * 1000 - (now - lastUsed)) / 1000).toFixed(1);
        await tempReply(message, errorEmbed('⏱ Cooldown', `Please wait ${remaining}s before using this command again.`));
        return;
      }
      client.cooldowns.set(key, now);
    }

    try {
      await command.execute(message, args, client, config);
      trackCommandUsage(message.guild.id, message.author.id, commandName);
    } catch (error) {
      console.error(`Error in command ${commandName}:`, error);
      await tempReply(message, errorEmbed('❌ Error', 'An error occurred executing this command.'));
      await logToDevChannel(message.guild, config, `❌ **Error in command \`${commandName}\`**\n\`\`\`${error.message}\`\`\``);
    }
  }
};

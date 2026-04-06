const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed, tempReply, parseTime, COLORS } = require('../../utils/helpers');

const lock = {
  name: 'lock',
  adminOnly: true,
  async execute(message, args, client, config) {
    const ch = message.mentions.channels.first() || message.channel;
    await ch.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
    const locked = Array.isArray(config.locked_channels) ? config.locked_channels : [];
    if (!locked.includes(ch.id)) locked.push(ch.id);
    db.updateGuildConfig(message.guild.id, { locked_channels: locked });
    tempReply(message, successEmbed('🔒 Channel Locked', `<#${ch.id}> has been locked.`));
  }
};

const unlock = {
  name: 'unlock',
  adminOnly: true,
  async execute(message, args, client, config) {
    const ch = message.mentions.channels.first() || message.channel;
    await ch.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
    const locked = Array.isArray(config.locked_channels) ? config.locked_channels : [];
    db.updateGuildConfig(message.guild.id, { locked_channels: locked.filter(id => id !== ch.id) });
    tempReply(message, successEmbed('🔓 Channel Unlocked', `<#${ch.id}> has been unlocked.`));
  }
};

const slowmode = {
  name: 'slowmode',
  adminOnly: true,
  async execute(message, args, client, config) {
    const ch = message.mentions.channels.first() || message.channel;
    const val = args.find(a => !a.startsWith('<'));
    if (!val || val === 'off') {
      await ch.setRateLimitPerUser(0);
      return tempReply(message, successEmbed('⏱ Slowmode', `Slowmode disabled in <#${ch.id}>.`));
    }
    const seconds = val.endsWith('s') ? parseInt(val) : val.endsWith('m') ? parseInt(val) * 60 : parseInt(val);
    await ch.setRateLimitPerUser(seconds);
    tempReply(message, successEmbed('⏱ Slowmode', `Slowmode set to ${val} in <#${ch.id}>.`));
  }
};

const announce = {
  name: 'announce',
  adminOnly: true,
  async execute(message, args, client, config) {
    const pingType = args[args.length - 1]?.toLowerCase();
    let ping = '';
    let msgArgs = args;
    if (['here', 'everyone', 'nothing'].includes(pingType)) {
      msgArgs = args.slice(0, -1);
      if (pingType === 'here') ping = '@here ';
      else if (pingType === 'everyone') ping = '@everyone ';
    }
    const text = msgArgs.join(' ');
    if (!text) return tempReply(message, errorEmbed('❌ Error', 'Please provide a message.'));
    await message.channel.send({ content: `${ping}**${text}**` });
  }
};

const embed = {
  name: 'embed',
  adminOnly: true,
  async execute(message, args, client, config) {
    const text = args.join(' ');
    if (!text) return tempReply(message, errorEmbed('❌ Error', 'Please provide a message.'));
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.BLUE).setDescription(text).setTimestamp()] });
  }
};

const schedule = {
  name: 'schedule',
  adminOnly: true,
  async execute(message, args, client, config) {
    const ch = message.mentions.channels.first();
    if (!ch) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?schedule #channel [message]'));
    const text = args.slice(1).join(' ');
    if (!text) return tempReply(message, errorEmbed('❌ Error', 'Please provide a message.'));
    const scheduled = Array.isArray(config.scheduled_messages) ? config.scheduled_messages : [];
    scheduled.push({ channel_id: ch.id, message: text, interval: 3600000, last_sent: 0 });
    db.updateGuildConfig(message.guild.id, { scheduled_messages: scheduled });
    tempReply(message, successEmbed('📅 Scheduled', `Message scheduled to send in <#${ch.id}> every hour.`));
  }
};

const joining = {
  name: 'joining',
  adminOnly: true,
  async execute(message, args, client, config) {
    const ch = message.mentions.channels.first();
    const status = args.find(a => a === 'on' || a === 'off');
    if (!ch || !status) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?joining #channel [on/off]'));
    db.updateGuildConfig(message.guild.id, { welcome_channel: ch.id, welcome_status: status === 'on' ? 1 : 0 });
    tempReply(message, successEmbed('👋 Welcome', `Welcome messages turned ${status} in <#${ch.id}>.`));
  }
};

const leaving = {
  name: 'leaving',
  adminOnly: true,
  async execute(message, args, client, config) {
    const ch = message.mentions.channels.first();
    const status = args.find(a => a === 'on' || a === 'off');
    if (!ch || !status) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?leaving #channel [on/off]'));
    db.updateGuildConfig(message.guild.id, { leaving_channel: ch.id, leaving_status: status === 'on' ? 1 : 0 });
    tempReply(message, successEmbed('👋 Leaving', `Leaving messages turned ${status} in <#${ch.id}>.`));
  }
};

const temprole = {
  name: 'temprole',
  adminOnly: true,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    const roleM = message.mentions.roles.first();
    const duration = args[2];
    if (!target || !roleM || !duration) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?temprole @user @role <duration>'));
    const ms = parseTime(duration);
    if (!ms) return tempReply(message, errorEmbed('❌ Error', 'Invalid duration.'));
    await target.roles.add(roleM);
    tempReply(message, successEmbed('⏱ Temp Role', `<@&${roleM.id}> given to <@${target.id}> for ${duration}.`));
    setTimeout(async () => {
      await target.roles.remove(roleM).catch(() => {});
    }, ms);
  }
};

const autorole = {
  name: 'autorole',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'set') {
      const role = message.mentions.roles.first();
      if (!role) return tempReply(message, errorEmbed('❌ Error', 'Please mention a role.'));
      db.updateGuildConfig(message.guild.id, { autorole: role.id });
      return tempReply(message, successEmbed('✅ Auto Role', `<@&${role.id}> will now be given to new members.`));
    }
    if (args[0] === 'remove') {
      db.updateGuildConfig(message.guild.id, { autorole: null });
      return tempReply(message, successEmbed('✅ Auto Role', 'Auto role has been removed.'));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?autorole set @role | ?autorole remove'));
  }
};

const prefix = {
  name: 'prefix',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'set' && args[1]) {
      db.updateGuildConfig(message.guild.id, { prefix: args[1] });
      return tempReply(message, successEmbed('✅ Prefix', `Bot prefix set to \`${args[1]}\`.`));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?prefix set <new_prefix>'));
  }
};

const addcmd = {
  name: 'addcmd',
  adminOnly: true,
  async execute(message, args, client, config) {
    const cmdName = args[0];
    const output = args.slice(1).join(' ');
    if (!cmdName || !output) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?addcmd [name] [output]'));
    const cmds = Array.isArray(config.custom_commands) ? config.custom_commands : [];
    const id = `cmd_${Date.now()}`;
    cmds.push({ id, name: cmdName.toLowerCase(), output });
    db.updateGuildConfig(message.guild.id, { custom_commands: cmds });
    tempReply(message, successEmbed('✅ Custom Command', `Command \`${cmdName}\` created with ID \`${id}\`.`));
  }
};

const delcmd = {
  name: 'delcmd',
  adminOnly: true,
  async execute(message, args, client, config) {
    const id = args[0];
    if (!id) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?delcmd [id]'));
    const cmds = Array.isArray(config.custom_commands) ? config.custom_commands : [];
    const filtered = cmds.filter(c => c.id !== id);
    db.updateGuildConfig(message.guild.id, { custom_commands: filtered });
    tempReply(message, successEmbed('✅ Deleted', `Custom command \`${id}\` deleted.`));
  }
};

const customcmd = {
  name: 'customcmd',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'list') {
      const cmds = Array.isArray(config.custom_commands) ? config.custom_commands : [];
      if (!cmds.length) return tempReply(message, infoEmbed('Custom Commands', 'No custom commands.'));
      const fields = cmds.map(c => ({ name: `${c.name} (ID: ${c.id})`, value: c.output.substring(0, 100) }));
      return tempReply(message, infoEmbed('Custom Commands', `${cmds.length} commands.`, fields), 15);
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?customcmd list'));
  }
};

const jailcmd = {
  name: 'jail',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'on') {
      db.updateGuildConfig(message.guild.id, { jail_status: 1 });
      return tempReply(message, successEmbed('✅ Jail System', 'Jail system is now ON.'));
    }
    if (args[0] === 'off') {
      db.updateGuildConfig(message.guild.id, { jail_status: 0 });
      return tempReply(message, successEmbed('✅ Jail System', 'Jail system is now OFF.'));
    }
    if (args[0] === 'logs' && args[1] === 'setup') {
      const ch = await message.guild.channels.create({ name: 'jail-logs', type: 0 });
      db.updateGuildConfig(message.guild.id, { jail_log_channel: ch.id });
      return tempReply(message, successEmbed('✅ Jail Logs', `Jail logs channel created: <#${ch.id}>.`));
    }
    if (args[0] === 'off') {
      db.updateGuildConfig(message.guild.id, { jail_status: 0 });
      return tempReply(message, successEmbed('✅ Jail', 'Jail system disabled.'));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?jail on | ?jail off | ?jail logs setup'));
  }
};

const unjail = {
  name: 'unjail',
  adminOnly: true,
  async execute(message, args, client, config) {
    if (args[0] === 'give' && args[1] === 'role') {
      const role = message.mentions.roles.first();
      if (!role) return tempReply(message, errorEmbed('❌ Error', 'Please mention a role.'));
      db.updateGuildConfig(message.guild.id, { unjail_give_role: role.id });
      return tempReply(message, successEmbed('✅ Unjail Role', `<@&${role.id}> will be given to users when unjailed.`));
    }
    tempReply(message, errorEmbed('❌ Error', 'Usage: ?unjail give role @role'));
  }
};

const jailmessage = {
  name: 'jailmessage',
  adminOnly: true,
  async execute(message, args, client, config) {
    const msg = args.join(' ');
    if (!msg) return tempReply(message, errorEmbed('❌ Error', 'Please provide a message.'));
    db.updateGuildConfig(message.guild.id, { jail_message: msg });
    tempReply(message, successEmbed('✅ Jail Message', `Jail message updated.`));
  }
};

module.exports = { lock, unlock, slowmode, announce, embed, schedule, joining, leaving, temprole, autorole, prefix, addcmd, delcmd, customcmd, jailcmd, unjail, jailmessage };

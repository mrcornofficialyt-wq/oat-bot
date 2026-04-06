const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { infoEmbed, warnEmbed, COLORS } = require('../utils/helpers');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const config = db.getGuildConfig(member.guild.id);

    // Alt account detection
    const accountAge = Date.now() - member.user.createdTimestamp;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (accountAge < sevenDays && config.modlog_channel) {
      const ch = member.guild.channels.cache.get(config.modlog_channel);
      if (ch) {
        const days = Math.floor(accountAge / (24 * 60 * 60 * 1000));
        await ch.send({ embeds: [warnEmbed('⚠️ Possible Alt Account', `<@${member.id}> joined with an account created only **${days} day(s) ago**.`)] }).catch(() => {});
      }
    }

    // Anti-raid: track join rate
    const now = Date.now();
    if (!client.recentJoins) client.recentJoins = {};
    if (!client.recentJoins[member.guild.id]) client.recentJoins[member.guild.id] = [];
    client.recentJoins[member.guild.id].push(now);
    client.recentJoins[member.guild.id] = client.recentJoins[member.guild.id].filter(t => now - t < (config.antiraid_timewindow || 10) * 1000);
    if (config.antiraid_status === 1 && client.recentJoins[member.guild.id].length >= (config.antiraid_threshold || 10)) {
      // Lock all channels
      const { triggerAntiRaid } = require('../systems/antiraid');
      await triggerAntiRaid(member.guild, config, client);
    }

    // Invite tracking
    try {
      const invites = await member.guild.invites.fetch();
      const tracked = db.query('SELECT * FROM invite_tracking WHERE guild_id = ?', [member.guild.id]);
      for (const [code, invite] of invites) {
        const existing = tracked.find(t => t.invite_code === code);
        if (existing && invite.uses > existing.uses) {
          db.run('UPDATE invite_tracking SET uses = ? WHERE guild_id = ? AND invite_code = ?', [invite.uses, member.guild.id, code]);
          db.run('UPDATE users SET invite_count = invite_count + 1 WHERE guild_id = ? AND user_id = ?', [member.guild.id, existing.inviter_id]);
          db.run(`UPDATE users SET invited_by = ? WHERE guild_id = ? AND user_id = ?`, [existing.inviter_id, member.guild.id, member.id]);
        }
      }
    } catch (e) {}

    // Autorole
    if (config.autorole) {
      try {
        const role = member.guild.roles.cache.get(config.autorole);
        if (role) await member.roles.add(role);
      } catch (e) {}
    }

    // Verification: add mute role if enabled
    if (config.verification_status === 1 && config.mute_role) {
      try {
        const role = member.guild.roles.cache.get(config.mute_role);
        if (role) await member.roles.add(role);
      } catch (e) {}
    }

    // Jail system
    if (config.jail_status === 1) {
      await setupJail(member, config, client);
    }

    // Welcome message
    if (config.welcome_status === 1 && config.welcome_channel) {
      const ch = member.guild.channels.cache.get(config.welcome_channel);
      if (ch) {
        const e = new EmbedBuilder()
          .setColor(COLORS.GREEN)
          .setTitle('👋 Welcome!')
          .setDescription(`Welcome to **${member.guild.name}**, <@${member.id}>! We're glad to have you here.`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields({ name: 'Member Count', value: `${member.guild.memberCount}`, inline: true })
          .setTimestamp();
        await ch.send({ embeds: [e] }).catch(() => {});
      }
    }
  }
};

async function setupJail(member, config, client) {
  try {
    const guild = member.guild;

    // Create jail role
    let jailRole = guild.roles.cache.find(r => r.name === `jail-${member.id}`);
    if (!jailRole) {
      jailRole = await guild.roles.create({
        name: `jail-${member.id}`,
        color: '#FF0000',
        permissions: [],
      });
    }

    // Deny all channels, create private one
    for (const [, channel] of guild.channels.cache) {
      if (channel.permissionsFor) {
        await channel.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false,
        }).catch(() => {});
      }
    }

    // Create jail channel
    const jailChannel = await guild.channels.create({
      name: `jail-${member.user.username}`,
      type: 0,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: jailRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      ],
    });

    // Give user the jail role
    await member.roles.add(jailRole).catch(() => {});

    // Save session
    db.run('INSERT INTO jail_sessions (guild_id, user_id, channel_id, role_id) VALUES (?, ?, ?, ?)',
      [guild.id, member.id, jailChannel.id, jailRole.id]);

    // Send jail message and keep resending until response
    const jailMsg = config.jail_message || 'Welcome! Please respond to this message and wait for a staff member.';
    const sentMsg = await jailChannel.send({ embeds: [new EmbedBuilder().setColor(COLORS.YELLOW).setTitle('🔒 Verification Required').setDescription(jailMsg)] });

    if (!client.jailIntervals) client.jailIntervals = {};
    let lastBotMsg = sentMsg;

    client.jailIntervals[jailChannel.id] = setInterval(async () => {
      try {
        const session = db.get('SELECT * FROM jail_sessions WHERE channel_id = ? AND status = ?', [jailChannel.id, 'pending']);
        if (!session) { clearInterval(client.jailIntervals[jailChannel.id]); return; }
        if (lastBotMsg) await lastBotMsg.delete().catch(() => {});
        lastBotMsg = await jailChannel.send({ embeds: [new EmbedBuilder().setColor(COLORS.YELLOW).setTitle('🔒 Verification Required').setDescription(jailMsg)] });
      } catch (e) { clearInterval(client.jailIntervals[jailChannel.id]); }
    }, 30000);

    // Listen for user response
    const filter = m => m.author.id === member.id;
    const collector = jailChannel.createMessageCollector({ filter });

    collector.on('collect', async (m) => {
      if (db.get('SELECT * FROM jail_sessions WHERE channel_id = ? AND status = ?', [jailChannel.id, 'pending'])) {
        clearInterval(client.jailIntervals[jailChannel.id]);
        if (lastBotMsg) await lastBotMsg.delete().catch(() => {});
        await m.delete().catch(() => {});

        db.run('UPDATE jail_sessions SET status = ? WHERE channel_id = ?', ['waiting', jailChannel.id]);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`unjail_${member.id}_${jailChannel.id}_${jailRole.id}`).setLabel('✅ Unjail User').setStyle(ButtonStyle.Success)
        );
        await jailChannel.send({
          embeds: [new EmbedBuilder().setColor(COLORS.BLUE).setTitle('✋ Awaiting Staff').setDescription(`<@${member.id}> has responded and is waiting for a staff member.`)],
          components: [row]
        });
        collector.stop();
      }
    });
  } catch (e) {
    console.error('Jail setup error:', e);
  }
}

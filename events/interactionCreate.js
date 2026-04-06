const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { COLORS, isAdmin, successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isButton()) return;
    const config = db.getGuildConfig(interaction.guild.id);

    // Unjail button
    if (interaction.customId.startsWith('unjail_')) {
      const [, userId, channelId, roleId] = interaction.customId.split('_');
      if (!isAdmin(interaction.member, config)) {
        return interaction.reply({ content: 'Only admins can unjail users.', ephemeral: true });
      }
      await interaction.deferUpdate().catch(() => {});

      try {
        const session = db.get('SELECT * FROM jail_sessions WHERE channel_id = ?', [channelId]);
        if (!session) return;

        const member = interaction.guild.members.cache.get(userId) || await interaction.guild.members.fetch(userId).catch(() => null);
        const jailRole = interaction.guild.roles.cache.get(roleId);

        // Remove jail role
        if (member && jailRole) await member.roles.remove(jailRole).catch(() => {});
        if (jailRole) await jailRole.delete().catch(() => {});

        // Give unjail role if configured
        if (config.unjail_give_role && member) {
          const giveRole = interaction.guild.roles.cache.get(config.unjail_give_role);
          if (giveRole) await member.roles.add(giveRole).catch(() => {});
        }

        // Save transcript and log
        const transcript = session.transcript || '';
        if (config.jail_log_channel) {
          const logCh = interaction.guild.channels.cache.get(config.jail_log_channel);
          if (logCh) {
            await logCh.send({
              embeds: [new EmbedBuilder()
                .setColor(COLORS.GREEN)
                .setTitle('📋 Jail Session Closed')
                .addFields(
                  { name: 'User', value: `<@${userId}>`, inline: true },
                  { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
                )
                .setTimestamp()],
              files: transcript ? [{ attachment: Buffer.from(transcript), name: `jail-transcript-${userId}.txt` }] : []
            }).catch(() => {});
          }
        }

        db.run('UPDATE jail_sessions SET status = ?, closed_at = ? WHERE channel_id = ?',
          ['closed', Math.floor(Date.now() / 1000), channelId]);

        const ch = interaction.guild.channels.cache.get(channelId);
        if (ch) {
          await ch.send({ embeds: [successEmbed('✅ Unjailed', `<@${userId}> has been unjailed by <@${interaction.user.id}>.`)] });
          setTimeout(() => ch.delete().catch(() => {}), 5000);
        }
      } catch (e) {
        console.error('Unjail error:', e);
      }
      return;
    }

    // Ticket claim button
    if (interaction.customId.startsWith('claim_ticket_')) {
      const ticketId = interaction.customId.split('_')[2];
      const ticket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
      if (ticket.claimed_by) return interaction.reply({ content: 'This ticket is already claimed.', ephemeral: true });
      if (!isAdmin(interaction.member, config)) return interaction.reply({ content: 'Only admins can claim tickets.', ephemeral: true });

      db.run('UPDATE tickets SET claimed_by = ? WHERE id = ?', [interaction.user.id, ticketId]);
      const ch = interaction.guild.channels.cache.get(ticket.channel_id);
      if (ch) {
        // Lock channel to only this admin + ticket creator
        await ch.permissionOverwrites.set([
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: ticket.user_id, allow: ['ViewChannel', 'SendMessages'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] },
          { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] },
        ]).catch(() => {});
        await ch.send({ embeds: [successEmbed('🎫 Ticket Claimed', `This ticket has been claimed by <@${interaction.user.id}>.`)] });
      }
      await interaction.reply({ content: 'Ticket claimed!', ephemeral: true });
      return;
    }

    // Ticket close button
    if (interaction.customId.startsWith('close_ticket_')) {
      const ticketId = interaction.customId.split('_')[2];
      const ticket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });

      const canClose = interaction.user.id === ticket.user_id || isAdmin(interaction.member, config);
      if (!canClose) return interaction.reply({ content: 'You cannot close this ticket.', ephemeral: true });

      await interaction.deferUpdate().catch(() => {});

      try {
        const ch = interaction.guild.channels.cache.get(ticket.channel_id);
        db.run('UPDATE tickets SET status = ?, closed_at = ? WHERE id = ?', ['closed', Math.floor(Date.now() / 1000), ticketId]);

        // Send review DM if ticket was claimed
        if (ticket.claimed_by) {
          const ticketUser = await client.users.fetch(ticket.user_id).catch(() => null);
          if (ticketUser) {
            await ticketUser.send({
              embeds: [new EmbedBuilder()
                .setColor(COLORS.PURPLE)
                .setTitle('⭐ Rate Your Support Experience')
                .setDescription(`Your ticket was handled by <@${ticket.claimed_by}>. Please rate your experience!`)],
              components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`review_1_${ticket.claimed_by}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`review_2_${ticket.claimed_by}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`review_3_${ticket.claimed_by}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`review_4_${ticket.claimed_by}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`review_5_${ticket.claimed_by}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success),
              )]
            }).catch(() => {});
          }
        }

        if (ch) {
          await ch.send({ embeds: [infoEmbed('🔒 Ticket Closing', 'This ticket will be deleted in 10 seconds.')] });
          setTimeout(() => ch.delete().catch(() => {}), 10000);
        }
      } catch (e) { console.error('Close ticket error:', e); }
      return;
    }

    // Open ticket from panel
    if (interaction.customId.startsWith('open_ticket_')) {
      const panelId = interaction.customId.split('_')[2];
      const { openTicket } = require('../systems/tickets');
      await openTicket(interaction, panelId, config, client);
      return;
    }

    // Reaction roles (button-based)
    if (interaction.customId.startsWith('rr_')) {
      const roleId = interaction.customId.split('_')[1];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: 'Role not found.', ephemeral: true });
      if (interaction.member.roles.cache.has(roleId)) {
        await interaction.member.roles.remove(role).catch(() => {});
        await interaction.reply({ content: `Removed role **${role.name}**.`, ephemeral: true });
      } else {
        await interaction.member.roles.add(role).catch(() => {});
        await interaction.reply({ content: `Added role **${role.name}**.`, ephemeral: true });
      }
      return;
    }

    // Verification button
    if (interaction.customId === 'verify_user') {
      const verRole = config.verified_role ? interaction.guild.roles.cache.get(config.verified_role) : null;
      const muteRole = config.mute_role ? interaction.guild.roles.cache.get(config.mute_role) : null;
      if (muteRole) await interaction.member.roles.remove(muteRole).catch(() => {});
      if (verRole) await interaction.member.roles.add(verRole).catch(() => {});
      await interaction.reply({ content: '✅ You have been verified! Welcome to the server.', ephemeral: true });
      return;
    }

    // Giveaway enter
    if (interaction.customId.startsWith('giveaway_enter_')) {
      const gId = interaction.customId.split('_')[2];
      const giveaway = db.get('SELECT * FROM giveaways WHERE id = ?', [gId]);
      if (!giveaway || giveaway.ended) return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });

      const entries = db.query('SELECT * FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?', [gId, interaction.user.id]);
      if (entries.length > 0) return interaction.reply({ content: 'You are already entered!', ephemeral: true });

      db.run('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)', [gId, interaction.user.id]);
      const count = db.get('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?', [gId]);
      await interaction.reply({ content: `🎉 You have entered the giveaway! Total entries: **${count.c}**`, ephemeral: true });
      return;
    }
  }
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');
const { COLORS, specialEmbed } = require('../utils/helpers');

async function openTicket(interaction, panelId, config, client) {
  await interaction.deferReply({ ephemeral: true });
  
  const panel = db.get('SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?', [panelId, interaction.guild.id]);
  if (!panel) return interaction.editReply({ content: 'Panel not found.' });

  const existing = db.get('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?',
    [interaction.guild.id, interaction.user.id, 'open']);
  if (existing) return interaction.editReply({ content: 'You already have an open ticket!' });

  const pingRoles = JSON.parse(panel.ping_roles || '[]');
  const pings = pingRoles.map(r => `<@&${r}>`).join(' ');

  // Create ticket channel
  const category = panel.ticket_category || config.ticket_category;
  const ch = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: 0,
    parent: category || null,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      ...pingRoles.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
    ],
  });

  const buttons = JSON.parse(panel.buttons || '[]');
  const result = db.run('INSERT INTO tickets (guild_id, channel_id, user_id, panel_id) VALUES (?, ?, ?, ?)',
    [interaction.guild.id, ch.id, interaction.user.id, panelId]);
  const ticketId = result.lastInsertRowid;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`claim_ticket_${ticketId}`).setLabel('🎫 Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`close_ticket_${ticketId}`).setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
  );

  const e = new EmbedBuilder()
    .setColor(panel.embed_color || COLORS.PURPLE)
    .setTitle(panel.embed_title || 'Support Ticket')
    .setDescription(panel.embed_description || 'A staff member will assist you shortly.')
    .addFields({ name: 'Ticket ID', value: `#${ticketId}`, inline: true })
    .setTimestamp();

  const mention = `<@${interaction.user.id}> ${pings}`;
  await ch.send({ content: mention, embeds: [e], components: [row] });
  await interaction.editReply({ content: `✅ Your ticket has been created: <#${ch.id}>` });
}

async function sendTicketPanel(channel, panel, guildId) {
  const buttons = JSON.parse(panel.buttons || '[]');
  const row = new ActionRowBuilder();
  
  if (buttons.length === 0) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`open_ticket_${panel.id}`).setLabel('📩 Open Ticket').setStyle(ButtonStyle.Primary)
    );
  } else {
    for (const btn of buttons.slice(0, 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`open_ticket_${panel.id}`)
          .setLabel(btn.label || 'Open Ticket')
          .setStyle(ButtonStyle[btn.style] || ButtonStyle.Primary)
      );
    }
  }

  const e = new EmbedBuilder()
    .setColor(panel.embed_color || '#8000FF')
    .setTitle(panel.embed_title)
    .setDescription(panel.embed_description)
    .setTimestamp();

  await channel.send({ embeds: [e], components: [row] });
}

module.exports = { openTicket, sendTicketPanel };

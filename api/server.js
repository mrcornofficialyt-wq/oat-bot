const express = require('express');
const cors = require('cors');
const db = require('../utils/database');
const { updateStatusEmbed } = require('../utils/botStatus');

function startApiServer(client) {
  const app = express();
  app.use(cors({ origin: process.env.DASHBOARD_URL || '*' }));
  app.use(express.json());

  // Simple auth middleware
  function auth(req, res, next) {
    const token = req.headers['x-dashboard-secret'];
    if (token !== process.env.DASHBOARD_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  // ── Guild info ──
  app.get('/api/guilds', auth, (req, res) => {
    const guilds = client.guilds.cache.map(g => ({
      id: g.id, name: g.name, icon: g.iconURL(), memberCount: g.memberCount
    }));
    res.json(guilds);
  });

  app.get('/api/guilds/:guildId', auth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const config = db.getGuildConfig(req.params.guildId);
    const channels = guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type }));
    const roles = guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    res.json({ guild: { id: guild.id, name: guild.name, icon: guild.iconURL(), memberCount: guild.memberCount }, config, channels, roles });
  });

  // ── Config update ──
  app.patch('/api/guilds/:guildId/config', auth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });
      db.updateGuildConfig(guildId, req.body);
      const config = db.getGuildConfig(guildId);
      // Update status embed in real-time
      if (config.bot_status_channel) {
        await updateStatusEmbed(guild, config, client).catch(() => {});
      }
      res.json({ success: true, config });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Mod logs ──
  app.get('/api/guilds/:guildId/modlogs', auth, (req, res) => {
    const { guildId } = req.params;
    const { user_id, action, from, to, limit = 50, offset = 0 } = req.query;
    const logs = db.getAllModLogs(guildId, parseInt(limit), parseInt(offset), { user_id, action, from: from ? parseInt(from) : null, to: to ? parseInt(to) : null });
    res.json(logs);
  });

  // ── Server stats ──
  app.get('/api/guilds/:guildId/stats', auth, (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const totalMessages = db.get('SELECT SUM(messages) as total FROM users WHERE guild_id = ?', [guildId]);
    const totalCommands = db.get('SELECT COUNT(*) as total FROM command_usage WHERE guild_id = ?', [guildId]);
    const topCommands = db.query('SELECT command, COUNT(*) as uses FROM command_usage WHERE guild_id = ? GROUP BY command ORDER BY uses DESC LIMIT 10', [guildId]);
    const topUsers = db.query('SELECT user_id, level, xp, messages FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT 10', [guildId]);
    const openTickets = db.get('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = ?', [guildId, 'open']);
    const totalWarnings = db.get('SELECT COUNT(*) as c FROM mod_logs WHERE guild_id = ? AND action = ?', [guildId, 'warn']);

    res.json({
      memberCount: guild.memberCount,
      onlineCount: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
      totalMessages: totalMessages?.total || 0,
      totalCommands: totalCommands?.total || 0,
      openTickets: openTickets?.c || 0,
      totalWarnings: totalWarnings?.c || 0,
      topCommands,
      topUsers,
      ping: client.ws.ping,
      uptime: process.uptime(),
    });
  });

  // ── Ticket panels ──
  app.get('/api/guilds/:guildId/ticket-panels', auth, (req, res) => {
    const panels = db.query('SELECT * FROM ticket_panels WHERE guild_id = ?', [req.params.guildId]);
    res.json(panels);
  });

  app.post('/api/guilds/:guildId/ticket-panels', auth, async (req, res) => {
    const { guildId } = req.params;
    const { name, embed_title, embed_description, embed_color, buttons, ping_roles, ticket_category, channel_id } = req.body;
    const id = `panel_${Date.now()}`;
    db.run('INSERT INTO ticket_panels (id, guild_id, name, embed_title, embed_description, embed_color, buttons, ping_roles, ticket_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, guildId, name, embed_title, embed_description, embed_color || '#8000FF', JSON.stringify(buttons || []), JSON.stringify(ping_roles || []), ticket_category || null]);

    // Send panel to channel if provided
    if (channel_id) {
      const guild = client.guilds.cache.get(guildId);
      const ch = guild?.channels.cache.get(channel_id);
      if (ch) {
        const panel = db.get('SELECT * FROM ticket_panels WHERE id = ?', [id]);
        const { sendTicketPanel } = require('../systems/tickets');
        await sendTicketPanel(ch, panel, guildId).catch(e => console.error(e));
      }
    }
    res.json({ success: true, id });
  });

  app.delete('/api/guilds/:guildId/ticket-panels/:panelId', auth, (req, res) => {
    db.run('DELETE FROM ticket_panels WHERE id = ? AND guild_id = ?', [req.params.panelId, req.params.guildId]);
    res.json({ success: true });
  });

  // ── Custom commands ──
  app.get('/api/guilds/:guildId/custom-commands', auth, (req, res) => {
    const config = db.getGuildConfig(req.params.guildId);
    res.json(Array.isArray(config.custom_commands) ? config.custom_commands : JSON.parse(config.custom_commands || '[]'));
  });

  // ── Message logs ──
  app.get('/api/guilds/:guildId/message-logs', auth, (req, res) => {
    const { guildId } = req.params;
    const { user_id, action, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM message_logs WHERE guild_id = ?';
    const params = [guildId];
    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (action) { query += ' AND action = ?'; params.push(action); }
    query += ' ORDER BY logged_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    res.json(db.query(query, params));
  });

  // ── Leaderboard ──
  app.get('/api/guilds/:guildId/leaderboard', auth, (req, res) => {
    const users = db.query('SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT 50', [req.params.guildId]);
    res.json(users);
  });

  // ── Send bot action (announce, etc.) ──
  app.post('/api/guilds/:guildId/action', auth, async (req, res) => {
    const { guildId } = req.params;
    const { type, channel_id, message, embed_color } = req.body;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const ch = guild.channels.cache.get(channel_id);
    if (!ch) return res.status(404).json({ error: 'Channel not found' });
    if (type === 'message') await ch.send(message);
    if (type === 'embed') {
      const { EmbedBuilder } = require('discord.js');
      await ch.send({ embeds: [new EmbedBuilder().setColor(embed_color || '#0099FF').setDescription(message).setTimestamp()] });
    }
    res.json({ success: true });
  });

  // ── Force status refresh ──
  app.post('/api/guilds/:guildId/refresh-status', auth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const config = db.getGuildConfig(req.params.guildId);
    await updateStatusEmbed(guild, config, client).catch(() => {});
    res.json({ success: true });
  });

  const port = process.env.API_PORT || 3001;
  app.listen(port, () => console.log(`✅ API server running on port ${port}`));
}

module.exports = { startApiServer };

const db = require('../utils/database');
const { warnEmbed } = require('../utils/helpers');

const spamMap = new Map();

async function process(message, config, client) {
  if (!message.member) return false;
  
  // Trusted roles bypass
  const modRoles = Array.isArray(config.mod_roles) ? config.mod_roles : JSON.parse(config.mod_roles || '[]');
  const adminRoles = Array.isArray(config.admin_roles) ? config.admin_roles : JSON.parse(config.admin_roles || '[]');
  const bypassRoles = [...modRoles, ...adminRoles];
  if (message.member.roles.cache.some(r => bypassRoles.includes(r.id))) return false;
  if (message.member.permissions.has(8n)) return false;

  const content = message.content;

  // 1. Bad word filter
  const bannedWords = Array.isArray(config.banned_words) ? config.banned_words : JSON.parse(config.banned_words || '[]');
  for (const word of bannedWords) {
    if (content.toLowerCase().includes(word.toLowerCase())) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({ embeds: [warnEmbed('⚠️ Bad Word', `<@${message.author.id}>, that word is not allowed here.`)] });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      if (config.automod_action === 'warn') {
        db.addModLog(message.guild.id, message.author.id, client.user.id, 'warn', 'AutoMod: Bad word usage');
      }
      return true;
    }
  }

  // 2. Caps filter
  if (config.caps_filter === 1 && content.length > 10) {
    const caps = (content.match(/[A-Z]/g) || []).length;
    if (caps / content.length > 0.7) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({ embeds: [warnEmbed('⚠️ Excessive Caps', `<@${message.author.id}>, please don't use excessive capitals.`)] });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      return true;
    }
  }

  // 3. Spam detection
  if (config.spam_detection === 1) {
    const key = `${message.guild.id}_${message.author.id}`;
    const now = Date.now();
    if (!spamMap.has(key)) spamMap.set(key, []);
    const times = spamMap.get(key).filter(t => now - t < 5000);
    times.push(now);
    spamMap.set(key, times);
    if (times.length >= 5) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({ embeds: [warnEmbed('⚠️ Spam Detected', `<@${message.author.id}>, please slow down!`)] });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      // Timeout user
      try {
        await message.member.timeout(10000, 'AutoMod: Spam');
      } catch (e) {}
      spamMap.set(key, []);
      return true;
    }
  }

  // 4. Link filter
  if (config.link_filter === 1) {
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const inviteRegex = /discord(?:\.gg|app\.com\/invite)\/[^\s]+/gi;
    const whitelist = Array.isArray(config.link_whitelist) ? config.link_whitelist : JSON.parse(config.link_whitelist || '[]');
    
    const links = content.match(linkRegex) || [];
    for (const link of links) {
      const isWhitelisted = whitelist.some(w => link.includes(w));
      if (!isWhitelisted) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send({ embeds: [warnEmbed('⚠️ Link Blocked', `<@${message.author.id}>, links are not allowed here.`)] });
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return true;
      }
    }
    
    if (config.invite_filter === 1 && inviteRegex.test(content)) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({ embeds: [warnEmbed('⚠️ Invite Blocked', `<@${message.author.id}>, Discord invites are not allowed here.`)] });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      return true;
    }
  }

  // AI moderation (if limited mode enabled with openai)
  if (process.env.OPENAI_API_KEY && config.automod_status === 1 && content.length > 20) {
    // Basic AI check in background - don't block message
    checkAiModeration(message, content, config, client).catch(() => {});
  }

  return false;
}

async function checkAiModeration(message, content, config, client) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.moderations.create({ input: content });
    const result = res.results[0];
    if (result.flagged) {
      await message.delete().catch(() => {});
      const ch = message.channel;
      const warn = await ch.send({ embeds: [require('../utils/helpers').warnEmbed('⚠️ AI Moderation', `<@${message.author.id}>, your message was flagged by our AI moderation system.`)] });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
    }
  } catch (e) {}
}

module.exports = { process };

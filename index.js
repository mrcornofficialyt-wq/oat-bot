require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const db = require('./utils/database');
const { startApiServer } = require('./api/server');
const { startStatusRotation } = require('./utils/statusRotation');
const { startSchedulers } = require('./utils/schedulers');

// ── Global crash guards (MUST be first) ────────────────────────────────────
// Without these, any unhandled promise rejection kills the process on Railway.
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  // Don't exit — keep the bot alive
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Don't exit — keep the bot alive
});

// Ensure data directory exists
fs.ensureDirSync(path.join(__dirname, 'data'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Load all command modules
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, 'commands', folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    try {
      const cmds = require(path.join(folderPath, file));
      for (const [name, command] of Object.entries(cmds)) {
        if (command && command.name) {
          client.commands.set(command.name, command);
        }
      }
    } catch (e) {
      console.error(`Failed to load command file ${file}:`, e.message);
    }
  }
}

// Load all event handlers
const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  try {
    const event = require(path.join(__dirname, 'events', file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client).catch(e => {
        console.error(`[Event error: ${event.name}]`, e.message);
      }));
    }
  } catch (e) {
    console.error(`Failed to load event file ${file}:`, e.message);
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  try {
    await db.initialize();
  } catch (e) {
    console.error('DB initialization failed:', e.message);
    // Don't crash — bot can still function without DB for basic things
  }

  try { startStatusRotation(client); } catch (e) { console.error('Status rotation failed:', e.message); }
  try { startApiServer(client); } catch (e) { console.error('API server failed:', e.message); }
  try { startSchedulers(client); } catch (e) { console.error('Schedulers failed:', e.message); }

  try {
    const { initBotStatusChannels } = require('./utils/botStatus');
    await initBotStatusChannels(client);
  } catch (e) {
    console.error('Bot status channels failed:', e.message);
  }
});

// Handle Discord client errors without crashing
client.on('error', (err) => {
  console.error('[Discord client error]', err.message);
});

client.on('warn', (info) => {
  console.warn('[Discord warning]', info);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err.message);
  // On a hard login failure, exit so Railway restarts us cleanly
  process.exit(1);
});

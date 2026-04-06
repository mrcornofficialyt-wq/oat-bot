require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const db = require('./utils/database');
const { startApiServer } = require('./api/server');
const { startStatusRotation } = require('./utils/statusRotation');
const { startSchedulers } = require('./utils/schedulers');

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
    const cmds = require(path.join(folderPath, file));
    // Each file exports multiple named commands
    for (const [name, command] of Object.entries(cmds)) {
      if (command && command.name) {
        client.commands.set(command.name, command);
      }
    }
  }
}

// Load all event handlers
const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(__dirname, 'events', file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  await db.initialize();
  startStatusRotation(client);
  startApiServer(client);
  startSchedulers(client);

  // Initialize bot status channels
  const { initBotStatusChannels } = require('./utils/botStatus');
  await initBotStatusChannels(client);
});

client.login(process.env.DISCORD_TOKEN);

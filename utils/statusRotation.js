const { ActivityType } = require('discord.js');

const statuses = [
  (client) => ({ name: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} users`, type: ActivityType.Watching }),
  () => ({ name: 'Use ?help', type: ActivityType.Playing }),
  (client) => ({ name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching }),
  () => ({ name: '?rank | ?leaderboard', type: ActivityType.Playing }),
  () => ({ name: 'Making servers great', type: ActivityType.Playing }),
];

let index = 0;

function startStatusRotation(client) {
  function rotate() {
    const s = statuses[index % statuses.length](client);
    client.user.setActivity(s.name, { type: s.type });
    index++;
  }
  rotate();
  setInterval(rotate, 30000);
}

module.exports = { startStatusRotation };

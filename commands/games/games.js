const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed, specialEmbed, tempReply, COLORS } = require('../../utils/helpers');

const tictactoe = {
  name: 'tictactoe',
  cooldown: 10,
  async execute(message, args, client, config) {
    if (config.games_status === 0) return tempReply(message, errorEmbed('❌ Disabled', 'Games are currently disabled.'));
    const opponent = message.mentions.members.first();
    if (!opponent || opponent.id === message.author.id) return tempReply(message, errorEmbed('❌ Error', 'Please mention a valid opponent.'));

    const board = Array(9).fill(null);
    const players = [message.author.id, opponent.id];
    let currentTurn = 0;
    const symbols = ['❌', '⭕'];

    function getRow(b) {
      return [0, 1, 2].map(row =>
        new ActionRowBuilder().addComponents(
          [0, 1, 2].map(col => {
            const idx = row * 3 + col;
            return new ButtonBuilder()
              .setCustomId(`ttt_${idx}`)
              .setLabel(b[idx] || '\u200b')
              .setStyle(b[idx] === '❌' ? ButtonStyle.Danger : b[idx] === '⭕' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setDisabled(b[idx] !== null);
          })
        )
      );
    }

    function checkWinner(b) {
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const [a, bIdx, c] of wins) if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
      if (b.every(x => x)) return 'tie';
      return null;
    }

    const e = new EmbedBuilder().setColor(COLORS.PURPLE).setTitle('🎮 Tic Tac Toe')
      .setDescription(`<@${players[currentTurn]}>'s turn (${symbols[currentTurn]})`);
    const msg = await message.channel.send({ embeds: [e], components: getRow(board) });

    const collector = msg.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== players[currentTurn]) {
        return i.reply({ content: 'It\'s not your turn!', ephemeral: true });
      }
      const idx = parseInt(i.customId.split('_')[1]);
      board[idx] = symbols[currentTurn];
      const winner = checkWinner(board);
      currentTurn = 1 - currentTurn;

      if (winner) {
        collector.stop();
        const desc = winner === 'tie' ? "It's a tie!" : `<@${players[symbols.indexOf(winner)]}> wins! 🎉`;
        await i.update({ embeds: [new EmbedBuilder().setColor(winner === 'tie' ? COLORS.YELLOW : COLORS.GREEN).setTitle('🎮 Tic Tac Toe').setDescription(desc)], components: getRow(board) });
      } else {
        await i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PURPLE).setTitle('🎮 Tic Tac Toe').setDescription(`<@${players[currentTurn]}>'s turn (${symbols[currentTurn]})`)], components: getRow(board) });
      }
    });
    collector.on('end', (_, reason) => {
      if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
    });
  }
};

const rps = {
  name: 'rps',
  cooldown: 5,
  async execute(message, args, client, config) {
    if (config.games_status === 0) return tempReply(message, errorEmbed('❌ Disabled', 'Games are currently disabled.'));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary),
    );
    const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.PURPLE).setTitle('🎮 Rock Paper Scissors').setDescription('Choose your move!')], components: [row] });
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 30000, max: 1 });
    collector.on('collect', async (i) => {
      const choices = ['rock', 'paper', 'scissors'];
      const botChoice = choices[Math.floor(Math.random() * 3)];
      const userChoice = i.customId.split('_')[1];
      let result;
      if (userChoice === botChoice) result = "It's a tie! 🤝";
      else if ((userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper'))
        result = 'You win! 🎉';
      else result = 'Bot wins! 🤖';
      await i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PURPLE).setTitle('🎮 Rock Paper Scissors').addFields({ name: 'You', value: userChoice, inline: true }, { name: 'Bot', value: botChoice, inline: true }, { name: 'Result', value: result })], components: [] });
    });
  }
};

const triviaQuestions = [
  { q: 'What is the capital of Australia?', a: 'canberra', opts: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'] },
  { q: 'How many sides does a hexagon have?', a: '6', opts: ['5', '6', '7', '8'] },
  { q: 'What is the largest planet?', a: 'jupiter', opts: ['Saturn', 'Jupiter', 'Neptune', 'Uranus'] },
  { q: 'What color is a ruby?', a: 'red', opts: ['Blue', 'Green', 'Red', 'Purple'] },
  { q: 'How many continents are there?', a: '7', opts: ['5', '6', '7', '8'] },
  { q: 'What gas do plants absorb?', a: 'co2', opts: ['Oxygen', 'CO2', 'Nitrogen', 'Helium'] },
  { q: 'What is 8 x 8?', a: '64', opts: ['56', '64', '72', '48'] },
  { q: 'Who wrote Romeo and Juliet?', a: 'shakespeare', opts: ['Dickens', 'Austen', 'Shakespeare', 'Poe'] },
];

const trivia = {
  name: 'trivia',
  cooldown: 15,
  async execute(message, args, client, config) {
    if (config.games_status === 0) return tempReply(message, errorEmbed('❌ Disabled', 'Games are currently disabled.'));
    const q = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    const row = new ActionRowBuilder().addComponents(
      q.opts.map((opt, i) =>
        new ButtonBuilder().setCustomId(`trivia_${opt.toLowerCase()}_${q.a}`).setLabel(opt).setStyle(ButtonStyle.Secondary)
      )
    );
    const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.BLUE).setTitle('🧠 Trivia').setDescription(`**${q.q}**`)], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 20000, max: 1 });
    collector.on('collect', async (i) => {
      const [, chosen, answer] = i.customId.split('_');
      const correct = chosen === answer;
      if (correct) {
        const user = db.getUser(message.guild.id, i.user.id);
        db.updateUser(message.guild.id, i.user.id, { economy_balance: user.economy_balance + 50 });
      }
      await i.update({ embeds: [new EmbedBuilder().setColor(correct ? COLORS.GREEN : COLORS.RED).setTitle('🧠 Trivia').setDescription(`**${q.q}**\n\n${correct ? '✅ Correct!' : `❌ Wrong! The answer was **${q.opts.find(o => o.toLowerCase() === answer)}**`}${correct ? '\n+50 coins!' : ''}`)], components: [] });
    });
  }
};

// Economy
const daily = {
  name: 'daily',
  cooldown: 0,
  async execute(message, args, client, config) {
    if (config.economy_status === 0) return tempReply(message, errorEmbed('❌ Disabled', 'Economy is disabled.'));
    const user = db.getUser(message.guild.id, message.author.id);
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (now - user.last_daily < cooldown) {
      const remaining = cooldown - (now - user.last_daily);
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      return tempReply(message, errorEmbed('⏱ Cooldown', `Come back in ${hours}h ${mins}m for your daily reward.`));
    }
    const streak = (now - user.last_daily < 2 * cooldown) ? user.daily_streak + 1 : 1;
    const reward = 100 + (streak - 1) * 10;
    db.updateUser(message.guild.id, message.author.id, {
      economy_balance: user.economy_balance + reward,
      daily_streak: streak,
      last_daily: now
    });
    await message.channel.send({ embeds: [successEmbed('💰 Daily Reward', `You claimed your daily reward of **${reward}** coins!\n🔥 Streak: ${streak} days`)] });
  }
};

const balance = {
  name: 'balance',
  cooldown: 5,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first() || message.member;
    const user = db.getUser(message.guild.id, target.id);
    await message.channel.send({ embeds: [infoEmbed('💰 Balance', `<@${target.id}> has **${user.economy_balance}** coins.`)] });
  }
};

const pay = {
  name: 'pay',
  cooldown: 10,
  async execute(message, args, client, config) {
    const target = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return tempReply(message, errorEmbed('❌ Error', 'Usage: ?pay @user <amount>'));
    const sender = db.getUser(message.guild.id, message.author.id);
    if (sender.economy_balance < amount) return tempReply(message, errorEmbed('❌ Insufficient Funds', `You only have ${sender.economy_balance} coins.`));
    const receiver = db.getUser(message.guild.id, target.id);
    db.updateUser(message.guild.id, message.author.id, { economy_balance: sender.economy_balance - amount });
    db.updateUser(message.guild.id, target.id, { economy_balance: receiver.economy_balance + amount });
    await message.channel.send({ embeds: [successEmbed('💸 Payment', `<@${message.author.id}> sent **${amount}** coins to <@${target.id}>.`)] });
  }
};

module.exports = { tictactoe, rps, trivia, daily, balance, pay };

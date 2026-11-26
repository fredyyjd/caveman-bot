const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const PICK_TIMEOUT_MS = 30 * 1000;
const FLIP_DELAY_MS = 1800;

function findEmoji(client, exactNames, looseName) {
  const all = client.emojis.cache;
  for (const name of exactNames) {
    const found = all.find((e) => e.name === name);
    if (found) return found;
  }
  return all.find((e) => e.name.toLowerCase().includes(looseName)) || null;
}

function getEmojis(client) {
  const heads = findEmoji(client, ['heads1', 'heads'], 'heads');
  const tails = findEmoji(client, ['tails1', 'tails'], 'tails');
  const spin = findEmoji(client, ['goldenspincoin', 'spincoin'], 'spin');
  return {
    heads: { text: heads ? heads.toString() : '🪙', button: heads ? { id: heads.id, name: heads.name, animated: heads.animated } : '🪙' },
    tails: { text: tails ? tails.toString() : '🪙', button: tails ? { id: tails.id, name: tails.name, animated: tails.animated } : '🪙' },
    spin: spin ? spin.toString() : '🪙',
  };
}

function pickEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Coin Flip')
    .setDescription('Pick a side');
}

function flippingEmbed(emojis) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Coin Flip')
    .setDescription(`${emojis.spin} Flipping...`);
}

function resultEmbed(emojis, choice, outcome, username) {
  const outcomeMention = outcome === 'heads' ? emojis.heads.text : emojis.tails.text;
  const won = choice === outcome;
  return new EmbedBuilder()
    .setColor(won ? 0x2ecc71 : 0xe74c3c)
    .setTitle('Coin Flip')
    .setDescription(`${outcomeMention} It's **${outcome}**`)
    .setFooter({ text: won ? `${username} guessed right` : `${username} guessed wrong` });
}

function expiredEmbed() {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('Coin Flip')
    .setDescription("Didn't pick in time.");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin'),

  async execute(interaction) {
    const user = interaction.user;
    const emojis = getEmojis(interaction.client);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('coin_heads')
        .setLabel('Heads')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.heads.button),
      new ButtonBuilder()
        .setCustomId('coin_tails')
        .setLabel('Tails')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.tails.button),
    );

    const message = await interaction.reply({
      embeds: [pickEmbed()],
      components: [row],
      fetchReply: true,
    });

    let responded = false;

    const collector = message.createMessageComponentCollector({
      time: PICK_TIMEOUT_MS,
      max: 1,
      filter: (i) => i.customId === 'coin_heads' || i.customId === 'coin_tails',
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== user.id) {
        return i.reply({ content: "This isn't your coin flip.", ephemeral: true });
      }

      responded = true;
      const choice = i.customId === 'coin_heads' ? 'heads' : 'tails';

      await i.update({
        embeds: [flippingEmbed(emojis)],
        components: [],
      });

      await new Promise((resolve) => setTimeout(resolve, FLIP_DELAY_MS));

      const outcome = Math.random() < 0.5 ? 'heads' : 'tails';

      await message.edit({
        embeds: [resultEmbed(emojis, choice, outcome, user.username)],
      }).catch((err) => console.error('[coinflip] result edit failed:', err));
    });

    collector.on('end', async () => {
      if (!responded) {
        await message.edit({
          embeds: [expiredEmbed()],
          components: [],
        }).catch((err) => console.error('[coinflip] expired edit failed:', err));
      }
    });
  },
};

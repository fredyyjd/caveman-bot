const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const createStore = require('../utils/jsonStore');

const votes = createStore('legit.json', {});

async function handleLegitButton(interaction) {
  const choice = interaction.customId === 'legit_yes' ? 'yes' : 'no';
  const userId = interaction.user.id;

  if (votes.get(userId) === choice) {
    return interaction.reply({ content: `You already voted ${choice}.`, ephemeral: true });
  }

  votes.set(userId, choice);

  if (choice === 'yes') {
    const sent = await interaction.user
      .send('Thank you for voting yes <3')
      .then(() => true)
      .catch(() => false);

    return interaction.reply({
      content: sent
        ? 'Thanks for voting! Check your DMs <3'
        : 'Thank you for voting yes <3',
      ephemeral: true,
    });
  }

  const supportChannelId = (config.legit || {}).supportChannelId;
  const supportLine = supportChannelId
    ? `Open a support ticket at <#${supportChannelId}>.`
    : 'Open a support ticket.';

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(
      [
        'You voted **no** for **are we legit**.',
        'You have **24h** to provide proof or you will be **banned**.',
        '',
        supportLine,
      ].join('\n')
    );

  return interaction.reply({
    content: `${interaction.user}`,
    embeds: [embed],
    allowedMentions: { users: [userId] },
  });
}

module.exports = { handleLegitButton };

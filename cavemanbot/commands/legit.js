const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getEmojis, buildEmbed } = require('../utils/legitPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('legit')
    .setDescription('Legit vote tools')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('panel').setDescription('Post the are we legit panel')),

  async execute(interaction) {
    const { tick, cross } = getEmojis(interaction.client);

    const message = await interaction.channel.send({
      embeds: [buildEmbed(interaction.client, 0, 0)],
    });

    await message.react(tick.react).catch((err) => console.error('[legit] react failed:', err.message));
    await message.react(cross.react).catch((err) => console.error('[legit] react failed:', err.message));

    return interaction.reply({ content: 'Legit panel posted.', ephemeral: true });
  },
};

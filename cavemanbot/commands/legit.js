const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { resolveEmoji } = require('../utils/findEmoji');

function panelContent(client) {
  const tick = resolveEmoji(client, ['Tick234234', 'tick', 'yes'], 'tick', '✅');
  const cross = resolveEmoji(client, ['Cross', 'cross', 'x'], 'cross', '❌');

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Are we legit?')
    .setDescription(
      [
        `Vote ${tick.text} if we are.`,
        `Vote ${cross.text} if we aren't.`,
        '',
        `**Warning:** voting ${cross.text} without showing us proof nor providing it will result in a ban.`,
      ].join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('legit_yes').setStyle(ButtonStyle.Success).setEmoji(tick.button),
    new ButtonBuilder().setCustomId('legit_no').setStyle(ButtonStyle.Danger).setEmoji(cross.button)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('legit')
    .setDescription('Legit vote tools')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('panel').setDescription('Post the are we legit panel')),

  async execute(interaction) {
    await interaction.channel.send(panelContent(interaction.client));
    return interaction.reply({ content: 'Legit panel posted.', ephemeral: true });
  },
};

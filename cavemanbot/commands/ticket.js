const { SlashCommandBuilder } = require('discord.js');
const { closeChannel, renameChannel, addUserToTicket } = require('../utils/ticketActions');

// /ticket close — closes the current ticket/application channel.
// /ticket rename <name> — renames it.
// /ticket add <user> — adds a user to it.
// All three just call straight into utils/ticketActions.js, same as the
// button versions of these actions.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage tickets')
    .addSubcommand((sub) =>
      sub.setName('close').setDescription('Close a ticket')
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename a ticket')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('New channel name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user to a ticket')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to add to this ticket').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'close') {
      return closeChannel(interaction);
    }

    if (sub === 'rename') {
      const newName = interaction.options.getString('name');
      return renameChannel(interaction, newName);
    }

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      return addUserToTicket(interaction, user);
    }
  },
};

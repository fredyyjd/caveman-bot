const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const COLOR = 0x5865f2;
const TIMEOUT_MS = 3 * 60 * 1000;
const LOCK = '🔒';

const CATEGORIES = [
  {
    icon: '🎫',
    name: 'Tickets & Builds',
    intro: 'Open, manage and finish tickets and builds.',
    commands: [
      { cmd: '/ticket close', desc: 'Close the ticket or application you are in.', staff: true },
      { cmd: '/ticket rename', args: 'name', desc: 'Rename the current ticket.', staff: true },
      { cmd: '/ticket add', args: 'user', desc: 'Add someone to the current ticket.', staff: true },
      { cmd: '/payment-ticket', desc: 'Move a service ticket to the payment category.', staff: true },
      { cmd: '/build-finish', desc: 'Ask the customer to confirm their build is done.', staff: true },
      { cmd: '/build-leaderboard', desc: 'See how many builds each builder finished.', staff: true },
      { cmd: '/ticket-panel', desc: 'Post the ticket panel in this channel.', staff: true },
      { cmd: '/service-panel', desc: 'Post the services panel in this channel.', staff: true },
      { cmd: '/application-panel', desc: 'Post the staff and builder applications panel.', staff: true },
    ],
  },
  {
    icon: '🎉',
    name: 'Giveaways',
    intro: 'Run giveaways and pick winners.',
    commands: [
      { cmd: '/gcreate', args: 'prize duration', desc: 'Start a giveaway. Optional winners, description and channel.', staff: true },
      { cmd: '/gend', args: 'message_id', desc: 'End a giveaway right now and pick the winners.', staff: true },
      { cmd: '/greroll', args: 'message_id', desc: 'Pick new winners for a giveaway that ended.', staff: true },
    ],
  },
  {
    icon: '📈',
    name: 'Levels & Leaderboards',
    intro: 'XP, levels and rankings.',
    commands: [
      { cmd: '/level rank', args: 'user', desc: 'Show your level and XP, or someone else’s.' },
      { cmd: '/level leaderboard', args: 'page', desc: 'See the top members by level.' },
      { cmd: '/xp-add', args: 'user amount type', desc: 'Give someone XP or levels.', staff: true },
      { cmd: '/xp-remove', args: 'user amount type', desc: 'Take XP or levels from someone.', staff: true },
      { cmd: '/point-leaderboard', desc: 'Show ticket points for everyone with a chosen role.', staff: true },
      { cmd: '/staff-leaderboard', desc: 'Show the staff leaderboard.', staff: true },
    ],
  },
  {
    icon: '⭐',
    name: 'Vouches & Scammers',
    intro: 'Build trust and flag scammers.',
    commands: [
      { cmd: '/vouch', args: 'user', desc: 'Vouch for someone. You can add a comment.' },
      { cmd: '/vouchsee', args: 'user', desc: 'See the vouches someone has.' },
      { cmd: '/vouch-leaderboard', desc: 'See who has the most vouches.' },
      { cmd: '/vouch-send', args: 'user', desc: 'Ask someone to vouch for you.', staff: true },
      { cmd: '/staff-vouch-leaderboard', desc: 'Vouches and scam reports for every user.', staff: true },
      { cmd: '/scam-vouch add', args: 'user', desc: 'Mark a user as a scammer and give them the scammer role.', staff: true },
      { cmd: '/scam-vouch remove', args: 'user', desc: 'Remove the scammer mark from a user.', staff: true },
    ],
  },
  {
    icon: '🎮',
    name: 'Games & Fun',
    intro: 'Quick games to play in chat.',
    commands: [
      { cmd: '/coinflip', desc: 'Pick heads or tails and flip a coin.' },
      { cmd: '/tictactoe', args: 'user', desc: 'Challenge someone to tic tac toe.' },
      { cmd: '/guessthenumber', desc: 'Guess the number the bot is thinking of.' },
      { cmd: '/groupguess', desc: 'Start a number guessing game everyone can join.' },
    ],
  },
  {
    icon: '🧰',
    name: 'Utility',
    intro: 'Handy commands for everyone.',
    commands: [
      { cmd: '/afk', args: 'reason', desc: 'Set yourself as AFK. The bot tells people who ping you.' },
      { cmd: '/membercount', desc: 'Show how many members the server has.' },
      { cmd: '/serverinfo', desc: 'Show information about the server.' },
      { cmd: '/help', desc: 'Open this menu. You can also type !help.' },
    ],
  },
  {
    icon: '🛠️',
    name: 'Admin Tools',
    intro: 'Server setup and moderation.',
    commands: [
      { cmd: '/embed', desc: 'Post a custom embed with your own title, text, color and images.', staff: true },
      { cmd: '/purge', args: 'amount', desc: 'Delete up to 100 recent messages in this channel.', staff: true },
      { cmd: '/sticky-roles', args: 'user', desc: 'Keep someone’s roles if they leave and rejoin.', staff: true },
      { cmd: '/reaction-roles-panel', desc: 'Post the reaction roles panel in this channel.', staff: true },
      { cmd: '/helper guide', desc: 'Post the helper guide.', staff: true },
      { cmd: '/builder guide', desc: 'Post the builder guide.', staff: true },
      { cmd: '/guide config', desc: 'Edit the text of the helper and builder guides.', staff: true },
    ],
  },
];

const TOTAL_PAGES = CATEGORIES.length + 1;

function homeEmbed(client) {
  const lines = CATEGORIES.map(
    (c, i) => `**${i + 2}.** ${c.icon} **${c.name}**\n-# ${c.intro}`
  );

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('📖 Help Menu')
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
      [
        'Here is everything this bot can do. Use the arrows below to flip through the pages.',
        '',
        lines.join('\n\n'),
        '',
        `${LOCK} next to a command means it is for staff only.`,
      ].join('\n')
    )
    .setFooter({ text: `Page 1/${TOTAL_PAGES} • Type !help or /help anytime` });
}

function categoryEmbed(client, categoryIndex) {
  const category = CATEGORIES[categoryIndex];
  const body = category.commands.map((c) => {
    const args = c.args ? ` ${c.args.split(' ').map((a) => `\`${a}\``).join(' ')}` : '';
    const lock = c.staff ? ` ${LOCK}` : '';
    return `**${c.cmd}**${args}${lock}\n-# ${c.desc}`;
  });

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${category.icon} ${category.name}`)
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription([`*${category.intro}*`, '', body.join('\n\n')].join('\n'))
    .setFooter({ text: `Page ${categoryIndex + 2}/${TOTAL_PAGES} • ${LOCK} = staff only` });
}

function buildEmbed(client, page) {
  return page === 0 ? homeEmbed(client) : categoryEmbed(client, page - 1);
}

function buildRow(page, disableAll = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_back')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll || page === 0),
    new ButtonBuilder()
      .setCustomId('help_page')
      .setLabel(`${page + 1} / ${TOTAL_PAGES}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll || page === TOTAL_PAGES - 1)
  );
}

function attachPaging(sentMessage, ownerId, client) {
  let page = 0;

  const collector = sentMessage.createMessageComponentCollector({
    time: TIMEOUT_MS,
    filter: (i) => i.customId === 'help_back' || i.customId === 'help_next',
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== ownerId) {
      return i.reply({ content: 'Run /help or !help to open your own menu.', ephemeral: true });
    }

    page = i.customId === 'help_next' ? Math.min(page + 1, TOTAL_PAGES - 1) : Math.max(page - 1, 0);

    await i.update({
      embeds: [buildEmbed(client, page)],
      components: [buildRow(page)],
    });
  });

  collector.on('end', async () => {
    await sentMessage
      .edit({ components: [buildRow(page, true)] })
      .catch(() => {});
  });
}

async function handleHelpMessage(message) {
  if (message.author.bot || !message.guild) return;
  if (message.content.trim().toLowerCase() !== '!help') return;

  const sent = await message.reply({
    embeds: [buildEmbed(message.client, 0)],
    components: [buildRow(0)],
    allowedMentions: { repliedUser: false },
  });

  attachPaging(sent, message.author.id, message.client);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all commands')
    .setDMPermission(false),

  async execute(interaction) {
    const sent = await interaction.reply({
      embeds: [buildEmbed(interaction.client, 0)],
      components: [buildRow(0)],
      fetchReply: true,
    });

    attachPaging(sent, interaction.user.id, interaction.client);
  },

  handleHelpMessage,
};

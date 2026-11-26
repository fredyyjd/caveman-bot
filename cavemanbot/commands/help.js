const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const COLOR = 0x5865f2;
const TIMEOUT_MS = 3 * 60 * 1000;

const WHO = {
  everyone: '🟢 Everyone',
  staff: '🔒 Staff only',
  staffManage: '🔒 Staff or Manage Server',
  manage: '🔒 Manage Server only',
  admin: '👑 Admins only',
};

const CATEGORIES = [
  {
    icon: '🎫',
    name: 'Tickets & Builds',
    intro: 'Open, manage and finish tickets and builds.',
    commands: [
      { cmd: '/ticket-panel', desc: 'Posts the ticket panel in this channel.', who: 'manage' },
      { cmd: '/service-panel', desc: 'Posts the services ticket panel in this channel.', who: 'manage' },
      { cmd: '/application-panel', desc: 'Posts the staff and builder applications panel.', who: 'manage' },
      { cmd: '/ticket close', desc: 'Closes the ticket or application you are in.', who: 'staff' },
      { cmd: '/ticket rename', args: 'name', desc: 'Renames the current ticket.', who: 'staff' },
      { cmd: '/ticket add', args: 'user', desc: 'Adds someone to the current ticket.', who: 'staff' },
      { cmd: '/payment-ticket', desc: 'Moves a service ticket to the payment category.', who: 'staff' },
      { cmd: '/build-finish', desc: 'Asks the customer to confirm their build is done.', who: 'staff' },
      { cmd: '/build-leaderboard', desc: 'Shows how many builds each builder finished.', who: 'staff' },
    ],
  },
  {
    icon: '🎉',
    name: 'Giveaways',
    intro: 'Run giveaways and pick winners.',
    commands: [
      { cmd: '/gcreate', args: 'prize duration', desc: 'Starts a giveaway. You can also set winners, description and channel.', who: 'staffManage' },
      { cmd: '/gend', args: 'message_id', desc: 'Ends a giveaway right now and picks the winners.', who: 'staffManage' },
      { cmd: '/greroll', args: 'message_id', desc: 'Picks new winners for a giveaway that ended.', who: 'staffManage' },
    ],
  },
  {
    icon: '📈',
    name: 'Levels & Leaderboards',
    intro: 'XP, levels and rankings.',
    commands: [
      { cmd: '/level rank', args: 'user', desc: 'Shows your level and XP, or someone else’s.', who: 'everyone' },
      { cmd: '/level leaderboard', args: 'page', desc: 'Shows the top members by level.', who: 'everyone' },
      { cmd: '/xp-add', args: 'user amount type', desc: 'Gives someone XP or levels.', who: 'admin' },
      { cmd: '/xp-remove', args: 'user amount type', desc: 'Takes XP or levels from someone.', who: 'staff' },
      { cmd: '/point-leaderboard', desc: 'Shows ticket points for everyone with a chosen role.', who: 'staff' },
      { cmd: '/staff-leaderboard', desc: 'Shows the staff leaderboard.', who: 'staff' },
    ],
  },
  {
    icon: '⭐',
    name: 'Vouches & Scammers',
    intro: 'Build trust and flag scammers.',
    commands: [
      { cmd: '/vouch', args: 'user', desc: 'Vouches for someone. You can add a comment.', who: 'everyone' },
      { cmd: '/vouchsee', args: 'user', desc: 'Shows the vouches someone has.', who: 'everyone' },
      { cmd: '/vouch-leaderboard', desc: 'Shows who has the most vouches.', who: 'everyone' },
      { cmd: '/vouch-send', args: 'user', desc: 'Asks someone to vouch for you.', who: 'staff' },
      { cmd: '/staff-vouch-leaderboard', desc: 'Shows vouches and scam reports for every user.', who: 'staff' },
      { cmd: '/scam-vouch add', args: 'user', desc: 'Marks a user as a scammer and gives them the scammer role.', who: 'staff' },
      { cmd: '/scam-vouch remove', args: 'user', desc: 'Removes the scammer mark from a user.', who: 'staff' },
    ],
  },
  {
    icon: '🎮',
    name: 'Games & Fun',
    intro: 'Quick games to play in chat.',
    commands: [
      { cmd: '/coinflip', desc: 'Flips a coin after you pick heads or tails.', who: 'everyone' },
      { cmd: '/tictactoe', args: 'user', desc: 'Challenges someone to tic tac toe.', who: 'everyone' },
      { cmd: '/guessthenumber', desc: 'Starts a number guessing game just for you.', who: 'everyone' },
      { cmd: '/groupguess', desc: 'Starts a number guessing game everyone can join.', who: 'everyone' },
    ],
  },
  {
    icon: '🧰',
    name: 'Utility',
    intro: 'Handy commands for everyone.',
    commands: [
      { cmd: '/afk', args: 'reason', desc: 'Sets you as AFK. The bot tells people who ping you.', who: 'everyone' },
      { cmd: '/membercount', desc: 'Shows how many members the server has.', who: 'everyone' },
      { cmd: '/serverinfo', desc: 'Shows information about the server.', who: 'everyone' },
      { cmd: '/cavehelp', desc: 'Opens this menu. You can also type !cavehelp.', who: 'everyone' },
    ],
  },
  {
    icon: '🛠️',
    name: 'Admin Tools',
    intro: 'Server setup and moderation.',
    commands: [
      { cmd: '/embed', desc: 'Posts a custom embed with your own title, text, color and images.', who: 'admin' },
      { cmd: '/purge', args: 'amount', desc: 'Deletes up to 100 recent messages in this channel.', who: 'admin' },
      { cmd: '/sticky-roles', args: 'user', desc: 'Keeps someone’s roles if they leave and rejoin.', who: 'admin' },
      { cmd: '/reaction-roles-panel', desc: 'Posts the reaction roles panel in this channel.', who: 'manage' },
      { cmd: '/helper guide', desc: 'Posts the helper guide.', who: 'admin' },
      { cmd: '/builder guide', desc: 'Posts the builder guide.', who: 'admin' },
      { cmd: '/guide config', desc: 'Edits the text of the helper and builder guides.', who: 'admin' },
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
        `Every command shows who can use it:\n${WHO.everyone}  ${WHO.staff}  ${WHO.manage}  ${WHO.admin}`,
      ].join('\n')
    )
    .setFooter({ text: `Page 1/${TOTAL_PAGES} • Type !cavehelp anytime` });
}

function categoryEmbed(client, categoryIndex) {
  const category = CATEGORIES[categoryIndex];
  const body = category.commands.map((c) => {
    const args = c.args ? ` ${c.args.split(' ').map((a) => `\`${a}\``).join(' ')}` : '';
    return `**${c.cmd}**${args}\n${c.desc}\n-# ${WHO[c.who]}`;
  });

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${category.icon} ${category.name}`)
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription([`*${category.intro}*`, '', body.join('\n\n')].join('\n'))
    .setFooter({ text: `Page ${categoryIndex + 2}/${TOTAL_PAGES} • Type !cavehelp anytime` });
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
      return i.reply({ content: 'Run /cavehelp or !cavehelp to open your own menu.', ephemeral: true });
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
  if (message.content.trim().toLowerCase() !== '!cavehelp') return;

  const sent = await message.reply({
    embeds: [buildEmbed(message.client, 0)],
    components: [buildRow(0)],
    allowedMentions: { repliedUser: false },
  });

  attachPaging(sent, message.author.id, message.client);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cavehelp')
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

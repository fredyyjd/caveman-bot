const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const createStore = require('../utils/jsonStore');
const { TITLE, getEmojis, buildEmbed } = require('../utils/legitPanel');

// userId -> { channelId, messageId } of the "you voted no" warning
const notices = createStore('legit-notices.json', {});

async function loadPanel(reaction) {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch {
    return null;
  }

  const message = reaction.message;
  const client = message.client;
  if (!message.guild) return null;
  if (!message.author || message.author.id !== client.user.id) return null;
  const embed = message.embeds[0];
  if (!embed || embed.title !== TITLE) return null;

  // Strip the old vote counter from panels posted before it was removed.
  if (embed.fields && embed.fields.length) {
    message.edit({ embeds: [buildEmbed(client)] }).catch(() => {});
  }

  return message;
}

function reactionKey(emoji) {
  return emoji.id || emoji.name;
}

async function deleteNotice(client, userId) {
  const notice = notices.get(userId);
  if (!notice) return;
  notices.delete(userId);

  try {
    const channel = await client.channels.fetch(notice.channelId);
    await channel.messages.delete(notice.messageId);
  } catch {
    // already deleted or no access
  }
}

async function handleLegitReactionAdd(reaction, user) {
  if (user.bot) return;

  const message = await loadPanel(reaction);
  if (!message) return;

  const { tick, cross } = getEmojis(message.client);
  const key = reactionKey(reaction.emoji);

  if (key !== tick.key && key !== cross.key) {
    await reaction.users.remove(user.id).catch(() => {});
    return;
  }

  if (key === tick.key) {
    await user.send('Thank you for voting yes <3').catch(() => {});
    return;
  }

  // Voted no. Voting yes first does not cancel it - only removing the no vote does.
  if (notices.get(user.id)) return;

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
        '',
        '-# voted by mistake just remove the vote !',
      ].join('\n')
    );

  // Uses the existing support ticket flow (same handler as the ticket panel).
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open_support')
      .setLabel('Open a ticket')
      .setStyle(ButtonStyle.Secondary)
  );

  const sent = await message.channel
    .send({
      content: `<@${user.id}>`,
      embeds: [embed],
      components: [row],
      allowedMentions: { users: [user.id] },
    })
    .catch((err) => {
      console.error('[legit] could not post no vote:', err.message);
      return null;
    });

  if (sent) notices.set(user.id, { channelId: sent.channel.id, messageId: sent.id });
}

async function handleLegitReactionRemove(reaction, user) {
  if (user.bot) return;

  const message = await loadPanel(reaction);
  if (!message) return;

  const { cross } = getEmojis(message.client);
  if (reactionKey(reaction.emoji) !== cross.key) return;

  // No vote removed -> delete the warning, no ban.
  await deleteNotice(message.client, user.id);
}

module.exports = { handleLegitReactionAdd, handleLegitReactionRemove };

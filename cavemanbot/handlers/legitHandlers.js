const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const createStore = require('../utils/jsonStore');
const { TITLE, getEmojis, buildEmbed } = require('../utils/legitPanel');

const votes = createStore('legit.json', {});

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

  return message;
}

function reactionKey(emoji) {
  return emoji.id || emoji.name;
}

async function refreshCounts(message) {
  const fresh = await message.fetch();
  const { tick, cross } = getEmojis(fresh.client);

  const count = (key) => {
    const r = fresh.reactions.cache.find((x) => reactionKey(x.emoji) === key);
    if (!r) return 0;
    return Math.max(0, r.count - (r.me ? 1 : 0));
  };

  await fresh
    .edit({ embeds: [buildEmbed(fresh.client, count(tick.key), count(cross.key))] })
    .catch((err) => console.error('[legit] edit failed:', err.message));
}

async function handleLegitReactionAdd(reaction, user) {
  if (user.bot) return;

  const message = await loadPanel(reaction);
  if (!message) return;

  const { tick, cross } = getEmojis(message.client);
  const key = reactionKey(reaction.emoji);

  let choice = null;
  let otherKey = null;
  if (key === tick.key) {
    choice = 'yes';
    otherKey = cross.key;
  } else if (key === cross.key) {
    choice = 'no';
    otherKey = tick.key;
  }

  if (!choice) {
    await reaction.users.remove(user.id).catch(() => {});
    return;
  }

  const other = message.reactions.cache.find((r) => reactionKey(r.emoji) === otherKey);
  if (other) await other.users.remove(user.id).catch(() => {});

  const previous = votes.get(user.id);
  if (previous !== choice) {
    votes.set(user.id, choice);

    if (choice === 'yes') {
      await user.send('Thank you for voting yes <3').catch(() => {});
    } else {
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

      await message.channel
        .send({
          content: `<@${user.id}>`,
          embeds: [embed],
          allowedMentions: { users: [user.id] },
        })
        .catch((err) => console.error('[legit] could not post no vote:', err.message));
    }
  }

  await refreshCounts(message);
}

async function handleLegitReactionRemove(reaction, user) {
  if (user.bot) return;

  const message = await loadPanel(reaction);
  if (!message) return;

  await refreshCounts(message);
}

module.exports = { handleLegitReactionAdd, handleLegitReactionRemove };

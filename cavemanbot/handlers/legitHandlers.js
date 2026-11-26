const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const createStore = require('../utils/jsonStore');
const { TITLE, getEmojis, buildEmbed } = require('../utils/legitPanel');

const BAN_AFTER_MS = 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 1000;

// panelMessageId -> { channelId, messageId, voters: { userId: timestamp } }
// One shared warning message per panel; it mentions everyone who currently has a no vote.
const notices = createStore('legit-notices.json', {});

// Runs tasks for the same panel one at a time, so fast vote/unvote clicks
// can't overlap (send + delete racing each other).
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  next
    .catch(() => {})
    .then(() => {
      if (locks.get(key) === next) locks.delete(key);
    });
  return next;
}

function reactionKey(emoji) {
  return emoji.id || emoji.name;
}

async function loadPanel(reaction) {
  // Do NOT bail if the reaction itself can't be fetched: when the last
  // reaction of an emoji is removed it no longer exists on the message.
  if (reaction.partial) await reaction.fetch().catch(() => {});
  try {
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

function buildNotice(voterIds) {
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

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open_support')
      .setLabel('Open a ticket')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: voterIds.map((id) => `<@${id}>`).join(' '),
    embeds: [embed],
    components: [row],
    allowedMentions: { users: voterIds },
  };
}

async function fetchNoticeMessage(client, entry) {
  try {
    const channel = await client.channels.fetch(entry.channelId);
    return await channel.messages.fetch(entry.messageId);
  } catch {
    return null;
  }
}

function addVoter(panelMessage, userId) {
  return withLock(panelMessage.id, () => addVoterNow(panelMessage, userId));
}

async function addVoterNow(panelMessage, userId) {
  const client = panelMessage.client;
  const entry = notices.get(panelMessage.id) || {
    channelId: panelMessage.channel.id,
    messageId: null,
    voters: {},
  };

  entry.voters[userId] = Date.now();

  // Drop anyone listed who no longer actually has the no reaction (stale entries),
  // so they don't get mentioned.
  try {
    const fresh = await panelMessage.fetch();
    const { cross } = getEmojis(client);
    const crossReaction = fresh.reactions.cache.find((r) => reactionKey(r.emoji) === cross.key);
    const users = crossReaction ? await crossReaction.users.fetch() : null;
    const current = new Set(users ? users.keys() : []);
    current.add(userId);
    for (const id of Object.keys(entry.voters)) {
      if (!current.has(id)) delete entry.voters[id];
    }
  } catch (err) {
    console.error('[legit] could not verify voters:', err.message);
  }

  const ids = Object.keys(entry.voters);

  const existing = entry.messageId ? await fetchNoticeMessage(client, entry) : null;
  if (existing) {
    await existing.edit(buildNotice(ids)).catch((err) => console.error('[legit] edit notice failed:', err.message));
  } else {
    const sent = await panelMessage.channel
      .send(buildNotice(ids))
      .catch((err) => {
        console.error('[legit] could not post no vote:', err.message);
        return null;
      });
    if (sent) entry.messageId = sent.id;
  }

  notices.set(panelMessage.id, entry);
}

function removeVoter(client, panelId, userId, onlyIfAt) {
  return withLock(panelId, () => removeVoterNow(client, panelId, userId, onlyIfAt));
}

async function removeVoterNow(client, panelId, userId, onlyIfAt) {
  const entry = notices.get(panelId);
  if (!entry || !entry.voters[userId]) return;
  // Timer checks pass the timestamp they saw; if the user re-voted since, leave them.
  if (onlyIfAt && entry.voters[userId] !== onlyIfAt) return;

  delete entry.voters[userId];
  const ids = Object.keys(entry.voters);
  const msg = await fetchNoticeMessage(client, entry);

  if (!ids.length) {
    notices.delete(panelId);
    if (msg) await msg.delete().catch(() => {});
    return;
  }

  notices.set(panelId, entry);
  if (msg) await msg.edit(buildNotice(ids)).catch(() => {});
}

async function handleLegitReactionAdd(reaction, user) {
  if (user.bot) return;

  const message = await loadPanel(reaction);
  if (!message) return;
  startLegitTimer(message.client);

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

  await addVoter(message, user.id);
}

async function handleLegitReactionRemove(reaction, user) {
  if (user.bot) return;

  const message = await loadPanel(reaction);
  if (!message) return;
  startLegitTimer(message.client);

  const { cross } = getEmojis(message.client);
  if (reactionKey(reaction.emoji) !== cross.key) return;

  // No vote removed -> take them off the warning (deleted if nobody is left). No ban.
  await removeVoter(message.client, message.id, user.id);
}

// Runs every minute: drops people who removed their no vote (even if the event
// was missed, e.g. while the bot was offline) and bans anyone still voting no
// after 24h.
async function checkNotices(client) {
  const { cross } = getEmojis(client);
  const all = notices.all();

  for (const [panelId, entry] of Object.entries(all)) {
    if (!entry || !entry.voters) {
      notices.delete(panelId); // leftover from an older version of the bot
      continue;
    }

    let panel;
    try {
      const channel = await client.channels.fetch(entry.channelId);
      panel = await channel.messages.fetch(panelId);
    } catch {
      continue; // panel gone or no access - leave it alone
    }

    const reaction = panel.reactions.cache.find((r) => reactionKey(r.emoji) === cross.key);
    let stillVoting = new Set();
    if (reaction) {
      const users = await reaction.users.fetch().catch(() => null);
      if (!users) continue;
      stillVoting = new Set(users.keys());
    }

    for (const [userId, at] of Object.entries(entry.voters)) {
      if (!stillVoting.has(userId)) {
        await removeVoter(client, panelId, userId, at);
        continue;
      }

      if (Date.now() - at >= BAN_AFTER_MS) {
        const guild = panel.guild;
        const banned = await guild.members
          .ban(userId, { reason: 'Voted no on "Are we legit?" and gave no proof within 24h' })
          .then(() => true)
          .catch((err) => {
            console.error(`[legit] could not ban ${userId}:`, err.message);
            return false;
          });

        if (banned) console.log(`[legit] banned ${userId} (no vote, 24h passed)`);
        if (reaction) await reaction.users.remove(userId).catch(() => {});
        await removeVoter(client, panelId, userId, at);
      }
    }
  }
}

let timer = null;
function startLegitTimer(client) {
  if (timer) return;
  timer = setInterval(() => {
    checkNotices(client).catch((err) => console.error('[legit] check failed:', err));
  }, CHECK_EVERY_MS);
}

module.exports = { handleLegitReactionAdd, handleLegitReactionRemove, startLegitTimer };

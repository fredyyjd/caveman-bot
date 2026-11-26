const { EmbedBuilder } = require('discord.js');
const { resolveEmoji } = require('./findEmoji');

const TITLE = 'Are we legit?';

function getEmojis(client) {
  return {
    tick: resolveEmoji(client, ['Tick234234', 'tick', 'yes'], 'tick', '✅'),
    cross: resolveEmoji(client, ['Cross', 'cross', 'x'], 'cross', '❌'),
  };
}

function buildEmbed(client) {
  const { tick, cross } = getEmojis(client);

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(TITLE)
    .setDescription(
      [
        `Vote ${tick.text} if we are.`,
        `Vote ${cross.text} if we aren't.`,
        '',
        `**Warning:** voting ${cross.text} without showing us proof nor providing it will result in a ban.`,
      ].join('\n')
    );
}

module.exports = { TITLE, getEmojis, buildEmbed };

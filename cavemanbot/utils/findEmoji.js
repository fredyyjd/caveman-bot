function findEmoji(client, exactNames, looseName) {
  const all = client.emojis.cache;
  for (const name of exactNames) {
    const found = all.find((e) => e.name === name);
    if (found) return found;
  }
  return all.find((e) => e.name.toLowerCase().includes(looseName)) || null;
}

function resolveEmoji(client, exactNames, looseName, fallback) {
  const emoji = findEmoji(client, exactNames, looseName);
  if (!emoji) return { text: fallback, react: fallback, key: fallback };
  return { text: emoji.toString(), react: emoji, key: emoji.id };
}

module.exports = { findEmoji, resolveEmoji };

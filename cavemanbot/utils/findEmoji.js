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
  if (!emoji) return { text: fallback, button: fallback };
  return {
    text: emoji.toString(),
    button: { id: emoji.id, name: emoji.name, animated: emoji.animated },
  };
}

module.exports = { findEmoji, resolveEmoji };

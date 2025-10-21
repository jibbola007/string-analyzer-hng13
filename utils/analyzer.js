const crypto = require("crypto");

function analyzeString(value) {
  const cleaned = value.toLowerCase().replace(/\s+/g, '');
  const reversed = cleaned.split('').reverse().join('');

  const properties = {
    length: value.length,
    is_palindrome: cleaned === reversed,
    unique_characters: new Set(value).size,
    word_count: value.trim().split(/\s+/).length,
    sha256_hash: crypto.createHash("sha256").update(value).digest("hex"),
    character_frequency_map: {}
  };

  for (let char of value) {
    properties.character_frequency_map[char] =
      (properties.character_frequency_map[char] || 0) + 1;
  }

  return properties;
}

module.exports = analyzeString;

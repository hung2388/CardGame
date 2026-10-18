const crypto = require('crypto');

/**
 * Fisher-Yates shuffle using cryptographically secure random numbers
 * @param {Array} array 
 * @returns {Array} Shuffled shallow copy
 */
function cryptoShuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    // Generate secure random integer in [0, i]
    const j = crypto.randomInt(0, i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Pick a random integer in range [min, max] inclusive
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function secureRandomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

module.exports = {
  cryptoShuffle,
  secureRandomInt
};

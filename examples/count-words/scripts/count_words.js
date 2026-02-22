/**
 * Count the number of words in a text string.
 *
 * @param {object} args
 * @param {string} args.text - The text to count words in
 * @param {string} [args.__workDir] - Working directory (injected by runtime)
 * @returns {Promise<{count: number}>}
 */
export default async function handler(args) {
  const { text } = args;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return { count: words.length };
}

/**
 * In-House Natural Language Processing (NLP) Service
 * 
 * Features:
 * - Text normalization and tokenization
 * - English stop-words filtering
 * - Porter Stemming algorithm for morphological reduction (e.g. "archiving" -> "archiv")
 * - Sublinear TF-IDF / Term-Weight Vectorization with L2-normalization
 * - Cosine Similarity search matching
 * - 100% Pure JavaScript (Zero native C++ bindings, zero external API or network dependencies)
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours'
]);

/**
 * Porter Stemmer implementation for English word normalization
 */
function porterStem(w) {
  let word = w.toLowerCase();
  if (word.length < 3) return word;

  // Step 1a: plurals and third person singular
  if (word.endsWith('sses')) word = word.slice(0, -2);
  else if (word.endsWith('ies')) word = word.slice(0, -2);
  else if (!word.endsWith('ss') && word.endsWith('s')) word = word.slice(0, -1);

  // Step 1b: past tense and progressive
  if (word.endsWith('eed')) {
    if (word.length > 4) word = word.slice(0, -1);
  } else if (word.endsWith('ed') && /[aeiou]/.test(word.slice(0, -2))) {
    word = word.slice(0, -2);
    if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) word += 'e';
    else if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/.test(word)) word = word.slice(0, -1);
  } else if (word.endsWith('ing') && /[aeiou]/.test(word.slice(0, -3))) {
    word = word.slice(0, -3);
    if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) word += 'e';
    else if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/.test(word)) word = word.slice(0, -1);
  }

  // Step 1c: y -> i
  if (word.endsWith('y') && /[aeiou]/.test(word.slice(0, -1))) {
    word = word.slice(0, -1) + 'i';
  }

  // Step 2 & 3: standard derivational suffixes
  const suffixes = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
    ['ical', 'ic'], ['ful', ''], ['ness', ''], ['ment', ''], ['able', ''], ['ible', '']
  ];

  for (const [sfx, rep] of suffixes) {
    if (word.endsWith(sfx) && word.length - sfx.length >= 3) {
      word = word.slice(0, -sfx.length) + rep;
      break;
    }
  }

  return word;
}

class NLPService {
  /**
   * Tokenizes, filters stopwords, stems and normalizes input text into a weighted vector map.
   * @param {string|{title?: string, abstract?: string, keywords?: string}} input 
   * @returns {Promise<Record<string, number>|null>}
   */
  static async getEmbedding(input) {
    if (!input) return null;

    let tokensWithWeights = [];

    if (typeof input === 'object') {
      // Apply field-based weighting
      if (input.title) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.title, 3.0));
      }
      if (input.keywords) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.keywords, 2.5));
      }
      if (input.abstract) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.abstract, 1.0));
      }
    } else {
      tokensWithWeights = this.extractWeightedTokens(String(input), 1.0);
    }

    if (tokensWithWeights.length === 0) return null;

    const tfMap = {};
    for (const { stem, weight } of tokensWithWeights) {
      tfMap[stem] = (tfMap[stem] || 0) + weight;
    }

    // Sublinear term frequency scaling & L2 unit normalization
    let sumSq = 0;
    for (const k in tfMap) {
      tfMap[k] = 1 + Math.log(tfMap[k]);
      sumSq += tfMap[k] * tfMap[k];
    }

    const norm = Math.sqrt(sumSq);
    if (norm === 0) return null;

    const vector = {};
    for (const k in tfMap) {
      vector[k] = Number((tfMap[k] / norm).toFixed(4));
    }

    return vector;
  }

  /**
   * Helper to extract stems with weight multiplier
   */
  static extractWeightedTokens(text, multiplier = 1.0) {
    if (!text || typeof text !== 'string') return [];
    const rawTokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);

    const results = [];
    for (const token of rawTokens) {
      if (!STOP_WORDS.has(token)) {
        const stem = porterStem(token);
        results.push({ stem, weight: multiplier });
      }
    }
    return results;
  }

  /**
   * Computes Cosine Similarity between query vector and document vector.
   * Returns a score from 0.0 to 1.0.
   * @param {Record<string, number>} vec1 
   * @param {Record<string, number>} vec2 
   * @returns {number}
   */
  static calculateSimilarity(vec1, vec2) {
    if (!vec1 || !vec2) return 0;
    
    // Support if vec2 was stored as dense array or object
    if (Array.isArray(vec1) && Array.isArray(vec2)) {
      // fallback for dense vectors if any exist
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < vec1.length; i++) {
        dot += vec1[i] * vec2[i];
        normA += vec1[i] * vec1[i];
        normB += vec2[i] * vec2[i];
      }
      return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    }

    if (typeof vec1 !== 'object' || typeof vec2 !== 'object') return 0;

    let score = 0;
    for (const stem in vec1) {
      if (vec2[stem]) {
        score += vec1[stem] * vec2[stem];
      }
    }

    return Math.min(1, Math.max(0, score));
  }
}

module.exports = NLPService;

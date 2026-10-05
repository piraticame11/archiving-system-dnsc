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
   * Supports scanning whole document content alongside title, abstract, keywords, and authors.
   * @param {string|{title?: string, abstract?: string, keywords?: string, authors?: string, adviser?: string, content?: string}} input 
   * @param {number} [maxTerms=1500] - Max unique terms to keep in vector for efficiency
   * @returns {Promise<Record<string, number>|null>}
   */
  static async getEmbedding(input, maxTerms = 1500) {
    if (!input) return null;

    let tokensWithWeights = [];

    if (typeof input === 'object') {
      // Apply field-based weighting
      if (input.title) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.title, 4.0));
      }
      if (input.keywords) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.keywords, 3.5));
      }
      if (input.abstract) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.abstract, 2.0));
      }
      if (input.authors) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.authors, 2.0));
      }
      if (input.adviser) {
        tokensWithWeights.push(...this.extractWeightedTokens(input.adviser, 1.5));
      }
      if (input.content) {
        // Scanned document whole content
        tokensWithWeights.push(...this.extractWeightedTokens(input.content, 1.0));
      }
    } else {
      tokensWithWeights = this.extractWeightedTokens(String(input), 1.0);
    }

    if (tokensWithWeights.length === 0) return null;

    const tfMap = {};
    for (const { stem, weight } of tokensWithWeights) {
      tfMap[stem] = (tfMap[stem] || 0) + weight;
    }

    // Sublinear term frequency scaling
    let scoredTerms = Object.keys(tfMap).map(k => {
      const val = 1 + Math.log(tfMap[k]);
      return { stem: k, val };
    });

    // Prune to top N terms if larger than maxTerms to keep JSON compact and focused
    if (scoredTerms.length > maxTerms) {
      scoredTerms.sort((a, b) => b.val - a.val);
      scoredTerms = scoredTerms.slice(0, maxTerms);
    }

    // L2 unit normalization
    let sumSq = 0;
    for (const item of scoredTerms) {
      sumSq += item.val * item.val;
    }

    const norm = Math.sqrt(sumSq);
    if (norm === 0) return null;

    const vector = {};
    for (const item of scoredTerms) {
      vector[item.stem] = Number((item.val / norm).toFixed(4));
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

  /**
   * Computes a hybrid relevance score combining semantic AI similarity and exact/partial
   * keyword matching across title, authors, adviser, keywords, abstract, and scanned content.
   * @param {string} search - Raw search string
   * @param {object} candidate - { title, authors, adviser, keywords, abstract, content_text, embedding }
   * @param {Record<string, number>|null} queryVector 
   * @returns {{ score: number, semanticScore: number, keywordScore: number, matchReason: string }}
   */
  static evaluateRelevance(search, candidate, queryVector) {
    const rawQuery = (search || '').trim().toLowerCase();
    if (!rawQuery) {
      return { score: 1.0, semanticScore: 1.0, keywordScore: 1.0, matchReason: 'all' };
    }

    let parsedEmbedding = candidate.embedding;
    if (typeof parsedEmbedding === 'string') {
      try { parsedEmbedding = JSON.parse(parsedEmbedding); } catch (e) { parsedEmbedding = null; }
    }

    // 1. Semantic AI Similarity
    let semanticScore = 0;
    if (parsedEmbedding && queryVector) {
      semanticScore = this.calculateSimilarity(queryVector, parsedEmbedding);
    }

    // 2. Keyword & Book Title Matching
    const queryTerms = rawQuery
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);

    const titleLower    = (candidate.title || '').toLowerCase();
    const authorsLower  = (candidate.authors || '').toLowerCase();
    const adviserLower  = (candidate.adviser || '').toLowerCase();
    const keywordsLower = (candidate.keywords || '').toLowerCase();
    const abstractLower = (candidate.abstract || '').toLowerCase();
    const contentLower  = (candidate.content_text || '').toLowerCase();

    let keywordScore = 0;
    let matchReasons = [];

    // Exact title / phrase matches
    if (titleLower.includes(rawQuery)) {
      keywordScore += 1.0;
      matchReasons.push('title_exact');
    }
    if (keywordsLower.includes(rawQuery)) {
      keywordScore += 0.8;
      matchReasons.push('keywords_exact');
    }
    if (authorsLower.includes(rawQuery) || adviserLower.includes(rawQuery)) {
      keywordScore += 0.8;
      matchReasons.push('author_exact');
    }
    if (abstractLower.includes(rawQuery)) {
      keywordScore += 0.6;
      matchReasons.push('abstract_exact');
    }
    if (contentLower.includes(rawQuery)) {
      keywordScore += 0.5;
      matchReasons.push('content_exact');
    }

    // Per-term matching across fields
    let matchedTermsCount = 0;
    for (const term of queryTerms) {
      let termMatched = false;
      if (titleLower.includes(term)) {
        keywordScore += 0.4;
        termMatched = true;
      }
      if (keywordsLower.includes(term)) {
        keywordScore += 0.3;
        termMatched = true;
      }
      if (authorsLower.includes(term) || adviserLower.includes(term)) {
        keywordScore += 0.25;
        termMatched = true;
      }
      if (abstractLower.includes(term)) {
        keywordScore += 0.2;
        termMatched = true;
      }
      if (contentLower.includes(term)) {
        keywordScore += 0.15;
        termMatched = true;
      }
      if (termMatched) matchedTermsCount++;
    }

    // Ratio of matched terms
    const termCoverageRatio = queryTerms.length > 0 ? (matchedTermsCount / queryTerms.length) : 0;
    if (termCoverageRatio === 1.0 && queryTerms.length > 1) {
      keywordScore += 0.5; // Bonus if every single query term appeared somewhere in the study/document
    }

    // 3. Composite Combined Score
    // Semantic score provides subtle conceptual correlation (0.0 to 1.0).
    // Keyword score provides strong factual grounding (0.0 to 2.5+).
    const score = (semanticScore * 0.4) + (keywordScore * 0.6);

    return {
      score,
      semanticScore,
      keywordScore,
      matchReason: matchReasons.join(',') || (matchedTermsCount > 0 ? 'terms' : (semanticScore > 0 ? 'semantic' : 'none'))
    };
  }
}

module.exports = NLPService;

const { pipeline, env } = require('@xenova/transformers');
const computeCosineSimilarity = require('compute-cosine-similarity');

// Don't search for local model files, download from HuggingFace
env.allowLocalModels = false;

class NLPService {
  static instance = null;

  /**
   * Lazy load the transformer model to avoid blocking on startup
   */
  static async getInstance() {
    if (this.instance === null) {
      console.log('Loading NLP model for semantic search...');
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Uses less memory and runs faster
      });
      console.log('NLP model loaded successfully.');
    }
    return this.instance;
  }

  /**
   * Generates a 384-dimensional vector embedding for the given text.
   * @param {string} text - The input text (e.g. title + abstract)
   * @returns {Promise<number[]>} - 384-dimensional dense vector
   */
  static async getEmbedding(text) {
    if (!text || text.trim() === '') return null;
    try {
      const extractor = await this.getInstance();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (err) {
      console.error('Error generating embedding:', err);
      return null;
    }
  }

  /**
   * Calculates the cosine similarity between two vector embeddings.
   * Returns a value between -1 and 1 (1 being exactly the same).
   * @param {number[]} vec1 
   * @param {number[]} vec2 
   * @returns {number}
   */
  static calculateSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) return 0;
    return computeCosineSimilarity(vec1, vec2) || 0;
  }
}

module.exports = NLPService;

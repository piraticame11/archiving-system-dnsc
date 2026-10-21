const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentExtractor {
  /**
   * Extracts clean text content from a PDF or DOCX file path.
   * @param {string} filePath 
   * @param {string} [mimeType] 
   * @returns {Promise<string>}
   */
  static async extractTextFromFile(filePath, mimeType = '') {
    if (!filePath) return '';

    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(absPath)) {
      console.warn(`[DocumentExtractor] File not found: ${absPath}`);
      return '';
    }

    const ext = path.extname(absPath).toLowerCase();
    let rawText = '';

    try {
      if (ext === '.pdf' || mimeType.includes('pdf')) {
        const fileBuffer = fs.readFileSync(absPath);
        const parser = new PDFParse({ data: fileBuffer });
        const textResult = await parser.getText();
        rawText = textResult?.text || '';
      } else if (ext === '.docx' || mimeType.includes('wordprocessingml') || mimeType.includes('docx')) {
        const result = await mammoth.extractRawText({ path: absPath });
        rawText = result?.value || '';
      } else {
        console.warn(`[DocumentExtractor] Unsupported file format for text extraction: ${ext || mimeType}`);
        return '';
      }
    } catch (err) {
      console.error(`[DocumentExtractor] Error extracting text from ${absPath}:`, err.message);
      return '';
    }

    return this.cleanExtractedText(rawText);
  }

  /**
   * Normalizes whitespace, removes control characters, and cleans extracted text.
   * @param {string} text 
   * @returns {string}
   */
  static cleanExtractedText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // control chars
      .replace(/[ \t]+/g, ' ')                           // collapse multiple spaces/tabs
      .replace(/\n\s*\n+/g, '\n\n')                      // collapse multiple empty lines
      .trim();
  }

  /**
   * Finds the most relevant snippet/excerpt in the document matching any of the query terms.
   * @param {string} text 
   * @param {string} query 
   * @param {number} [maxLen=220] 
   * @returns {string|null}
   */
  static extractSnippet(text, query, maxLen = 240) {
    if (!text || !query) return null;

    // Clean operators like author: or quotes
    const cleanedQuery = String(query)
      .replace(/\b(author|adviser|title):/gi, '')
      .replace(/["']/g, ' ')
      .trim();

    const normalizedQuery = cleanedQuery.toLowerCase();
    const queryTerms = normalizedQuery
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);

    if (queryTerms.length === 0) return null;

    const lowerText = text.toLowerCase();

    // 1. Try to find the full exact phrase first
    let matchIdx = lowerText.indexOf(normalizedQuery);

    // 2. If no exact phrase, find the position with the highest concentration of query terms
    if (matchIdx === -1) {
      const step = 60;
      let bestScore = -1;
      let bestIdx = -1;

      // Scan through text in chunks to find maximum term density
      for (let i = 0; i < lowerText.length; i += step) {
        const slice = lowerText.substring(i, i + maxLen);
        let score = 0;
        for (const term of queryTerms) {
          if (slice.includes(term)) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
        if (score === queryTerms.length) break; // found all terms
      }

      if (bestScore > 0 && bestIdx !== -1) {
        matchIdx = bestIdx;
      } else {
        // Fallback to first occurrence of any term
        for (const term of queryTerms) {
          const idx = lowerText.indexOf(term);
          if (idx !== -1 && (matchIdx === -1 || idx < matchIdx)) {
            matchIdx = idx;
          }
        }
      }
    }

    if (matchIdx === -1) return null;

    // Center window around match
    const half = Math.floor(maxLen / 2);
    let start = Math.max(0, matchIdx - Math.floor(half * 0.4));
    let end = Math.min(text.length, start + maxLen);

    // Snap to nearest space if possible
    if (start > 0) {
      const spaceIdx = text.indexOf(' ', start);
      if (spaceIdx !== -1 && spaceIdx < start + 25) {
        start = spaceIdx + 1;
      }
    }
    if (end < text.length) {
      const spaceIdx = text.lastIndexOf(' ', end);
      if (spaceIdx !== -1 && spaceIdx > end - 25) {
        end = spaceIdx;
      }
    }

    let snippet = text.substring(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = '… ' + snippet;
    if (end < text.length) snippet = snippet + ' …';

    return snippet;
  }
}

module.exports = DocumentExtractor;

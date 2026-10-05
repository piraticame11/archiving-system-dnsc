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
  static extractSnippet(text, query, maxLen = 220) {
    if (!text || !query) return null;

    const normalizedQuery = query.toLowerCase().trim();
    const queryTerms = normalizedQuery
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);

    if (queryTerms.length === 0) return null;

    const lowerText = text.toLowerCase();

    // 1. Try to find the full exact phrase first
    let matchIdx = lowerText.indexOf(normalizedQuery);

    // 2. If not found, find the first occurrence of any query term
    if (matchIdx === -1) {
      for (const term of queryTerms) {
        const idx = lowerText.indexOf(term);
        if (idx !== -1 && (matchIdx === -1 || idx < matchIdx)) {
          matchIdx = idx;
        }
      }
    }

    if (matchIdx === -1) return null;

    // Center window around match
    const half = Math.floor(maxLen / 2);
    let start = Math.max(0, matchIdx - half);
    let end = Math.min(text.length, matchIdx + half);

    // Snap to nearest space if possible
    if (start > 0) {
      const spaceIdx = text.indexOf(' ', start);
      if (spaceIdx !== -1 && spaceIdx < start + 20) {
        start = spaceIdx + 1;
      }
    }
    if (end < text.length) {
      const spaceIdx = text.lastIndexOf(' ', end);
      if (spaceIdx !== -1 && spaceIdx > end - 20) {
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

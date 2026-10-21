const { parseSearchQuery } = require('../src/modules/archive/archive.service');
const DocumentExtractor = require('../src/utils/documentExtractor');

describe('Google Scholar-Style Archive Search & Indexing Suite', () => {
  describe('Query Syntax Parser', () => {
    test('extracts exact quoted phrases correctly', () => {
      const q = parseSearchQuery('deep learning "convolutional neural network" healthcare');
      expect(q.phrases).toContain('convolutional neural network');
      expect(q.terms).toContain('deep');
      expect(q.terms).toContain('learning');
      expect(q.terms).toContain('healthcare');
    });

    test('extracts author and adviser search operators', () => {
      const q = parseSearchQuery('author:"Santos, Maria" adviser:Reyes blockchain');
      expect(q.authorFilter).toBe('Santos, Maria');
      expect(q.adviserFilter).toBe('Reyes');
      expect(q.terms).toContain('blockchain');
    });

    test('extracts title filter operator', () => {
      const q = parseSearchQuery('title:"IoT Aquaculture" water sensor');
      expect(q.titleFilter).toBe('IoT Aquaculture');
      expect(q.terms).toContain('water');
      expect(q.terms).toContain('sensor');
    });

    test('gracefully handles empty or blank queries', () => {
      const q = parseSearchQuery('');
      expect(q.terms.length).toBe(0);
      expect(q.phrases.length).toBe(0);
      expect(q.authorFilter).toBeNull();
    });
  });

  describe('High-Density Snippet Extraction', () => {
    test('finds the excerpt with highest keyword concentration', () => {
      const fullText = `
        Chapter 1 introduces the history of computing. Many machines were built in the 1950s.
        Chapter 2 discusses early database management systems and indexing methodologies.
        Chapter 3 focuses on deep learning and neural network architectures for cardiovascular arrhythmia detection.
        Chapter 4 discusses future work and general conclusions.
      `;

      const snippet = DocumentExtractor.extractSnippet(fullText, 'neural network cardiovascular arrhythmia', 150);
      expect(snippet).toBeTruthy();
      expect(snippet.toLowerCase()).toContain('cardiovascular arrhythmia');
      expect(snippet.toLowerCase()).toContain('neural network');
    });

    test('ignores query operators when extracting snippet', () => {
      const fullText = 'The authors proposed an intelligent irrigation system for local smart farming.';
      const snippet = DocumentExtractor.extractSnippet(fullText, 'author:Santos "intelligent irrigation"', 100);
      expect(snippet).toBeTruthy();
      expect(snippet.toLowerCase()).toContain('intelligent irrigation');
    });
  });
});

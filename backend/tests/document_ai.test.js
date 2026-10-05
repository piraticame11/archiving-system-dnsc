const DocumentExtractor = require('../src/utils/documentExtractor');
const NLPService = require('../src/utils/nlp');

describe('Document AI & Search Matching Suite', () => {
  test('DocumentExtractor cleans text and extracts snippet properly', () => {
    const rawText = '   First Chapter\r\n\r\nIntroduction to Artificial Intelligence and Machine Learning in modern research.   \n\n\nSection 2   ';
    const cleaned = DocumentExtractor.cleanExtractedText(rawText);
    expect(cleaned).toContain('Introduction to Artificial Intelligence and Machine Learning');
    expect(cleaned).not.toContain('\r');

    const snippet = DocumentExtractor.extractSnippet(cleaned, 'Machine Learning', 60);
    expect(snippet).toBeTruthy();
    expect(snippet.toLowerCase()).toContain('machine learning');
  });

  test('NLPService extracts weighted stems and handles whole document content', async () => {
    const embedding = await NLPService.getEmbedding({
      title: 'Neural Networks in Medical Diagnostic Systems',
      keywords: 'deep learning, cardiology, classification',
      content: 'A comprehensive study on cardiovascular arrhythmia detection using ECG signal processing and deep convolutional neural networks.'
    });

    expect(embedding).toBeTruthy();
    expect(typeof embedding).toBe('object');
    // Check stemmed words
    expect(embedding['neural']).toBeGreaterThan(0);
    expect(embedding['cardiovascular']).toBeGreaterThan(0);
  });

  test('NLPService evaluates relevance combining semantic similarity and keyword correlation', async () => {
    const candidate = {
      title: 'Neural Network Algorithm and Analysis for Multi-Label ECG Data Classification',
      authors: 'Ana Reyes',
      adviser: 'Maria Santos',
      keywords: 'machine learning, cardiology, neural network',
      abstract: 'Cardiovascular disease detection using multi-label classification.',
      content_text: 'The proposed deep neural network architecture processes raw 12-lead ECG signals with high accuracy.',
      embedding: await NLPService.getEmbedding({
        title: 'Neural Network Algorithm and Analysis for Multi-Label ECG Data Classification',
        keywords: 'machine learning, cardiology, neural network',
        content: 'The proposed deep neural network architecture processes raw 12-lead ECG signals with high accuracy.'
      })
    };

    const queryVector = await NLPService.getEmbedding('ECG classification');
    const relevance = NLPService.evaluateRelevance('ECG classification', candidate, queryVector);

    expect(relevance.score).toBeGreaterThan(0.3);
    expect(relevance.semanticScore).toBeGreaterThan(0);
    expect(relevance.keywordScore).toBeGreaterThan(0);
  });

  test('Book title match yields highest priority ranking', async () => {
    const book1 = {
      title: 'Understanding and Implementing EIGRP for IPv4',
      authors: 'Ana Reyes',
      embedding: await NLPService.getEmbedding('Understanding and Implementing EIGRP for IPv4')
    };
    const book2 = {
      title: 'Deep Learning for Medical Signal Analysis',
      authors: 'Ana Reyes',
      embedding: await NLPService.getEmbedding('Deep Learning for Medical Signal Analysis')
    };

    const queryVector = await NLPService.getEmbedding('EIGRP for IPv4');
    const score1 = NLPService.evaluateRelevance('EIGRP for IPv4', book1, queryVector);
    const score2 = NLPService.evaluateRelevance('EIGRP for IPv4', book2, queryVector);

    expect(score1.score).toBeGreaterThan(score2.score);
  });
});

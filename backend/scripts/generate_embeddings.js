const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const db = require('../src/config/database');
const NLPService = require('../src/utils/nlp');
const DocumentExtractor = require('../src/utils/documentExtractor');

async function run() {
  const forceAll = process.argv.includes('--all') || process.argv.includes('--force');
  console.log('Connecting to database...');

  const query = forceAll
    ? `SELECT a.id, a.title, a.abstract, a.keywords, a.authors, a.adviser, a.content_text,
              sd.file_path, sd.file_name, sd.mime_type
       FROM archive a
       LEFT JOIN submission_documents sd ON a.document_id = sd.id`
    : `SELECT a.id, a.title, a.abstract, a.keywords, a.authors, a.adviser, a.content_text,
              sd.file_path, sd.file_name, sd.mime_type
       FROM archive a
       LEFT JOIN submission_documents sd ON a.document_id = sd.id
       WHERE a.embedding IS NULL OR a.content_text IS NULL`;

  const [rows] = await db.query(query);
  console.log(`Found ${rows.length} archive entries to process${forceAll ? ' (--force flag active)' : ''}.`);

  if (rows.length === 0) {
    console.log('All archives already have scanned document content and embeddings. Use --force to re-scan.');
    process.exit(0);
  }

  console.log('Scanning document contents and generating AI embeddings...');
  let count = 0;
  for (const row of rows) {
    try {
      let documentContent = row.content_text;

      // Scan document from disk if missing or if forced
      if (!documentContent && row.file_path) {
        console.log(`[ID ${row.id}] Scanning document file: ${row.file_name || row.file_path}...`);
        documentContent = await DocumentExtractor.extractTextFromFile(row.file_path, row.mime_type);
        if (documentContent) {
          console.log(`[ID ${row.id}] Successfully extracted ${documentContent.length} characters.`);
          await db.query('UPDATE archive SET content_text = ? WHERE id = ?', [documentContent, row.id]);
        } else {
          console.warn(`[ID ${row.id}] Warning: No text extracted from document file.`);
        }
      }

      // Generate comprehensive embedding
      const embedding = await NLPService.getEmbedding({
        title: row.title,
        abstract: row.abstract,
        keywords: row.keywords,
        authors: row.authors,
        adviser: row.adviser,
        content: documentContent || '',
      });

      if (embedding) {
        await db.query('UPDATE archive SET embedding = ? WHERE id = ?', [JSON.stringify(embedding), row.id]);
        count++;
        console.log(`[ID ${row.id}] Generated embedding with ${Object.keys(embedding).length} unique vocabulary terms.`);
      }
    } catch (e) {
      console.error(`Failed to process archive ID ${row.id}:`, e.message);
    }
  }

  console.log(`\nSuccessfully processed and indexed ${count} / ${rows.length} archives!`);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/database');
const NLPService = require('../src/utils/nlp');

async function run() {
  console.log('Connecting to database...');
  const [rows] = await db.query('SELECT id, title, abstract, keywords FROM archive WHERE embedding IS NULL');
  console.log(`Found ${rows.length} archives without embeddings.`);

  if (rows.length === 0) {
    console.log('No embeddings to generate. Exiting.');
    process.exit(0);
  }

  console.log('Generating embeddings. This may take a while (model downloads on first run)...');
  let count = 0;
  for (const row of rows) {
    const combinedText = `${row.title} ${row.abstract || ''} ${row.keywords || ''}`;
    try {
      const embedding = await NLPService.getEmbedding(combinedText);
      if (embedding) {
        await db.query('UPDATE archive SET embedding = ? WHERE id = ?', [JSON.stringify(embedding), row.id]);
        count++;
        if (count % 10 === 0) {
          console.log(`Processed ${count} / ${rows.length}`);
        }
      }
    } catch (e) {
      console.error(`Failed to generate embedding for ID ${row.id}`, e);
    }
  }

  console.log(`Successfully generated ${count} embeddings!`);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

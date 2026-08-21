require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/database');
const NLPService = require('../src/utils/nlp');
const { listArchive } = require('../src/modules/archive/archive.service');

async function testSemanticSearch() {
  console.log('Testing NLP Semantic Search...');
  const searchQuery = 'Machine Learning and Artificial Intelligence';
  
  console.log(`\nQuerying for: "${searchQuery}"`);
  
  try {
    const result = await listArchive({ 
      search: searchQuery, 
      page: 1, 
      limit: 5 
    });
    
    if (result.data.length === 0) {
      console.log('\nNo results found. Note: Make sure your archives have embeddings generated!');
      console.log('You can generate them by running: node backend/scripts/generate_embeddings.js');
    } else {
      console.log('\nTop Results:');
      result.data.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.title}`);
        console.log(`   Abstract snippet: ${item.abstract ? item.abstract.substring(0, 100) + '...' : 'None'}`);
      });
    }
  } catch (err) {
    console.error('Error during search:', err);
  } finally {
    process.exit(0);
  }
}

testSemanticSearch();

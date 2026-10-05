const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { listArchive } = require('../src/modules/archive/archive.service');

async function testSemanticSearch() {
  const searchQuery = process.argv.slice(2).join(' ') || 'Machine Learning and Artificial Intelligence';
  
  console.log('Testing Whole-Document AI & Hybrid Archive Search...');
  console.log(`\nQuerying for: "${searchQuery}"`);
  
  try {
    const result = await listArchive({ 
      search: searchQuery, 
      page: 1, 
      limit: 5 
    });
    
    if (result.data.length === 0) {
      console.log('\nNo results found. Note: Make sure your archives have scanned content and embeddings generated!');
      console.log('You can generate them by running: npm run embeddings:generate');
    } else {
      console.log(`\nFound ${result.pagination.total} matching book/archive entr${result.pagination.total === 1 ? 'y' : 'ies'}:`);
      result.data.forEach((item, index) => {
        console.log(`\n${index + 1}. [${item.type.toUpperCase()}] ${item.title}`);
        console.log(`   Authors: ${item.authors}`);
        console.log(`   Relevance: ${item.relevance_score}`);
        if (item.match_snippet) {
          console.log(`   AI Document Match Excerpt: "${item.match_snippet}"`);
        } else if (item.abstract) {
          console.log(`   Abstract snippet: "${item.abstract.substring(0, 120)}..."`);
        }
      });
    }
  } catch (err) {
    console.error('Error during search:', err);
  } finally {
    process.exit(0);
  }
}

testSemanticSearch();

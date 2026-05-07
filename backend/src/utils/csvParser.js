const fs = require('fs');
const readline = require('readline');

/**
 * Parse a CSV file and return an array of objects keyed by header row.
 * Expects first row to be: student_email,adviser_email (or similar).
 */
async function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const cols = trimmed.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

      if (!headers) {
        headers = cols.map(h => h.toLowerCase().replace(/\s+/g, '_'));
        return;
      }

      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] || ''; });
      rows.push(row);
    });

    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

module.exports = { parseCsv };

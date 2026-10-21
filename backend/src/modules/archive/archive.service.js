const path = require('path');
const fs   = require('fs');
const db   = require('../../config/database');
const NLPService = require('../../utils/nlp');
const DocumentExtractor = require('../../utils/documentExtractor');
const { getPagination, paginatedResponse } = require('../../utils/pagination');

const MIN_ARCHIVE_YEAR = 2023;

/* ── helpers ─────────────────────────────────────────────────────── */
const BASE_SELECT = `
  SELECT a.id, a.title, a.authors, a.adviser, a.school_year, a.semester,
         a.type, a.keywords, a.archived_at, a.download_count, a.submission_id,
         d.name  AS department_name, d.code AS department_code,
         CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
         sd.file_name, sd.file_size, sd.mime_type
  FROM archive a
  JOIN departments d          ON a.department_id = d.id
  JOIN users u                ON a.archived_by   = u.id
  JOIN submission_documents sd ON a.document_id   = sd.id`;

const FULL_SELECT = `
  SELECT a.*, a.abstract,
         d.name  AS department_name, d.code AS department_code,
         CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
         sd.file_name, sd.file_size, sd.mime_type, sd.file_path
  FROM archive a
  JOIN departments d          ON a.department_id = d.id
  JOIN users u                ON a.archived_by   = u.id
  JOIN submission_documents sd ON a.document_id   = sd.id`;

/* ── Google Scholar-style Query Parser ──────────────────────────── */
function parseSearchQuery(queryStr) {
  if (!queryStr || typeof queryStr !== 'string') {
    return { raw: '', clean: '', phrases: [], terms: [], authorFilter: null, adviserFilter: null, titleFilter: null };
  }

  const raw = queryStr.trim();
  let clean = raw;
  let authorFilter = null;
  let adviserFilter = null;
  let titleFilter = null;

  // Extract author:"..." or author:word
  const authorMatch = clean.match(/\bauthor:(?:"([^"]+)"|(\S+))/i);
  if (authorMatch) {
    authorFilter = (authorMatch[1] || authorMatch[2]).trim();
    clean = clean.replace(authorMatch[0], ' ');
  }

  // Extract adviser:"..." or adviser:word
  const adviserMatch = clean.match(/\badviser:(?:"([^"]+)"|(\S+))/i);
  if (adviserMatch) {
    adviserFilter = (adviserMatch[1] || adviserMatch[2]).trim();
    clean = clean.replace(adviserMatch[0], ' ');
  }

  // Extract title:"..." or title:word
  const titleMatch = clean.match(/\btitle:(?:"([^"]+)"|(\S+))/i);
  if (titleMatch) {
    titleFilter = (titleMatch[1] || titleMatch[2]).trim();
    clean = clean.replace(titleMatch[0], ' ');
  }

  // Extract exact phrases in quotes
  const phrases = [];
  const phraseRegex = /"([^"]+)"/g;
  let pMatch;
  while ((pMatch = phraseRegex.exec(clean)) !== null) {
    if (pMatch[1].trim()) phrases.push(pMatch[1].trim().toLowerCase());
  }
  clean = clean.replace(/"[^"]+"/g, ' ');

  // Extract remaining individual terms
  const terms = clean
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);

  return {
    raw,
    clean: clean.trim(),
    phrases,
    terms,
    authorFilter,
    adviserFilter,
    titleFilter
  };
}

/* ── list (browse) with Google Scholar-style Hybrid Indexing ─────── */
async function listArchive({ search, department_id, school_year, semester, type, sort = 'relevance', page, limit }) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (department_id) { conditions.push('a.department_id = ?'); params.push(department_id); }
  if (school_year)   { conditions.push('a.school_year = ?');   params.push(school_year); }
  if (semester)      { conditions.push('a.semester = ?');      params.push(semester); }
  if (type)          { conditions.push('a.type = ?');          params.push(type); }

  if (search) {
    const parsed = parseSearchQuery(search);

    if (parsed.authorFilter) {
      conditions.push('LOWER(a.authors) LIKE ?');
      params.push(`%${parsed.authorFilter.toLowerCase()}%`);
    }
    if (parsed.adviserFilter) {
      conditions.push('LOWER(a.adviser) LIKE ?');
      params.push(`%${parsed.adviserFilter.toLowerCase()}%`);
    }
    if (parsed.titleFilter) {
      conditions.push('LOWER(a.title) LIKE ?');
      params.push(`%${parsed.titleFilter.toLowerCase()}%`);
    }

    // Build MySQL FULLTEXT boolean search expression & LIKE fallback for high recall
    const booleanTokens = [];
    parsed.phrases.forEach(p => booleanTokens.push(`+"${p}"`));
    parsed.terms.forEach(t => {
      if (t.length >= 3) booleanTokens.push(`+${t}*`);
    });

    const booleanQuery = booleanTokens.join(' ');
    const likePattern  = `%${(parsed.clean || search).toLowerCase()}%`;

    const searchConditions = [];
    const searchParams     = [];

    if (booleanQuery.length > 0) {
      searchConditions.push(
        '(MATCH(a.title) AGAINST(? IN BOOLEAN MODE) OR ' +
        ' MATCH(a.keywords) AGAINST(? IN BOOLEAN MODE) OR ' +
        ' MATCH(a.abstract) AGAINST(? IN BOOLEAN MODE) OR ' +
        ' MATCH(a.content_text) AGAINST(? IN BOOLEAN MODE))'
      );
      searchParams.push(booleanQuery, booleanQuery, booleanQuery, booleanQuery);
    }

    // Substring fallback for acronyms, short words, authors, keywords
    searchConditions.push(
      '(LOWER(a.title) LIKE ? OR LOWER(a.keywords) LIKE ? OR LOWER(a.authors) LIKE ? OR LOWER(a.adviser) LIKE ? OR LOWER(a.abstract) LIKE ?)'
    );
    searchParams.push(likePattern, likePattern, likePattern, likePattern, likePattern);

    conditions.push(`(${searchConditions.join(' OR ')})`);
    params.push(...searchParams);

    const filterWhere = `WHERE ${conditions.join(' AND ')}`;

    // 1. Get search query semantic vector (if available)
    const queryVector = await NLPService.getEmbedding(search);

    // 2. Fetch lightweight candidates (Notice: content_text is NOT fetched into memory here)
    const [candidates] = await db.query(
      `SELECT a.id, a.title, a.abstract, a.keywords, a.authors, a.adviser, a.school_year, a.download_count, a.embedding
       FROM archive a ${filterWhere}`,
      params
    );

    if (candidates.length === 0) {
      return paginatedResponse([], 0, page, limit);
    }

    // 3. Multi-Signal Google Scholar-style ranking
    const rawLower = search.trim().toLowerCase();
    const scored = candidates.map(c => {
      const titleLower    = (c.title || '').toLowerCase();
      const keywordsLower = (c.keywords || '').toLowerCase();
      const authorsLower  = (c.authors || '').toLowerCase();
      const adviserLower  = (c.adviser || '').toLowerCase();
      const abstractLower = (c.abstract || '').toLowerCase();

      let lexicalScore = 0;

      // Exact phrase bonus
      if (titleLower.includes(rawLower))    lexicalScore += 4.0;
      if (keywordsLower.includes(rawLower)) lexicalScore += 3.0;
      if (authorsLower.includes(rawLower) || adviserLower.includes(rawLower)) lexicalScore += 2.5;
      if (abstractLower.includes(rawLower)) lexicalScore += 1.8;

      // Field weighted per-term scoring
      let matchedTerms = 0;
      for (const term of parsed.terms) {
        let termFound = false;
        if (titleLower.includes(term))    { lexicalScore += 1.2; termFound = true; }
        if (keywordsLower.includes(term)) { lexicalScore += 0.8; termFound = true; }
        if (authorsLower.includes(term) || adviserLower.includes(term)) { lexicalScore += 0.7; termFound = true; }
        if (abstractLower.includes(term)) { lexicalScore += 0.4; termFound = true; }
        if (termFound) matchedTerms++;
      }

      // Bonus if all query terms are present in the paper
      if (parsed.terms.length > 1 && matchedTerms === parsed.terms.length) {
        lexicalScore += 1.2;
      }

      // Semantic Vector Similarity (0.0 to 1.0)
      let semanticScore = 0;
      let parsedEmbedding = c.embedding;
      if (typeof parsedEmbedding === 'string') {
        try { parsedEmbedding = JSON.parse(parsedEmbedding); } catch (_) { parsedEmbedding = null; }
      }
      if (parsedEmbedding && queryVector) {
        semanticScore = NLPService.calculateSimilarity(queryVector, parsedEmbedding);
      }

      // Popularity & Recency signals
      const downloadBonus = Math.log10(1 + (c.download_count || 0)) * 0.25;
      const startYear = parseInt(String(c.school_year || '').slice(0, 4), 10);
      const recencyBonus = startYear ? Math.max(0, (startYear - 2020) * 0.05) : 0;

      // Composite final score
      const finalScore = (lexicalScore * 0.65) + (semanticScore * 2.5 * 0.25) + downloadBonus + recencyBonus;

      return {
        id: c.id,
        score: finalScore,
        downloadCount: c.download_count || 0,
        schoolYear: startYear || 0,
      };
    });

    // 4. Sorting
    if (sort === 'newest') {
      scored.sort((a, b) => b.schoolYear - a.schoolYear || b.score - a.score);
    } else if (sort === 'downloads') {
      scored.sort((a, b) => b.downloadCount - a.downloadCount || b.score - a.score);
    } else {
      // Default: highest relevance
      scored.sort((a, b) => b.score - a.score || b.downloadCount - a.downloadCount);
    }

    const total = scored.length;
    const paginatedItems = scored.slice(offset, offset + limit);
    const paginatedIds = paginatedItems.map(s => s.id);

    if (paginatedIds.length === 0) {
      return paginatedResponse([], total, page, limit);
    }

    // 5. Fetch full data & snippets ONLY for the paginated top IDs
    const idPlaceholders = paginatedIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT a.id, a.title, a.abstract, a.authors, a.adviser, a.school_year, a.semester,
              a.type, a.keywords, a.archived_at, a.download_count, a.submission_id, a.content_text,
              d.name AS department_name, d.code AS department_code,
              CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
              sd.file_name, sd.file_size, sd.mime_type
       FROM archive a
       JOIN departments d ON a.department_id = d.id
       JOIN users u ON a.archived_by = u.id
       JOIN submission_documents sd ON a.document_id = sd.id
       WHERE a.id IN (${idPlaceholders})`,
      paginatedIds
    );

    const rowMap = {};
    rows.forEach(r => { rowMap[r.id] = r; });

    const sortedRows = paginatedItems.map(item => {
      const r = rowMap[item.id];
      if (!r) return null;

      // Generate snippet on the fly only for current page items
      const snippet = DocumentExtractor.extractSnippet(r.content_text || r.abstract || '', search, 240);
      delete r.content_text; // Do not send huge text blobs to frontend

      return {
        ...r,
        match_snippet: snippet,
        relevance_score: Number(item.score.toFixed(3))
      };
    }).filter(Boolean);

    return paginatedResponse(sortedRows, total, page, limit);

  } else {
    // BROWSE WITHOUT SEARCH
    const filterWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const from  = `FROM archive a
      JOIN departments d ON a.department_id = d.id
      JOIN users u ON a.archived_by = u.id
      JOIN submission_documents sd ON a.document_id = sd.id
      ${filterWhere}`;

    let orderBy = 'ORDER BY a.archived_at DESC';
    if (sort === 'downloads') {
      orderBy = 'ORDER BY a.download_count DESC, a.archived_at DESC';
    } else if (sort === 'title') {
      orderBy = 'ORDER BY a.title ASC';
    } else if (sort === 'newest') {
      orderBy = 'ORDER BY a.school_year DESC, a.archived_at DESC';
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);
    const [rows] = await db.query(
      `SELECT a.id, a.title, a.abstract, a.authors, a.adviser, a.school_year, a.semester,
              a.type, a.keywords, a.archived_at, a.download_count, a.submission_id,
              d.name AS department_name, d.code AS department_code,
              CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
              sd.file_name, sd.file_size, sd.mime_type
       ${from}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return paginatedResponse(rows, total, page, limit);
  }
}

/* ── single entry ────────────────────────────────────────────────── */
async function getArchiveById(id) {
  const [rows] = await db.query(
    `${FULL_SELECT} WHERE a.id = ?`, [id]
  );
  return rows[0] || null;
}

/* ── eligible submissions (approved, not yet archived) ───────────── */
async function getEligible({ page, limit }) {
  const offset = (page - 1) * limit;

  const base = `FROM thesis_submissions ts
    JOIN users u       ON ts.student_id    = u.id
    JOIN departments d ON ts.department_id = d.id
    WHERE ts.status = 'approved'
      AND ts.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM archive a WHERE a.submission_id = ts.id)`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`);
  const [rows] = await db.query(
    `SELECT ts.id, ts.title, ts.type, ts.school_year, ts.semester,
            ts.abstract, ts.keywords, ts.approved_at,
            CONCAT(u.first_name, ' ', u.last_name) AS student_name,
            u.student_number,
            d.name AS department_name, d.code AS department_code,
            ts.adviser_id,
            (SELECT CONCAT(a2.first_name, ' ', a2.last_name)
             FROM users a2 WHERE a2.id = ts.adviser_id) AS adviser_name
     ${base}
     ORDER BY ts.approved_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  /* attach full_document files only — those are the only promotable documents */
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const [docs] = await db.query(
      `SELECT id, submission_id, doc_type, file_name, file_size, is_current
       FROM submission_documents
       WHERE submission_id IN (${ids.map(() => '?').join(',')})
         AND doc_type = 'full_document'
       ORDER BY version DESC`,
      ids
    );
    const docMap = {};
    docs.forEach(d => {
      if (!docMap[d.submission_id]) docMap[d.submission_id] = [];
      docMap[d.submission_id].push(d);
    });
    rows.forEach(r => { r.documents = docMap[r.id] || []; });
  }

  return paginatedResponse(rows, total, page, limit);
}

/* ── promote a submission to the archive ─────────────────────────── */
async function promoteToArchive({ submission_id, document_id, authors, adviser, keywords, archived_by }) {
  /* validate submission */
  const [[sub]] = await db.query(
    `SELECT ts.*, d.id AS dept_id
     FROM thesis_submissions ts
     JOIN departments d ON ts.department_id = d.id
     WHERE ts.id = ? AND ts.deleted_at IS NULL`,
    [submission_id]
  );
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });
  if (sub.status !== 'approved')
    throw Object.assign(new Error('Only approved submissions can be archived'), { statusCode: 400 });

  const startYear = parseInt(String(sub.school_year).slice(0, 4), 10);
  if (!startYear || startYear < MIN_ARCHIVE_YEAR)
    throw Object.assign(
      new Error(`Only theses/capstones from school year ${MIN_ARCHIVE_YEAR} onward can be archived.`),
      { statusCode: 400 }
    );

  /* check not already archived */
  const [[existing]] = await db.query('SELECT id FROM archive WHERE submission_id = ?', [submission_id]);
  if (existing) throw Object.assign(new Error('Submission is already archived'), { statusCode: 409 });

  /* validate document belongs to submission and is a full document */
  const [[doc]] = await db.query(
    `SELECT id, file_path, mime_type, file_name FROM submission_documents
     WHERE id = ? AND submission_id = ? AND doc_type = 'full_document'`,
    [document_id, submission_id]
  );
  if (!doc) throw Object.assign(new Error('Only full documents can be archived'), { statusCode: 400 });

  /* Scan whole document content using DocumentExtractor */
  let documentContent = '';
  if (doc.file_path) {
    try {
      documentContent = await DocumentExtractor.extractTextFromFile(doc.file_path, doc.mime_type);
    } catch (e) {
      console.warn('Could not extract text from document during archiving:', e.message);
    }
  }

  /* Generate comprehensive AI embedding from title, abstract, keywords, authors, adviser, and scanned document content */
  const embedding = await NLPService.getEmbedding({
    title: sub.title,
    abstract: sub.abstract || '',
    keywords: keywords || sub.keywords || '',
    authors: authors || '',
    adviser: adviser || '',
    content: documentContent || '',
  });

  const [result] = await db.query(
    `INSERT INTO archive
       (submission_id, document_id, title, abstract, authors, adviser,
        department_id, school_year, semester, keywords, type, archived_by, embedding, content_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      submission_id, document_id,
      sub.title, sub.abstract || null,
      authors, adviser || null,
      sub.dept_id, sub.school_year, sub.semester,
      keywords || sub.keywords || null,
      sub.type,
      archived_by,
      embedding ? JSON.stringify(embedding) : null,
      documentContent || null
    ]
  );

  return getArchiveById(result.insertId);
}

/* ── download (increment count + return file info) ───────────────── */
async function getDownloadInfo(id) {
  const [rows] = await db.query(
    `SELECT a.id, a.title,
            sd.file_path, sd.file_name, sd.mime_type
     FROM archive a
     JOIN submission_documents sd ON a.document_id = sd.id
     WHERE a.id = ?`,
    [id]
  );
  const entry = rows[0];
  if (!entry) throw Object.assign(new Error('Archive entry not found'), { statusCode: 404 });

  /* resolve absolute path — multer stores full absolute path */
  const absPath = path.isAbsolute(entry.file_path)
    ? entry.file_path
    : path.resolve(process.cwd(), entry.file_path);

  if (!fs.existsSync(absPath))
    throw Object.assign(new Error('File not found on disk'), { statusCode: 404 });

  await db.query('UPDATE archive SET download_count = download_count + 1 WHERE id = ?', [id]);

  return { absPath, fileName: entry.file_name, mimeType: entry.mime_type };
}

/* ── remove from archive ─────────────────────────────────────────── */
async function removeFromArchive(id) {
  const entry = await getArchiveById(id);
  if (!entry) throw Object.assign(new Error('Archive entry not found'), { statusCode: 404 });
  await db.query('DELETE FROM archive WHERE id = ?', [id]);
}

/* ── stats ───────────────────────────────────────────────────────── */
async function getStats() {
  const [[counts]] = await db.query(
    `SELECT
       COUNT(*)                                    AS total,
       SUM(type = 'thesis')                        AS thesis_count,
       SUM(type = 'capstone')                      AS capstone_count,
       COALESCE(SUM(download_count), 0)            AS total_downloads
     FROM archive`
  );
  const [byDept] = await db.query(
    `SELECT d.code, d.name, COUNT(*) AS count
     FROM archive a JOIN departments d ON a.department_id = d.id
     GROUP BY d.id ORDER BY count DESC`
  );
  const [byYear] = await db.query(
    `SELECT school_year, COUNT(*) AS count
     FROM archive GROUP BY school_year ORDER BY school_year DESC LIMIT 5`
  );
  return { ...counts, by_department: byDept, by_year: byYear };
}

module.exports = { listArchive, getArchiveById, getEligible, promoteToArchive, getDownloadInfo, removeFromArchive, getStats, parseSearchQuery };

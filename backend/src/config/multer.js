const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } = require('./constants');

function makeUploadDir(subDir) {
  const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const documentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const now = new Date();
    const sub = `documents/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    cb(null, makeUploadDir(sub));
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const csvStorage = multer.diskStorage({
  destination(req, file, cb) { cb(null, makeUploadDir('adviser-lists')); },
  filename(req, file, cb) { cb(null, `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`); },
});

const imradStorage = multer.diskStorage({
  destination(req, file, cb) { cb(null, makeUploadDir('imrad')); },
  filename(req, file, cb) { cb(null, `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`); },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Only PDF and DOCX files are allowed.'), false);
  }
  cb(null, true);
}

function csvFilter(req, file, cb) {
  if (!['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype)) {
    return cb(new Error('Only CSV files are allowed.'), false);
  }
  cb(null, true);
}

const maxFileSizeMB = () => (Number(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

const excelStorage = multer.diskStorage({
  destination(req, file, cb) { cb(null, makeUploadDir('student-imports')); },
  filename(req, file, cb) { cb(null, `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`); },
});

function excelFilter(req, file, cb) {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(file.mimetype) && !['.xlsx', '.xls'].includes(ext)) {
    return cb(new Error('Only Excel files (.xlsx, .xls) are allowed.'), false);
  }
  cb(null, true);
}

const uploadDocument = multer({ storage: documentStorage, fileFilter, limits: { fileSize: maxFileSizeMB() } });
const uploadCsv      = multer({ storage: csvStorage, fileFilter: csvFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadImrad    = multer({ storage: imradStorage, fileFilter, limits: { fileSize: maxFileSizeMB() } });
const uploadExcel    = multer({ storage: excelStorage, fileFilter: excelFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { uploadDocument, uploadCsv, uploadImrad, uploadExcel };

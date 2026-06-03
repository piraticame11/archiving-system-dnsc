const ROLES = {
  STUDENT:     'student',
  INSTRUCTOR:  'instructor',
  ADMIN:       'admin',
  PANELIST:    'panelist',
  SUPERADMIN:  'superadmin',
};

const SUBMISSION_STATUS = {
  DRAFT:             'draft',
  SUBMITTED:         'submitted',
  UNDER_REVIEW:      'under_review',
  APPROVED:          'approved',
  REJECTED:          'rejected',
  REVISION_REQUIRED: 'revision_required',
};

const DEFENSE_STATUS = {
  SCHEDULED:    'scheduled',
  COMPLETED:    'completed',
  CANCELLED:    'cancelled',
  RESCHEDULED:  'rescheduled',
};

const EVAL_STATUS = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  SUBMITTED:   'submitted',
};

const DOC_TYPES = ['title_proposal', 'partial_document', 'full_document', 'imrad', 'presentation', 'other'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['pdf', 'docx'];

module.exports = {
  ROLES,
  SUBMISSION_STATUS,
  DEFENSE_STATUS,
  EVAL_STATUS,
  DOC_TYPES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
};

/**
 * Detect venue and panelist scheduling conflicts.
 *
 * @param {Object} proposed - { venue_id, scheduled_at: Date, duration_min, panelist_ids: number[] }
 * @param {Array}  existing - rows from DB: { id, venue_id, scheduled_at, duration_min, panelist_ids: number[] }
 * @returns {{ hasConflicts: boolean, venueConflicts: Array, panelistConflicts: Array }}
 */
function detectConflicts(proposed, existing) {
  const pStart = new Date(proposed.scheduled_at).getTime();
  const pEnd   = pStart + proposed.duration_min * 60 * 1000;

  const venueConflicts    = [];
  const panelistConflicts = [];

  for (const sched of existing) {
    const eStart = new Date(sched.scheduled_at).getTime();
    const eEnd   = eStart + sched.duration_min * 60 * 1000;

    const overlaps = pStart < eEnd && eStart < pEnd;
    if (!overlaps) continue;

    // Venue conflict
    if (proposed.venue_id && sched.venue_id && proposed.venue_id === sched.venue_id) {
      venueConflicts.push({
        schedule_id:      sched.id,
        submission_title: sched.submission_title || '',
        scheduled_at:     sched.scheduled_at,
      });
    }

    // Panelist double-booking
    const proposedSet = new Set(proposed.panelist_ids || []);
    for (const pid of (sched.panelist_ids || [])) {
      if (proposedSet.has(pid)) {
        panelistConflicts.push({
          panelist_id:   pid,
          panelist_name: sched.panelist_names ? sched.panelist_names[pid] : '',
          schedule_id:   sched.id,
          scheduled_at:  sched.scheduled_at,
        });
      }
    }
  }

  return {
    hasConflicts: venueConflicts.length > 0 || panelistConflicts.length > 0,
    venueConflicts,
    panelistConflicts,
  };
}

module.exports = { detectConflicts };

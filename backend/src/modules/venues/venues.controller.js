const service = require('./venues.service');
const { sendSuccess, sendCreated, send404 } = require('../../utils/responseHelper');
const { getPagination } = require('../../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const include_inactive = ['true', '1'].includes(req.query.include_inactive);
    const result = await service.listVenues({
      search: req.query.search,
      include_inactive,
      page,
      limit,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const venue = await service.createVenue(req.body);
    sendCreated(res, venue, 'Venue created');
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Venue not found');
    const venue = await service.updateVenue(req.params.id, req.body);
    sendSuccess(res, venue, 'Venue updated');
  } catch (err) { next(err); }
}

async function toggleActive(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Venue not found');
    const venue = await service.toggleActive(req.params.id);
    sendSuccess(res, venue, 'Venue status toggled');
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Venue not found');
    await service.deleteVenue(req.params.id);
    sendSuccess(res, null, 'Venue deleted');
  } catch (err) { next(err); }
}

module.exports = { list, create, update, toggleActive, remove };

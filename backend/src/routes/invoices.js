/**
 * /api/invoices — workspace-scoped invoice management
 *
 * GET  /              paginated list (query: page, limit, search, status)
 * GET  /:id           invoice details
 * GET  /:id/pdf       download invoice as PDF
 */

const express = require('express');
const PDFDocument = require('pdfkit');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const wid = (req) => req.user.workspace_id;

/**
 * GET /api/invoices — paginated list with search and filter
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let whereClause = 'WHERE i.workspace_id = $1';
    const params = [wid(req)];
    let paramIdx = 2;

    if (status && status !== 'all') {
      whereClause += ` AND i.status = $${paramIdx++}`;
      params.push(status);
    }

    if (search) {
      whereClause += ` AND (i.invoice_number ILIKE $${paramIdx++} OR sp.name ILIKE $${paramIdx++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) FROM invoices i LEFT JOIN subscription_plans sp ON sp.id = i.plan_id ${whereClause}`;
    const { rows: [{ count }] } = await pool.query(countQuery, params);
    const total = parseInt(count, 10);

    const dataQuery = `
      SELECT i.*, sp.code AS plan_code, sp.name AS plan_name, sp.hours_limit
      FROM invoices i
      LEFT JOIN subscription_plans sp ON sp.id = i.plan_id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);

    res.json({
      invoices: rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/invoices/:id — invoice details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [invoice] } = await pool.query(
      `SELECT i.*, sp.code AS plan_code, sp.name AS plan_name, sp.hours_limit,
              w.name AS workspace_name, w.slug AS workspace_slug
       FROM invoices i
       LEFT JOIN subscription_plans sp ON sp.id = i.plan_id
       LEFT JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.id = $1 AND i.workspace_id = $2`,
      [req.params.id, wid(req)]
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    res.json(invoice);
  } catch (err) { next(err); }
});

/**
 * GET /api/invoices/:id/pdf — download invoice as PDF
 */
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const { rows: [invoice] } = await pool.query(
      `SELECT i.*, sp.code AS plan_code, sp.name AS plan_name, sp.hours_limit,
              w.name AS workspace_name, w.slug AS workspace_slug
       FROM invoices i
       LEFT JOIN subscription_plans sp ON sp.id = i.plan_id
       LEFT JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.id = $1 AND i.workspace_id = $2`,
      [req.params.id, wid(req)]
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `invoice-${invoice.invoice_number}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header — Company branding
    doc.fontSize(22).fillColor('#5B6AF0').font('Helvetica-Bold').text('MeetSync AI', 50, 50);
    doc.fontSize(10).fillColor('#666').font('Helvetica').text('Action Engine for Meetings', 50, 78);
    doc.text('support@meetsyncai.net', 50, 92);

    // Invoice title
    doc.fontSize(20).fillColor('#000').font('Helvetica-Bold').text('INVOICE', 400, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`#${invoice.invoice_number}`, 400, 78);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 400, 92);

    // Line
    doc.moveTo(50, 115).lineTo(555, 115).strokeColor('#ddd').lineWidth(1).stroke();

    // Billed To
    doc.fontSize(9).fillColor('#999').font('Helvetica-Bold').text('BILLED TO', 50, 135);
    doc.fontSize(11).fillColor('#000').font('Helvetica').text(invoice.workspace_name || '—', 50, 152);

    // Invoice details
    doc.fontSize(9).fillColor('#999').font('Helvetica-Bold').text('INVOICE DETAILS', 350, 135);
    doc.fontSize(10).fillColor('#000').font('Helvetica').text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 350, 152);
    if (invoice.paid_at) {
      doc.text(`Paid: ${new Date(invoice.paid_at).toLocaleDateString()}`, 350, 167);
    }
    if (invoice.period_start && invoice.period_end) {
      doc.text(`Period: ${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`, 350, 182);
    }

    // Table header
    const tableTop = 220;
    doc.moveTo(50, tableTop - 10).lineTo(555, tableTop - 10).strokeColor('#ddd').lineWidth(1).stroke();
    doc.fontSize(9).fillColor('#999').font('Helvetica-Bold').text('DESCRIPTION', 50, tableTop);
    doc.text('AMOUNT', 400, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(555, tableTop + 15).strokeColor('#ddd').lineWidth(0.5).stroke();

    // Line item
    const itemY = tableTop + 30;
    doc.fontSize(11).fillColor('#000').font('Helvetica').text(
      `${invoice.plan_name || 'Subscription'} — ${invoice.hours_limit || ''} hours/month`,
      50, itemY
    );
    doc.text(`$${(invoice.amount_cents / 100).toFixed(2)}`, 400, itemY);

    // Tax
    let y = itemY + 25;
    if (invoice.tax_cents > 0) {
      doc.fontSize(10).fillColor('#666').text('Tax', 400, y);
      doc.text(`$${(invoice.tax_cents / 100).toFixed(2)}`, 500, y);
      y += 20;
    }

    // Total
    doc.moveTo(350, y).lineTo(555, y).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.fontSize(12).fillColor('#000').font('Helvetica-Bold').text('TOTAL', 400, y + 10);
    doc.text(`$${(invoice.total_cents / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || 'USD'}`, 500, y + 10);

    // Footer
    doc.moveTo(50, 480).lineTo(555, 480).strokeColor('#ddd').lineWidth(1).stroke();
    doc.fontSize(9).fillColor('#999').font('Helvetica').text(
      'This is a computer-generated invoice and does not require a signature.',
      50, 495
    );
    doc.text('Thank you for your business!', 50, 510);
    doc.fillColor('#5B6AF0').text('MeetSync AI · support@meetsyncai.net · https://meetsyncai.net', 50, 525);

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;

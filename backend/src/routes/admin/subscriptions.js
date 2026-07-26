const express = require('express');
const PDFDocument = require('pdfkit');
const { pool } = require('../../db');
const { log } = require('../../utils/logger');

const router = express.Router();

/**
 * GET /api/admin/subscriptions
 * List all workspaces with their subscription status
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        w.id   AS workspace_id,
        w.name AS workspace_name,
        w.slug AS workspace_slug,
        w.created_at,
        (
          SELECT jsonb_build_object('name', u.name, 'email', u.email)
          FROM users u
          WHERE u.workspace_id = w.id AND u.role = 'admin'
          LIMIT 1
        ) AS admin,
        s.id                     AS subscription_id,
        sp.name                  AS plan_name,
        sp.code                  AS plan_code,
        sp.price_cents,
        s.status,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        s.canceled_at
      FROM workspaces w
      LEFT JOIN subscriptions s  ON s.workspace_id = w.id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      ORDER BY s.status = 'active' DESC, w.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/subscriptions/:workspaceId
 * Get subscription details + invoices for a workspace
 */
router.get('/:workspaceId', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    const { rows: wsRows } = await pool.query(
      'SELECT id, name, slug FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    if (!wsRows[0]) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const { rows: subRows } = await pool.query(`
      SELECT
        s.id, s.status, s.stripe_subscription_id, s.stripe_customer_id,
        s.current_period_start, s.current_period_end,
        s.cancel_at_period_end, s.canceled_at, s.created_at,
        sp.name AS plan_name, sp.code AS plan_code, sp.price_cents,
        sp.hours_limit
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE s.workspace_id = $1
    `, [workspaceId]);

    const { rows: invoiceRows } = await pool.query(`
      SELECT
        i.id, i.invoice_number, i.amount_cents, i.currency,
        i.tax_cents, i.total_cents, i.status,
        i.period_start, i.period_end, i.paid_at, i.pdf_url,
        i.created_at
      FROM invoices i
      WHERE i.workspace_id = $1
      ORDER BY i.created_at DESC
    `, [workspaceId]);

    res.json({
      workspace: wsRows[0],
      subscription: subRows[0] || null,
      invoices: invoiceRows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/subscriptions/:workspaceId/invoices/:invoiceId/pdf
 * Generate and download invoice as PDF (same as user panel)
 */
router.get('/:workspaceId/invoices/:invoiceId/pdf', async (req, res, next) => {
  try {
    const { workspaceId, invoiceId } = req.params;

    const { rows: [invoice] } = await pool.query(
      `SELECT i.*, sp.code AS plan_code, sp.name AS plan_name, sp.hours_limit,
              w.name AS workspace_name, w.slug AS workspace_slug
       FROM invoices i
       LEFT JOIN subscriptions s ON s.id = i.subscription_id
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.id = $1 AND i.workspace_id = $2`,
      [invoiceId, workspaceId]
    );

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `invoice-${invoice.invoice_number}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header - Company branding
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
    doc.fontSize(11).fillColor('#000').font('Helvetica').text(invoice.workspace_name || '--', 50, 152);

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
      `${invoice.plan_name || 'Subscription'} - ${invoice.hours_limit || ''} hours/month`,
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
    doc.fillColor('#5B6AF0').text('MeetSync AI - support@meetsyncai.net - https://meetsyncai.net', 50, 525);

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

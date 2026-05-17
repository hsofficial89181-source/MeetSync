require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../models/migrate');

async function seedSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Error: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables are required');
    console.error('Example: SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=securepassword123 npm run seed:superadmin');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: SUPERADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  try {
    // Check if any superadmin already exists
    const { rows: existingAdmins } = await pool.query(
      "SELECT id, email FROM users WHERE role = 'superadmin' LIMIT 1"
    );

    if (existingAdmins.length > 0) {
      console.log(`Super Admin already exists: ${existingAdmins[0].email}`);
      console.log('To create additional Super Admins, use the Admin Panel or create directly in database.');
      process.exit(0);
    }

    // Create superadmin user (no workspace_id - global access)
    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'superadmin', TRUE)
       RETURNING id, name, email, role`,
      ['Super Admin', email.toLowerCase(), hash]
    );

    console.log('========================================');
    console.log('Super Admin created successfully!');
    console.log('========================================');
    console.log(`Email:    ${user.email}`);
    console.log(`Role:     ${user.role}`);
    console.log(`ID:       ${user.id}`);
    console.log('========================================');
    console.log('You can now log in to the Admin Panel at /admin/login');
    console.log('========================================');

  } catch (err) {
    console.error('Error creating Super Admin:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedSuperAdmin();

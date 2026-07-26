require('dotenv').config();
const { pool } = require('../src/db');

async function seedPlans() {
  const client = await pool.connect();
  try {
    console.log('Seeding subscription plans...');

    const plans = [
      ['starter',             'Starter',                   9900,    'month', 10,  null, 1],
      ['professional',        'Professional',              29900,   'month', 30,  null, 2],
      ['business',            'Business',                  79900,   'month', 80,  null, 3],
      ['enterprise',          'Enterprise',               349900,   'month', 350, null, 4],
      ['starter_yearly',      'Starter (Yearly)',          99900,   'year',  120, null, 5],
      ['professional_yearly', 'Professional (Yearly)',    349900,   'year',  360, null, 6],
      ['business_yearly',     'Business (Yearly)',        949900,   'year',  960, null, 7],
      ['enterprise_yearly',   'Enterprise (Yearly)',     3999900,   'year',  4200, null, 8],
    ];

    for (const [code, name, priceCents, interval, hoursLimit, stripePriceId, sortOrder] of plans) {
      await client.query(
        `INSERT INTO subscription_plans (code, name, price_cents, interval, hours_limit, stripe_price_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           price_cents = EXCLUDED.price_cents,
           interval = EXCLUDED.interval,
           hours_limit = EXCLUDED.hours_limit,
           sort_order = EXCLUDED.sort_order`,
        [code, name, priceCents, interval, hoursLimit, stripePriceId, sortOrder]
      );
    }

    console.log(`Seeded ${plans.length} subscription plans.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedPlans();

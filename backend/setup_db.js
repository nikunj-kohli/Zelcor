import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    console.log('🚀 Connecting to database...');
    const schemaPath = path.resolve('schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📜 Running schema.sql...');
    await sql.unsafe(schemaSql);

    console.log('🔓 Disabling profiles foreign key constraint for demo...');
    await sql.unsafe('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;');

    console.log('🛠️ Adding missing columns to insurance_purchases and insurance_claims if they do not exist...');
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='insurance_purchases' AND column_name='razorpay_payment_id') THEN
          ALTER TABLE insurance_purchases ADD COLUMN razorpay_payment_id TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='insurance_claims' AND column_name='purchase_id') THEN
          ALTER TABLE insurance_claims ADD COLUMN purchase_id UUID REFERENCES insurance_purchases(id);
        END IF;
      END $$;
    `);

    console.log('✅ Schema applied successfully!');
  } catch (error) {
    console.error('❌ Error applying schema:', error);
  } finally {
    await sql.end();
  }
}

setup();

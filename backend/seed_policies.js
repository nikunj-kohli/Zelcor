
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const policies = [
  {
    name: 'Full Body Protection Plus',
    type: 'health',
    subtype: 'full_body',
    description: 'Comprehensive coverage for all major organs and general health emergencies.',
    coverage_amount: 1000000,
    premium_amount: 15000,
    duration_months: 12,
    terms: 'Standard terms apply.'
  },
  {
    name: 'Vital Organs Shield',
    type: 'health',
    subtype: 'body_parts',
    description: 'Focused coverage for heart, lungs, and kidney related treatments.',
    coverage_amount: 500000,
    premium_amount: 8000,
    duration_months: 12,
    terms: 'Covers major organ failures.'
  },
  {
    name: 'Limb & Mobility Guard',
    type: 'health',
    subtype: 'body_parts',
    description: 'Coverage for fractures, joint replacements, and accidental limb injuries.',
    coverage_amount: 300000,
    premium_amount: 4500,
    duration_months: 12,
    terms: 'Accidental injuries only.'
  },
  {
    name: 'Comprehensive Vehicle Protect',
    type: 'vehicle',
    subtype: 'comprehensive',
    description: 'All-round protection for your vehicle against accidents, theft, and natural disasters.',
    coverage_amount: 800000,
    premium_amount: 12000,
    duration_months: 12,
    terms: 'Zero depreciation included.'
  },
  {
    name: 'Smart Travel Safe',
    type: 'travel',
    subtype: 'international',
    description: 'Global travel insurance covering medical emergencies, trip cancellations, and lost luggage.',
    coverage_amount: 2000000,
    premium_amount: 2500,
    duration_months: 1,
    terms: 'Worldwide coverage excluding war zones.'
  }
];

async function seed() {
  console.log('Seeding insurance policies...');
  
  const { data, error } = await supabase
    .from('insurance_policies')
    .insert(policies)
    .select();

  if (error) {
    console.error('Error seeding policies:', error);
  } else {
    console.log('Successfully seeded policies:', data.length);
  }
}

seed();

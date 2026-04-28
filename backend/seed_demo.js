import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const demoCompanyId = '88888888-8888-8888-8888-888888888888';
const demoUserId = '11111111-1111-1111-1111-111111111111';

async function seed() {
  console.log('🌱 Seeding demo data...');

  // 1. Create Demo Company Profile
  const { error: error1 } = await supabase.from('profiles').upsert({
    id: demoCompanyId,
    full_name: 'Zelcor Enterprise Demo',
    email: 'demo@company.com',
    wallet_address: '0x9999999999999999999999999999999999999999',
    is_enterprise: true,
    trust_score: 98.5
  });
  if (error1) console.error('Error seeding profiles:', error1);

  // 2. Create Demo User Profile
  const { error: error2 } = await supabase.from('profiles').upsert({
    id: demoUserId,
    full_name: 'HackIndia Demo User',
    email: 'demo-user@hackindia.io',
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    is_enterprise: false,
    trust_score: 92.0
  });
  if (error2) console.error('Error seeding profiles (user):', error2);

  // 3. Create some Escrows
  const { data: escrows, error: error3 } = await supabase.from('escrows').upsert([
    {
      id: 'e1111111-1111-1111-1111-111111111111',
      buyer_id: demoUserId,
      seller_id: demoCompanyId,
      item_name: 'iPhone 15 Pro Max (Refurbished)',
      amount: 85000,
      status: 'disputed',
      auto_release_at: new Date(Date.now() + 48 * 3600000).toISOString()
    },
    {
      id: 'e2222222-2222-2222-2222-222222222222',
      buyer_id: demoUserId,
      seller_id: demoCompanyId,
      item_name: 'MacBook Air M2',
      amount: 110000,
      status: 'active',
      auto_release_at: new Date(Date.now() + 72 * 3600000).toISOString()
    }
  ]).select();
  if (error3) console.error('Error seeding escrows:', error3);

  // 4. Create Insurance Policies
  const { error: error4 } = await supabase.from('insurance_policies').upsert([
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Comprehensive Health Insurance',
      type: 'health',
      subtype: 'full_body',
      description: 'Complete health coverage including hospitalization, surgeries, and preventive care',
      coverage_amount: 500000,
      premium_amount: 12000,
      duration_months: 12,
      terms: 'Annual premium, covers all major illnesses and accidents'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Critical Illness Insurance',
      type: 'health',
      subtype: 'critical_illness',
      description: 'Coverage for major critical illnesses like cancer, heart attack, stroke',
      coverage_amount: 1000000,
      premium_amount: 8000,
      duration_months: 12,
      terms: 'Lump sum payment on diagnosis of critical illness'
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Accident Insurance',
      type: 'health',
      subtype: 'accident',
      description: 'Personal accident coverage for injuries and disabilities',
      coverage_amount: 200000,
      premium_amount: 2000,
      duration_months: 12,
      terms: 'Covers accidental death, permanent disability, and medical expenses'
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Vehicle Comprehensive Insurance',
      type: 'vehicle',
      subtype: 'comprehensive',
      description: 'Complete vehicle protection including theft, damage, and third-party liability',
      coverage_amount: 500000,
      premium_amount: 15000,
      duration_months: 12,
      terms: 'Covers own damage, third-party liability, and accessories'
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      name: 'Term Life Insurance',
      type: 'life', // 20 years
      subtype: 'term',
      description: 'Pure life insurance providing financial protection to family',
      coverage_amount: 2000000,
      premium_amount: 10000,
      duration_months: 240, // 20 years
      terms: 'Pays out on death during the term period'
    }
  ]);
  if (error4) console.error('Error seeding insurance_policies:', error4);

  // 5. Create a Dispute for the first escrow
  const { error: error5 } = await supabase.from('disputes').upsert({
    id: 'd1111111-1111-1111-1111-111111111111',
    escrow_id: 'e1111111-1111-1111-1111-111111111111',
    filed_by: demoUserId,
    reason: 'The device has a cracked screen and the battery health is only 75%, which was not mentioned in the listing.',
    ai_probability_legit: 0.94,
    ai_analysis_summary: 'Visual analysis of evidence confirms screen damage. Battery report provided by user matches claim. High probability of fraud/misrepresentation.',
    status: 'pending'
  });
  if (error5) console.error('Error seeding disputes:', error5);

  console.log('✅ Demo data seeded successfully!');
}

seed();

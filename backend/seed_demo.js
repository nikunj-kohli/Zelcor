import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const demoCompanyId = '88888888-8888-8888-8888-888888888888';
const demoUserId = '11111111-1111-1111-1111-111111111111';

async function seed() {
  console.log('🌱 Seeding demo data...');

  // 1. Create Demo Company Profile
  await supabase.from('profiles').upsert({
    id: demoCompanyId,
    full_name: 'Zelcor Enterprise Demo',
    email: 'demo@company.com',
    wallet_address: '0x9999999999999999999999999999999999999999',
    is_enterprise: true,
    trust_score: 98.5
  });

  // 2. Create Demo User Profile
  await supabase.from('profiles').upsert({
    id: demoUserId,
    full_name: 'HackIndia Demo User',
    email: 'demo-user@hackindia.io',
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    is_enterprise: false,
    trust_score: 92.0
  });

  // 3. Create some Escrows
  const { data: escrows } = await supabase.from('escrows').upsert([
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

  // 4. Create a Dispute for the first escrow
  await supabase.from('disputes').upsert({
    id: 'd1111111-1111-1111-1111-111111111111',
    escrow_id: 'e1111111-1111-1111-1111-111111111111',
    filed_by: demoUserId,
    reason: 'The device has a cracked screen and the battery health is only 75%, which was not mentioned in the listing.',
    ai_probability_legit: 0.94,
    ai_analysis_summary: 'Visual analysis of evidence confirms screen damage. Battery report provided by user matches claim. High probability of fraud/misrepresentation.',
    status: 'pending'
  });

  console.log('✅ Demo data seeded successfully!');
}

seed();

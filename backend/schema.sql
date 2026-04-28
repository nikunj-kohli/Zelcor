-- Zelcor Database Schema
-- Run this in the Supabase SQL Editor

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  wallet_address TEXT UNIQUE,
  trust_score NUMERIC DEFAULT 95.0,
  is_enterprise BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Escrows Table
CREATE TABLE IF NOT EXISTS escrows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'disputed', 'refunded', 'inspection')),
  inspection_period_hours INTEGER DEFAULT 48,
  auto_release_at TIMESTAMP WITH TIME ZONE,
  blockchain_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Disputes Table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE NOT NULL,
  filed_by UUID REFERENCES profiles(id) NOT NULL,
  reason TEXT NOT NULL,
  ai_probability_legit NUMERIC,
  ai_analysis_summary TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'settled', 'escalated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Evidence Table
CREATE TABLE IF NOT EXISTS evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID REFERENCES disputes(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'image', 'video', 'pdf'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Activity/Notifications Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'payment_received', 'escrow_created', 'dispute_filed', etc.
  message TEXT NOT NULL,
  amount_affected NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Set up basic RLS policies (Example: users can view their own data)
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view escrows they are part of" ON escrows FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

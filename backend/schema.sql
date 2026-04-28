-- Zelcor Comprehensive Database Schema
-- Run this in the Supabase SQL Editor

-- 1. PROFILES
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

-- 2. ESCROWS (Ecommerce)
CREATE TABLE IF NOT EXISTS escrows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  item_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'disputed', 'refunded', 'inspection')),
  blockchain_tx_hash TEXT,
  razorpay_order_id TEXT,
  auto_release_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DISPUTES
CREATE TABLE IF NOT EXISTS disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
  filed_by UUID REFERENCES profiles(id) NOT NULL,
  reason TEXT NOT NULL,
  ai_probability_legit NUMERIC,
  ai_analysis_summary TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'settled', 'escalated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. INSURANCE CLAIMS
CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  insurer_id UUID REFERENCES profiles(id) NOT NULL,
  claim_amount NUMERIC NOT NULL,
  diagnosis TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'critical', 'emergency')),
  deadline_hours INTEGER DEFAULT 720,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'penalty')),
  ai_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. RENTAL AGREEMENTS
CREATE TABLE IF NOT EXISTS rental_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES profiles(id) NOT NULL,
  landlord_id UUID REFERENCES profiles(id) NOT NULL,
  property_address TEXT NOT NULL,
  total_deposit NUMERIC NOT NULL,
  escrow_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inspected', 'resolved')),
  move_in_photos TEXT[],
  move_out_photos TEXT[],
  ai_assessment JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. COURSE ENROLLMENTS (EdTech)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  platform_id UUID REFERENCES profiles(id) NOT NULL,
  course_name TEXT NOT NULL,
  total_fee NUMERIC NOT NULL,
  milestone_count INTEGER NOT NULL,
  released_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'disputed', 'refunded', 'completed')),
  ai_validity_score NUMERIC,
  ai_findings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. HOSPITAL ADMISSIONS
CREATE TABLE IF NOT EXISTS hospital_admissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES profiles(id) NOT NULL,
  hospital_id UUID REFERENCES profiles(id) NOT NULL,
  package_name TEXT NOT NULL,
  package_amount NUMERIC NOT NULL,
  paid_to_hospital NUMERIC NOT NULL,
  held_in_escrow NUMERIC NOT NULL,
  status TEXT DEFAULT 'package_agreed' CHECK (status IN ('package_agreed', 'admitted', 'discharged', 'bill_disputed', 'settled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. HOSPITAL CONSENTS
CREATE TABLE IF NOT EXISTS hospital_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admission_id UUID REFERENCES hospital_admissions(id) ON DELETE CASCADE NOT NULL,
  item TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'consented', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. EVIDENCE Table
CREATE TABLE IF NOT EXISTS evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID REFERENCES disputes(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES insurance_claims(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES rental_agreements(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe migration helpers for already-created tables
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on all tables
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_consents ENABLE ROW LEVEL SECURITY;

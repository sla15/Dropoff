-- 1. Update Profiles Table
-- Add referral_code and referral_balance if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code') THEN
        ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_balance') THEN
        ALTER TABLE profiles ADD COLUMN referral_balance DECIMAL(10, 2) DEFAULT 0.00;
    END IF;
END $$;

-- 2. Create User Rewards Table
CREATE TABLE IF NOT EXISTS user_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g. "Free Delivery"
    description TEXT, -- e.g. "Valid for next 3 orders"
    type TEXT NOT NULL, -- e.g. "delivery_discount", "ride_discount"
    discount_amount DECIMAL(10, 2), -- e.g. 50.00 or 0.20 (for percentage)
    is_percentage BOOLEAN DEFAULT FALSE,
    expiry_date TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES profiles(id),
    referee_id UUID REFERENCES profiles(id), -- The new user
    status TEXT DEFAULT 'pending', -- pending, completed
    reward_amount DECIMAL(10, 2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 4. RLS Policies
-- User Rewards: Users can read their own rewards
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rewards"
ON user_rewards FOR SELECT
USING (auth.uid() = user_id);

-- Referrals: Users can view referrals they made
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referrals"
ON referrals FOR SELECT
USING (auth.uid() = referrer_id);

-- 1. Add referral_reward_amount column to app_settings
-- The table uses columns for settings, not key-value rows.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'referral_reward_amount') THEN
        ALTER TABLE app_settings ADD COLUMN referral_reward_amount DECIMAL(10, 2) DEFAULT 50.00;
    END IF;
END $$;

-- 2. Update the singleton row with the default value (if row exists)
UPDATE app_settings SET referral_reward_amount = 50.00 WHERE referral_reward_amount IS NULL;

-- 3. Function to Process Reward on Ride Completion
CREATE OR REPLACE FUNCTION process_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
    v_recruit_id UUID;
    v_referrer_id UUID;
    v_reward_amount DECIMAL(10, 2);
    v_ride_count INTEGER;
BEGIN
    -- Only run if status changed to 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        v_recruit_id := NEW.user_id;

        -- Check if this is their FIRST ride
        SELECT COUNT(*) INTO v_ride_count
        FROM rides
        WHERE user_id = v_recruit_id AND status = 'completed';

        -- If ride_count is 1 (this is the first one), proceed
        IF v_ride_count = 1 THEN
            -- Check if they have a PENDING referral
            SELECT referrer_id INTO v_referrer_id
            FROM referrals
            WHERE referee_id = v_recruit_id AND status = 'pending';

            IF v_referrer_id IS NOT NULL THEN
                -- Get Reward Amount from Settings (Singleton Row)
                SELECT referral_reward_amount INTO v_reward_amount
                FROM app_settings
                LIMIT 1;

                -- Fallback default if settings are empty
                IF v_reward_amount IS NULL THEN
                    v_reward_amount := 50.00;
                END IF;

                -- Update Referrer's Balance
                UPDATE profiles
                SET referral_balance = referral_balance + v_reward_amount
                WHERE id = v_referrer_id;

                -- Mark Referral as Completed
                UPDATE referrals
                SET status = 'completed',
                    completed_at = NOW(),
                    reward_amount = v_reward_amount
                WHERE referee_id = v_recruit_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trigger_referral_reward ON rides;

CREATE TRIGGER trigger_referral_reward
AFTER UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION process_referral_reward();

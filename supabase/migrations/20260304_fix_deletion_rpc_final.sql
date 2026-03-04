-- Final fix for delete_user_account RPC with corrected column names
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
    v_debt DECIMAL;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RETURN 'ERROR: Not authenticated';
    END IF;

    -- Check for debt on drivers table (can be customer or driver)
    SELECT commission_debt INTO v_debt FROM public.drivers WHERE id = target_user_id;
    
    IF v_debt > 0 THEN
        RETURN 'DEBT_BLOCK:' || v_debt::TEXT;
    END IF;

    -- Delete cascading data with correct column names
    DELETE FROM public.user_activities WHERE user_id = target_user_id;
    DELETE FROM public.user_saved_locations WHERE user_id = target_user_id;
    DELETE FROM public.user_favorite_businesses WHERE user_id = target_user_id;
    DELETE FROM public.user_rewards WHERE user_id = target_user_id;
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    
    -- Corrected Referrals column names
    DELETE FROM public.referrals WHERE referrer_id = target_user_id OR referee_id = target_user_id;
    
    -- Corrected Wallets column name (owner_id)
    DELETE FROM public.wallets WHERE owner_id = target_user_id;
    
    DELETE FROM public.notifications WHERE user_id = target_user_id;
    DELETE FROM public.messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;
    
    -- Corrected Reviews column name (reviewer_id)
    DELETE FROM public.reviews WHERE reviewer_id = target_user_id OR target_id = target_user_id;

    -- Handle Orders and Items
    DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE customer_id = target_user_id);
    DELETE FROM public.orders WHERE customer_id = target_user_id OR driver_id = target_user_id;
    
    DELETE FROM public.rides WHERE customer_id = target_user_id OR driver_id = target_user_id;
    
    DELETE FROM public.driver_documents WHERE driver_id = target_user_id;
    DELETE FROM public.merchant_documents WHERE merchant_id = target_user_id;
    
    DELETE FROM public.drivers WHERE id = target_user_id;
    
    -- Corrected Businesses column name (owner_id)
    DELETE FROM public.businesses WHERE owner_id = target_user_id;
    
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- Finally, delete the auth user
    -- This requires the function to be SECURITY DEFINER and the user to be deletable
    -- If auth.users deletion fails via SQL, the rest of the profile data is at least gone.
    -- In some setups, a trigger on profile deletion handles this.
    -- For now, we attempt to delete from auth.users (requires superuser or bypassrls)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN 'SUCCESS';
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$;

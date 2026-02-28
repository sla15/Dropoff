import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';

export const triggerHaptic = () => {
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            // Only vibrate if there's been some user interaction to avoid browser warnings
            if ('userActivation' in navigator && !(navigator as any).userActivation.hasBeenActive) {
                return;
            }
            navigator.vibrate(10);
        }
    } catch (e) {
        // Ignore haptic errors
    }
};

export const sendPushNotification = async (title: string, message: string, target: 'driver' | 'customer' | 'merchant' = 'customer', userId?: string) => {
    console.log(`[PUSH] ${title}: ${message}`);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const finalUserId = userId || session?.user?.id;

        if (!finalUserId) {
            console.warn("⚠️ sendPushNotification: No user ID provided or found in session.");
            return;
        }

        const { data, error } = await supabase.functions.invoke('send-fcm-notification', {
            body: {
                user_ids: [finalUserId],
                title,
                message,
                target
            }
        });

        if (error) throw error;
        console.log("✅ sendPushNotification: Edge function success:", data);
    } catch (err) {
        console.error("❌ sendPushNotification Error:", err);
    }
};

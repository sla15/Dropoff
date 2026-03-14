import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';

export const triggerHaptic = () => {
    // Vibrations disabled per user request
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

        // Correct key mismatch: Edge function expects 'userIds'
        const { data, error } = await supabase.functions.invoke('send-fcm-notification', {
            body: {
                userIds: [finalUserId],
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
export const getInitialAvatar = (name: string, size: number = 40, theme: 'light' | 'dark' = 'light') => {
    const initial = name.charAt(0).toUpperCase();
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
        '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
    ];
    const index = name.length % colors.length;
    const color = colors[index];

    // Simple SVG Data URI for an initial-based avatar
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <rect width="100%" height="100%" fill="${encodeURIComponent(color)}"/>
        <text x="50%" y="54%" font-family="Arial, sans-serif" font-size="${size / 2}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    </svg>`;
};

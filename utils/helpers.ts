import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';

/**
 * Translates a raw technical error (Supabase, Postgres, network, etc.)
 * into a customer-friendly message. The original error is always logged
 * to the console for debugging — only the UI-facing string is changed.
 */
export const friendlyError = (err: any): string => {
    if (!err) return 'Something went wrong. Please try again.';

    const msg: string = (err?.message || err?.error_description || String(err)).toLowerCase();
    const code: string = (err?.code || '').toLowerCase();

    // ── Postgres / Supabase RLS ──
    if (code === '42501' || msg.includes('row-level security') || msg.includes('row level security') || msg.includes('violates row-level')) {
        return 'You don\'t have permission to do that. Please try again or contact support.';
    }
    if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists')) {
        return 'This already exists. Please check your details and try again.';
    }
    if (code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign key')) {
        return 'A required piece of information is missing. Please try again.';
    }
    if (code === '23514' || msg.includes('violates check constraint')) {
        return 'The information you entered isn\'t valid. Please check and try again.';
    }
    if (code === 'pgrst116' || msg.includes('more than one row')) {
        return 'An unexpected data error occurred. Please try again.';
    }

    // ── Auth ──
    if (msg.includes('invalid login credentials') || msg.includes('invalid otp') || msg.includes('token has expired')) {
        return 'Your verification code is incorrect or has expired. Please request a new one.';
    }
    if (msg.includes('email not confirmed')) {
        return 'Please verify your email address before continuing.';
    }
    if (msg.includes('user already registered')) {
        return 'An account with this phone number already exists.';
    }
    if (msg.includes('session') && msg.includes('expired')) {
        return 'Your session has expired. Please log in again.';
    }

    // ── Network / connectivity ──
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('networkerror')) {
        return 'Connection failed. Please check your internet and try again.';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
        return 'The request took too long. Please check your connection and try again.';
    }

    // ── Storage ──
    if (msg.includes('payload too large') || msg.includes('file too large') || msg.includes('413')) {
        return 'The file you selected is too large. Please choose a smaller one.';
    }
    if (msg.includes('invalid file type') || msg.includes('mime')) {
        return 'This file type isn\'t supported. Please use a JPG or PNG image.';
    }

    // ── Ride-specific ──
    if (msg.includes('safety_lock_no_self_riding')) {
        return 'You can\'t book a ride for yourself as a driver.';
    }

    // ── Generic fallback — never show raw stack traces ──
    // Return a generic message rather than leaking technical details
    return 'Something went wrong. Please try again or contact support if the issue continues.';
};

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
                target,
                data: { target } // Include target in data for robust filtering
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

export const compressImage = async (file: File | Blob, maxWidth = 1024, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Image compression failed: could not create blob'));
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(new Error('Image load failed'));
        };
        reader.onerror = (err) => reject(new Error('File read failed'));
    });
};

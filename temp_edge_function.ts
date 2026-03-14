import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(serviceAccount: any) {
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: serviceAccount.token_uri,
        exp: now + 3600,
        iat: now,
    };

    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = serviceAccount.private_key
        .replace(pemHeader, "")
        .replace(pemFooter, "")
        .replace(/\s/g, "");
    
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const jwt = await create(header, claim, key);

    const response = await fetch(serviceAccount.token_uri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    const data = await response.json();
    return data.access_token;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { tokens: initialTokens, userIds, title, message, data, target } = await req.json();

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        let tokens = initialTokens || [];

        // Fetch tokens from profiles table if userIds provided
        if (userIds && userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('fcm_token')
                .in('id', userIds)
                .not('fcm_token', 'is', null);
            
            if (profiles) {
                const profileTokens = profiles.map((p: any) => p.fcm_token);
                tokens = [...new Set([...tokens, ...profileTokens])];
            }
        }

        console.log(`🔔 FCM: Sending to ${tokens?.length || 0} tokens`);

        if (!tokens || tokens.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No tokens found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
        if (!serviceAccount.project_id) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT secret not set or invalid");
        }

        const accessToken = await getAccessToken(serviceAccount);
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

        // Determine if this is a ride request notification (needs cash register sound)
        const isRideRequest = ['ride_request', 'order_request', 'batch_update', 'new_delivery'].includes(data?.type || '');
        const soundName = 'cashregistersound';
        const logoUrl = 'https://uuiqtfzgdisuuqtefrgb.supabase.co/storage/v1/object/public/avatars/logo.png';

        const results = await Promise.all(tokens.map(async (token: string) => {
            const body = {
                message: {
                    token: token,
                    notification: { 
                        title, 
                        body: message,
                        image: logoUrl 
                    },
                    data: data || {},
                    webpush: {
                        headers: { Urgency: "high" },
                        notification: {
                            icon: logoUrl,
                        },
                        fcm_options: { link: "https://ridegambia.com/dashboard" }
                    },
                    android: {
                        priority: "high",
                        notification: {
                            // Ensure common fallback if sound doesn't exist to avoid silent drop
                            sound: isRideRequest ? soundName : 'default',
                            channel_id: isRideRequest ? 'ride_requests' : 'default',
                            priority: 'max',
                            visibility: 'public',
                            icon: 'ic_launcher',
                            color: '#00E39A',
                            default_vibrate_timings: false,
                            vibrate_timings: ['0s', '0.5s', '0s', '0.5s'],
                        }
                    },
                    apns: {
                        headers: {
                            'apns-priority': '10',
                            'apns-push-type': 'alert',
                        },
                        payload: {
                            aps: {
                                sound: isRideRequest ? `${soundName}.mp3` : 'default',
                                badge: 1,
                                'content-available': 1,
                            }
                        }
                    }
                }
            };

            const response = await fetch(fcmUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            return await response.json();
        }));

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error(`❌ Edge Function Error:`, error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});

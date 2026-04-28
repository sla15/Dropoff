import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Browser } from '@capacitor/browser';
import { MapPin, RefreshCw, Settings } from 'lucide-react';
import { Theme } from '../types';

interface Props {
    theme: Theme;
    reason: 'denied' | 'disabled' | 'checking';
    onRetry: () => void;
}

export const LocationPermissionGate = ({ theme, reason, onRetry }: Props) => {
    const [isRetrying, setIsRetrying] = useState(false);

    const isDark = theme === 'dark';

    const handleOpenSettings = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                // 'app-settings:' opens the app's settings page on both Android and iOS.
                // Uses @capacitor/browser which is already installed in this project.
                await Browser.open({ url: 'app-settings:' });
            } catch {
                // Fallback: re-request permissions (may show the system prompt again)
                try {
                    await Geolocation.requestPermissions();
                    onRetry();
                } catch { /* silent */ }
            }
        } else {
            // Web: We cannot deep-link; instruct the user with a helpful message.
            alert('Please click the lock/info icon in your browser address bar and allow Location access, then tap Retry.');
        }
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            // Small delay so any system permission dialog has time to resolve
            await new Promise(res => setTimeout(res, 800));
            onRetry();
        } finally {
            setIsRetrying(false);
        }
    };

    const title = reason === 'denied'
        ? 'Location Access Required'
        : reason === 'disabled'
            ? 'Location Services Off'
            : 'Checking Location...';

    const subtitle = reason === 'denied'
        ? 'Dropoff needs your location so drivers can find you.'
        : reason === 'disabled'
            ? 'Your device\'s location services are turned off. Please enable them to use Dropoff rides.'
            : 'Please wait while we check your location settings.';

    const hint = reason === 'denied'
        ? 'Open your device settings and grant Dropoff permission to access your location.'
        : reason === 'disabled'
            ? 'Go to Settings → Location → turn on Location Services.'
            : null;

    return (
        <div
            className={`absolute inset-0 z-[50] flex flex-col items-center justify-center px-8
                ${isDark ? 'bg-[#000000]' : 'bg-[#F2F2F7]'}`}
        >
            {/* Animated Glow Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className={`absolute top-[20%] left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full blur-[100px]
                        ${isDark ? 'bg-[#00D68F]/8' : 'bg-[#00D68F]/12'}`}
                />
            </div>

            {/* Icon */}
            <div className="relative mb-8">
                {/* Outer pulse ring */}
                <div
                    className="absolute inset-0 rounded-full animate-ping opacity-20"
                    style={{
                        background: reason === 'checking' ? '#00D68F' : '#EF4444',
                        animationDuration: '2s',
                        transform: 'scale(1.6)'
                    }}
                />
                {/* Icon container */}
                <div
                    className="w-24 h-24 rounded-full flex items-center justify-center relative z-10"
                    style={{
                        background: reason === 'checking'
                            ? 'rgba(0, 214, 143, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        border: `1.5px solid ${reason === 'checking' ? 'rgba(0,214,143,0.25)' : 'rgba(239,68,68,0.25)'}`
                    }}
                >
                    <MapPin
                        size={40}
                        className={reason === 'checking' ? 'text-[#00D68F]' : 'text-red-400'}
                        style={reason === 'checking' ? {
                            animation: 'bounce 1s infinite'
                        } : {}}
                    />
                </div>
            </div>

            {/* Text Content */}
            <div className="text-center mb-10 relative z-10">
                <h1
                    className={`text-2xl font-black tracking-tight mb-3
                        ${isDark ? 'text-white' : 'text-[#000000]'}`}
                >
                    {title}
                </h1>
                <p
                    className={`text-sm font-medium leading-relaxed mb-4
                        ${isDark ? 'text-[#98989D]' : 'text-[#8E8E93]'}`}
                >
                    {subtitle}
                </p>
                {hint && (
                    <div
                        className={`mt-2 px-4 py-3 rounded-2xl text-xs font-semibold leading-relaxed
                            ${isDark ? 'bg-white/5 text-[#EBEBF5]/70' : 'bg-black/5 text-[#636366]'}`}
                    >
                        {hint}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {reason !== 'checking' && (
                <div className="w-full max-w-xs flex flex-col gap-3 relative z-10">
                    {/* Primary: Open Settings */}
                    <button
                        onClick={handleOpenSettings}
                        className="w-full py-4 rounded-2xl bg-[#00D68F] text-black font-black text-base
                            active:scale-[0.97] transition-all shadow-lg shadow-[#00D68F]/30
                            flex items-center justify-center gap-2.5"
                    >
                        <Settings size={18} />
                        Open Location Settings
                    </button>

                    {/* Secondary: Retry */}
                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className={`w-full py-4 rounded-2xl font-semibold text-base
                            active:scale-[0.97] transition-all flex items-center justify-center gap-2.5
                            disabled:opacity-60
                            ${isDark ? 'bg-[#1C1C1E] text-[#EBEBF5]' : 'bg-white text-[#000000]'}
                            shadow-sm`}
                    >
                        <RefreshCw
                            size={16}
                            className={isRetrying ? 'animate-spin' : ''}
                        />
                        {isRetrying ? 'Checking...' : 'I\'ve Enabled It — Retry'}
                    </button>
                </div>
            )}

            {/* Bottom label */}
            <p
                className={`mt-8 text-[11px] font-semibold text-center relative z-10
                    ${isDark ? 'text-[#636366]' : 'text-[#AEAEB2]'}`}
            >
                Your location is only used to match you with nearby drivers
                {'\n'}and is never stored without your consent.
            </p>
        </div>
    );
};

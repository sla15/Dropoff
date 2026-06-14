import React, { useState, useEffect, useRef } from 'react';
import { Gift, Copy, Share2, Award, Sparkles, Users, ChevronRight } from 'lucide-react';
import { Theme, Screen, Reward, AppSettings } from '../types';
import { triggerHaptic } from '../utils/helpers';
import { supabase } from '../supabaseClient';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    isScrolling: boolean;
    isNavVisible: boolean;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    settings: any;
    showAlert: (
        title: string,
        message: string,
        type?: 'success' | 'error' | 'info',
        onConfirm?: () => void,
        showCancel?: boolean,
        confirmText?: string,
        cancelText?: string,
        onCancel?: () => void
    ) => void;
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dropoffgambia.customer';
const APP_STORE_URL = 'https://apps.apple.com/app/dropoff-gambia/id6478229445';

const getStoreUrl = (): string => {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return APP_STORE_URL;
    return PLAY_STORE_URL; // android + web fallback to Play Store
};

export const EarnScreen = ({ theme, navigate, isScrolling, isNavVisible, handleScroll, settings, showAlert }: Props) => {
    const [copied, setCopied] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referralBalance, setReferralBalance] = useState(0);
    const [activeRewards, setActiveRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [headerHeight, setHeaderHeight] = useState(115);
    const headerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (headerRef.current) {
            setHeaderHeight(headerRef.current.offsetHeight);
        }
    }, []);

    const isDark = theme === 'dark';
    const bgMain = isDark ? 'bg-[#000000]' : 'bg-[#F2F2F7]';
    const bgCard = isDark ? 'bg-[#1C1C1E]' : 'bg-white';
    const textMain = isDark ? 'text-white' : 'text-[#000000]';
    const textSec = isDark ? 'text-[#98989D]' : 'text-[#8E8E93]';

    const rewardAmount = Number(settings?.referral_reward_amount || 0).toFixed(2);
    const currSym = settings?.currency_symbol || 'D';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('referral_code, referral_balance, full_name')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    setReferralBalance(profile.referral_balance || 0);

                    if (profile.referral_code) {
                        setReferralCode(profile.referral_code);
                    } else {
                        const namePart = (profile.full_name || 'USER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
                        const randomPart = Math.floor(1000 + Math.random() * 9000);
                        const newCode = `${namePart}${randomPart}`;
                        await supabase.from('profiles').update({ referral_code: newCode }).eq('id', session.user.id);
                        setReferralCode(newCode);
                    }
                }

                const { data: rewards } = await supabase
                    .from('user_rewards')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('is_used', false)
                    .gt('expiry_date', new Date().toISOString());

                if (rewards) setActiveRewards(rewards as Reward[]);

            } catch (err) {
                console.error('Earn Logic Error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const copyCode = () => {
        triggerHaptic();
        if (referralCode) {
            navigator.clipboard.writeText(referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const shareCode = async () => {
        triggerHaptic();
        const storeUrl = getStoreUrl();
        const shareText = `Join me on Dropoff! Use my code ${referralCode} when you sign up 🎉\n\nDownload the app: ${storeUrl}`;

        try {
            if (Capacitor.isNativePlatform()) {
                // Use official Capacitor native share plugin on iOS/Android
                await Share.share({
                    title: 'Join Dropoff & earn rewards!',
                    text: shareText,
                    url: storeUrl,
                    dialogTitle: 'Share with friends',
                });
            } else if (navigator.share) {
                // Use Web Share API on mobile browsers that support it
                await navigator.share({
                    title: 'Join Dropoff & earn rewards!',
                    text: shareText,
                    url: storeUrl,
                });
            } else {
                // Fallback for desktop browsers: copy to clipboard
                navigator.clipboard.writeText(shareText).then(() => {
                    showAlert('Link Copied!', 'Share link copied to clipboard.', 'success');
                });
            }
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                console.warn('Share failed:', e);
            }
        }
    };

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in relative`}>
            {/* Header */}
            <div ref={headerRef} className={`absolute top-0 left-0 right-0 z-20 pt-safe px-6 pb-4 ${theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]'} border-b ${theme === 'light' ? 'border-gray-200/50' : 'border-white/5'} transition-all`}>
                <h1 className="text-3xl font-black tracking-tight">Gifts &amp; Earn</h1>
                <p className={`text-sm mt-1 font-medium ${textSec}`}>Share your code. Earn every time.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-32" style={{ paddingTop: headerHeight }} onScroll={handleScroll}>

                {/* ── Hero Invite Card (Apple-style tilt + premium shadow) ── */}
                <div
                    className="mt-6 mb-8 relative"
                    style={{ perspective: '1000px' }}
                >
                    {/* Ambient glow behind card */}
                    <div
                        className="absolute inset-0 rounded-[32px] blur-3xl opacity-30 scale-95"
                        style={{ background: 'linear-gradient(135deg, #00D68F 0%, #00B8A9 50%, #00E5FF 100%)' }}
                    />

                    {/* The card itself — slightly tilted */}
                    <div
                        className="relative rounded-[32px] p-6 text-black overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, #00D68F 0%, #00C49A 40%, #00B8D4 100%)',
                            transform: 'rotate(-1.5deg) translateZ(0)',
                            boxShadow: '0 24px 60px -10px rgba(0,214,143,0.55), 0 8px 20px -5px rgba(0,0,0,0.15)',
                            willChange: 'transform',
                        }}
                    >
                        {/* Decorative circles */}
                        <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full" />
                        <div className="absolute -bottom-14 -left-8 w-48 h-48 bg-black/5 rounded-full" />
                        <div className="absolute top-4 right-4 w-20 h-20 bg-white/5 rounded-full" />

                        {/* Content */}
                        <div className="relative z-10">
                            {/* Icon */}
                            <div className="w-14 h-14 bg-black/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                                <Gift size={26} className="text-black" />
                            </div>

                            <p className="text-black/80 text-xs font-black uppercase tracking-widest mb-1">Referral Program</p>
                            <h2 className="text-4xl font-black tracking-tight leading-none mb-1">
                                {currSym}{rewardAmount}
                            </h2>
                            <p className="text-lg font-bold text-black/90 mb-1">reward for you</p>
                            <p className="text-sm text-black/80 font-medium mb-6 leading-relaxed">
                                Share your code. When a friend signs up and completes their first ride or delivery, you earn a reward.
                            </p>

                            {/* Code + Action Row */}
                            <div className="flex gap-2">
                                {/* Code pill */}
                                <div className="flex-1 bg-black/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center justify-between border border-white/20">
                                    <span className="font-mono font-black tracking-widest text-base">
                                        {loading ? '••••••' : (referralCode || 'Generating...')}
                                    </span>
                                    <button
                                        onClick={copyCode}
                                        className="ml-2 w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 bg-white/20 hover:bg-white/30 active:scale-90 transition-all"
                                    >
                                        {copied
                                            ? <span className="text-[10px] font-black">✓</span>
                                            : <Copy size={15} />
                                        }
                                    </button>
                                </div>

                                {/* Share button */}
                                <button
                                    onClick={shareCode}
                                    className="bg-black text-white px-5 rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform font-bold text-sm"
                                >
                                    <Share2 size={16} />
                                    <span>Share</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── How it Works strip ── */}
                <div className={`${bgCard} rounded-[24px] p-5 mb-6 border ${isDark ? 'border-white/5' : 'border-black/5'} shadow-sm`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-4`}>How It Works</p>
                    <div className="flex items-start gap-4">
                        {[
                            { icon: Share2, label: 'Share your code with a friend', step: '1' },
                            { icon: Users, label: 'They sign up & complete their first ride', step: '2' },
                            { icon: Sparkles, label: `You get ${currSym}${rewardAmount} added to your balance`, step: '3' },
                        ].map(({ icon: Icon, label, step }) => (
                            <div key={step} className="flex-1 flex flex-col items-center text-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center">
                                    <Icon size={18} className="text-[#00D68F]" />
                                </div>
                                <p className={`text-[11px] font-semibold leading-snug ${textSec}`}>{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Rewards Balance Card ── */}
                <div className={`${bgCard} rounded-[24px] p-6 mb-6 border ${isDark ? 'border-white/5' : 'border-black/5'} shadow-sm`}>
                    <p className={`text-[10px] font-black tracking-widest uppercase ${textSec} mb-1`}>Your Rewards Balance</p>
                    <div className="flex items-end justify-between">
                        <div>
                            <h3 className="text-4xl font-black tracking-tight">
                                {currSym}{(referralBalance || 0).toFixed(2)}
                            </h3>
                            <p className={`text-xs font-semibold mt-1 ${textSec}`}>
                                Available to use on your next ride or order
                            </p>
                        </div>
                        {/* Badge indicator */}
                        {referralBalance > 0 && (
                            <div className="w-12 h-12 rounded-full bg-[#00D68F]/10 flex items-center justify-center">
                                <Sparkles size={20} className="text-[#00D68F]" />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Active Rewards / Vouchers ── */}
                <h3 className={`font-black text-base mb-3 ${textSec} uppercase tracking-widest text-[10px]`}>Active Rewards</h3>
                <div className="space-y-3">
                    {!loading && activeRewards.length === 0 && (
                        <div className={`${bgCard} p-8 rounded-[24px] border-2 border-dashed ${isDark ? 'border-white/10' : 'border-black/10'} flex flex-col items-center justify-center text-center`}>
                            <div className="w-14 h-14 rounded-full bg-[#00D68F]/10 flex items-center justify-center mb-3">
                                <Gift size={24} className="text-[#00D68F]" />
                            </div>
                            <p className={`font-bold text-sm ${textMain}`}>No active rewards yet</p>
                            <p className={`text-xs mt-1 ${textSec}`}>Invite friends to earn perks &amp; vouchers!</p>
                        </div>
                    )}

                    {activeRewards.map(reward => (
                        <div
                            key={reward.id}
                            className={`${bgCard} p-4 rounded-[20px] flex items-center gap-4 border ${isDark ? 'border-white/5' : 'border-black/5'} shadow-sm cursor-pointer active:scale-[0.98] transition-all`}
                        >
                            <div className={`w-12 h-12 rounded-2xl ${reward.type.includes('delivery') ? 'bg-blue-500/10' : 'bg-orange-500/10'} flex items-center justify-center flex-shrink-0`}>
                                {reward.type.includes('delivery')
                                    ? <Award size={22} className="text-blue-500" />
                                    : <Gift size={22} className="text-orange-500" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm truncate">{reward.title}</h4>
                                <p className={`text-xs ${textSec} font-medium truncate`}>{reward.description}</p>
                            </div>
                            <ChevronRight size={16} className={`${textSec} opacity-40 flex-shrink-0`} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

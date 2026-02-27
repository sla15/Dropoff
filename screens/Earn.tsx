
import React, { useState, useEffect } from 'react';
import { Gift, Copy, Share2, ChevronRight, Award } from 'lucide-react';
import { Theme, Screen, Reward, AppSettings } from '../types';
import { triggerHaptic } from '../utils/helpers';
import { supabase } from '../supabaseClient';

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

export const EarnScreen = ({ theme, navigate, isScrolling, isNavVisible, handleScroll, settings, showAlert }: Props) => {
    const [copied, setCopied] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referralBalance, setReferralBalance] = useState(0);
    const [activeRewards, setActiveRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                // 1. Fetch Profile for Code & Balance
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
                        // Generate Code if missing: Firstname + 4 random digits
                        const namePart = (profile.full_name || 'USER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
                        const randomPart = Math.floor(1000 + Math.random() * 9000);
                        const newCode = `${namePart}${randomPart}`;

                        await supabase
                            .from('profiles')
                            .update({ referral_code: newCode })
                            .eq('id', session.user.id);

                        setReferralCode(newCode);
                    }
                }

                // 2. Fetch Active Rewards
                const { data: rewards } = await supabase
                    .from('user_rewards')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('is_used', false)
                    .gt('expiry_date', new Date().toISOString());

                if (rewards) {
                    setActiveRewards(rewards as Reward[]);
                }

            } catch (err) {
                console.error("Earn Logic Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Subscription would go here...
    }, []);

    const copyCode = () => {
        triggerHaptic();
        if (referralCode) {
            navigator.clipboard.writeText(referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in`}>
            <div className="pt-safe px-6 pb-6">
                <h1 className="text-3xl font-black tracking-tight">Gifts & Earn</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-32" onScroll={handleScroll}>
                {/* Hero Card */}
                <div className="bg-[#00D68F] rounded-[32px] p-6 text-black shadow-[0_20px_40px_-15px_rgba(0,214,143,0.5)] mb-6 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                            <Gift size={24} className="text-black" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-2 leading-tight">Invite friends,<br />get {settings.currency_symbol}{Number(settings.referral_reward_amount || 0).toFixed(2)}</h2>
                        <p className="opacity-80 mb-6 text-sm font-bold tracking-wide">Share your code and earn rewards when your friends take their first ride or order.</p>

                        <div className="flex gap-3">
                            <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between border border-black/5">
                                <span className="font-mono font-bold tracking-widest">
                                    {loading ? "..." : (referralCode || "Generating...")}
                                </span>
                                <button onClick={copyCode} className="p-1.5 hover:bg-black/10 rounded-lg transition-colors">
                                    {copied ? <span className="text-xs font-bold">Copied!</span> : <Copy size={18} />}
                                </button>
                            </div>
                            <button className="bg-black text-white px-4 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                                <Share2 size={18} />
                            </button>
                        </div>
                    </div>
                    {/* Decor */}
                    <div className="absolute -right-4 -bottom-12 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-yellow-300/30 rounded-full blur-xl"></div>
                </div>

                {/* Balance */}
                <div className={`${bgCard} rounded-[24px] p-6 mb-8 flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-black/5 dark:border-white/5`}>
                    <div>
                        <p className={`text-[10px] font-black tracking-widest uppercase ${textSec} mb-1`}>Rewards Balance</p>
                        <h3 className="text-3xl font-black">D{(referralBalance || 0).toFixed(2)}</h3>
                    </div>
                    <button className={`${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/10 hover:bg-white/20'} px-5 py-2.5 rounded-full text-sm font-bold transition-colors active:scale-95`}>
                        History
                    </button>
                </div>

                {/* Active Rewards / Offers */}
                <h3 className="font-bold text-lg mb-4">Active Rewards</h3>
                <div className="space-y-3">
                    {activeRewards.length === 0 && !loading && (
                        <div className={`p-8 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center opacity-60`}>
                            <Gift size={32} className="mb-2" />
                            <p className="font-bold">No active rewards</p>
                            <p className="text-xs">Invite friends to earn some perks!</p>
                        </div>
                    )}

                    {activeRewards.map(reward => (
                        <div key={reward.id} className={`${bgCard} p-4 rounded-2xl flex items-center gap-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border border-transparent dark:border-white/5 cursor-pointer active:scale-[0.98] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)]`}>
                            <div className={`w-12 h-12 rounded-full ${reward.type.includes('delivery') ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center`}>
                                {reward.type.includes('delivery') ? <Award size={24} /> : <Gift size={24} />}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold">{reward.title}</h4>
                                <p className={`text-xs ${textSec} font-medium`}>{reward.description}</p>
                            </div>
                            <ChevronRight size={16} className={`${textSec} opacity-50`} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

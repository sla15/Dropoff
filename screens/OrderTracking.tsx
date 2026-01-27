
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, Truck, Home, Star, Phone, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { Theme, Screen, UserData, Activity } from '../types';
import { triggerHaptic, GreenGlow, sendPushNotification } from '../index';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    user: UserData;
    setRecentActivity: React.Dispatch<React.SetStateAction<Activity[]>>;
}

type OrderStatus = 'preparing' | 'picked-up' | 'arriving' | 'delivered';

export const OrderTrackingScreen = ({ theme, navigate, user, setRecentActivity }: Props) => {
    const [status, setStatus] = useState<OrderStatus>('preparing');
    const [progress, setProgress] = useState(25);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    useEffect(() => {
        // Mocking the delivery lifecycle
        const timers = [
            setTimeout(() => {
                sendPush("Order Accepted", "Your order has been accepted by the merchant!");
            }, 2000),
            setTimeout(() => {
                sendPush("Order Prepared", "Your order is being prepared.");
            }, 5000),
            setTimeout(() => {
                sendPush("Order Ready", "Your order is ready for pickup!");
            }, 8000),
            setTimeout(() => {
                setStatus('picked-up');
                setProgress(50);
                sendPush("Delivery Partner", "The delivery partner is on the way!");
            }, 12000),
            setTimeout(() => {
                setStatus('arriving');
                setProgress(85);
                sendPush("Delivery Partner", "The delivery partner has arrived!");
            }, 22000),
            setTimeout(() => {
                setStatus('delivered');
                setProgress(100);
                sendPush("SuperApp Market", "Order delivered! Enjoy your meal.");

                const newActivity: Activity = {
                    id: Math.random().toString(),
                    type: 'order',
                    title: 'Market Order',
                    subtitle: 'Food Delivery',
                    price: 250,
                    date: 'Just now',
                    status: 'completed'
                };
                setRecentActivity(prev => [newActivity, ...prev]);
            }, 28000)
        ];

        return () => timers.forEach(clearTimeout);
    }, []);

    const sendPush = (title: string, msg: string) => {
        sendPushNotification(title, msg);
    };

    const statusConfig = {
        preparing: { label: 'Preparing your order', icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        'picked-up': { label: 'Out for delivery', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        arriving: { label: 'Arriving now', icon: Truck, color: 'text-[#00D68F]', bg: 'bg-[#00D68F]/10' },
        delivered: { label: 'Delivered', icon: Home, color: 'text-[#00D68F]', bg: 'bg-[#00D68F]/10' }
    };

    const Config = statusConfig[status];

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} relative overflow-hidden`}>
            <GreenGlow />

            <div className="pt-safe px-6 pb-6 flex items-center justify-between z-10">
                <button onClick={() => navigate('dashboard')} className={`w-10 h-10 rounded-full ${bgCard} shadow-lg flex items-center justify-center active:scale-95 transition-transform`}>
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                    <h1 className="font-bold">Order Tracking</h1>
                    <p className={`text-[10px] ${textSec} uppercase tracking-widest font-black`}>Order #42991</p>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 px-6 pb-40 overflow-y-auto z-10">
                <div className={`${bgCard} rounded-[32px] p-8 shadow-sm relative overflow-hidden`}>
                    <div className="flex flex-col items-center mb-8">
                        <div className={`w-28 h-28 ${Config.bg} rounded-full flex items-center justify-center ${Config.color} mb-6 relative`}>
                            <Config.icon size={48} className={status !== 'delivered' ? 'animate-bounce' : ''} />
                            {status !== 'delivered' && (
                                <div className="absolute inset-0 rounded-full border-4 border-current border-t-transparent animate-spin opacity-20"></div>
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-center mb-2">{Config.label}</h2>
                        <p className={`text-center ${textSec} font-medium`}>Estimated arrival: {status === 'preparing' ? '25 min' : (status === 'delivered' ? 'Completed' : '5-8 min')}</p>
                    </div>

                    <div className="relative h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-12">
                        <div
                            className="absolute top-0 left-0 h-full bg-[#00D68F] transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 opacity-100">
                            <div className={`w-8 h-8 rounded-full ${progress >= 25 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 25 && 'opacity-50'}`}>Order Received</p>
                                <p className={`text-[10px] ${textSec}`}>10:04 AM</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full ${progress >= 50 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 50 && 'opacity-50'}`}>Pick up from Merchant</p>
                                <p className={`text-[10px] ${textSec}`}>{status === 'preparing' ? 'Pending' : '10:12 AM'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full ${progress >= 100 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 100 && 'opacity-50'}`}>Delivered Successfully</p>
                                <p className={`text-[10px] ${textSec}`}>Waiting...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${bgCard} mt-6 rounded-[28px] p-6 shadow-sm`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full border-2 border-[#00D68F] bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100)' }}></div>
                            <div>
                                <h3 className="font-bold">Momodou Bah</h3>
                                <p className={`text-[10px] uppercase font-black text-[#00D68F]`}>Delivery Expert</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a href="tel:+2201234567" className={`w-10 h-10 rounded-full ${inputBg} flex items-center justify-center text-[#00D68F] active:scale-95 transition-transform`}>
                                <Phone size={20} />
                            </a>
                            <a href="sms:+2201234567" className={`w-10 h-10 rounded-full ${inputBg} flex items-center justify-center text-[#00D68F] active:scale-95 transition-transform`}>
                                <MessageSquare size={20} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


import React from 'react';
import { Car, ShoppingBag, Home, User, Gift, LogOut } from 'lucide-react';
import { Screen, Theme } from '../types';

interface NavProps {
    active: Screen;
    navigate: (scr: Screen) => void;
    theme: Theme;
    isScrolling?: boolean;
    isNavVisible?: boolean;
}

export const BottomNav = ({ active, navigate, theme, isScrolling, isNavVisible = true }: NavProps) => {
    if (active === 'checkout' || active === 'business-detail' || active === 'order-tracking') return null;

    return (
        <div className={`fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isNavVisible ? 'nav-visible' : 'nav-hidden'}`}>
            <div
                className={`
          pointer-events-auto
          ${theme === 'light' ? 'bg-white/80 text-black border-white' : 'bg-[#1C1C1E]/80 text-white border-white/5'} 
          backdrop-blur-2xl rounded-[32px] px-2 shadow-2xl flex items-center justify-between relative border ring-1 ring-black/5
          transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isScrolling ? 'w-[320px] py-1.5' : 'w-[92%] md:w-[400px] py-3'}
        `}
            >

                <button onClick={() => navigate('ride')} className="flex flex-1 flex-col items-center gap-1.5 active:scale-98 transition-transform">
                    <Car size={isScrolling ? 22 : 20} className={active === 'ride' ? 'text-[#00D68F]' : 'opacity-40'} strokeWidth={active === 'ride' ? 2.5 : 2} />
                    <div className={`transition-all duration-300 ${isScrolling ? 'h-0 opacity-0 overflow-hidden' : 'h-4 opacity-100'}`}>
                        <span className={`text-[10px] font-bold ${active === 'ride' ? 'text-[#00D68F]' : 'opacity-40'}`}>Ride</span>
                    </div>
                </button>

                <button onClick={() => navigate('marketplace')} className="flex flex-1 flex-col items-center gap-1.5 active:scale-98 transition-transform">
                    <ShoppingBag size={isScrolling ? 22 : 20} className={active === 'marketplace' ? 'text-[#00D68F]' : 'opacity-40'} strokeWidth={active === 'marketplace' ? 2.5 : 2} />
                    <div className={`transition-all duration-300 ${isScrolling ? 'h-0 opacity-0 overflow-hidden' : 'h-4 opacity-100'}`}>
                        <span className={`text-[10px] font-bold ${active === 'marketplace' ? 'text-[#00D68F]' : 'opacity-40'}`}>Market</span>
                    </div>
                </button>

                <div className="relative w-12 flex justify-center">
                    <button
                        onClick={() => navigate('dashboard')}
                        className={`absolute w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-[4px] transition-all duration-500 active:scale-98 ${theme === 'light' ? 'bg-[#00D68F] text-black border-[#F2F2F7]' : 'bg-[#00D68F] text-black border-black'} -top-8 scale-100`}
                    >
                        <Home size={24} fill="currentColor" strokeWidth={2.5} />
                    </button>
                </div>

                <button onClick={() => navigate('profile')} className="flex flex-1 flex-col items-center gap-1.5 active:scale-98 transition-transform">
                    <User size={isScrolling ? 22 : 20} className={active === 'profile' ? 'text-[#00D68F]' : 'opacity-40'} strokeWidth={active === 'profile' ? 2.5 : 2} />
                    <div className={`transition-all duration-300 ${isScrolling ? 'h-0 opacity-0 overflow-hidden' : 'h-4 opacity-100'}`}>
                        <span className={`text-[10px] font-bold ${active === 'profile' ? 'text-[#00D68F]' : 'opacity-40'}`}>Profile</span>
                    </div>
                </button>

                <button onClick={() => navigate('earn')} className="flex flex-1 flex-col items-center gap-1.5 active:scale-98 transition-transform">
                    <Gift size={isScrolling ? 22 : 20} className={active === 'earn' ? 'text-[#00D68F]' : 'opacity-40'} strokeWidth={active === 'earn' ? 2.5 : 2} />
                    <div className={`transition-all duration-300 ${isScrolling ? 'h-0 opacity-0 overflow-hidden' : 'h-4 opacity-100'}`}>
                        <span className={`text-[10px] font-bold ${active === 'earn' ? 'text-[#00D68F]' : 'opacity-40'}`}>Gifts</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export const Sidebar = ({ active, navigate, theme }: NavProps) => {
    const items = [
        { id: 'dashboard', icon: Home, label: 'Home' },
        { id: 'ride', icon: Car, label: 'Ride' },
        { id: 'marketplace', icon: ShoppingBag, label: 'Marketplace' },
        { id: 'earn', icon: Gift, label: 'Gifts & Earn' },
        { id: 'profile', icon: User, label: 'Profile' },
    ];

    return (
        <div className={`hidden md:flex flex-col w-64 h-full ${theme === 'light' ? 'bg-white border-r border-gray-200' : 'bg-[#1C1C1E] border-r border-gray-800'} p-6 transition-colors`}>
            <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-[#00D68F] rounded-xl flex items-center justify-center text-black">
                    <div className="w-6 h-6 border-2 border-black rounded-full"></div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">SuperApp</h1>
            </div>

            <nav className="flex-1 space-y-2">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => navigate(item.id as Screen)}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all ${active === item.id
                            ? 'bg-[#00D68F]/10 text-[#00D68F]'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <item.icon size={22} strokeWidth={active === item.id ? 2.5 : 2} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => navigate('onboarding')} className="flex items-center gap-3 text-red-500 font-bold px-4 py-2 opacity-80 hover:opacity-100">
                    <LogOut size={20} />
                    <span>Log Out</span>
                </button>
            </div>
        </div>
    );
};

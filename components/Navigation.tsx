
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
          ${theme === 'light' ? 'bg-white/50 text-black border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)]' : 'bg-[#1C1C1E]/40 text-white border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.3)]'} 
          backdrop-blur-2xl rounded-full px-6 flex items-center justify-center gap-2 relative
          w-fit mx-auto py-2 overflow-visible border-[0.5px] min-w-[280px]
        `}
            >
                {/* Liquid Top Highlighter */}
                <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-70`}></div>
                <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00D68F]/20 to-transparent opacity-50 blur-[1px]`}></div>

                <NavItem
                    active={active === 'ride'}
                    onClick={() => navigate('ride')}
                    icon={Car}
                    label="Ride"
                    theme={theme}
                />

                <NavItem
                    active={active === 'marketplace'}
                    onClick={() => navigate('marketplace')}
                    icon={ShoppingBag}
                    label="Market"
                    theme={theme}
                />

                <NavItem
                    active={active === 'dashboard'}
                    onClick={() => navigate('dashboard')}
                    icon={Home}
                    label="Home"
                    theme={theme}
                    isHome
                />

                <NavItem
                    active={active === 'profile'}
                    onClick={() => navigate('profile')}
                    icon={User}
                    label="Profile"
                    theme={theme}
                />

                <NavItem
                    active={active === 'earn'}
                    onClick={() => navigate('earn')}
                    icon={Gift}
                    label="Gifts"
                    theme={theme}
                />
            </div>
        </div>
    );
};

const NavItem = ({ active, onClick, icon: Icon, label, theme, isHome }: { active: boolean, onClick: () => void, icon: any, label: string, theme: Theme, isHome?: boolean }) => {
    const iconSize = isHome ? 24 : 26;

    return (
        <div className="relative flex flex-col items-center">
            <button
                onClick={onClick}
                className={`
                    flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${active
                        ? 'w-14 h-14 rounded-full bg-[#00D68F] text-black shadow-xl -translate-y-1.5 border-[4px]'
                        : 'w-12 h-12 rounded-2xl text-current opacity-40 hover:opacity-100 active:scale-95'
                    }
                    ${active && theme === 'light' ? 'border-white' : active ? 'border-[#1C1C1E]' : 'border-transparent'}
                `}
            >
                <Icon size={iconSize} strokeWidth={active ? 2.5 : 2} fill={active ? 'currentColor' : 'none'} />
            </button>
            <span className={`
                absolute -bottom-1 text-[10px] font-black transition-all duration-500
                ${active ? 'opacity-100 translate-y-0 scale-100 text-[#00D68F]' : 'opacity-0 translate-y-2 scale-75'}
            `}>
                {label}
            </span>
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
                <h1 className="text-2xl font-bold tracking-tight">DROPOFF</h1>
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

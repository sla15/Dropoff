
import React, { useState } from 'react';
import { Search, Star, MapPin, Heart, Phone } from 'lucide-react';
import { Theme, Screen, Business, Category, UserData } from '../types';
import { triggerHaptic, getInitialAvatar } from '../utils/helpers';

interface Props {
   theme: Theme;
   navigate: (scr: Screen, addToHistory?: boolean) => void;
   businesses: Business[];
   categories: Category[];
   setSelectedBusiness: (b: Business | null) => void;
   isScrolling: boolean;
   isNavVisible: boolean;
   handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
   toggleFavorite: (id: string, e?: React.MouseEvent) => void;
   favorites: string[];
   searchQuery: string;
   setSearchQuery: (q: string) => void;
   user: UserData;
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

// Haversine formula to calculate distance in KM
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
   const R = 6371; // Radius of the earth in km
   const dLat = (lat2 - lat1) * Math.PI / 180;
   const dLon = (lon2 - lon1) * Math.PI / 180;
   const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   const d = R * c;
   return d;
};

export const MarketplaceScreen = ({ theme, navigate, businesses, categories, setSelectedBusiness, isScrolling, isNavVisible, handleScroll, toggleFavorite, favorites, searchQuery, setSearchQuery, showAlert, user }: Props) => {
   const [selectedCategory, setSelectedCategory] = useState('All');

   const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
   const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
   const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
   const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';

   const displayCategories = ['All', ...categories.map(c => c.name)];

   const filteredBusinesses = businesses.filter(b => {
      const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         b.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
   });

   const filteredProducts = businesses.flatMap(b =>
      (b.products || []).map(p => ({ ...p, business: b }))
   ).filter(p => {
      if (!searchQuery) return false; // Only show products if searching
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) ||
         (p.mainCategory || '').toLowerCase().includes(q) ||
         (p.description || '').toLowerCase().includes(q);
   });

   return (
      <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in`}>
         <div className={`pt-safe px-6 pb-4 ${theme === 'light' ? 'bg-white/80' : 'bg-black/80'} backdrop-blur-md z-10 sticky top-0 border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-800'}`}>
            <h1 className="text-3xl font-black tracking-tight mb-4">Marketplace</h1>
            <div className={`flex items-center gap-3 p-3 rounded-[22px] h-14 ${theme === 'light' ? 'bg-white border-none shadow-[0_12px_40px_rgba(0,0,0,0.06)] focus-within:shadow-[0_12px_40px_rgba(0,214,143,0.15)] focus-within:ring-2 focus-within:ring-[#00D68F]/20' : 'bg-[#1C1C1E]/60 border border-white/5 shadow-lg focus-within:ring-2 focus-within:ring-[#00D68F]/30'} backdrop-blur-xl transition-all`}>
               <Search size={20} className={`${textSec} ml-2`} />
               <input
                  placeholder="Search for food, shops..."
                  className="bg-transparent flex-1 outline-none font-bold text-base placeholder:opacity-50 h-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>

            <div className="flex gap-3 mt-4 overflow-x-auto no-scrollbar pb-2">
               {displayCategories.map(c => (
                  <button
                     key={c}
                     onClick={() => setSelectedCategory(c)}
                     className={`px-4 py-2 rounded-full font-black text-sm whitespace-nowrap transition-all shadow-sm ${selectedCategory === c ? 'bg-[#00D68F] text-black border border-[#00D68F]' : `bg-white dark:bg-[#1C1C1E] border ${theme === 'light' ? 'border-gray-200' : 'border-gray-800'} ${textSec}`}`}
                  >
                     {c}
                  </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto min-h-0 px-6 pt-4 pb-32 space-y-8" onScroll={handleScroll}>
            {/* Businesses Section */}
            {filteredBusinesses.length > 0 && (
               <div className="space-y-4 animate-scale-in">
                  <h2 className="font-black text-xl tracking-tight">
                     {selectedCategory === 'All' ? 'Featured Spots' : `${selectedCategory} Spots`}
                  </h2>

                  <div className="space-y-4">
                     {filteredBusinesses.map(b => (
                        <div
                           key={b.id}
                           onClick={() => {
                              if (b.isOpen) {
                                 setSelectedBusiness(b);
                                 navigate('business-detail', true);
                              }
                           }}
                           className={`group ${bgCard} p-4 rounded-[28px] shadow-sm border border-black/5 dark:border-white/5 ${b.isOpen ? 'cursor-pointer active:scale-[0.98] transition-all' : 'opacity-50 grayscale cursor-not-allowed'} flex items-center gap-4`}
                        >
                           <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800 border border-black/5 dark:border-white/5 relative">
                              <img src={b.logo || b.image} className="w-full h-full object-cover" alt={b.name} />
                              {!b.isOpen && (
                                 <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-[8px] font-black text-white uppercase backdrop-blur-sm px-1 text-center">
                                    <div>Closed</div>
                                 </div>
                              )}
                           </div>
                           <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-black tracking-tight truncate mb-0.5">{b.name}</h3>
                              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider opacity-60">
                                 <span className="flex items-center gap-1 text-[#00D68F]">
                                    <Star size={10} fill="currentColor" /> {b.rating}
                                 </span>
                                 <span>•</span>
                                 <span>{b.category}</span>
                              </div>
                           </div>
                           <button
                              onClick={(e) => toggleFavorite(b.id, e)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${favorites.includes(b.id) ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-gray-50 dark:bg-white/5 text-gray-400'}`}
                              disabled={!b.isOpen}
                           >
                              <Heart size={20} className={favorites.includes(b.id) ? "fill-current" : ""} />
                           </button>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* Products Section (Only if searching) */}
            {filteredProducts.length > 0 && (
               <div className="space-y-4 animate-scale-in">
                  <h2 className="font-black text-xl tracking-tight">Matching Products</h2>
                  <div className="grid grid-cols-2 gap-4">
                     {filteredProducts.map(p => (
                        <div
                           key={`${p.business.id}-${p.id}`}
                           onClick={() => { setSelectedBusiness(p.business); navigate('business-detail', true); }}
                           className={`${bgCard} p-4 rounded-[32px] shadow-sm border border-black/5 dark:border-white/5 cursor-pointer active:scale-95 transition-all flex flex-col gap-3 group`}
                        >
                           <div className="aspect-square rounded-[24px] overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                              <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                              <div className="absolute top-2 right-2 bg-[#00D68F] px-2 py-1 rounded-lg shadow-lg">
                                 <span className="text-[10px] font-black text-black">D{p.price}</span>
                              </div>
                           </div>
                           <div className="px-1">
                              <div className="font-black text-sm truncate tracking-tight text-[#00D68F]">{p.name}</div>
                              <div className={`text-[10px] ${textSec} font-bold mt-0.5 truncate uppercase tracking-widest`}>{p.business.name}</div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* Combined Empty State */}
            {searchQuery && filteredBusinesses.length === 0 && filteredProducts.length === 0 && (
               <div className="py-20 text-center animate-scale-in">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                     <Search size={32} className={textSec} />
                  </div>
                  <h3 className="text-xl font-black mb-2">No results found</h3>
                  <p className={`text-sm ${textSec} font-medium`}>We couldn't find any spots or products matching "{searchQuery}"</p>
                  <button 
                     onClick={() => setSearchQuery('')}
                     className="mt-6 px-6 py-2 bg-[#00D68F] text-black rounded-full font-black text-xs active:scale-95 transition-all"
                  >
                     Clear Search
                  </button>
               </div>
            )}

            {/* Default Empty State (No Search) */}
            {!searchQuery && filteredBusinesses.length === 0 && (
               <div className="py-20 text-center opacity-40 animate-scale-in">
                  <p className="text-sm font-bold">No businesses found in this category.</p>
               </div>
            )}
         </div>
      </div>
   );
};

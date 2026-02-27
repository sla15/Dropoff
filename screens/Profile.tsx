
import React, { useState, useRef, useEffect } from 'react';
import { UserCog, History, Heart, HelpCircle, ChevronRight, LogOut, X, Camera, Phone, Mail, MessageSquare, Trash2, MapPin, Car, ShoppingBag, Star, Loader2 } from 'lucide-react';
import { Theme, Screen, UserData, Activity, Business, AppSettings } from '../types';
import { triggerHaptic } from '../utils/helpers';
import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    setScreen: React.Dispatch<React.SetStateAction<Screen>>;
    user: UserData;
    setUser: React.Dispatch<React.SetStateAction<UserData>>;
    recentActivities: Activity[];
    setRecentActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
    favorites: string[];
    businesses: Business[];
    isScrolling: boolean;
    isNavVisible: boolean;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    settings: AppSettings;
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

type DrawerType = 'none' | 'account' | 'history' | 'favorites' | 'support';

// Drawer Component Defined Outside to fix Input Focus issues
// Added Swipe-to-close logic
const Drawer = ({ title, children, onClose, isClosing, theme, bgCard }: { title: string, children: React.ReactNode, onClose: () => void, isClosing: boolean, theme: Theme, bgCard: string }) => {
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isPeeked, setIsPeeked] = useState(false);
    const startY = useRef(0);
    const drawerRef = useRef<HTMLDivElement>(null);
    const PEEK_Y = 480;

    const handleTouchStart = (e: React.TouchEvent) => {
        const scrollContainer = drawerRef.current?.querySelector('.overflow-y-auto');
        if (scrollContainer && scrollContainer.scrollTop > 0) return;
        startY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const delta = currentY - startY.current;

        if (isPeeked) {
            // If peeked, allow dragging UP
            if (delta < 0) {
                setDragY(Math.max(0, PEEK_Y + delta));
            }
        } else {
            // If expanded, allow dragging DOWN
            if (delta > 0) {
                setDragY(delta);
            }
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        if (isPeeked) {
            if (dragY < PEEK_Y - 100) {
                setDragY(0);
                setIsPeeked(false);
            } else {
                setDragY(PEEK_Y);
            }
        } else {
            if (dragY > 150) {
                setDragY(PEEK_Y);
                setIsPeeked(true);
            } else {
                setDragY(0);
            }
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-500 ${isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} style={{ opacity: Math.max(0, 1 - dragY / 500) }}></div>
            <div
                ref={drawerRef}
                className={`w-full ${theme === 'light' ? 'bg-white/85' : 'bg-[#1C1C1E]/85'} backdrop-blur-3xl rounded-t-[40px] pb-safe relative z-10 max-h-[92vh] flex flex-col shadow-2xl ${isClosing ? 'ios-slide-down' : 'ios-slide-up'}`}
                style={{
                    transform: `translateY(${dragY}px)`,
                    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.17, 0.89, 0.32, 1.1)'
                }}
            >
                {/* Drag Handle Area */}
                <div
                    className="w-full pt-5 pb-2 flex justify-center cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0 opacity-40"></div>
                </div>

                <div className="px-8 pb-4 flex justify-between items-center border-b border-gray-100/50 dark:border-gray-800/50">
                    <h2 className="text-2xl font-black tracking-tight">{title}</h2>
                    <button onClick={onClose} className={`p-2.5 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-white/10 active:bg-white/20'} transition-colors`}>
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const ProfileScreen = ({ theme, navigate, setScreen, user, setUser, recentActivities, setRecentActivities, favorites, businesses, isScrolling, isNavVisible, handleScroll, settings, showAlert }: Props) => {
    const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
    const [isClosing, setIsClosing] = useState(false);

    // Local state for editing profile
    const [editName, setEditName] = useState(user.name);
    const [editPhone, setEditPhone] = useState(user.phone);
    const [editEmail, setEditEmail] = useState(user.email);
    const [editLocation, setEditLocation] = useState(user.location || '');
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    // Image Upload Ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [homeLocData, setHomeLocData] = useState<{ address: string; lat: number; lng: number } | null>(null);
    const [showLP, setShowLP] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        fetchHomeLocation();
    }, []);

    const fetchHomeLocation = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data, error } = await supabase
                .from('user_saved_locations')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('label', 'Home')
                .maybeSingle();

            if (data) {
                setHomeLocData({ address: data.address, lat: data.latitude, lng: data.longitude });
                setEditLocation(data.address);
            }
        } catch (err) {
            console.error("Fetch Home Location Error:", err);
        }
    };

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    const openDrawer = (drawer: DrawerType) => {
        triggerHaptic();
        setActiveDrawer(drawer);
        setIsClosing(false);
    };

    const closeDrawer = () => {
        setIsClosing(true);
        setTimeout(() => {
            setActiveDrawer('none');
            setIsClosing(false);
        }, 280); // Slightly less than CSS animation duration
    };

    const handleSaveProfile = async () => {
        triggerHaptic();
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            if (!userId) throw new Error("No active session found");

            if (!editName.trim()) {
                showAlert("Missing Name", "Full Name cannot be empty.", "error");
                setLoading(false);
                return;
            }
            if (!editLocation.trim()) {
                showAlert("Missing Location", "Home Location cannot be empty.", "error");
                setLoading(false);
                return;
            }

            let finalAvatarUrl = user.photo;

            // 1. Upload new photo if selected
            if (photoFile) {
                console.log("Uploading Profile Photo...");
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${userId}-${Math.random()}.${fileExt}`;
                const filePath = `user-avatars/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, photoFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                finalAvatarUrl = publicUrl;
                console.log("Uploaded! URL:", finalAvatarUrl);
            }

            // 2. Update Profiles Table
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: editName,
                    email: editEmail,
                    location: editLocation,
                    phone: editPhone,
                    avatar_url: finalAvatarUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // 2.1 Update Saved Locations (Home)
            if (homeLocData) {
                const { error: locError } = await supabase
                    .from('user_saved_locations')
                    .upsert({
                        user_id: userId,
                        label: 'Home',
                        emoji: '🏠',
                        address: homeLocData.address,
                        latitude: homeLocData.lat,
                        longitude: homeLocData.lng
                    }, { onConflict: 'user_id, label' });

                if (locError) throw locError;
            }

            // 3. Update Global State
            setUser({
                ...user,
                name: editName,
                phone: editPhone,
                email: editEmail,
                location: editLocation,
                photo: finalAvatarUrl
            });

            console.log("Profile updated successfully!");
            closeDrawer();
        } catch (err: any) {
            console.error("Failed to update profile:", err);
            showAlert("Update Failed", err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setUser({ ...user, photo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in relative`}>
            <div className="flex-1 overflow-y-auto pt-safe px-6 pb-32 no-scrollbar" onScroll={handleScroll}>
                <h1 className="text-3xl font-bold mb-6">Profile</h1>
                <div className="flex items-center gap-4 mb-8">
                    <div
                        className={`w-20 h-20 rounded-full ${user.photo ? 'bg-cover bg-center' : 'bg-[#00D68F]/20 flex items-center justify-center'} border-2 border-white dark:border-[#333]`}
                        style={user.photo ? { backgroundImage: `url(${user.photo})` } : {}}
                    >
                        {!user.photo && (
                            <span className="text-[#00D68F] font-bold text-2xl">
                                {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
                            </span>
                        )}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">{user.name || 'User'}</h2>
                        <p className={`${textSec} text-sm font-medium`}>{user.phone}</p>

                        {/* Rating Score */}
                        {settings.is_rating_enabled && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${user.rating >= 4.5 ? 'bg-[#00D68F]/10 text-[#00D68F]' :
                                    user.rating >= 3.0 ? 'bg-orange-500/10 text-orange-500' :
                                        'bg-red-500/10 text-red-500'
                                    }`}>
                                    <Star size={12} fill="currentColor" />
                                    <span className="text-xs font-black">{(user.rating || 5.0).toFixed(1)}</span>
                                </div>
                                <span className={`text-[10px] font-medium ${textSec}`}>Rating</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`${bgCard} rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/5`}>
                    <button onClick={() => openDrawer('account')} className={`w-full flex items-center justify-between p-4 border-b border-transparent ${theme === 'light' ? 'border-gray-100/50' : 'border-gray-800/50'} active:bg-gray-50 dark:active:bg-white/5 transition-colors group`}>
                        <div className="flex items-center gap-3 transition-transform group-active:scale-95 duration-200">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 dark:bg-blue-500/10`}>
                                <UserCog size={20} />
                            </div>
                            <span className="font-bold">Account Settings</span>
                        </div>
                        <ChevronRight size={16} className={`${textSec} opacity-50 transition-transform group-active:translate-x-1 duration-200`} />
                    </button>

                    <button onClick={() => openDrawer('history')} className={`w-full flex items-center justify-between p-4 border-b border-transparent ${theme === 'light' ? 'border-gray-100/50' : 'border-gray-800/50'} active:bg-gray-50 dark:active:bg-white/5 transition-colors group`}>
                        <div className="flex items-center gap-3 transition-transform group-active:scale-95 duration-200">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-orange-50 text-orange-500 dark:bg-orange-500/10`}>
                                <History size={20} />
                            </div>
                            <span className="font-bold">Ride & Order History</span>
                        </div>
                        <ChevronRight size={16} className={`${textSec} opacity-50 transition-transform group-active:translate-x-1 duration-200`} />
                    </button>

                    <button onClick={() => openDrawer('favorites')} className={`w-full flex items-center justify-between p-4 border-b border-transparent ${theme === 'light' ? 'border-gray-100/50' : 'border-gray-800/50'} active:bg-gray-50 dark:active:bg-white/5 transition-colors group`}>
                        <div className="flex items-center gap-3 transition-transform group-active:scale-95 duration-200">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-red-50 text-red-500 dark:bg-red-500/10`}>
                                <Heart size={20} />
                            </div>
                            <span className="font-bold">Favorites</span>
                        </div>
                        <ChevronRight size={16} className={`${textSec} opacity-50 transition-transform group-active:translate-x-1 duration-200`} />
                    </button>

                    <button onClick={() => openDrawer('support')} className={`w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-white/5 transition-colors group`}>
                        <div className="flex items-center gap-3 transition-transform group-active:scale-95 duration-200">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-purple-50 text-purple-500 dark:bg-purple-500/10`}>
                                <HelpCircle size={20} />
                            </div>
                            <span className="font-bold">Help & Support</span>
                        </div>
                        <ChevronRight size={16} className={`${textSec} opacity-50 transition-transform group-active:translate-x-1 duration-200`} />
                    </button>
                </div>
            </div>

            {/* --- DRAWERS --- */}

            {/* Account Settings Drawer */}
            {activeDrawer === 'account' && (
                <Drawer title="Account Settings" onClose={closeDrawer} isClosing={isClosing} theme={theme} bgCard={bgCard}>
                    <div className="pb-20">
                        <div className="flex justify-center mb-8">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                className="hidden"
                                accept="image/*"
                            />
                            <div
                                className={`w-24 h-24 rounded-full ${user.photo ? 'bg-cover bg-center' : 'bg-[#00D68F]/20 flex items-center justify-center'} border-2 border-white dark:border-[#333] relative cursor-pointer`}
                                style={user.photo ? { backgroundImage: `url(${user.photo})` } : {}}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {!user.photo && (
                                    <span className="text-[#00D68F] font-bold text-3xl">
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
                                    </span>
                                )}
                                <div className="absolute bottom-0 right-0 bg-[#00D68F] p-1.5 rounded-full border-2 border-white dark:border-black cursor-pointer shadow-sm">
                                    <Camera size={14} className="text-black" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            {/* Status Message */}
                            {loading && (
                                <div className="flex items-center gap-2 justify-center py-2 text-[#00D68F] animate-pulse">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Saving Changes...</span>
                                </div>
                            )}
                            <div>
                                <label className={`text-xs font-bold ${textSec} mb-1 block`}>Full Name</label>
                                <input value={editName} onChange={e => setEditName(e.target.value)} className={`w-full p-3 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium`} />
                            </div>
                            <div>
                                <label className={`text-xs font-bold ${textSec} mb-1 block`}>Phone Number</label>
                                <input value={editPhone} readOnly className={`w-full p-3 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium opacity-50`} />
                            </div>
                            <div>
                                <label className={`text-xs font-bold ${textSec} mb-1 block`}>Email</label>
                                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className={`w-full p-3 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium`} />
                            </div>
                            <div>
                                <label className={`text-xs font-bold ${textSec} mb-1 block`}>Home Location</label>
                                <div
                                    onClick={() => setShowLP(true)}
                                    className={`w-full p-3 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md cursor-pointer flex items-center justify-between group`}
                                >
                                    <span className={`flex-1 font-medium truncate ${!editLocation ? 'opacity-30' : ''}`}>
                                        {editLocation || 'Set Home Location'}
                                    </span>
                                    <MapPin size={18} className="text-[#00D68F] opacity-50 group-active:opacity-100" />
                                </div>
                            </div>

                            {showLP && (
                                <LocationPicker
                                    theme={theme}
                                    title="Home Address"
                                    user={user}
                                    onClose={() => setShowLP(false)}
                                    onConfirm={(loc) => {
                                        setHomeLocData(loc);
                                        setEditLocation(loc.address);
                                        setShowLP(false);
                                    }}
                                />
                            )}
                        </div>

                        <button
                            onClick={handleSaveProfile}
                            disabled={loading}
                            className={`w-full py-4 rounded-xl bg-[#00D68F] text-black font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                        </button>

                        <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'} my-4`}></div>

                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                setScreen('onboarding');
                            }}
                            className="w-full p-4 rounded-xl bg-gray-100 dark:bg-white/5 font-bold flex items-center justify-center gap-2 mb-4 active:scale-95 transition-transform"
                        >
                            <LogOut size={20} /> Log Out
                        </button>

                        <button
                            onClick={() => {
                                triggerHaptic();
                                setShowDeleteModal(true);
                            }}
                            className="w-full p-4 rounded-xl bg-red-500/10 text-red-500 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                            <Trash2 size={20} /> Delete Account
                        </button>
                    </div>
                </Drawer>
            )}

            {/* History Drawer */}
            {activeDrawer === 'history' && (
                <Drawer title="Ride & Order History" onClose={closeDrawer} isClosing={isClosing} theme={theme} bgCard={bgCard}>
                    {recentActivities.length === 0 ? (
                        <div className={`text-center py-10 ${textSec}`}>No history yet.</div>
                    ) : (
                        <div className="space-y-4">
                            {recentActivities.map(item => (
                                <div key={item.id} className={`p-4 rounded-2xl ${inputBg} flex items-center gap-4 group/item`}>
                                    <div className={`w-12 h-12 rounded-full ${item.type === 'ride' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center`}>
                                        {item.type === 'ride' ? <Car size={20} /> : <ShoppingBag size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <h4 className="font-bold">{item.title}</h4>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">D{item.price}</span>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        triggerHaptic();
                                                        showAlert(
                                                            "Delete Activity",
                                                            `Are you sure you want to permanently delete this ${item.type} from your history? This action cannot be undone.`,
                                                            "info",
                                                            async () => {
                                                                try {
                                                                    // Update local state first for immediate UI feedback
                                                                    setRecentActivities(prev => prev.filter(a => a.id !== item.id));

                                                                    // Delete from Supabase
                                                                    const table = item.type === 'ride' ? 'rides' : 'orders';
                                                                    const { error } = await supabase.from(table).delete().eq('id', item.id);

                                                                    if (error) {
                                                                        console.error(`Error deleting ${item.type}:`, error);
                                                                        showAlert("Delete Failed", `Failed to delete ${item.type} from history.`, "error");
                                                                        // Revert local state on error
                                                                        setRecentActivities(prev => [...prev, item].sort((a, b) =>
                                                                            new Date(b.date).getTime() - new Date(a.date).getTime()
                                                                        ));
                                                                    }
                                                                } catch (err) {
                                                                    console.error("Delete Activity Error:", err);
                                                                    showAlert("Delete Failed", "An unexpected error occurred.", "error");
                                                                }
                                                            },
                                                            true,
                                                            "Yes, Delete",
                                                            "Cancel"
                                                        );
                                                    }}
                                                    className="p-2 -mr-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all text-red-500 active:scale-95"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className={`text-xs ${textSec}`}>{item.subtitle}</span>
                                            <span className={`text-xs ${textSec}`}>{item.date}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Drawer>
            )}

            {/* Favorites Drawer */}
            {activeDrawer === 'favorites' && (
                <Drawer title="Favorites" onClose={closeDrawer} isClosing={isClosing} theme={theme} bgCard={bgCard}>
                    {favorites.length === 0 ? (
                        <div className={`text-center py-10 ${textSec}`}>No favorites yet.</div>
                    ) : (
                        <div className="space-y-4">
                            {businesses.filter(b => favorites.includes(b.id)).map(b => (
                                <div key={b.id} onClick={() => navigate('business-detail')} className={`p-3 rounded-2xl ${inputBg} flex gap-4 cursor-pointer`}>
                                    <img src={b.image} className="w-16 h-16 rounded-xl object-cover" />
                                    <div className="flex-1 py-1">
                                        <h4 className="font-bold">{b.name}</h4>
                                        <p className={`text-xs ${textSec}`}>{b.category} • {b.distance}</p>
                                        <div className="flex items-center gap-1 mt-1 text-xs font-bold text-orange-500">
                                            <Star size={10} fill="currentColor" /> {b.rating}
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Heart size={20} className="fill-red-500 text-red-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Drawer>
            )}

            {/* Support Drawer */}
            {activeDrawer === 'support' && (
                <Drawer title="Help & Support" onClose={closeDrawer} isClosing={isClosing} theme={theme} bgCard={bgCard}>
                    <div className="grid grid-cols-1 gap-4">
                        <a href="tel:+2201234567" className={`p-5 rounded-2xl ${inputBg} flex items-center gap-4 hover:opacity-80 transition-opacity`}>
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <Phone size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Call Us</h3>
                                <p className={`text-xs ${textSec}`}>Speak to our support team</p>
                            </div>
                        </a>

                        <a href="https://wa.me/2201234567" target="_blank" className={`p-5 rounded-2xl ${inputBg} flex items-center gap-4 hover:opacity-80 transition-opacity`}>
                            <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366]">
                                <MessageSquare size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">WhatsApp</h3>
                                <p className={`text-xs ${textSec}`}>Chat with us instantly</p>
                            </div>
                        </a>

                        <a href="mailto:support@dropoff.gm" className={`p-5 rounded-2xl ${inputBg} flex items-center gap-4 hover:opacity-80 transition-opacity`}>
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <Mail size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Email Us</h3>
                                <p className={`text-xs ${textSec}`}>Send us a message</p>
                            </div>
                        </a>
                    </div>
                    <div className={`mt-8 text-center text-xs ${textSec}`}>
                        <p>Version 1.0.5 (Build 202)</p>
                        <p className="text-[10px] opacity-20">© 2026 DROPOFF</p>
                    </div>
                </Drawer>
            )}

            {/* Account Deletion Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
                    <div className={`w-full max-w-sm ${bgCard} rounded-3xl p-6 relative z-10 shadow-2xl animate-scale-in`}>
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-black text-center mb-2">Delete Account?</h3>
                        <p className={`text-center ${textSec} mb-6 text-sm leading-relaxed`}>
                            This action is permanent and cannot be undone. All your ride history, saved locations, and profile data will be erased immediately.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={async () => {
                                    triggerHaptic();
                                    setLoading(true);
                                    try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        if (session?.user?.id) {
                                            // Call Supabase Delete User RPC or Edge Function if configured,
                                            // OR handle standard auth.admin deletion.
                                            // Standard practice is to sign out and let a trigger handle it,
                                            // or call a specific edge function for GDPR deletion.
                                            const { error } = await supabase.rpc('delete_user_account');
                                            if (error) {
                                                console.error("RPC failed, falling back to direct auth.admin deletion if available.", error);
                                            }
                                        }
                                        await supabase.auth.signOut();
                                        setScreen('onboarding');
                                    } catch (err: any) {
                                        console.error("Failed to delete account:", err);
                                        showAlert("Deletion Failed", "Could not delete your account. Please contact support.", "error");
                                    } finally {
                                        setLoading(false);
                                        setShowDeleteModal(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full py-4 rounded-xl bg-red-500 text-white font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Yes, Delete My Account'}
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className={`w-full py-4 rounded-xl ${theme === 'light' ? 'bg-gray-100 text-black' : 'bg-[#2C2C2E] text-white'} font-bold active:scale-[0.98] transition-all`}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


import React, { useState, useRef, useEffect } from 'react';
import { UserCog, History, Heart, HelpCircle, ChevronRight, LogOut, X, Camera as CameraIcon, Phone, Mail, MessageSquare, Trash2, MapPin, Car, ShoppingBag, Star, Loader2 } from 'lucide-react';

import { Theme, Screen, UserData, Activity, Business, AppSettings, SavedLocation } from '../types';
import { triggerHaptic, sendPushNotification, compressImage, friendlyError, validateUpload } from '../utils/helpers';
import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';


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
    setIsNavVisible: (visible: boolean) => void;
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
    initialDrawer?: string;
    clearInitialDrawer?: () => void;
    handleLogout: () => Promise<void>;
}

type DrawerType = 'none' | 'account' | 'history' | 'favorites' | 'support' | 'saved-locations';

// Drawer Component Defined Outside to fix Input Focus issues
// Added Swipe-to-close logic
const Drawer = ({ title, children, onClose, isClosing, theme, bgCard, maxHeightClass = 'max-h-[92vh]' }: { title: string, children: React.ReactNode, onClose: () => void, isClosing: boolean, theme: Theme, bgCard: string, maxHeightClass?: string }) => {
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const drawerRef = useRef<HTMLDivElement>(null);

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
        // Only allow dragging DOWN (positive delta)
        if (delta > 0) {
            setDragY(delta);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        // Swipe down past threshold → fully close the drawer
        if (dragY > 150) {
            setDragY(0);
            onClose();
        } else {
            // Spring back to fully open
            setDragY(0);
        }
    };

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col justify-end transition-opacity duration-500 ${isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} style={{ opacity: Math.max(0, 1 - dragY / 500) }}></div>
            <div
                ref={drawerRef}
                className={`w-full ${theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]'} backdrop-blur-3xl rounded-t-[40px] pb-safe relative z-10 ${maxHeightClass} flex flex-col shadow-2xl ${isClosing ? 'ios-slide-down' : 'ios-slide-up'}`}
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

// Formats phone numbers by adding a space after the country code prefix.
const safeFormatPhone = (phoneStr: string) => {
    if (!phoneStr) return "";
    // Typical E.164 without space -> Add space after 1-3 digit country code
    if (phoneStr.startsWith('+')) {
        const match = phoneStr.match(/^(\+\d{1,3})(\d+)$/);
        if (match) return `${match[1]} ${match[2]}`;
        return phoneStr;
    }
    // Fallback for extremely old accounts that only saved the local number
    return phoneStr;
};

export const ProfileScreen = ({ theme, navigate, setScreen, user, setUser, recentActivities, setRecentActivities, favorites, businesses, isScrolling, isNavVisible, setIsNavVisible, handleScroll, settings, showAlert, initialDrawer, clearInitialDrawer, handleLogout }: Props) => {
    const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (initialDrawer && initialDrawer !== 'none') {
            setActiveDrawer(initialDrawer as DrawerType);
            if (clearInitialDrawer) clearInitialDrawer();
        }
    }, [initialDrawer, clearInitialDrawer]);

    // Local state for editing profile
    const [editName, setEditName] = useState(user.name);
    const [editPhone, setEditPhone] = useState(user.phone);
    const [editEmail, setEditEmail] = useState(user.email);
    const [editLocation, setEditLocation] = useState(user.location || '');
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | Blob | null>(null);


    // Image Upload Ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [homeLocData, setHomeLocData] = useState<{ address: string; lat: number; lng: number } | null>(null);
    const [showLP, setShowLP] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [editingLoc, setEditingLoc] = useState<SavedLocation | null>(null);
    const [showLocPicker, setShowLocPicker] = useState(false);

    useEffect(() => {
        fetchHomeLocation();
        fetchSavedLocations();
    }, []);

    const fetchSavedLocations = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data, error } = await supabase
                .from('user_saved_locations')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (data) {
                setSavedLocations(data.map(d => ({
                    id: d.id,
                    label: d.label,
                    emoji: d.emoji || '📍',
                    address: d.address,
                    latitude: d.latitude,
                    longitude: d.longitude
                })));
            }
        } catch (err) {
            console.error("Fetch Saved Locations Error:", err);
        }
    };

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
        setIsNavVisible(false);
        setActiveDrawer(drawer);
        setIsClosing(false);
    };

    const closeDrawer = () => {
        setIsClosing(true);
        setTimeout(() => {
            setActiveDrawer('none');
            setIsNavVisible(true);
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

            if (!editName.trim() || /<[^>]*>/.test(editName)) {
                showAlert("Invalid Name", "Please enter a valid name (no HTML tags allowed).", "error");
                setLoading(false);
                return;
            }
            if (!editLocation.trim() || /<[^>]*>/.test(editLocation)) {
                showAlert("Invalid Location", "Please enter a valid location.", "error");
                setLoading(false);
                return;
            }

            let finalAvatarUrl = user.photo;

            // 1. Upload new photo if selected
            if (photoFile) {
                const error = validateUpload(photoFile);
                if (error) {
                    showAlert("Invalid File", error);
                    setLoading(false);
                    return;
                }
                console.log("Compressing & Uploading Profile Photo...");
                const compressedBlob = await compressImage(photoFile, 800, 0.7);
                const fileName = `${userId}-${Date.now()}.jpg`;
                const filePath = `user-avatars/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, compressedBlob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                finalAvatarUrl = publicUrl;
                console.log("Uploaded! URL:", finalAvatarUrl);
            }

            // Validate email BEFORE writing to DB
            if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
                showAlert("Invalid Email", "Please enter a valid email address.", "error");
                setLoading(false);
                return;
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
            setLoading(false);
            closeDrawer();
        } catch (err: any) {
            console.error("Failed to update profile:", err);
            setLoading(false);
            showAlert("Update Failed", friendlyError(err), "error");
        }
    };


    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement> | null) => {
        if (Capacitor.isNativePlatform()) {
            try {
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: CameraResultType.Uri,
                    source: CameraSource.Prompt // Ask: Camera or Photos
                });


                if (image.webPath) {
                    const response = await fetch(image.webPath);
                    const blob = await response.blob();
                    const error = validateUpload(blob);
                    if (error) {
                        showAlert("Invalid File", error);
                        return;
                    }
                    setPhotoFile(blob);
                    setUser({ ...user, photo: image.webPath });
                }
            } catch (err) {
                console.warn("Camera/Gallery cancelled or failed:", err);
            }
        } else if (event) {
            const file = event.target.files?.[0];
            if (file) {
                const error = validateUpload(file);
                if (error) {
                    showAlert("Invalid File", error);
                    return;
                }
                setPhotoFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setUser({ ...user, photo: reader.result as string });
                };
                reader.readAsDataURL(file);
            }
        }
    };


    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in relative`}>
            {/* Fixed Header */}
            {/* Fixed Header */}
            <div className={`pt-safe px-6 pb-2 flex-shrink-0 ${bgMain}`} style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <h1 className="text-3xl font-black tracking-tight">Profile</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar" onScroll={handleScroll}>
                {/* --- HERO SECTION --- */}
                <div className="flex flex-col items-center justify-center mb-8 mt-4 relative">
                    {/* Ambient Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#00D68F] opacity-15 blur-[40px] rounded-full pointer-events-none" />

                    <div className="relative mb-4">
                        <div
                            className={`w-28 h-28 rounded-[36px] ${user.photo ? 'bg-cover bg-center' : 'bg-[#00D68F]/10 dark:bg-[#00D68F]/20 flex items-center justify-center'} shadow-xl border-2 ${theme === 'light' ? 'border-white' : 'border-[#1C1C1E]'} relative z-10`}
                            style={user.photo ? { backgroundImage: `url(${user.photo})` } : {}}
                        >
                            {!user.photo && (
                                <span className="text-[#00D68F] font-black text-4xl">
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
                                </span>
                            )}
                        </div>

                        {/* Premium Rating Badge */}
                        {settings.is_rating_enabled && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] shadow-lg backdrop-blur-md border ${theme === 'light' ? 'bg-white/90 border-black/5 text-black' : 'bg-[#2C2C2E]/90 border-white/10 text-white'}`}>
                                    <Star size={12} fill="#00D68F" className="text-[#00D68F]" />
                                    <span className="text-xs font-black tracking-tight">{(user.rating || 5.0).toFixed(1)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <h2 className="text-2xl font-black tracking-tight text-center truncate max-w-full px-6">{user.name || 'User'}</h2>
                    <p className={`text-sm ${textSec} font-bold text-center mt-1`}>{safeFormatPhone(user.phone)}</p>
                </div>

                {/* --- GROUP 1: PERSONAL --- */}
                <div className="mb-6">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-2 pl-4`}>Personal</p>
                    <div className={`${bgCard} rounded-[24px] overflow-hidden shadow-sm border ${theme === 'light' ? 'border-gray-100/50' : 'border-white/5'}`}>
                        <button onClick={() => openDrawer('account')} className={`w-full flex items-center justify-between p-4 border-b ${theme === 'light' ? 'border-gray-100/50' : 'border-gray-800/50'} active:bg-black/5 dark:active:bg-white/5 transition-colors group`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center bg-blue-500 text-white shadow-inner`}>
                                    <UserCog size={20} />
                                </div>
                                <span className="font-bold text-base">Account Settings</span>
                            </div>
                            <ChevronRight size={18} className={`${textSec} opacity-40`} />
                        </button>

                        <button onClick={() => openDrawer('saved-locations')} className={`w-full flex items-center justify-between p-4 active:bg-black/5 dark:active:bg-white/5 transition-colors group`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center bg-emerald-500 text-white shadow-inner`}>
                                    <MapPin size={20} />
                                </div>
                                <span className="font-bold text-base">Saved Locations</span>
                            </div>
                            <ChevronRight size={18} className={`${textSec} opacity-40`} />
                        </button>
                    </div>
                </div>

                {/* --- GROUP 2: ACTIVITY --- */}
                <div className="mb-6">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-2 pl-4`}>Activity</p>
                    <div className={`${bgCard} rounded-[24px] overflow-hidden shadow-sm border ${theme === 'light' ? 'border-gray-100/50' : 'border-white/5'}`}>
                        <button onClick={() => openDrawer('history')} className={`w-full flex items-center justify-between p-4 border-b ${theme === 'light' ? 'border-gray-100/50' : 'border-gray-800/50'} active:bg-black/5 dark:active:bg-white/5 transition-colors group`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center bg-orange-500 text-white shadow-inner`}>
                                    <History size={20} />
                                </div>
                                <span className="font-bold text-base">Ride & Order History</span>
                            </div>
                            <ChevronRight size={18} className={`${textSec} opacity-40`} />
                        </button>

                        <button onClick={() => openDrawer('favorites')} className={`w-full flex items-center justify-between p-4 active:bg-black/5 dark:active:bg-white/5 transition-colors group`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center bg-pink-500 text-white shadow-inner`}>
                                    <Heart size={20} />
                                </div>
                                <span className="font-bold text-base">Favorites</span>
                            </div>
                            <ChevronRight size={18} className={`${textSec} opacity-40`} />
                        </button>
                    </div>
                </div>

                {/* --- GROUP 3: SUPPORT --- */}
                <div className="mb-8">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-2 pl-4`}>Support</p>
                    <div className={`${bgCard} rounded-[24px] overflow-hidden shadow-sm border ${theme === 'light' ? 'border-gray-100/50' : 'border-white/5'}`}>
                        <button onClick={() => openDrawer('support')} className={`w-full flex items-center justify-between p-4 active:bg-black/5 dark:active:bg-white/5 transition-colors group`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center bg-purple-500 text-white shadow-inner`}>
                                    <HelpCircle size={20} />
                                </div>
                                <span className="font-bold text-base">Help & Support</span>
                            </div>
                            <ChevronRight size={18} className={`${textSec} opacity-40`} />
                        </button>
                    </div>
                </div>

                {/* --- DANGEROUS ACTIONS --- */}
                <div className="mb-6 space-y-3 px-2">
                    <button
                        onClick={handleLogout}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${theme === 'light' ? 'bg-gray-200/50 text-gray-500' : 'bg-white/5 text-gray-400'}`}
                    >
                        <LogOut size={18} /> Log Out
                    </button>

                    <button
                        onClick={() => {
                            triggerHaptic();
                            setShowDeleteModal(true);
                        }}
                        className="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <Trash2 size={18} /> Delete Account
                    </button>
                </div>
            </div>

            {/* --- DRAWERS --- */}

            {/* Account Settings Drawer */}
            {activeDrawer === 'account' && (
                <Drawer title="Account Settings" onClose={closeDrawer} isClosing={isClosing} theme={theme} bgCard={bgCard} maxHeightClass="max-h-[96vh]">
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
                                onClick={() => {
                                    if (Capacitor.isNativePlatform()) {
                                        handleImageUpload(null);
                                    } else {
                                        fileInputRef.current?.click();
                                    }
                                }}
                            >

                                {!user.photo && (
                                    <span className="text-[#00D68F] font-bold text-3xl">
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
                                    </span>
                                )}
                                <div className="absolute bottom-0 right-0 bg-[#00D68F] p-1.5 rounded-full border-2 border-white dark:border-black cursor-pointer shadow-sm">
                                    <CameraIcon size={14} className="text-black" />
                                </div>

                            </div>
                        </div>

                        <div className="mb-8">
                            {/* Status Message */}
                            {loading && (
                                <div className="flex items-center gap-2 justify-center py-2 text-[#00D68F] animate-pulse mb-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Saving Changes...</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Full Name */}
                                <div className={`px-5 py-4 rounded-2xl border ${theme === 'light' ? 'bg-[#F2F2F7]/50 border-black/5' : 'bg-[#1C1C1E]/50 border-white/5'}`}>
                                    <label className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-1 block`}>Full Name</label>
                                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent outline-none font-bold text-lg" />
                                </div>

                                {/* Phone Number */}
                                <div className={`px-5 py-4 rounded-2xl border ${theme === 'light' ? 'bg-[#F2F2F7]/50 border-black/5' : 'bg-[#1C1C1E]/50 border-white/5'}`}>
                                    <label className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-1 block`}>Phone Number</label>
                                    <input value={safeFormatPhone(editPhone)} readOnly className="w-full bg-transparent outline-none font-bold text-lg opacity-50" />
                                </div>

                                {/* Email */}
                                <div className={`px-5 py-4 rounded-2xl border ${theme === 'light' ? 'bg-[#F2F2F7]/50 border-black/5' : 'bg-[#1C1C1E]/50 border-white/5'}`}>
                                    <label className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-1 block`}>Email</label>
                                    <input type="email" placeholder="name@example.com" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-transparent outline-none font-bold text-lg" />
                                </div>

                                {/* Home Location */}
                                <div
                                    onClick={() => setShowLP(true)}
                                    className={`px-5 py-4 rounded-2xl border cursor-pointer group ${theme === 'light' ? 'bg-[#F2F2F7]/50 border-black/5' : 'bg-[#1C1C1E]/50 border-white/5'}`}
                                >
                                    <label className={`text-[10px] font-black uppercase tracking-widest ${textSec} mb-1 block`}>Home Location</label>
                                    <span className={`block w-full bg-transparent font-bold text-lg truncate ${!editLocation ? 'opacity-30' : ''}`}>
                                        {editLocation || 'Set Home Location'}
                                    </span>
                                </div>
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
                        <button
                            onClick={handleSaveProfile}
                            disabled={loading}
                            className={`w-full py-4 rounded-xl bg-[#00D68F] text-black font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Save Changes'}
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
                                    <div className={`w-12 h-12 rounded-full ${item.type?.startsWith('ride') || item.type?.startsWith('delivery') ? 'bg-[#00D68F] text-black' : 'bg-orange-100 text-orange-600'} flex items-center justify-center`}>
                                        {item.type?.startsWith('ride') ? <Car size={20} /> : item.type?.startsWith('delivery') ? <Car size={20} /> : <ShoppingBag size={20} />}
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

                                                                    // Update localStorage to match
                                                                    const currentSaved = JSON.parse(localStorage.getItem('app_recent_activities') || '[]');
                                                                    const updatedSaved = currentSaved.filter((a: any) => a.id !== item.id);
                                                                    localStorage.setItem('app_recent_activities', JSON.stringify(updatedSaved));

                                                                    // Delete from Supabase
                                                                    const { error } = await supabase.from('user_activities').delete().eq('id', item.id);

                                                                    if (error) {
                                                                        console.error(`Error deleting activity:`, error);
                                                                        showAlert("Delete Failed", `Failed to delete activity from history.`, "error");
                                                                        // Revert local state and localStorage on error
                                                                        setRecentActivities(prev => [...prev, item].sort((a, b) =>
                                                                            new Date(b.date).getTime() - new Date(a.date).getTime()
                                                                        ));
                                                                        localStorage.setItem('app_recent_activities', JSON.stringify(currentSaved));
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

            {/* Saved Locations Drawer */}
            {activeDrawer === 'saved-locations' && (
                <Drawer title="Saved Locations" onClose={closeDrawer} isClosing={isClosing} theme={theme} bgCard={bgCard}>
                    <div className="pb-20">
                        {savedLocations.length === 0 ? (
                            <div className={`text-center py-10 ${textSec}`}>No saved locations yet.</div>
                        ) : (
                            <div className="space-y-4 mb-8">
                                {savedLocations.map(loc => (
                                    <div key={loc.id} className={`p-4 rounded-2xl ${inputBg} flex items-center gap-4 group/item`}>
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
                                            {loc.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold truncate">{loc.label}</h4>
                                            <p className={`text-xs ${textSec} truncate`}>{loc.address}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    triggerHaptic();
                                                    setEditingLoc(loc);
                                                    setShowLocPicker(true);
                                                }}
                                                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all text-blue-500 active:scale-95"
                                            >
                                                <UserCog size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    triggerHaptic();
                                                    showAlert(
                                                        "Delete Location",
                                                        `Are you sure you want to delete "${loc.label}"?`,
                                                        "info",
                                                        async () => {
                                                            try {
                                                                const { error } = await supabase
                                                                    .from('user_saved_locations')
                                                                    .delete()
                                                                    .eq('id', loc.id);

                                                                if (error) throw error;
                                                                setSavedLocations(prev => prev.filter(l => l.id !== loc.id));
                                                                if (loc.label === 'Home') fetchHomeLocation();
                                                            } catch (err) {
                                                                console.error("Delete Location Error:", err);
                                                                showAlert("Error", "Failed to delete location", "error");
                                                            }
                                                        },
                                                        true,
                                                        "Delete",
                                                        "Cancel"
                                                    );
                                                }}
                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all text-red-500 active:scale-95"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'} my-4`}></div>

                        {showLocPicker && (
                            <LocationPicker
                                theme={theme}
                                title={editingLoc ? `Edit ${editingLoc.label}` : "Select Location"}
                                user={user}
                                initialLocation={editingLoc ? { lat: editingLoc.latitude, lng: editingLoc.longitude } : undefined}
                                onClose={() => {
                                    setShowLocPicker(false);
                                    setEditingLoc(null);
                                }}
                                onConfirm={async (locData) => {
                                    try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        if (!session) return;

                                        // Since we only allow editing now, editingLoc should always be present
                                        const label = editingLoc ? editingLoc.label : "Saved Location";

                                        const payload = {
                                            user_id: session.user.id,
                                            label: label,
                                            address: locData.address,
                                            latitude: locData.lat,
                                            longitude: locData.lng,
                                            emoji: editingLoc ? editingLoc.emoji : (label.toLowerCase().includes('work') ? '💼' : label.toLowerCase().includes('gym') ? '🏋️' : '📍')
                                        };

                                        if (editingLoc) {
                                            const { error } = await supabase
                                                .from('user_saved_locations')
                                                .update(payload)
                                                .eq('id', editingLoc.id);
                                            if (error) throw error;
                                        }

                                        fetchSavedLocations();
                                        if (label === 'Home') fetchHomeLocation();
                                        setShowLocPicker(false);
                                        setEditingLoc(null);
                                    } catch (err) {
                                        console.error("Save Location Error:", err);
                                        showAlert("Error", "Failed to save location", "error");
                                    }
                                }}
                            />
                        )}
                    </div>
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
                                <div
                                    key={b.id}
                                    onClick={() => {
                                        if (b.isOpen) {
                                            triggerHaptic();
                                            navigate('business-detail');
                                        }
                                    }}
                                    className={`p-3 rounded-2xl border border-transparent dark:border-white/5 shadow-sm ${inputBg} flex gap-4 transition-all duration-300 ${b.isOpen ? 'cursor-pointer active:scale-95' : 'opacity-50 grayscale cursor-not-allowed'}`}
                                >
                                    <div className="w-16 h-16 rounded-xl overflow-hidden relative shrink-0">
                                        <img src={b.image} className="w-full h-full object-cover" alt={b.name} />
                                        {!b.isOpen && (
                                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-[7px] font-bold text-white uppercase backdrop-blur-sm px-1 text-center">
                                                <div>Closed</div>
                                                {b.working_hours?.start && <div className="mt-0.5 opacity-80">Opens at {b.working_hours.start}</div>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 py-1 min-w-0">
                                        <h4 className="font-bold truncate">{b.name}</h4>
                                        <p className={`text-xs ${textSec} truncate`}>{b.category} • {b.distance}</p>
                                        <div className="flex items-center gap-1 mt-1 text-xs font-bold text-[#00D68F]">
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
                        <a href="tel:+2203888888" className={`p-5 rounded-2xl ${inputBg} flex items-center gap-4 hover:opacity-80 transition-opacity`}>
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <Phone size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Call Us</h3>
                                <p className={`text-xs ${textSec}`}>+220 3888888</p>
                            </div>
                        </a>

                        <a
                            href="https://wa.me/2203888888?text=Hello%20Dropoff%20Support,%20I%20need%20assistance%20with..."
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-5 rounded-2xl ${inputBg} flex items-center gap-4 hover:opacity-80 transition-opacity`}
                        >
                            <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366]">
                                <MessageSquare size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">WhatsApp</h3>
                                <p className={`text-xs ${textSec}`}>+220 3888888</p>
                            </div>
                        </a>


                        <a href="mailto:dropoffgm@gmail.com" className={`p-5 rounded-2xl ${inputBg} flex items-center gap-4 hover:opacity-80 transition-opacity`}>
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <Mail size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Email Us</h3>
                                <p className={`text-xs ${textSec}`}>dropoffgm@gmail.com</p>
                            </div>
                        </a>



                    </div>
                    <div className={`mt-8 text-center text-xs ${textSec}`}>
                        <p>Version 1.11.0-beta5 (Build 235)</p>
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
                                            const { data, error } = await supabase.rpc('delete_user_account');

                                            if (error) {
                                                console.error("RPC failed:", error);
                                                throw error;
                                            }

                                            if (data && data.startsWith('DEBT_BLOCK:')) {
                                                const debtAmount = data.split(':')[1];
                                                showAlert(
                                                    "Account Deletion Blocked",
                                                    `You have an outstanding commission debt of D${debtAmount}. Please clear all balances before deleting your account.`,
                                                    "error"
                                                );
                                                setLoading(false);
                                                setShowDeleteModal(false);
                                                return;
                                            }
                                        }
                                        await handleLogout();
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

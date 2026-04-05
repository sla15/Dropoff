
import React, { useState, useEffect, useRef } from 'react';
declare global { interface Window { google: any; } }
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import './index.css';
import { createRoot } from 'react-dom/client';
import { Theme, Screen, CartItem, Business, Activity, UserData, Category, AppSettings } from './types';
import { INITIAL_BUSINESSES } from './data';
import { SmartAssistant } from './components/SmartAssistant';
import { BottomNav } from './components/Navigation';
import { SplashScreen } from './components/SplashScreen'; // Import Splash
import { FloatingCartButton } from './components/FloatingCartButton';
import { CONFIG } from './config';
import { supabase } from './supabaseClient';

// Screens
import { OnboardingScreen } from './screens/Onboarding';
import { DashboardScreen } from './screens/Dashboard';
import { RideScreen } from './screens/Ride';
import { MarketplaceScreen } from './screens/Marketplace';
import { EarnScreen } from './screens/Earn';
import { BusinessDetailScreen } from './screens/BusinessDetail';
import { CheckoutScreen } from './screens/Checkout';
import { ProfileScreen } from './screens/Profile';
import { OrderTrackingScreen } from './screens/OrderTracking';
import { PremiumModal } from './components/PremiumModal';
import { triggerHaptic, sendPushNotification } from './utils/helpers';

// --- API INITIALIZATION ---
import { initFCM } from './utils/fcm';
import { UpdatePopup } from './components/UpdatePopup';
import { App as CapacitorApp } from '@capacitor/app';

import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { Loader2, WifiOff, RefreshCcw, AlertTriangle } from 'lucide-react';
import { logError, setupGlobalErrorHandlers } from './utils/logger';
// --- END API INITIALIZATION ---

// Google Maps initialization is handled in index.html to ensure the callback is available before the script loads.
const App = () => {
  const isNative = Capacitor.isNativePlatform();

  // 🛡️ Global Error Catching
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  // 🚀 Low-End Device Detection
  // Applies 'low-end-device' class to <html> to enable CSS performance mode.
  // This disables heavy GPU effects (shadows, backdrop-blur, animations) on
  // budget/entry-level Android devices while keeping all functionality intact.
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const memoryGB = (navigator as any).deviceMemory || 4; // GB, not available on iOS

    const isLowEnd = cores <= 4 || memoryGB <= 2;

    if (isLowEnd) {
      console.log(`📱 Low-end device detected (cores: ${cores}, RAM: ${memoryGB}GB). Enabling performance mode.`);
      document.documentElement.classList.add('low-end-device');
    } else {
      document.documentElement.classList.remove('low-end-device');
    }
  }, []);


  // 🌓 Theme Management (Apple-style)
  const [theme, setThemeState] = useState<Theme>('dark');

  const setTheme = (t: Theme) => {
    setThemeState(t);
    Preferences.set({ key: 'app_theme', value: t });
  };

  useEffect(() => {
    const loadTheme = async () => {
      const { value: saved } = await Preferences.get({ key: 'app_theme' });
      if (saved) {
        setThemeState(saved as Theme);
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setThemeState(isDark ? 'dark' : 'light');
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = async (e: MediaQueryListEvent) => {
      const { value: saved } = await Preferences.get({ key: 'app_theme' });
      // If no manual preference is saved, follow system changes
      if (!saved) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'bg-black' : 'bg-[#F2F2F7]';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (isNative) {
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
        // Enable overlay to prevent "cut off" and allow CSS to handle packing with pt-safe
        StatusBar.setOverlaysWebView({ overlay: true });
        StatusBar.setBackgroundColor({ color: 'transparent' });
      }).catch(console.error);
    }
  }, [theme, isNative]);

  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = useRef(false); // Mirror for closures
  const [screen, setScreenState] = useState<Screen>('splash');
  const screenRef = useRef<Screen>('splash');
  const setScreen = (scr: Screen | ((prev: Screen) => Screen)) => {
    if (typeof scr === 'function') {
      setScreenState(prev => {
        const next = scr(prev);
        screenRef.current = next;
        return next;
      });
    } else {
      setScreenState(scr);
      screenRef.current = scr;
    }
  };
  const [history, setHistory] = useState<Screen[]>([]);
  const [showAssistant, setShowAssistant] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [profileDrawerToOpen, setProfileDrawerToOpen] = useState<string>('none');
  const [isRideSearching, setIsRideSearching] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [prefilledDestination, setPrefilledDestination] = useState<string | null>(null);
  const [prefilledTier, setPrefilledTier] = useState<string | null>(null);
  const [prefilledDistance, setPrefilledDistance] = useState<number | null>(null);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info',
    showCancel?: boolean,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false);
  const [locationPromptDone, setLocationPromptDone] = useState(false);

  const [updateConfig, setUpdateConfig] = useState<{
    show: boolean,
    type: 'force' | 'optional',
    latestVersion: string,
    updateUrl: string
  } | null>(null);


  // Define showAlert early so effects can use it safely
  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    onConfirm?: () => void,
    showCancel?: boolean,
    confirmText?: string,
    cancelText?: string,
    onCancel?: () => void
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      showCancel,
      onConfirm,
      onCancel,
      confirmText,
      cancelText
    });
  };

  // 👤 User State (At the top to prevent ReferenceErrors)
  const [user, setUser] = useState<UserData>({
    id: '',
    name: '',
    phone: '',
    email: '',
    location: 'Banjul, The Gambia',
    photo: '',
    role: 'customer',
    rating: 5.0,
    referralCode: '',
    referralBalance: 0
  });
  const userRef = useRef<UserData>(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // FCM Initialization Logic
  const hasTriggeredFCM = useRef(false);

  useEffect(() => {
    // Only prompt for push notifications once the user reaches the dashboard and location is done
    if (!user.id || screen !== 'dashboard' || !locationPromptDone) return;

    const startFCM = async () => {
      if (hasTriggeredFCM.current) return;
      hasTriggeredFCM.current = true; // Set immediately to prevent strict mode double-firing
      
      console.log("🚀 FCM: Starting FCM initialization sequence...");
      
      if (isNative) {
        try {
          const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
          let permStatus = await FirebaseMessaging.checkPermissions();
          if (permStatus.receive === 'prompt') {
             // Let Capacitor handle the native prompt (it usually works well even on load for iOS/Android)
             await FirebaseMessaging.requestPermissions();
          }
        } catch (e) {
          console.error("📱 FCM Native perm error:", e);
        }
        await initFCM(user.id);
      } else {
        // Web flow: modern browsers require a user gesture to request permissions.
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          showAlert(
            "Enable Notifications",
            "Please enable notifications to receive live updates about your ride and driver status.",
            "info",
            async () => {
              console.log("👆 User clicked Enable, triggering initFCM...");
              await initFCM(user.id);
            },
            true, // show cancel
            "Enable",
            "Later"
          );
        } else {
          // If already granted or denied, just run it (it won't prompt)
          await initFCM(user.id);
        }
      }
    };

    startFCM();
  }, [user.id, isNative, screen, locationPromptDone, showAlert]);

  // Foreground Notification Listener
  useEffect(() => {
    const handleForegroundPush = (e: any) => {
      const { title, body } = e.detail;
      showAlert(title || "Notification", body || "", "info");
      triggerHaptic();
    };

    window.addEventListener('foreground_notification', handleForegroundPush);
    return () => window.removeEventListener('foreground_notification', handleForegroundPush);
  }, []);

  // Background/Tap Notification Listener
  useEffect(() => {
    const handleNotificationTap = (e: any) => {
      const data = e.detail;
      console.log("👆 Notification tapped, routing to:", data);
      if (data?.type === 'order_update' && data.order_id) {
        setActiveOrderId(data.order_id);
        navigate('order-tracking');
      } else if (data?.type === 'ride_update' || data?.type === 'ride_request' || data?.ride_id) {
        navigate('ride');
      }
    };

    window.addEventListener('notification_tapped', handleNotificationTap);
    return () => window.removeEventListener('notification_tapped', handleNotificationTap);
  }, []);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    return localStorage.getItem('active_order_id');
  });

  const [activeBatchId, setActiveBatchId] = useState<string | null>(() => {
    return localStorage.getItem('active_batch_id');
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('app_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cart from localStorage", e);
      localStorage.removeItem('app_cart');
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>({
    min_ride_price: 150,
    min_delivery_fee: 50,
    driver_search_radius_km: 10,
    referral_reward_amount: 0,
    currency_symbol: 'D',
    commission_percentage: 15,
    rating_window_limit: 100,
    is_rating_enabled: true,
    max_driver_cash_amount: 3000,
    multiplier_scooter: 0.7,
    multiplier_economy: 1.0,
    multiplier_premium: 1.5,
    price_per_km: 40,
    waiting_fee_per_min: 0.5
  });

  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>(() => {
    try {
      const saved = localStorage.getItem('app_recent_activities');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse activities from localStorage", e);
      localStorage.removeItem('app_recent_activities');
      return [];
    }
  });

  const scrollTimeout = useRef<any>(null);
  const lastScrollY = useRef(0);

  // --- Real-time Geolocation ---
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    let watchId: string | null = null;

    const startWatching = async () => {
      try {
        // Prevent permission spam: only ask if we haven't asked in this session
        const promptedLocation = sessionStorage.getItem('location_prompted');

        if (Capacitor.isNativePlatform() && !promptedLocation) {
          const permissions = await Geolocation.checkPermissions();
          if (permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale') {
            await Geolocation.requestPermissions();
          }
          sessionStorage.setItem('location_prompted', 'true');
        }
        
        // Mark location prompt as done so FCM can proceed immediately after
        setLocationPromptDone(true);

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
          (pos) => {
            if (!pos) return;
            const { latitude, longitude } = pos.coords;
            setUserLocation({ lat: latitude, lng: longitude });

            setUser(prev => ({
              ...prev,
              last_lat: latitude,
              last_lng: longitude
            }));

            if (window.google?.maps?.Geocoder) {
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                  setUser(prev => ({ ...prev, location: results[0].formatted_address }));
                }
              });
            }
          }
        );
      } catch (err) {
        console.error("Geolocation error:", err);
      }
    };

    startWatching();

    return () => {
      if (watchId) Geolocation.clearWatch({ id: watchId });
    };
  }, []);

  // 🟢 Scalability Optimization: Throttled DB Updates
  // We only sync the user's location to the database every 10 seconds max.
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (user.id && userLocation) {
      const now = Date.now();
      if (now - lastUpdateRef.current < 10000) return; // Throttle: 10 seconds

      const updateDB = async () => {
        lastUpdateRef.current = now;
        await supabase
          .from('profiles')
          .update({
            last_lat: userLocation.lat,
            last_lng: userLocation.lng
          })
          .eq('id', user.id);
      };
      updateDB();
    }
  }, [user.id, userLocation]);

  // --- Effects ---

  useEffect(() => {
    if (activeOrderId) {
      localStorage.setItem('active_order_id', activeOrderId);
    } else {
      localStorage.removeItem('active_order_id');
    }
  }, [activeOrderId]);

  useEffect(() => {
    if (activeBatchId) {
      localStorage.setItem('active_batch_id', activeBatchId);
    } else {
      localStorage.removeItem('active_batch_id');
    }
  }, [activeBatchId]);

  // Sync active orders on mount
  useEffect(() => {
    if (user.id && !activeOrderId && !activeBatchId) {
      const fetchActiveOrder = async () => {
        try {
          // Check for active batch first
          const { data: batchData } = await supabase
            .from('orders')
            .select('batch_id')
            .eq('customer_id', user.id)
            .not('batch_id', 'is', null)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'delivering'])
            .limit(1)
            .maybeSingle();

          if (batchData?.batch_id) {
            setActiveBatchId(batchData.batch_id);
            return;
          }

          const { data, error } = await supabase
            .from('orders')
            .select('id')
            .eq('customer_id', user.id)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'delivering'])
            .limit(1)
            .maybeSingle();

          if (data && !error) {
            setActiveOrderId(data.id);
          }
        } catch (err) {
          console.error("Error fetching active order:", err);
        }
      };
      fetchActiveOrder();
    }
  }, [user.id]);



  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    triggerHaptic();
  };

  // --- 4. DATA FETCHING & INITIALIZATION ---
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (data && !error) {
        setSettings(data);
        
        // --- Version Check Logic ---
        if (Capacitor.isNativePlatform()) {
          (async () => {
            try {
              const info = await CapacitorApp.getInfo();
              const currentVersion = info.version; // e.g., "1.7.5"
              
              const minVersion = data.min_app_version || '1.0.0';
              const latestVersion = data.latest_app_version || '1.7.5';
              
              const isLower = (v1: string, v2: string) => {
                const parts1 = v1.split('.').map(Number);
                const parts2 = v2.split('.').map(Number);
                for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                  const p1 = parts1[i] || 0;
                  const p2 = parts2[i] || 0;
                  if (p1 < p2) return true;
                  if (p1 > p2) return false;
                }
                return false;
              };

              if (isLower(currentVersion, minVersion)) {
                setUpdateConfig({
                  show: true,
                  type: 'force',
                  latestVersion: latestVersion,
                  updateUrl: Capacitor.getPlatform() === 'android' ? (data.update_url_android || '') : (data.update_url_ios || '')
                });
              } else if (isLower(currentVersion, latestVersion)) {
                if (!sessionStorage.getItem('update_dismissed')) {
                  setUpdateConfig({
                    show: true,
                    type: 'optional',
                    latestVersion: latestVersion,
                    updateUrl: Capacitor.getPlatform() === 'android' ? (data.update_url_android || '') : (data.update_url_ios || '')
                  });
                }
              }
            } catch (e) { console.error("Update check error:", e); }
          })();
        }
      }
    } catch (err) { console.error("Settings Fetch Error:", err); }
  };


  // Precise Business Hours Check
  const isBusinessOpen = (workingHours: { start: string, end: string } | null, dbIsOpen: boolean) => {
    if (!workingHours) return dbIsOpen;

    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = workingHours.start.split(':').map(Number);
      const [endH, endM] = workingHours.end.split(':').map(Number);

      const startTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;

      // Handle cases where closing time is after midnight (e.g. 09:00 - 02:00)
      if (endTime < startTime) {
        return currentTime >= startTime || currentTime <= endTime;
      }

      return currentTime >= startTime && currentTime <= endTime;
    } catch (e) {
      return dbIsOpen;
    }
  };

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase.from('businesses').select(`*, products(*)`);
      if (data && !error) {
        setBusinesses(data.map((b: any) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          description: b.description,
          rating: b.rating || 5.0,
          reviews: 0,
          deliveryTime: '30-45 min',
          image: b.image_url || null,
          logo: b.image_url || null,
          phone: b.payment_phone || '',
          location: b.location_address || '',
          isOpen: isBusinessOpen(b.working_hours, b.is_open),
          working_hours: b.working_hours,
          distance: '2.5 km',
          products: (b.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            image: p.image_url || '',
            description: p.description || '',
            stock: p.stock || 0,
            mainCategory: p.category || '',
            categories: []
          }))
        })));
      }
    } catch (err) { console.error(err); }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('business_categories').select('*').eq('is_active', true).order('display_order', { ascending: true });
      if (data && !error) setCategories(data);
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    try {
      console.log("📂 Performing complete app data purge...");
      // 1. Supabase SignOut
      await supabase.auth.signOut();
      
      // 2. Clear Local State
      setUser({
        id: '', name: '', phone: '', email: '', location: 'Banjul, The Gambia',
        photo: '', role: 'customer', rating: 5.0, referralCode: '', referralBalance: 0
      });
      setRecentActivities([]);
      setFavorites([]);
      setCart([]);
      setActiveOrderId(null);
      setActiveBatchId(null);

      // 3. Clear Storage
      const keysToClear = [
        'app_recent_activities',
        'app_cart',
        'fcm_prompted',
        'active_order_id',
        'active_batch_id',
        'pending_gift_card'
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));
      // Clear cached profile from Preferences
      Preferences.remove({ key: 'cached_user_profile' }).catch(() => {});
      
      // 4. Reset Navigation
      setScreen('onboarding');
      setHistory([]);
      
      console.log("✅ App data purged successfully.");
    } catch (err) {
      console.error("❌ Logout failed:", err);
      // Fallback
      setScreen('onboarding');
    }
  };

  const fetchFavorites = async (userId: string) => {
    setIsFavoritesLoading(true);
    try {
      const { data, error } = await supabase.from('user_favorite_businesses').select('business_id').eq('user_id', userId);
      if (data && !error) setFavorites(data.map(f => f.business_id));
    } catch (err) { console.error(err); }
    finally { setIsFavoritesLoading(false); }
  };

  const fetchActivities = async (userId: string) => {
    setIsActivitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        const formattedActivities = data.map((a: any) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          subtitle: a.subtitle,
          price: Number(a.price) || 0,
          date: new Date(a.created_at).toLocaleDateString(),
          created_at: a.created_at,
          status: a.status as 'completed' | 'cancelled',
          reference_id: a.reference_id
        }));

        setRecentActivities(formattedActivities);
        localStorage.setItem('app_recent_activities', JSON.stringify(formattedActivities));
      }
    } catch (err) { console.error("Activities Fetch Error:", err); }
    finally { setIsActivitiesLoading(false); }
  };

  // --- 4. INITIALIZATION & AUTH HANDLER ---
  useEffect(() => {
    let authListener: any = null;
    let appStateListener: any = null;
    let realtimeChannel: any = null;

    const subscribeToChanges = (userId?: string) => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      
      const channel = supabase.channel('app-changes');
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => fetchSettings());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'business_categories' }, () => fetchCategories());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => fetchBusinesses());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchBusinesses());

      if (userId) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'user_activities', filter: `user_id=eq.${userId}` }, () => fetchActivities(userId));
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
          const p = payload.new as any;
          setUser(prev => ({
            ...prev,
            name: p.full_name || prev.name,
            phone: p.phone || prev.phone,
            email: p.email || prev.email,
            location: p.location || prev.location,
            photo: p.avatar_url || prev.photo,
            role: p.role || prev.role,
            rating: p.average_rating !== undefined ? Number(p.average_rating) : prev.rating,
            referralCode: p.referral_code || prev.referralCode,
            referralBalance: p.referral_balance !== undefined ? Number(p.referral_balance) : prev.referralBalance
          }));
        });
      }
      
      channel.subscribe();
      realtimeChannel = channel;
    };

    let isSyncingProfile = false; // Prevent concurrent syncs
    const handleUserAuthenticated = async (session: any) => {
      if (isSyncingProfile) return true;
      isSyncingProfile = true;
      try {
        if (!session?.user?.id) return false;
        console.log("👤 Syncing profile for user:", session.user.id);
        
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        
        if (error) {
          logError(error, { context: 'handleUserAuthenticated_fetch_profile' });
        }

        if (profile) {
          const loadedUser = {
            id: profile.id,
            name: profile.full_name || '',
            phone: profile.phone || '',
            email: profile.email || '',
            location: profile.location || 'Banjul, The Gambia',
            photo: profile.avatar_url || null,
            role: profile.role || 'customer',
            rating: Number(profile.average_rating) || 5.0,
            referralCode: profile.referral_code || '',
            referralBalance: profile.referral_balance || 0,
            last_lat: profile.last_lat,
            last_lng: profile.last_lng
          };
          setUser(loadedUser);

          // 💾 Persist profile to Preferences so it survives offline reconnections
          Preferences.set({ key: 'cached_user_profile', value: JSON.stringify(loadedUser) }).catch(() => {});
          
          setIsFavoritesLoading(true);
          setIsActivitiesLoading(true);
          fetchFavorites(session.user.id);
          fetchActivities(session.user.id);
          subscribeToChanges(session.user.id);
          
          // Re-init Push Notifications
          initFCM(session.user.id);

          if (!profile.full_name || !profile.phone) {
            console.log("👤 Profile incomplete, redirecting to onboarding");
            setScreen('onboarding');
          }
          return true;
        } else {
          console.warn("👤 No profile found for authenticated user");
          setScreen('onboarding');
          return false;
        }
      } catch (err) {
        console.error("Auth sync error:", err);
        logError(err instanceof Error ? err : new Error(String(err)), { context: 'handleUserAuthenticated_catch' });
        return false;
      } finally {
        isSyncingProfile = false;
      }
    };

    const initializeApp = async () => {
      setIsLoading(true);
      const minTime = new Promise(resolve => setTimeout(resolve, 2000)); 
      const safetyTimeout = new Promise(resolve => setTimeout(resolve, 15000));

      const hasDeterminedDestRef = { current: false }; // Use local ref-like object for boot closure
      const markDestDetermined = () => { hasDeterminedDestRef.current = true; };

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("🔐 Auth Change Event:", event, session ? "Session active" : "No session");
        
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          Preferences.set({ key: 'has_ever_logged_in', value: 'true' });
          console.log(`🔐 Auth Change Event: ${event} - marking destination immediately`);
          
          markDestDetermined();   // Kill the fallback timer NOW
          
          if (screenRef.current === 'splash') {
            // Check profile before deciding where to go - refined check without blocking
            supabase
               .from('profiles')
               .select('full_name, phone')
               .eq('id', session.user.id)
               .maybeSingle()
               .then(({ data: profile, error }) => {
                 if (error) {
                    console.error("Error fetching profile during auth change:", error);
                    setScreen('onboarding');
                 } else if (profile && profile.full_name && profile.phone) {
                    setScreen('dashboard');
                 } else {
                    setScreen('onboarding');
                 }
               }, (err: any) => {
                 console.error("Exception fetching profile during auth change:", err);
                 setScreen('onboarding');
               });
          }
          handleUserAuthenticated(session).catch(err => console.error("Background sync error:", err)); // Sync in background
        } else if (event === 'SIGNED_OUT') {
          // ⚡ Network-drop guard: Supabase emits SIGNED_OUT when offline due to
          // token refresh failure. We suppress the navigation to onboarding
          // in that case — the network-restore handler will re-sync properly.
          if (isOfflineRef.current) {
            console.warn("🔐 SIGNED_OUT received while offline — ignoring to prevent onboarding redirect.");
            return;
          }
          Preferences.remove({ key: 'has_ever_logged_in' });
          setScreen('onboarding');
          setHistory([]);
          setUser({
            id: '', name: '', phone: '', email: '', location: 'Banjul, The Gambia',
            photo: '', role: 'customer', rating: 5.0, referralCode: '', referralBalance: 0
          });
        }
      });
      authListener = subscription;

      const runInit = async () => {
        try {
          console.log("🚀 Init: Start...");

          // 0. Immediately load cached profile from Preferences
          // This guarantees the user's name/photo are visible even before any network call.
          try {
            const { value: cachedProfile } = await Preferences.get({ key: 'cached_user_profile' });
            if (cachedProfile) {
              const parsed = JSON.parse(cachedProfile);
              if (parsed && parsed.id && parsed.name) {
                console.log("🚀 Init: Restoring cached profile for:", parsed.name);
                setUser(parsed);
              }
            }
          } catch (e) {
            console.warn("🚀 Init: Failed to restore cached profile:", e);
          }

          // 1. Critical Session Check - FIRST priority
          console.log("🚀 Init: Session check...");
          let currentSession = null;
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
             logError(sessionError, { context: 'initializeApp_getSession' });
          }

          if (session) {
            console.log("🚀 Init: Session found immediately");
            currentSession = session;
          } else {
            console.log("🚀 Init: No immediate session, fast retry...");
            // Single fast retry for mobile storage adapters
            await new Promise(r => setTimeout(r, 400));
            const { data: { session: s } } = await supabase.auth.getSession();
            if (s) {
              console.log("🚀 Init: Session recovered on fast retry");
              currentSession = s; 
            }
          }

          // 2. Determine Destination based on Session
          if (currentSession) {
            console.log("🚀 Init: Session exists, letting user in via Auth Listener profile check");
            // The Auth Change listener handles routing from 'splash' depending on profile completeness.
            markDestDetermined(); // Ensure fallback doesn't trigger
            
            // Sync profile and data in background without await
            handleUserAuthenticated(currentSession).catch(err => {
               console.error("🚀 Init: Background sync failed:", err);
            });
          } else {
            console.log("🚀 Init: No session recovered, heading to onboarding");
            if (!hasDeterminedDestRef.current) {
              setScreen('onboarding');
              markDestDetermined();
            }
          }

          // 3. Parallel Background Data Fetch (Non-blocking for Destination)
          console.log("🚀 Init: Data parallel fetch...");
          Promise.allSettled([fetchSettings(), fetchBusinesses(), fetchCategories()]).then(results => {
             console.log("🚀 Init: Background data sync complete");
          });

        } catch (err) {
          console.error("🚀 Init Critical Failure:", err);
          logError(err instanceof Error ? err : new Error(String(err)), { context: 'initializeApp_runInit' });
          if (!hasDeterminedDestRef.current) {
            setScreen('onboarding');
            markDestDetermined();
          }
        }
      };

      try {
        const initPromise = runInit();
        
        await Promise.race([
          Promise.all([minTime, initPromise]),
          safetyTimeout
        ]);

        if (!hasDeterminedDestRef.current) {
          console.warn("⚠️ Init: Navigation fallback triggered");
          setScreen('onboarding');
        }
      } catch (err) {
        console.error("Init failed:", err);
        setScreen('onboarding');
      } finally {
        setIsLoading(false);
      }
    };


    // 2. Network Listener — also re-syncs profile when connection is restored
    Network.addListener('networkStatusChange', async (netStatus) => {
      console.log("🌐 Network status changed:", netStatus);

      // Keep the offline ref in sync
      if (!netStatus.connected) {
        isOfflineRef.current = true;
      }

      setIsOffline(!netStatus.connected);

      if (netStatus.connected) {
        // Brief delay — network is reported as up but isn't always stable immediately
        setTimeout(() => { isOfflineRef.current = false; }, 3000);
        console.log("🌐 Network restored — re-syncing session & profile...");
        try {
          // Force-reset the sync guard so network restore is never blocked by a stale lock
          isSyncingProfile = false;

          // Refresh the JWT first (it may have expired while offline)
          await supabase.auth.refreshSession().catch(() => {});
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log("🌐 Network restore: session valid, reloading profile...");
            // Await the sync to ensure profile is loaded before moving on
            await handleUserAuthenticated(session).catch(err =>
              console.warn("🌐 Network restore profile sync failed:", err)
            );
            // Reconnect Realtime channels that may have dropped
            try {
              supabase.realtime.disconnect();
              supabase.realtime.connect();
              supabase.realtime.setAuth(session.access_token);
              subscribeToChanges(session.user.id);
            } catch (rtErr) {
              console.warn("🌐 Realtime reconnect error:", rtErr);
            }
          }
        } catch (err) {
          console.warn("🌐 Network restore re-sync error:", err);
        }
      }
    });

    // 3. App State Change Listener (Resume/Background)
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log("📱 App Resumed: verifying and refreshing session...");
        
        // Explicitly force a session refresh. This prevents the auto-refresh lock 
        // from hanging indefinitely if the OS paused the WebView's timers.
        supabase.auth.refreshSession().then(({ error }) => {
           if (error) console.warn("📱 Session refresh error (often normal if offline):", error.message);
           return supabase.auth.getSession();
        }).then(({ data: { session } }) => {
          if (session) {
            console.log("📱 App Resumed: session verified. Reconnecting Realtime...");
            try {
              supabase.realtime.disconnect();
              supabase.realtime.connect();
              supabase.realtime.setAuth(session.access_token);
            } catch (rtErr) {
              console.error("📱 Real-time reconnection error:", rtErr);
            }
            const userId = session.user.id;
            subscribeToChanges(userId);
            // Re-sync FCM on resume to ensure waking up
            import('./utils/fcm').then(({ initFCM }) => initFCM(userId)).catch(err => console.error(err));
          }
        }).catch(err => {
           console.error("📱 App Resumed: Critical error in resume sequence:", err);
        });
      }
    });

    // Check initial network status
    Network.getStatus().then(status => setIsOffline(!status.connected));

    initializeApp();

    return () => {
      if (authListener) authListener.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // Native Back Button Hook
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backListener: any;
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('backButton', () => {
        console.log("📱 Native Back Button Pressed, current screen:", screenRef.current);
        
        // Prevent exiting the app if on main screens
        if (screenRef.current === 'dashboard' || screenRef.current === 'onboarding' || screenRef.current === 'marketplace') {
          // You might want to minimize the app instead
          // CapApp.exitApp(); 
          return;
        }
        
        // Functional update for complete reliability across re-renders
        triggerHaptic();
        setHistory(prev => {
          if (prev.length > 0) {
            const newHistory = [...prev];
            const previousScreen = newHistory.pop();
            if (previousScreen) {
              setScreenState(previousScreen); // use setScreenState to prevent breaking ref
              screenRef.current = previousScreen;
            }
            return newHistory;
          } else {
            setScreenState('dashboard');
            screenRef.current = 'dashboard';
            return prev;
          }
        });
      }).then(l => backListener = l);
    });

    return () => {
      if (backListener) backListener.remove();
    };
  }, []); // Run ONLY once to prevent memory leaks

  // --- Real-time Local Persistence ---
  useEffect(() => {
    if (recentActivities.length > 0) {
      console.log('💾 Saving recent activities to localStorage');
      localStorage.setItem('app_recent_activities', JSON.stringify(recentActivities));
    }
  }, [recentActivities]);


  const navigate = (scr: Screen, addToHistory = false) => {
    // Block navigation if searching for a ride
    // Exception: Allow navigation TO 'ride' or if we are already on the target screen (to avoid alert spam)
    if (isRideSearching && scr !== 'ride' && scr !== screen) {
      showAlert(
        "Request in Progress",
        "Please cancel your search before navigating to another screen.",
        "info"
      );
      return;
    }

    triggerHaptic();
    setIsNavVisible(true); // Always show nav on navigation
    if (addToHistory) {
      setHistory(prev => [...prev, screen]);
    } else if (['dashboard', 'marketplace', 'earn', 'profile', 'ride'].includes(scr)) {
      setHistory([]);
    }
    setScreen(scr);
  };

  const goBack = () => {
    triggerHaptic();
    if (history.length > 0) {
      const newHistory = [...history];
      const prev = newHistory.pop();
      setHistory(newHistory);
      if (prev) setScreen(prev);
    } else {
      setScreen('dashboard');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    const delta = currentScrollY - lastScrollY.current;

    // Hysteresis: only update if scrolled more than 10px
    if (Math.abs(delta) > 10) {
      if (delta > 0 && currentScrollY > 50) {
        if (isNavVisible) setIsNavVisible(false);
      } else if (delta < 0) {
        if (!isNavVisible) setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
    }

    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 400);
  };

  const toggleFavorite = async (bizId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert("Please login to save favorites!"); return; }

    if (favorites.includes(bizId)) {
      const { error } = await supabase.from('user_favorite_businesses').delete().eq('user_id', session.user.id).eq('business_id', bizId);
      if (!error) setFavorites(prev => prev.filter(f => f !== bizId));
    } else {
      if (favorites.length >= 6) { alert("Limit reached!"); return; }
      const { error } = await supabase.from('user_favorite_businesses').insert({ user_id: session.user.id, business_id: bizId });
      if (!error) setFavorites(prev => [...prev, bizId]);
    }
  };
  const renderScreen = () => {
    switch (screen || 'splash') {

      case 'splash': return <SplashScreen theme={theme} />;
      case 'onboarding': return <OnboardingScreen theme={theme} navigate={navigate} setUser={setUser} showAlert={showAlert} />;
      case 'dashboard': return <DashboardScreen
        user={user}
        theme={theme}
        navigate={navigate}
        toggleTheme={toggleTheme}
        setProfileDrawerToOpen={setProfileDrawerToOpen}
        setShowAssistant={setShowAssistant}
        favorites={favorites}
        businesses={businesses}
        recentActivities={recentActivities}
        setRecentActivities={setRecentActivities}
        setSelectedBusiness={setSelectedBusiness}
        isScrolling={isScrolling}
        isNavVisible={isNavVisible}
        handleScroll={handleScroll}
        setPrefilledDestination={setPrefilledDestination}
        setPrefilledTier={setPrefilledTier}
        setPrefilledDistance={setPrefilledDistance}
        setMarketSearchQuery={setMarketSearchQuery}

        settings={settings}
        showAlert={showAlert}
        activeOrderId={activeOrderId}
        activeBatchId={activeBatchId}
        setIsNavVisible={setIsNavVisible}
        isActivitiesLoading={isActivitiesLoading}
        isFavoritesLoading={isFavoritesLoading}
        locationPromptDone={locationPromptDone}
      />;
      case 'marketplace': return <MarketplaceScreen theme={theme} navigate={navigate} businesses={businesses} categories={categories} setSelectedBusiness={setSelectedBusiness} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} toggleFavorite={toggleFavorite} favorites={favorites} searchQuery={marketSearchQuery} setSearchQuery={setMarketSearchQuery} showAlert={showAlert} user={user} />;
      case 'earn': return <EarnScreen theme={theme} navigate={navigate} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} settings={settings} showAlert={showAlert} />;
      case 'business-detail': return <BusinessDetailScreen theme={theme} navigate={navigate} goBack={goBack} selectedBusiness={selectedBusiness} cart={cart} setCart={setCart} showAlert={showAlert} />;
      case 'checkout': return <CheckoutScreen theme={theme} navigate={navigate} goBack={goBack} cart={cart} setCart={setCart} user={user} settings={settings} showAlert={showAlert} setActiveOrderId={setActiveOrderId} setActiveBatchId={setActiveBatchId} activeOrderId={activeOrderId} activeBatchId={activeBatchId} />;
      case 'profile': return <ProfileScreen theme={theme} navigate={navigate} setScreen={setScreen} user={user} setUser={setUser} recentActivities={recentActivities} setRecentActivities={setRecentActivities} favorites={favorites} businesses={businesses} isScrolling={isScrolling} isNavVisible={isNavVisible} setIsNavVisible={setIsNavVisible} handleScroll={handleScroll} settings={settings} showAlert={showAlert} initialDrawer={profileDrawerToOpen} clearInitialDrawer={() => setProfileDrawerToOpen('none')} handleLogout={handleLogout} />;
      case 'order-tracking': return <OrderTrackingScreen theme={theme} navigate={navigate} user={user} setRecentActivities={setRecentActivities} showAlert={showAlert} activeOrderId={activeOrderId} setActiveOrderId={setActiveOrderId} activeBatchId={activeBatchId} setActiveBatchId={setActiveBatchId} />;
      default: return <SplashScreen theme={theme} />;
    }

  };

  return (
    <div className={`flex h-[100dvh] w-full ${theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-black'} transition-colors overflow-hidden`}>
      {isLoading && <SplashScreen theme={theme} />}
      <div className={`flex-1 relative flex justify-center bg-gray-100 dark:bg-black/50 overflow-hidden ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>
        <div className={`w-full h-full ${theme === 'light' ? 'bg-white/95' : 'bg-black/95'} relative overflow-hidden`}>
          <div key={screen} className="h-full w-full animate-scale-in">
            {screen && renderScreen()}
          </div>

          {!isLoading && screen !== 'onboarding' && screen !== 'ride' && screen !== 'checkout' && screen !== 'business-detail' && (
            <BottomNav active={screen} navigate={navigate} theme={theme} isScrolling={isScrolling} isNavVisible={isNavVisible} />
          )}

          {!isLoading && screen !== 'onboarding' && screen !== 'ride' && screen !== 'checkout' && (
            <FloatingCartButton cart={cart} theme={theme} onClick={() => navigate('checkout', true)} />
          )}

          {/* Persistent Ride Layer */}
          <div className={`absolute inset-0 transition-opacity duration-300 ${screen === 'ride' ? 'opacity-100 z-[5] pointer-events-auto' : 'opacity-0 -z-10 pointer-events-none'}`}>
            <RideScreen
              theme={theme}
              navigate={navigate}
              goBack={goBack}
              setRecentActivities={setRecentActivities}
              user={user}
              prefilledDestination={prefilledDestination}
              prefilledTier={prefilledTier}
              prefilledDistance={prefilledDistance}
              clearPrefilled={() => { setPrefilledDestination(null); setPrefilledTier(null); setPrefilledDistance(null); }}
              active={screen === 'ride'}
              handleScroll={handleScroll}
              settings={settings}
              showAlert={showAlert}
              onSearchingChange={setIsRideSearching}
              indexLocation={userLocation}
            />
          </div>
        </div>
      </div>
      {showAssistant && <SmartAssistant onClose={() => setShowAssistant(false)} theme={theme} />}

      {/* Connectivity Modal (Offline Only) */}
      {isOffline && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md px-6 animate-fade-in">
          <div className={`${theme === 'dark' ? 'bg-[#1C1C1E] border-white/10' : 'bg-white border-black/5'} border w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl animate-scale-in`}>
            <div className={`mx-auto w-20 h-20 mb-6 rounded-full flex items-center justify-center bg-red-500/10`}>
              <WifiOff className="w-10 h-10 text-red-500" />
            </div>
            
            <h2 className={`text-2xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              You are Offline
            </h2>
            
            <p className={`text-sm mb-8 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Please check your internet connection to continue using Dropoff.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="w-full h-16 bg-[#00E39A] text-black rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCcw className="w-5 h-5" />
              Refresh App
            </button>
          </div>
        </div>
      )}

      <PremiumModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        theme={theme}
        showCancel={modalConfig.showCancel}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      {/* 🚀 Update Popup Overlay */}
      {updateConfig?.show && (
        <UpdatePopup 
          type={updateConfig.type}
          latestVersion={updateConfig.latestVersion}
          updateUrl={updateConfig.updateUrl}
          onDismiss={() => {
            setUpdateConfig(null);
            sessionStorage.setItem('update_dismissed', 'true');
          }}
        />
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  import('./utils/logger').then(({ setupGlobalErrorHandlers }) => {
     setupGlobalErrorHandlers();
  }).catch(e => console.error(e));
  const root = createRoot(container);
  root.render(<App />);
}

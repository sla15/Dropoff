import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Geolocation } from '@capacitor/geolocation';
import { ArrowRight, ArrowLeft, Camera, Briefcase, Mail, MapPin, Locate, Loader2, Gift, ChevronDown, X, Search } from 'lucide-react';
import { Theme, Screen, UserData } from '../types';
import { triggerHaptic, sendPushNotification, compressImage } from '../utils/helpers';
import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';
import { logError } from '../utils/logger';

interface Props {
   theme: Theme;
   navigate: (scr: Screen) => void;
   setUser: React.Dispatch<React.SetStateAction<UserData>>;
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

const COUNTRIES = [
   { code: '+220', flag: '🇬🇲', name: 'Gambia', maxLen: 7 },
   { code: '+221', flag: '🇸🇳', name: 'Senegal', maxLen: 9 },
   { code: '+234', flag: '🇳🇬', name: 'Nigeria', maxLen: 10 },
   { code: '+233', flag: '🇬🇭', name: 'Ghana', maxLen: 9 },
   { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire", maxLen: 10 },
   { code: '+231', flag: '🇱🇷', name: 'Liberia', maxLen: 9 },
   { code: '+232', flag: '🇸🇱', name: 'Sierra Leone', maxLen: 8 },
   { code: '+224', flag: '🇬🇳', name: 'Guinea', maxLen: 9 },
   { code: '+223', flag: '🇲🇱', name: 'Mali', maxLen: 8 },
   { code: '+226', flag: '🇧🇫', name: 'Burkina Faso', maxLen: 10 },
   { code: '+222', flag: '🇲🇷', name: 'Mauritania', maxLen: 8 },
   { code: '+227', flag: '🇳🇪', name: 'Niger', maxLen: 8 },
   { code: '+235', flag: '🇹🇩', name: 'Chad', maxLen: 8 },
   { code: '+237', flag: '🇨🇲', name: 'Cameroon', maxLen: 9 },
   { code: '+241', flag: '🇬🇦', name: 'Gabon', maxLen: 7 },
   { code: '+242', flag: '🇨🇬', name: 'Congo', maxLen: 9 },
   { code: '+243', flag: '🇨🇩', name: 'DR Congo', maxLen: 9 },
   { code: '+236', flag: '🇨🇫', name: 'CAR', maxLen: 8 },
   { code: '+240', flag: '🇬🇶', name: 'Equatorial Guinea', maxLen: 9 },
   { code: '+244', flag: '🇦🇴', name: 'Angola', maxLen: 9 },
   { code: '+264', flag: '🇳🇦', name: 'Namibia', maxLen: 9 },
   { code: '+267', flag: '🇧🇼', name: 'Botswana', maxLen: 8 },
   { code: '+268', flag: '🇸🇿', name: 'Eswatini', maxLen: 9 },
   { code: '+266', flag: '🇱🇸', name: 'Lesotho', maxLen: 8 },
   { code: '+263', flag: '🇿🇼', name: 'Zimbabwe', maxLen: 10 },
   { code: '+260', flag: '🇿🇲', name: 'Zambia', maxLen: 9 },
   { code: '+261', flag: '🇲🇬', name: 'Madagascar', maxLen: 9 },
   { code: '+265', flag: '🇲🇼', name: 'Malawi', maxLen: 9 },
   { code: '+254', flag: '🇰🇪', name: 'Kenya', maxLen: 10 },
   { code: '+255', flag: '🇹🇿', name: 'Tanzania', maxLen: 9 },
   { code: '+256', flag: '🇺🇬', name: 'Uganda', maxLen: 9 },
   { code: '+250', flag: '🇷🇼', name: 'Rwanda', maxLen: 9 },
   { code: '+257', flag: '🇧🇮', name: 'Burundi', maxLen: 8 },
   { code: '+251', flag: '🇪🇹', name: 'Ethiopia', maxLen: 9 },
   { code: '+252', flag: '🇸🇴', name: 'Somalia', maxLen: 9 },
   { code: '+253', flag: '🇩🇯', name: 'Djibouti', maxLen: 8 },
   { code: '+249', flag: '🇸🇩', name: 'Sudan', maxLen: 9 },
   { code: '+211', flag: '🇸🇸', name: 'South Sudan', maxLen: 9 },
   { code: '+20', flag: '🇪🇬', name: 'Egypt', maxLen: 10 },
   { code: '+212', flag: '🇲🇦', name: 'Morocco', maxLen: 9 },
   { code: '+213', flag: '🇩🇿', name: 'Algeria', maxLen: 9 },
   { code: '+216', flag: '🇹🇳', name: 'Tunisia', maxLen: 8 },
   { code: '+218', flag: '🇱🇾', name: 'Libya', maxLen: 9 },
   { code: '+44', flag: '🇬🇧', name: 'UK', maxLen: 10 },
   { code: '+1', flag: '🇺🇸', name: 'USA', maxLen: 10 },
   { code: '+33', flag: '🇫🇷', name: 'France', maxLen: 9 },
   { code: '+49', flag: '🇩🇪', name: 'Germany', maxLen: 11 },
   { code: '+34', flag: '🇪🇸', name: 'Spain', maxLen: 9 },
   { code: '+39', flag: '🇮🇹', name: 'Italy', maxLen: 10 },
   { code: '+31', flag: '🇳🇱', name: 'Netherlands', maxLen: 9 },
   { code: '+32', flag: '🇧🇪', name: 'Belgium', maxLen: 9 },
   { code: '+41', flag: '🇨🇭', name: 'Switzerland', maxLen: 9 },
   { code: '+43', flag: '🇦🇹', name: 'Austria', maxLen: 10 },
   { code: '+46', flag: '🇸🇪', name: 'Sweden', maxLen: 9 },
   { code: '+47', flag: '🇳🇴', name: 'Norway', maxLen: 8 },
   { code: '+45', flag: '🇩🇰', name: 'Denmark', maxLen: 8 },
   { code: '+358', flag: '🇫🇮', name: 'Finland', maxLen: 9 },
   { code: '+353', flag: '🇮🇪', name: 'Ireland', maxLen: 9 },
   { code: '+351', flag: '🇵🇹', name: 'Portugal', maxLen: 9 },
   { code: '+30', flag: '🇬🇷', name: 'Greece', maxLen: 10 },
   { code: '+90', flag: '🇹🇷', name: 'Turkey', maxLen: 10 },
   { code: '+7', flag: '🇷🇺', name: 'Russia', maxLen: 10 },
   { code: '+86', flag: '🇨🇳', name: 'China', maxLen: 11 },
   { code: '+91', flag: '🇮🇳', name: 'India', maxLen: 10 },
   { code: '+81', flag: '🇯🇵', name: 'Japan', maxLen: 10 },
   { code: '+82', flag: '🇰🇷', name: 'South Korea', maxLen: 10 },
   { code: '+61', flag: '🇦🇺', name: 'Australia', maxLen: 9 },
   { code: '+64', flag: '🇳🇿', name: 'New Zealand', maxLen: 9 },
   { code: '+1', flag: '🇨🇦', name: 'Canada', maxLen: 10 },
   { code: '+55', flag: '🇧🇷', name: 'Brazil', maxLen: 11 },
   { code: '+54', flag: '🇦🇷', name: 'Argentina', maxLen: 10 },
   { code: '+56', flag: '🇨🇱', name: 'Chile', maxLen: 9 },
   { code: '+57', flag: '🇨🇴', name: 'Colombia', maxLen: 10 },
   { code: '+58', flag: '🇻🇪', name: 'Venezuela', maxLen: 10 },
   { code: '+51', flag: '🇵🇪', name: 'Peru', maxLen: 9 },
   { code: '+52', flag: '🇲🇽', name: 'Mexico', maxLen: 10 },
   { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia', maxLen: 9 },
   { code: '+971', flag: '🇦🇪', name: 'UAE', maxLen: 9 },
   { code: '+974', flag: '🇶🇦', name: 'Qatar', maxLen: 8 },
   { code: '+965', flag: '🇰🇼', name: 'Kuwait', maxLen: 8 },
   { code: '+968', flag: '🇴🇲', name: 'Oman', maxLen: 8 },
   { code: '+973', flag: '🇧🇭', name: 'Bahrain', maxLen: 8 },
   { code: '+972', flag: '🇮🇱', name: 'Israel', maxLen: 9 },
   { code: '+962', flag: '🇯🇴', name: 'Jordan', maxLen: 9 },
   { code: '+961', flag: '🇱🇧', name: 'Lebanon', maxLen: 8 },
   { code: '+963', flag: '🇸🇾', name: 'Syria', maxLen: 9 },
   { code: '+964', flag: '🇮🇶', name: 'Iraq', maxLen: 10 },
   { code: '+98', flag: '🇮🇷', name: 'Iran', maxLen: 10 },
   { code: '+92', flag: '🇵🇰', name: 'Pakistan', maxLen: 10 },
   { code: '+880', flag: '🇧🇩', name: 'Bangladesh', maxLen: 10 },
   { code: '+94', flag: '🇱🇰', name: 'Sri Lanka', maxLen: 9 },
   { code: '+66', flag: '🇹🇭', name: 'Thailand', maxLen: 9 },
   { code: '+84', flag: '🇻🇳', name: 'Vietnam', maxLen: 9 },
   { code: '+60', flag: '🇲🇾', name: 'Malaysia', maxLen: 9 },
   { code: '+65', flag: '🇸🇬', name: 'Singapore', maxLen: 8 },
   { code: '+62', flag: '🇮🇩', name: 'Indonesia', maxLen: 11 },
   { code: '+63', flag: '🇵🇭', name: 'Philippines', maxLen: 10 },
   { code: '+27', flag: '🇿🇦', name: 'South Africa', maxLen: 9 },
];


// Draggable Bottom Sheet for Country Code Picker
const Drawer = ({ title, children, onClose, isClosing, theme, forceExpand }: { title: string, children: React.ReactNode, onClose: () => void, isClosing: boolean, theme: Theme, forceExpand?: boolean }) => {
   const [dragY, setDragY] = useState(0);
   const [isDragging, setIsDragging] = useState(false);
   const [isPeeked, setIsPeeked] = useState(false);
   const startY = useRef(0);
   const drawerRef = useRef<HTMLDivElement>(null);
   const PEEK_Y = 480;
   useEffect(() => {
      if (forceExpand) {
         setDragY(0);
         setIsPeeked(false);
      }
   }, [forceExpand]);

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
         if (delta < 0) {
            setDragY(Math.max(0, PEEK_Y + delta));
         }
      } else {
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
      <div className={`fixed inset-0 z-[101] flex flex-col justify-end transition-opacity duration-500 ${isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
         <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} style={{ opacity: Math.max(0, 1 - dragY / 500) }}></div>
         <div
            ref={drawerRef}
            className={`w-full ${theme === 'light' ? 'bg-white/85' : 'bg-[#1C1C1E]/85'} backdrop-blur-3xl rounded-t-[40px] pb-safe relative z-10 max-h-[95vh] min-h-[80vh] flex flex-col shadow-2xl ${isClosing ? 'ios-slide-down' : 'ios-slide-up'}`}
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
               <button onClick={onClose} className={`p-2.5 rounded-full ${theme === 'light' ? 'bg-gray-100 active:bg-gray-200' : 'bg-white/10 active:bg-white/20'} transition-colors`}>
                  <X size={20} />
               </button>
            </div>
            {children}
         </div>
      </div>
   );
};

export const OnboardingScreen = ({ theme, navigate, setUser, showAlert }: Props) => {
   const [step, setStep] = useState(1);
   const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
   const [showCountryPicker, setShowCountryPicker] = useState(false);
   const [isClosing, setIsClosing] = useState(false);
   const [countrySearch, setCountrySearch] = useState('');
   const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
   const [phone, setPhone] = useState('');
   const [otp, setOtp] = useState('');
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [referralInput, setReferralInput] = useState('');
   const [loading, setLoading] = useState(false);
   const [keyboardHeight, setKeyboardHeight] = useState(0);

   useEffect(() => {
      if (Capacitor.isNativePlatform()) {
         Keyboard.addListener('keyboardWillShow', info => {
            setKeyboardHeight(info.keyboardHeight);
         });
         Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
         });
         return () => {
            Keyboard.removeAllListeners();
         };
      }
   }, []);

   // Resume Onboarding if user is already logged in but profile is incomplete
   useEffect(() => {
      const checkResumeOnboarding = async () => {
         const { data: { session } } = await supabase.auth.getSession();
         if (session) {
            console.log("Onboarding: User found, checking profile completeness...");
            const { data: profile } = await supabase
               .from('profiles')
               .select('full_name, phone')
               .eq('id', session.user.id)
               .single();

            if (profile) {
               if (!profile.full_name || !profile.phone) {
                  console.log("Onboarding: Incomplete profile, jumping to Step 4");
                  setStep(4);
                  setName(profile.full_name || '');
                  setPhone(profile.phone || '');
               }
            } else {
               // No profile yet, likely just signed up
               console.log("Onboarding: No profile found, starting from Step 4");
               setStep(4);
            }
         }
      };
      checkResumeOnboarding();
   }, []);
   const [photo, setPhoto] = useState<string | null>(null);
   const [photoFile, setPhotoFile] = useState<File | null>(null);
   const [homeLocation, setHomeLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
   const [showPicker, setShowPicker] = useState(false);
   const [vehicleIndex, setVehicleIndex] = useState(0);

   const vehicles = [
      { src: "/assets/black_luxury_side.png", alt: "Premium Car" },
      { src: "/assets/white_yaris_side.png", alt: "Economic Car" },
      { src: "/assets/scooter_side_view.png", alt: "Scooter" }
   ];

   useEffect(() => {
      const interval = setInterval(() => {
         setVehicleIndex((prev) => (prev + 1) % vehicles.length);
      }, 5000);
      return () => clearInterval(interval);
   }, [vehicles.length]);



   const fileInputRef = useRef<HTMLInputElement>(null);

   const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
   const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
   const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
   const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';
   const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';

   const ProgressBar = ({ currentStep }: { currentStep: number }) => {
      const activeIndex = currentStep - 2;
      return (
         <div className="flex gap-2 mb-8 mt-2">
            {[0, 1, 2, 3].map((i) => (
               <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= activeIndex ? 'bg-[#00D68F]' : 'bg-gray-200 dark:bg-gray-800'}`}
               ></div>
            ))}
         </div>
      );
   };

   const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
         setPhotoFile(file);
         const reader = new FileReader();
         reader.onloadend = () => {
            setPhoto(reader.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   const sendOTP = async () => {
      triggerHaptic();
      setLoading(true);

      const fullPhone = `${selectedCountry.code}${phone}`;
      console.log("Sending OTP to:", fullPhone);

      const { error } = await supabase.auth.signInWithOtp({
         phone: fullPhone,
         // options: { shouldCreateUser: true } // Optional: Force/ensure user creation
      });

      setLoading(false);

      if (error) {
         console.error("OTP Error:", error);
         showAlert("Error", error.message, "error");
      } else {
         setStep(3);
      }
   };

   const verifyOTP = async (tokenOverride?: string) => {
      setLoading(true);
      triggerHaptic();

      try {
         const fullPhone = `${selectedCountry.code}${phone}`;
         const tokenToVerify = tokenOverride || otp;

         console.log("📡 OTP: Verifying for", fullPhone);
         const { data, error } = await supabase.auth.verifyOtp({
            phone: fullPhone,
            token: tokenToVerify,
            type: 'sms'
         });

         // Specialized Logging for User's Test Number
         if (phone === '2725142') {
            console.log("📊 DEBUG [2725142] OTP result:", { error, success: !!data.session });
            if (error) {
               logError(`OTP Verification Failed for 2725142: ${error.message}`, { phone: fullPhone, errorCode: error.status });
            }
         }

         if (error) {
            setLoading(false);
            console.error("Verification Error:", error);
            const errorMessage = error.message.includes("Expired") ? "OTP expired. Please request a new one." : error.message;
            showAlert("Error", errorMessage, "error");
            return;
         }

         if (data.session) {
            console.log("✅ OTP: Verified session created. Syncing profile before navigation.");

            localStorage.removeItem('fcm_prompted');

            const syncProfile = async () => {
               try {
                  const { data: profile, error: profileError } = await supabase
                     .from('profiles')
                     .select('*')
                     .eq('id', data.session.user.id)
                     .maybeSingle();

                  if (profileError) {
                     console.error("Profile Fetch Error:", profileError);
                     logError(profileError, { context: 'onboarding_verifyOTP_profileFetch' });
                  }

                  if (profile) {
                     console.log("👤 Profile: Found existing profile", profile.full_name);
                     setUser({
                        id: profile.id,
                        name: profile.full_name || '',
                        phone: profile.phone || '',
                        email: profile.email || '',
                        location: profile.location || 'Banjul, The Gambia',
                        photo: profile.avatar_url || null,
                        role: profile.role || 'customer',
                        rating: Number(profile.average_rating) || 5.0,
                        referralCode: profile.referral_code || '',
                        referralBalance: profile.referral_balance || 0
                     });

                     if (!profile.full_name || !profile.phone) {
                        console.log("👤 Profile: Incomplete, sending back to setup");
                        setStep(4);
                     } else {
                        navigate('dashboard');
                     }
                  } else {
                     console.log("👤 Profile: No profile found, sending to setup");
                     setStep(4);
                  }
               } catch (e) {
                  console.error("Background Sync Error:", e);
                  setStep(4); // Fallback to setup if sync fails
               } finally {
                  setLoading(false);
               }
            };

            syncProfile();

         } else {
            setLoading(false);
            showAlert("Session Error", "Could not create session. Please try again.", "error");
         }
      } catch (err: any) {
         console.error("OTP System Error:", err);
         logError(err, { context: 'onboarding_verifyOTP_catch' });
         showAlert("Error", "A system error occurred. Please try again.", "error");
      } finally {
         setLoading(false);
      }
   };

   const handleCompleteProfile = async () => {
      triggerHaptic();
      if (!name.trim() || /<[^>]*>/.test(name)) {
         showAlert("Invalid Name", "Please enter a valid name (no HTML tags allowed).", "info");
         return;
      }
      if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /<[^>]*>/.test(email))) {
         showAlert("Invalid Email", "Please enter a valid email address.", "info");
         return;
      }
      setLoading(true);

      // 1. Update Local State (Immediate UI feedback)
      setUser(prev => ({ ...prev, name, phone, email, photo }));

      try {
         // 2. Insert into Supabase 'profiles' table using the LIVE session
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id;

         if (userId) {
            console.log("Saving profile for User ID:", userId);

            let finalAvatarUrl = null;

            // 3. Upload Photo to Supabase Storage (if exists)
            if (photoFile) {
               try {
                  console.log("Compressing & Uploading photo to Storage...");
                  const compressedBlob = await compressImage(photoFile, 800, 0.7);
                  const fileName = `${userId}-${Date.now()}.jpg`;
                  const filePath = `user-avatars/${fileName}`;

                  const { error: uploadError } = await supabase.storage
                     .from('avatars')
                     .upload(filePath, compressedBlob, {
                        contentType: 'image/jpeg'
                     });

                  if (uploadError) throw uploadError;

                  // Get Public URL
                  const { data: { publicUrl } } = supabase.storage
                     .from('avatars')
                     .getPublicUrl(filePath);

                  finalAvatarUrl = publicUrl;
                  console.log("Photo uploaded! URL:", finalAvatarUrl);
               } catch (uploadErr: any) {
                  console.error("Storage Error:", uploadErr);
                  showAlert("Note", `Photo upload failed. We will save your profile anyway.`, "info");
               }
            }

            const { error } = await supabase.from('profiles').upsert({
               id: userId,
               full_name: name,
               phone: `${selectedCountry.code}${phone}`,
               email: email,
               avatar_url: finalAvatarUrl,
               role: 'customer',
               updated_at: new Date().toISOString()
            });

            if (error) throw error;

            // HANDLE REFERRAL LOGIC
            if (referralInput.length > 0) {
               console.log("Processing Referral:", referralInput);
               // 1. Find the referrer
               const { data: referrer, error: refError } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('referral_code', referralInput.toUpperCase())
                  .single();

               if (referrer && !refError) {
                  // 2. Create Referral Record
                  await supabase.from('referrals').insert({
                     referrer_id: referrer.id,
                     referee_id: userId,
                     status: 'pending'
                  });
                  console.log("Referral Linked!");
                  // Persistent storage for checkout
                  localStorage.setItem('pending_gift_card', referralInput.toUpperCase());
               } else {
                  console.warn("Invalid Referral Code ignored.");
               }
            }

            console.log("Profile saved to Supabase!");

            // 4. Update Application State with the REAL Supabase URL
            setUser(prev => ({ ...prev, name, phone, email, photo: finalAvatarUrl }));

            setStep(5); // Move to location selection
         } else {
            showAlert("Error", "Session lost. Please log in again.", "error");
            setStep(1); // Reset
         }
      } catch (e: any) {
         console.error("Profile Save Error:", e);
         showAlert("Save Error", e.message || "Could not save profile.", "error");
      } finally {
         setLoading(false);
      }
   };

   const saveHomeAndFinish = async (locData: { address: string; lat: number; lng: number }) => {
      setLoading(true);
      try {
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id;
         if (!userId) throw new Error("No session");

         const { error } = await supabase.from('user_saved_locations').insert({
            user_id: userId,
            label: 'Home',
            emoji: '🏠',
            address: locData.address,
            latitude: locData.lat,
            longitude: locData.lng
         });

         if (error) throw error;

         setUser(prev => ({ ...prev, location: locData.address }));

         // FINAL ONBOARDING SUCCESS PUSH
         sendPushNotification("Welcome to Dropoff! 🚀", `Hi ${name.split(' ')[0]}, thanks for joining us! Your journey starts here.`);

         navigate('dashboard');
      } catch (err: any) {
         console.error("Save Location Error:", err);
         showAlert("Error", `Failed to save location: ${err.message}`, "error");
      } finally {
         setLoading(false);
      }
   };

   const detectLocation = async () => {
      setLoading(true);
      try {
         if (Capacitor.isNativePlatform()) {
            const permissions = await Geolocation.checkPermissions();
            console.log("📍 Location permission status:", permissions.location);

            if (permissions.location === 'denied') {
               showAlert("Location Denied", "Please enable location permissions in your phone settings to use this feature.", "info");
               setLoading(false);
               return;
            }

            if (permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale') {
               const request = await Geolocation.requestPermissions();
               if (request.location !== 'granted') {
                  setLoading(false);
                  return;
               }
            }
         }

         const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
         });

         const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
         console.log("Onboarding: Location detected", coords);

         const google = (window as any).google;
         if (!google) {
            setLoading(false);
            showAlert("Error", "Google Maps not loaded. Please try again.", "error");
            return;
         }

         const geocoder = new google.maps.Geocoder();
         geocoder.geocode({ location: coords }, (results: any, status: string) => {
            if (status === 'OK' && results[0]) {
               const locData = { address: results[0].formatted_address, ...coords };
               setHomeLocation(locData);
               saveHomeAndFinish(locData);
            } else {
               setLoading(false);
               showAlert("Address Error", "Could not find address for this location.", "info");
            }
         });
      } catch (err: any) {
         console.error("Onboarding: Geolocation Error", err);
         setLoading(false);
         showAlert("Location Error", "Could not get your location. Please check your settings.", "error");
      }
   };

   if (step === 1) {
      return (
         <div className={`h-full w-full flex flex-col justify-between ${theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]'} ${textMain} p-6 pb-safe overflow-hidden relative selection:bg-[#00D68F]/30`}>
            {/* Dynamic Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
               <div className={`absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full blur-[100px] transition-opacity duration-1000 ${theme === 'light' ? 'bg-[#00D68F]/20' : 'bg-[#00D68F]/10'}`}></div>
               <div className={`absolute top-[40%] -right-[20%] w-[80vw] h-[80vw] rounded-full blur-[120px] transition-opacity duration-1000 ${theme === 'light' ? 'bg-[#00A06A]/20' : 'bg-[#00D68F]/10'}`}></div>
            </div>

            {/* Subtle Grid Pattern */}
            <div className={`absolute inset-0 z-0 ${theme === 'light' ? 'opacity-[0.03]' : 'opacity-[0.05]'} pointer-events-none`}>
               <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                     <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                     </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
               </svg>
            </div>

            {/* Content Overlay */}
            <div className="flex-1 flex flex-col justify-center z-10 pt-16 relative">
               <div className="mb-16">
                  <p className="text-[3.8rem] leading-[1.05] sm:text-[4.5rem] sm:leading-[1.05] font-black tracking-tighter mb-5 drop-shadow-xl relative z-10 pt-8 mt-8">
                     The future <br />
                     of <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D68F] to-[#00A06A]" style={{ filter: 'drop-shadow(0 0 10px rgba(0,214,143,0.4))' }}>movement.</span>
                  </p>

                  {/* Accent line */}
                  <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-[#00D68F] to-[#00A06A] mb-7 shadow-[0_0_10px_rgba(0,214,143,0.5)]"></div>

                  <p className={`text-[19px] sm:text-2xl font-semibold max-w-[280px] leading-snug tracking-tight ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                     Swift rides, smart deliveries. <br />
                     All in one premium app.
                  </p>
               </div>
            </div>

            {/* Background Image (Animated Vehicle Carousel) */}
            <div className="absolute top-[48%] -right-[65%] w-[160%] h-auto z-0 pointer-events-none translate-y-[-50%] overflow-hidden">
               <div className="relative w-full aspect-[2/1]">
                  {/* Common Ground Shadow for all vehicles */}
                  <div className="absolute bottom-[20%] left-[15%] w-[70%] h-[12%] bg-black/60 blur-[35px] rounded-[100%] transition-opacity duration-1000"></div>

                  {vehicles.map((v, i) => {
                     const isActive = i === vehicleIndex;
                     const isPrev = i === (vehicleIndex - 1 + vehicles.length) % vehicles.length;
                     const slideClass = isActive
                        ? 'opacity-100 translate-x-0 scale-100 z-10'
                        : isPrev
                           ? 'opacity-0 -translate-x-[40%] scale-95 blur-md z-0'
                           : 'opacity-0 translate-x-[40%] scale-95 blur-md z-0';

                     return (
                        <div
                           key={v.src}
                           className={`absolute inset-0 w-full h-full transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center ${slideClass}`}
                        >
                           <img
                              src={v.src}
                              className="w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
                              style={{
                                 transform: isActive ? 'translateY(-8px)' : 'translateY(8px)',
                                 transition: 'transform 2.5s ease-in-out'
                              }}
                              alt={v.alt}
                           />
                        </div>
                     );
                  })}
               </div>
            </div>

            <div className="space-y-6 z-[100] w-full relative mb-4 transition-all duration-300">
               <button
                  id="get-started-button"
                  onClick={(e) => {
                     e.stopPropagation();
                     console.log("🚀 Get Started clicked");
                     triggerHaptic();
                     setStep(2);
                  }}
                  className="group relative overflow-hidden w-full bg-[#00D68F] text-black py-5 rounded-[24px] font-black text-[20px] tracking-tight active:scale-[0.97] transition-all shadow-[0_15px_35px_rgba(0,214,143,0.35)] flex items-center justify-center gap-3 cursor-pointer touch-manipulation"
               >
                  <span className="relative z-10">Get Started</span>
                  <ArrowRight size={22} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1.5" />
                  <div className="sweep-animation absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg]"></div>
               </button>

               <p className={`text-center text-[12px] leading-relaxed px-6 font-semibold ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                  By continuing, you verify you are at least 18 and agree to our{' '}
                  <span onClick={() => window.open('/terms', '_blank')} className="text-[#00D68F] hover:text-[#00A06A] transition-colors cursor-pointer border-b border-[#00D68F]/30">Terms</span>
                  {' & '}
                  <span onClick={() => window.open('/privacy', '_blank')} className="text-[#00D68F] hover:text-[#00A06A] transition-colors cursor-pointer border-b border-[#00D68F]/30">Privacy</span>.
               </p>
            </div>

            <style dangerouslySetInnerHTML={{
               __html: `
               .group:hover .sweep-animation {
                  animation: shimmer 1.5s infinite;
               }
               @keyframes shimmer {
                  0% { transform: translateX(-150%) skewX(-20deg); }
                  100% { transform: translateX(150%) skewX(-20deg); }
               }
            `}} />
         </div>
      );
   }

   if (step === 2) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in overflow-hidden relative`}>
            {/* Header Navigation: Top-Right Action Button */}
            <div className="absolute top-8 left-6 right-6 z-[100] flex justify-between items-center bg-transparent">
               <button
                  onClick={() => setStep(1)}
                  className={`p-3 rounded-full ${theme === 'light' ? 'bg-white shadow-md' : 'bg-white/10'} active:scale-90 transition-all`}
               >
                  <ArrowLeft size={22} />
               </button>
               <button
                  onClick={sendOTP}
                  disabled={phone.length < (selectedCountry.maxLen - 2) || loading}
                  className={`px-6 py-3 rounded-full font-black text-sm active:scale-95 transition-all flex items-center gap-2 ${phone.length >= (selectedCountry.maxLen - 2) ? 'bg-[#00D68F] text-black shadow-xl shadow-[#00D68F]/30' : 'bg-gray-800 text-gray-500 opacity-60'}`}
               >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Continue <ArrowRight size={18} /></>}
               </button>
            </div>

            <div
               className="flex-1 flex flex-col justify-start items-center text-center overflow-y-auto pt-[15vh] px-4 no-scrollbar"
               style={{ paddingBottom: Math.max(20, keyboardHeight + 20) }}
            >
               <div className="w-full max-w-sm mx-auto">
                  <div className="flex justify-center mb-8">
                     <ProgressBar currentStep={2} />
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight mb-8">Enter your number</h2>

                  <div className={`flex items-center justify-center gap-3 pb-4 border-b-2 ${theme === 'light' ? 'border-black' : 'border-[#00D68F]'} mb-6 w-full max-w-[320px] mx-auto transition-colors focus-within:border-[#00D68F]`}>
                     <div
                        className="font-bold text-2xl flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => { triggerHaptic(); setShowCountryPicker(true); }}
                     >
                        <span>{selectedCountry.flag}</span> {selectedCountry.code}
                        <ChevronDown size={20} className={`${textSec} opacity-70`} />
                     </div>
                     <input
                        id="phone-input"
                        type="tel"
                        placeholder="### ####"
                        value={phone}
                        onChange={(e) => {
                           const val = e.target.value.replace(/\D/g, '');
                           if (val.length <= selectedCountry.maxLen) setPhone(val);
                        }}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' && phone.length >= (selectedCountry.maxLen - 2) && !loading) {
                              sendOTP();
                           }
                        }}
                        onFocus={(e) => {
                           setTimeout(() => (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                        }}
                        className={`flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-gray-300 dark:placeholder:text-gray-800 ${theme === 'light' ? 'text-black' : 'text-white'}`}
                     />
                  </div>
                  <p className={`text-sm ${textSec} font-medium opacity-60`}>We'll text you a 6-digit verification code.</p>
               </div>
            </div>

            {showCountryPicker && (
               <Drawer
                  title="Select Country"
                  onClose={() => {
                     setIsClosing(true);
                     setTimeout(() => {
                        setShowCountryPicker(false);
                        setIsClosing(false);
                        setCountrySearch('');
                        setIsDrawerExpanded(false);
                     }, 300);
                  }}
                  isClosing={isClosing}
                  theme={theme}
                  forceExpand={isDrawerExpanded}
               >
                  <div className="px-6 py-4 flex-shrink-0">
                     <div className={`flex items-center gap-3 h-14 p-3.5 rounded-2xl ${inputBg} border border-transparent focus-within:border-[#00D68F]/30 transition-all`}>
                        <Search size={18} className={textSec} />
                        <input
                           placeholder="Search country name or code..."
                           value={countrySearch}
                           onChange={(e) => setCountrySearch(e.target.value)}
                           onFocus={() => setIsDrawerExpanded(true)}
                           className="flex-1 bg-transparent outline-none font-bold text-sm"
                        />
                        {countrySearch.length > 0 && (
                           <button onClick={() => setCountrySearch('')} className="p-1 rounded-full bg-gray-200 dark:bg-gray-800">
                              <X size={14} className={textSec} />
                           </button>
                        )}
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-2 no-scrollbar">
                     {COUNTRIES.filter(c =>
                        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                        c.code.includes(countrySearch)
                     ).length > 0 ? (
                        COUNTRIES.filter(c =>
                           c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                           c.code.includes(countrySearch)
                        ).map((c, index) => (
                           <div
                              key={`${c.name}-${c.code}-${index}`}
                              onClick={() => {
                                 triggerHaptic();
                                 setSelectedCountry(c);
                                 setIsClosing(true);
                                 setTimeout(() => {
                                    setShowCountryPicker(false);
                                    setIsClosing(false);
                                    setCountrySearch('');
                                    setTimeout(() => document.getElementById('phone-input')?.focus(), 100);
                                 }, 300);
                              }}
                              className={`flex items-center gap-4 py-4 border-b ${theme === 'light' ? 'border-gray-100' : 'border-gray-800/50'} cursor-pointer active:bg-gray-100 dark:active:bg-white/5 transition-colors`}
                           >
                              <span className="text-3xl">{c.flag}</span>
                              <span className="font-bold text-lg flex-1">{c.name}</span>
                              <span className={`${textSec} font-bold`}>{c.code}</span>
                              {selectedCountry.code === c.code && (
                                 <div className="w-6 h-6 rounded-full bg-[#00D68F] flex items-center justify-center text-black">
                                    <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                                 </div>
                              )}
                           </div>
                        ))
                     ) : (
                        <div className="py-20 text-center opacity-40">
                           <p className="font-bold">No results for "{countrySearch}"</p>
                        </div>
                     )}
                     <div className="pt-6 pb-20 text-center">
                        <p className={`text-xs font-semibold ${textSec} opacity-60 px-4`}>Dropoff currently operates exclusively in the listed countries.</p>
                     </div>
                  </div>
               </Drawer>
            )}
         </div>
      );
   }

   if (step === 3) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in relative overflow-hidden`}>
            <div className="absolute top-8 left-6 right-6 z-[100] flex justify-end items-center bg-transparent">
               <button
                  onClick={() => verifyOTP()}
                  disabled={otp.length < 6 || loading}
                  className={`px-6 py-3 rounded-full font-black text-sm active:scale-95 transition-all flex items-center gap-2 ${otp.length === 6 ? 'bg-[#00D68F] text-black shadow-xl shadow-[#00D68F]/30' : 'bg-gray-800 text-gray-500 opacity-60'}`}
               >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Verify <ArrowRight size={18} /></>}
               </button>
            </div>

            <div
               className="flex-1 flex flex-col justify-start items-center text-center overflow-y-auto pt-[15vh] px-4 no-scrollbar"
               style={{ paddingBottom: Math.max(20, keyboardHeight + 20) }}
            >
               <div className="w-full max-w-sm mx-auto">
                  <div className="flex justify-center mb-10">
                     <ProgressBar currentStep={3} />
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight mb-3">Enter code</h2>
                  <p className={`${textSec} mb-12`}>Sent to {selectedCountry.code} {phone}</p>

                  <div className="flex items-center justify-center gap-3 mb-10 relative">
                     <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                           <div key={i} className={`w-12 h-16 rounded-2xl border ${theme === 'light' ? 'bg-white/50 border-black/10' : 'bg-[#1C1C1E]/50 border-white/10'} backdrop-blur-md shadow-sm flex items-center justify-center text-3xl font-bold transition-all duration-200 ${otp[i] ? 'border-[#00D68F] shadow-[0_0_15px_rgba(0,214,143,0.2)]' : ''}`}>
                              {otp[i] || ''}
                           </div>
                        ))}
                     </div>
                     <div className={`text-2xl font-bold opacity-30 ${textMain}`}>-</div>
                     <div className="flex gap-2">
                        {[3, 4, 5].map((i) => (
                           <div key={i} className={`w-12 h-16 rounded-2xl border ${theme === 'light' ? 'bg-white/50 border-black/10' : 'bg-[#1C1C1E]/50 border-white/10'} backdrop-blur-md shadow-sm flex items-center justify-center text-3xl font-bold transition-all duration-200 ${otp[i] ? 'border-[#00D68F] shadow-[0_0_15px_rgba(0,214,143,0.2)]' : ''}`}>
                              {otp[i] || ''}
                           </div>
                        ))}
                     </div>

                     <input
                        className="absolute inset-0 opacity-0 w-full h-full cursor-default caret-transparent"
                        type="tel"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        value={otp}
                        onChange={(e) => {
                           const val = e.target.value.replace(/\D/g, '');
                           if (val.length <= 6) setOtp(val);
                        }}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' && otp.length === 6 && !loading) {
                              verifyOTP();
                           }
                        }}
                        autoFocus
                     />
                  </div>
               </div>
            </div>

            <div className="mt-auto flex flex-col gap-4 px-2 pb-10 transition-all duration-300">
               <button
                  onClick={sendOTP}
                  disabled={loading}
                  className="text-[#00D68F] font-bold text-sm text-center hover:opacity-70 transition-opacity disabled:opacity-50"
               >
                  Resend Code
               </button>
            </div>
         </div>
      );
   }

   if (step === 4) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in overflow-hidden`}>
            <div className="absolute top-8 left-6 right-6 z-[100] flex justify-end items-center bg-transparent">
               <button
                  onClick={handleCompleteProfile}
                  disabled={loading || !name}
                  className={`px-6 py-3 rounded-full font-black text-sm active:scale-95 transition-all flex items-center gap-2 ${name ? 'bg-[#00D68F] text-black shadow-xl shadow-[#00D68F]/30' : 'bg-gray-800 text-gray-500 opacity-60'}`}
               >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Next <ArrowRight size={18} /></>}
               </button>
            </div>

            <div
               className="flex-1 flex flex-col justify-start items-center overflow-y-auto pt-[8vh] px-4 no-scrollbar"
               style={{ paddingBottom: Math.max(20, keyboardHeight + 20) }}
            >
               <div className="w-full max-w-sm mx-auto">
                  <div className="flex justify-center mb-6">
                     <ProgressBar currentStep={4} />
                  </div>

                  <div className="text-center mb-6">
                     <h1 className="text-2xl font-bold mb-2">Let's get to know you</h1>
                     <p className={`${textSec} text-xs px-4`}>Add your details so drivers and sellers can identify you.</p>
                  </div>

                  <div className="flex justify-center mb-6">
                     <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                     <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-24 h-24 rounded-full ${inputBg} flex items-center justify-center relative cursor-pointer overflow-hidden bg-cover bg-center`}
                        style={photo ? { backgroundImage: `url(${photo})` } : {}}
                     >
                        {!photo && <span className={`text-[10px] font-bold ${textSec} opacity-40 uppercase tracking-widest`}>Add Photo</span>}
                        <div className="absolute bottom-0 right-0 bg-[#00D68F] w-7 h-7 rounded-full flex items-center justify-center border-2 border-white dark:border-black shadow-sm z-10">
                           <Camera size={12} className="text-black" />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 w-full px-2">
                     <div>
                        <div className="flex items-center gap-1 mb-1.5">
                           <label className={`text-xs font-bold ${textSec}`}>Full Name</label>
                           <span className="text-[#00D68F]">*</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3.5 rounded-xl ${inputBg}`}>
                           <Briefcase size={18} className={textSec} />
                           <input
                              placeholder="e.g. Lamin Faye"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter' && name.trim() && !loading) {
                                    handleCompleteProfile();
                                 }
                              }}
                              onFocus={(e) => {
                                 setTimeout(() => (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                              }}
                              className="flex-1 bg-transparent outline-none font-medium text-sm"
                           />
                        </div>
                     </div>

                     <div>
                        <div className="flex items-center justify-between mb-1.5">
                           <label className={`text-xs font-bold ${textSec}`}>Email Address</label>
                           <span className={`text-[9px] ${inputBg} px-1.5 py-0.5 rounded text-gray-500`}>Optional</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3.5 rounded-xl ${inputBg}`}>
                           <Mail size={18} className={textSec} />
                           <input
                              placeholder="name@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter' && name.trim() && !loading) {
                                    handleCompleteProfile();
                                 }
                              }}
                              onFocus={(e) => {
                                 setTimeout(() => (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                              }}
                              className="flex-1 bg-transparent outline-none font-medium text-sm"
                           />
                        </div>
                     </div>

                     <div>
                        <div className="flex items-center justify-between mb-1.5">
                           <label className={`text-xs font-bold ${textSec}`}>Referral Code</label>
                           <span className={`text-[9px] ${inputBg} px-1.5 py-0.5 rounded text-gray-500`}>Optional</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3.5 rounded-xl ${inputBg}`}>
                           <Gift size={18} className={textSec} />
                           <input
                              placeholder="e.g. DROP2025"
                              value={referralInput}
                              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                              maxLength={10}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter' && name.trim() && !loading) {
                                    handleCompleteProfile();
                                 }
                              }}
                              onFocus={(e) => {
                                 setTimeout(() => (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                              }}
                              className="flex-1 bg-transparent outline-none font-medium uppercase tracking-widest text-sm placeholder:normal-case placeholder:tracking-normal"
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      );
   }

   if (step === 5) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in overflow-hidden`}>
            <div className="absolute top-8 left-6 right-6 z-[100] flex justify-end items-center bg-transparent">
               <button
                  onClick={() => navigate('dashboard')}
                  className="px-6 py-3 rounded-full font-black text-sm active:scale-95 transition-all flex items-center gap-2 bg-gray-800 text-gray-500 opacity-60"
               >
                  Skip/Finish <ArrowRight size={18} />
               </button>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center text-center overflow-y-auto pt-20 pb-4 no-scrollbar">
               <div className="w-full max-w-sm mx-auto">
                  <div className="flex justify-center mb-8">
                     <ProgressBar currentStep={5} />
                  </div>

                  <div className="text-center mb-10">
                     <h1 className="text-3xl font-bold mb-3">Where is Home?</h1>
                     <p className={`${textSec} text-sm px-4`}>This will be your primary pickup and delivery spot.</p>
                  </div>

                  <div className="flex flex-col gap-6 w-full">
                     <div className={`p-8 rounded-[32px] ${inputBg} flex flex-col items-center gap-4 text-center border-2 border-transparent active:border-[#00D68F] transition-all cursor-pointer shadow-sm`} onClick={detectLocation}>
                        <div className="w-16 h-16 bg-[#00D68F]/20 rounded-full flex items-center justify-center text-[#00D68F]">
                           <Locate size={32} />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg">Use Current Location</h3>
                           <p className={`text-xs ${textSec}`}>Detect via GPS (Fastest)</p>
                        </div>
                     </div>

                     <div className={`p-8 rounded-[32px] ${inputBg} flex flex-col items-center gap-4 text-center border-2 border-transparent active:border-[#00D68F] transition-all cursor-pointer shadow-sm`} onClick={() => setShowPicker(true)}>
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
                           <MapPin size={32} />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg">Set Manually</h3>
                           <p className={`text-xs ${textSec}`}>Search or Pin on Map</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {loading && (
               <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] backdrop-blur-sm">
                  <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                     <Loader2 className="animate-spin text-[#00D68F]" size={40} />
                     <span className="font-bold">Saving Location...</span>
                  </div>
               </div>
            )}

            {showPicker && (
               <LocationPicker
                  theme={theme}
                  title="Home Address"
                  user={{ id: '', name: name, phone: phone, email: email, location: '', photo: photo, role: 'customer', rating: 5.0, referralCode: '', referralBalance: 0 }}
                  onClose={() => setShowPicker(false)}
                  onConfirm={(loc) => {
                     setHomeLocation(loc);
                     setShowPicker(false);
                     saveHomeAndFinish(loc);
                  }}
               />
            )}
         </div>
      );
   }
   return null;
};

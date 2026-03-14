import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Geolocation } from '@capacitor/geolocation';
import { ArrowRight, ArrowLeft, Camera, Briefcase, Mail, MapPin, Locate, Loader2, Gift } from 'lucide-react';
import { Theme, Screen, UserData } from '../types';
import { triggerHaptic, sendPushNotification } from '../utils/helpers';
import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';

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

export const OnboardingScreen = ({ theme, navigate, setUser, showAlert }: Props) => {
   const [step, setStep] = useState(1);
   const [phone, setPhone] = useState('');
   const [otp, setOtp] = useState('');
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [referralInput, setReferralInput] = useState('');
   const [loading, setLoading] = useState(false);
   const [photo, setPhoto] = useState<string | null>(null);
   const [photoFile, setPhotoFile] = useState<File | null>(null);
   const [homeLocation, setHomeLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
   const [showPicker, setShowPicker] = useState(false);
   const [keyboardHeight, setKeyboardHeight] = useState(0);
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

   useEffect(() => {
      let showListener: any;
      let hideListener: any;

      if (Capacitor.isNativePlatform()) {
         Keyboard.addListener('keyboardWillShow', info => {
            setKeyboardHeight(info.keyboardHeight);
         }).then(l => showListener = l);

         Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
         }).then(l => hideListener = l);

         return () => {
            if (showListener) showListener.remove();
            if (hideListener) hideListener.remove();
         };
      }
   }, []);

   const fileInputRef = useRef<HTMLInputElement>(null);

   const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
   const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
   const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
   const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

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

      const fullPhone = `+220${phone}`;
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

      const fullPhone = `+220${phone}`;
      const tokenToVerify = tokenOverride || otp;

      const { data, error } = await supabase.auth.verifyOtp({
         phone: fullPhone,
         token: tokenToVerify,
         type: 'sms'
      });

      setLoading(false);

      if (error) {
         console.error("Verification Error:", error);
         showAlert("Error", error.message, "error");
      } else if (data.session) {
         console.log("Verified Session:", data.session);

         // Check if profile exists
         const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .maybeSingle();

         if (profile) {
            setUser({
               name: profile.full_name || '',
               phone: profile.phone || '',
               email: profile.email || '',
               location: profile.location || 'Banjul, The Gambia',
               photo: profile.avatar_url || null,
               rating: Number(profile.average_rating) || 5.0
            });

            if (!profile.full_name) {
               setStep(4);
            } else {
               localStorage.removeItem('fcm_prompted');
               navigate('dashboard');
            }
         } else {
            setStep(4);
         }
      }
   };

   const handleCompleteProfile = async () => {
      triggerHaptic();
      if (!name) { showAlert("Required", "Please enter your name", "info"); return; }
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
                  console.log("Uploading photo to Storage...");
                  const fileExt = photoFile.name.split('.').pop();
                  const fileName = `${userId}-${Math.random()}.${fileExt}`;
                  const filePath = `user-avatars/${fileName}`;

                  const { error: uploadError } = await supabase.storage
                     .from('avatars')
                     .upload(filePath, photoFile);

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
               phone: `+220${phone}`,
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
         <div className={`h-full w-full flex flex-col justify-between ${bgMain} ${textMain} p-6 pb-safe animate-scale-in overflow-hidden relative`}>
            {/* Subtle SVG Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none">
               <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                     <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                     </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
               </svg>
            </div>

            {/* Content Overlay */}
            <div className="flex-1 flex flex-col justify-center z-10 pt-10">
               <div className="mb-12">
                  <p className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.0] mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                     The future <br />
                     of <span className="text-[#00D68F]">movement.</span>
                  </p>
                  <p className={`text-xl ${theme === 'dark' ? 'text-white' : 'text-black'} font-bold max-w-[240px] leading-relaxed drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]`}>
                     Swift rides, smart deliveries. <br />
                     All in one premium app.
                  </p>
               </div>
            </div>

            {/* Background Image (Animated Vehicle Carousel, >50% cut off on right) */}
            <div className="absolute top-[50%] -right-[75%] w-[170%] h-auto z-0 pointer-events-none translate-y-[-50%] overflow-hidden">
               <div className="relative w-full aspect-[2/1]">
                  {/* Common Ground Shadow for all vehicles */}
                  <div className="absolute bottom-[15%] left-[10%] w-[80%] h-[10%] bg-black/40 blur-[40px] rounded-[100%] transition-opacity duration-1000"></div>
                  
                  {vehicles.map((v, i) => (
                     <img 
                        key={v.src}
                        src={v.src} 
                        className={`absolute inset-0 w-full h-full object-contain transition-all duration-1000 ease-in-out
                           ${i === vehicleIndex ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-20 scale-95 blur-sm'}
                           ${i < vehicleIndex || (vehicleIndex === 0 && i === vehicles.length - 1) ? '-translate-x-20' : ''}
                        `}
                        alt={v.alt}
                     />
                  ))}
               </div>
            </div>

            <div className="space-y-6 z-10">
               <button
                  onClick={() => { triggerHaptic(); setStep(2); }}
                  className="w-full bg-[#00D68F] text-black py-4.5 rounded-[22px] font-bold text-lg active:scale-95 transition-all shadow-[0_15px_30px_rgba(0,214,143,0.3)] flex items-center justify-center gap-3 group"
               >
                  Get Started
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
               </button>

               <p className={`text-center text-[10px] leading-relaxed px-4 font-medium opacity-40`}>
                  By continuing, you verify you are at least 18 and agree to our{' '}
                  <span onClick={() => window.open('/terms', '_blank')} className="text-[#00D68F] underline cursor-pointer">Terms</span>
                  {' & '}
                  <span onClick={() => window.open('/privacy', '_blank')} className="text-[#00D68F] underline cursor-pointer">Privacy</span>.
               </p>
            </div>
         </div>
      );
   }

   if (step === 2) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in overflow-hidden relative`}>
            <div className="flex-1 flex flex-col justify-center items-center text-center">
               <div className="w-full max-w-sm mx-auto">
                  <div className="flex justify-center mb-8">
                     <ProgressBar currentStep={2} />
                  </div>
                  
                  <h2 className="text-3xl font-bold tracking-tight mb-8">Enter your number</h2>
                  
                  <div className={`flex items-center justify-center gap-3 pb-4 border-b-2 ${theme === 'light' ? 'border-black' : 'border-[#00D68F]'} mb-6 w-full max-w-[280px] mx-auto transition-colors`}>
                     <div className="font-bold text-2xl flex items-center gap-2 shrink-0">
                        <span>🇬🇲</span> +220
                     </div>
                     <input
                        type="tel"
                        autoFocus
                        placeholder="### ####"
                        value={phone}
                        onChange={(e) => {
                           const val = e.target.value.replace(/\D/g, '');
                           if (val.length <= 7) setPhone(val);
                        }}
                        className={`w-36 bg-transparent text-2xl font-bold outline-none placeholder:text-gray-300 dark:placeholder:text-gray-800 ${theme === 'light' ? 'text-black' : 'text-white'}`}
                     />
                  </div>
                  <p className={`text-sm ${textSec} font-medium opacity-60`}>We'll text you a 6-digit verification code.</p>
               </div>
            </div>
            
            <div className="mt-auto px-2 pb-safe">
               <button
                  onClick={sendOTP}
                  disabled={phone.length < 3 || loading}
                  className={`w-full ${phone.length >= 7 ? 'bg-[#00D68F] text-black shadow-[0_15px_30px_rgba(0,214,143,0.3)]' : 'bg-gray-800 text-gray-500'} py-4.5 rounded-[22px] font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-2`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
               </button>
            </div>
         </div>
      );
   }

   if (step === 3) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in relative overflow-hidden`}>
            <div className="flex-1 flex flex-col justify-center items-center text-center">
               <div className="w-full max-w-sm mx-auto">
                  <div className="flex justify-center mb-10">
                    <ProgressBar currentStep={3} />
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight mb-3">Enter code</h2>
                  <p className={`${textSec} mb-12`}>Sent to +220 {phone}</p>
                  
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
                        autoFocus
                     />
                  </div>
               </div>
            </div>

            <div className="mt-auto flex flex-col gap-4 px-2 pb-safe">
               <button
                  onClick={() => verifyOTP()}
                  disabled={otp.length < 6 || loading}
                  className={`w-full ${otp.length === 6 ? 'bg-[#00D68F] text-black shadow-[0_15px_30px_rgba(0,214,143,0.3)]' : 'bg-gray-800 text-gray-500'} py-4.5 rounded-[22px] font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-2`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : 'Verify Code'}
               </button>

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
            <div className="flex-1 flex flex-col justify-center items-center">
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
                              placeholder="e.g. Buba Camara"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
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
                              placeholder="e.g. ALEX2025"
                              value={referralInput}
                              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                              maxLength={10}
                              className="flex-1 bg-transparent outline-none font-medium uppercase tracking-widest text-sm placeholder:normal-case placeholder:tracking-normal"
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-auto pb-safe pt-6 px-2">
               <button
                  onClick={handleCompleteProfile}
                  disabled={loading || !name}
                  className={`w-full ${name ? 'bg-[#00D68F] text-black shadow-[0_15px_30px_rgba(0,214,143,0.3)]' : 'bg-gray-800 text-gray-500'} py-4.5 rounded-[22px] font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-2`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : <>Next <ArrowRight size={20} /></>}
               </button>
            </div>
         </div>
      );
   }

   if (step === 5) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} px-6 pt-safe pb-safe animate-slide-in overflow-hidden`}>
            <div className="flex-1 flex flex-col justify-center items-center text-center">
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

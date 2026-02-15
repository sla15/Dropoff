
import React, { useState, useRef } from 'react';
import { ArrowRight, ArrowLeft, Camera, Briefcase, Mail, MapPin, Locate, Loader2, Gift } from 'lucide-react';
import { Theme, Screen, UserData } from '../types';
import { triggerHaptic } from '../utils/helpers';
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
         navigate('dashboard');
      } catch (err: any) {
         console.error("Save Location Error:", err);
         showAlert("Error", `Failed to save location: ${err.message}`, "error");
      } finally {
         setLoading(false);
      }
   };

   const detectLocation = () => {
      setLoading(true);
      if (navigator.geolocation) {
         const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

         navigator.geolocation.getCurrentPosition(
            async (pos) => {
               const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
               console.log("Onboarding: Location detected", coords);

               // Reverse geocode to get address
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
            },
            (error) => {
               console.error("Onboarding: Geolocation Error", error);
               setLoading(false);

               let errorMsg = "Could not get your location.";
               let errorTitle = "Location Error";

               switch (error.code) {
                  case 1: // PERMISSION_DENIED
                     errorTitle = "Permission Denied";
                     errorMsg = "Please allow location access in your browser or device settings.";
                     break;
                  case 2: // POSITION_UNAVAILABLE
                     errorTitle = "Unavailable";
                     errorMsg = "Location information is unavailable.";
                     break;
                  case 3: // TIMEOUT
                     errorTitle = "Timeout";
                     errorMsg = "The request to get your location timed out. Please try again.";
                     break;
               }

               showAlert(errorTitle, errorMsg, "error");
            },
            options
         );
      } else {
         setLoading(false);
         showAlert("Not Supported", "Geolocation is not supported by this browser.", "error");
      }
   };

   if (step === 1) {
      return (
         <div className={`h-full w-full flex flex-col justify-between ${bgMain} ${textMain} p-6 pb-safe animate-scale-in overflow-hidden relative`}>

            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] right-[-30%] w-[500px] h-[500px] bg-[#00D68F]/10 rounded-full blur-[80px] animate-[pulse_4s_ease-in-out_infinite]"></div>
            <div className="absolute bottom-[-10%] left-[-20%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[80px] animate-[pulse_5s_ease-in-out_infinite_1s]"></div>

            <div className="flex-1 flex flex-col justify-end pb-10 z-10">
               <div className="mb-12 relative w-full">
                  {/* Animated Logo */}
                  <div className="w-[30vw] h-[30vw] max-w-[160px] max-h-[160px] mb-12 flex items-center justify-center animate-[bounce_3s_infinite]">
                     <img
                        src="/assets/logo.png"
                        alt="DROPOFF"
                        className="w-full h-full object-contain rounded-[20%] shadow-2xl"
                     />
                  </div>

                  <h1 className="text-[14vw] sm:text-7xl font-black tracking-tighter mb-8 leading-[0.9]">
                     Move<br />
                     <span className="text-[#00D68F]">Freely.</span>
                  </h1>
                  <p className={`text-xl ${textSec} leading-relaxed max-w-[320px] font-medium`}>
                     The professional way to ride, shop, and manage your business.
                  </p>
               </div>

               <div className="space-y-6">
                  <button
                     onClick={() => { triggerHaptic(); setStep(2); }}
                     className={`w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg active:scale-98 transition-all shadow-xl hover:shadow-[#00D68F]/30 hover:scale-[1.01]`}
                  >
                     Get Started
                  </button>

                  <p className={`text-xs ${textSec} text-center leading-relaxed px-2`}>
                     By continuing, you have agreed to our{' '}
                     <span
                        onClick={() => window.open('https://superapp-hub.vercel.app/terms', '_blank')}
                        className="text-[#00D68F] font-bold cursor-pointer hover:underline"
                     >
                        Terms of Services
                     </span>
                     {' '}and{' '}
                     <span
                        onClick={() => window.open('https://superapp-hub.vercel.app/privacy', '_blank')}
                        className="text-[#00D68F] font-bold cursor-pointer hover:underline"
                     >
                        Policy
                     </span>.
                  </p>
               </div>
            </div>
         </div>
      );
   }

   if (step === 2) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} p-6 pt-safe animate-slide-in`}>
            <ArrowLeft onClick={() => setStep(1)} className="mb-4 cursor-pointer opacity-70" />
            <ProgressBar currentStep={2} />

            <h2 className="text-3xl font-bold tracking-tight mb-8">Enter your number</h2>
            <div className={`flex gap-3 pb-2 border-b-2 ${theme === 'light' ? 'border-black' : 'border-white'} mb-4`}>

               <div className="font-semibold text-2xl flex items-center gap-2"><span>🇬🇲</span> +220</div>
               <input
                  type="tel" autoFocus placeholder="*** ****" value={phone}
                  onChange={(e) => {
                     const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                     setPhone(val);
                  }}
                  className={`flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 ${theme === 'light' ? 'text-black' : 'text-white'}`}
               />
            </div>
            <p className={`text-sm ${textSec}`}>We'll text you a verification code.</p>
            <div className="mt-auto pb-safe">
               <button
                  onClick={sendOTP}
                  disabled={phone.length < 3 || loading}
                  className={`w-full bg-white text-black py-4 rounded-full font-semibold text-lg disabled:opacity-30 shadow-lg flex items-center justify-center`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
               </button>
            </div>
         </div>
      );
   }

   if (step === 3) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} p-6 pt-safe animate-slide-in relative`}>
            <ArrowLeft onClick={() => setStep(2)} className="mb-4 cursor-pointer opacity-70" />
            <ProgressBar currentStep={3} />

            <h2 className="text-3xl font-bold tracking-tight mb-2">Enter code</h2>
            <p className={`${textSec} mb-8`}>Sent to +220 {phone}</p>
            <div className="flex items-center justify-center gap-3 mb-8 z-20 pointer-events-none">
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
            </div>
            <input
               className="opacity-0 absolute inset-0 z-10 cursor-default"
               type="tel"
               pattern="[0-9]*"
               inputMode="numeric"
               value={otp}
               onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 6) setOtp(val);
               }}
               autoFocus
            />

            <div className="mt-auto pb-safe flex flex-col gap-4 z-30 relative">
               <button
                  onClick={() => verifyOTP()}
                  disabled={otp.length < 6 || loading}
                  className={`w-full bg-[#00D68F] text-black py-4 rounded-full font-semibold text-lg disabled:opacity-30 shadow-lg flex items-center justify-center transition-transform active:scale-98`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : 'Verify Code'}
               </button>

               <button
                  onClick={sendOTP}
                  disabled={loading}
                  className="text-[#00D68F] font-medium text-sm text-center hover:underline disabled:opacity-50"
               >
                  Resend Code
               </button>
            </div>
         </div>
      );
   }

   if (step === 4) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} p-6 pt-safe animate-slide-in`}>
            <div className="flex items-center justify-between mb-4">
               <button onClick={() => setStep(3)}><ArrowLeft className={textMain} /></button>
            </div>

            <ProgressBar currentStep={4} />

            <div className="text-center mb-8">
               <h1 className="text-3xl font-bold mb-3">Let's get to know you</h1>
               <p className={`${textSec} text-sm px-4`}>Add your details so drivers and sellers can identify you.</p>
            </div>

            <div className="flex justify-center mb-10">
               <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/*"
               />
               <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-28 h-28 rounded-full ${inputBg} flex items-center justify-center relative cursor-pointer overflow-hidden bg-cover bg-center`}
                  style={photo ? { backgroundImage: `url(${photo})` } : {}}
               >
                  {!photo && (
                     <div className="text-center">
                        <span className={`text-xs font-bold ${textSec} opacity-40 uppercase tracking-widest`}>Add Photo</span>
                     </div>
                  )}
                  <div className="absolute bottom-0 right-0 bg-[#00D68F] w-9 h-9 rounded-full flex items-center justify-center border-4 border-[#F2F2F7] dark:border-black shadow-sm z-10">
                     <Camera size={14} className="text-black" />
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <div>
                  <div className="flex items-center gap-1 mb-2">
                     <label className={`text-sm font-bold ${textSec}`}>Full Name</label>
                     <span className="text-[#00D68F]">*</span>
                  </div>
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${inputBg}`}>
                     <Briefcase size={20} className={textSec} />
                     <input
                        placeholder="e.g. Buba Camara"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="flex-1 bg-transparent outline-none font-medium"
                     />
                  </div>
               </div>

               <div>
                  <div className="flex items-center justify-between mb-2">
                     <label className={`text-sm font-bold ${textSec}`}>Email Address</label>
                     <span className={`text-[10px] ${inputBg} px-2 py-0.5 rounded text-gray-500`}>Optional</span>
                  </div>
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${inputBg}`}>
                     <Mail size={20} className={textSec} />
                     <input
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 bg-transparent outline-none font-medium"
                     />
                  </div>
               </div>

               <div>
                  <div className="flex items-center justify-between mb-2">
                     <label className={`text-sm font-bold ${textSec}`}>Referral Code</label>
                     <span className={`text-[10px] ${inputBg} px-2 py-0.5 rounded text-gray-500`}>Optional</span>
                  </div>
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${inputBg}`}>
                     <Gift size={20} className={textSec} />
                     <input
                        placeholder="e.g. ALEX2025"
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="flex-1 bg-transparent outline-none font-medium uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
                     />
                  </div>
               </div>
            </div>

            <div className="mt-auto pb-safe pt-6">
               <button
                  onClick={handleCompleteProfile}
                  disabled={loading}
                  className={`w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-lg flex items-center justify-center gap-2`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : <>Next <ArrowRight size={20} /></>}
               </button>
            </div>
         </div>
      );
   }

   if (step === 5) {
      return (
         <div className={`h-full w-full flex flex-col ${bgMain} ${textMain} p-6 pt-safe animate-slide-in`}>
            <div className="flex items-center justify-between mb-4">
               <button onClick={() => setStep(4)}><ArrowLeft className={textMain} /></button>
            </div>

            <ProgressBar currentStep={5} />

            <div className="text-center mb-8">
               <h1 className="text-3xl font-bold mb-3">Where is Home?</h1>
               <p className={`${textSec} text-sm px-4`}>This will be your primary pickup and delivery spot.</p>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6">
               <div className={`p-8 rounded-[32px] ${inputBg} flex flex-col items-center gap-4 text-center border-2 border-transparent hover:border-[#00D68F] transition-all cursor-pointer shadow-sm`} onClick={detectLocation}>
                  <div className="w-16 h-16 bg-[#00D68F]/20 rounded-full flex items-center justify-center text-[#00D68F]">
                     <Locate size={32} />
                  </div>
                  <div>
                     <h3 className="font-bold text-lg">Use Current Location</h3>
                     <p className={`text-xs ${textSec}`}>Detect via GPS (Fastest)</p>
                  </div>
               </div>

               <div className={`p-8 rounded-[32px] ${inputBg} flex flex-col items-center gap-4 text-center border-2 border-transparent hover:border-[#00D68F] transition-all cursor-pointer shadow-sm`} onClick={() => setShowPicker(true)}>
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
                     <MapPin size={32} />
                  </div>
                  <div>
                     <h3 className="font-bold text-lg">Set Manually</h3>
                     <p className={`text-xs ${textSec}`}>Search or Pin on Map</p>
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

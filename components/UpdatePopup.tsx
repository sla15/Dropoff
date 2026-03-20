
import React from 'react';
import { Download, AlertCircle, ArrowRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface UpdatePopupProps {
  type: 'force' | 'optional';
  latestVersion: string;
  updateUrl: string;
  onDismiss?: () => void;
}

export const UpdatePopup: React.FC<UpdatePopupProps> = ({ 
  type, 
  latestVersion, 
  updateUrl, 
  onDismiss 
}) => {
  const isAndroid = Capacitor.getPlatform() === 'android';
  
  // If the user provided a JSON string instead of a URL, we try to parse it or fallback to a standard Play Store link
  const getActionUrl = () => {
    if (updateUrl.trim().startsWith('[') || updateUrl.trim().startsWith('{')) {
      // This looks like the JSON provided by the user (Asset Links config)
      // We should use the standard store link for the actual button
      return isAndroid 
        ? 'https://play.google.com/store/apps/details?id=com.dropoffgambia.customer'
        : 'https://apps.apple.com/app/dropoff-gambia/id6478229445'; // Placeholder or actual iOS link if available
    }
    return updateUrl || (isAndroid 
      ? 'https://play.google.com/store/apps/details?id=com.dropoffgambia.customer'
      : '');
  };

  const handleUpdate = () => {
    window.open(getActionUrl(), '_system');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={type === 'optional' ? onDismiss : undefined}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-sm overflow-hidden bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
        
        {/* Banner/Header */}
        <div className="bg-gradient-to-br from-[#FFD700] to-[#FFA500] p-8 flex flex-col items-center text-black">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <Download className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-center tracking-tight">Update Available</h2>
          <p className="text-black/70 font-medium mt-1">Version {latestVersion}</p>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
            {type === 'force' 
              ? "A critical update is required to continue using the app. This version includes essential security and performance improvements."
              : "We've released a new version of Dropoff with smoother performance and new features. Update now for the best experience!"}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={handleUpdate}
              className="w-full py-4 px-6 bg-[#FFD700] hover:bg-[#FFC000] text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#FFD700]/20"
            >
              Update Now
              <ArrowRight className="w-5 h-5" />
            </button>

            {type === 'optional' && (
              <button
                onClick={onDismiss}
                className="w-full py-4 text-gray-500 dark:text-gray-400 font-medium hover:text-black dark:hover:text-white transition-colors"
              >
                Maybe later
              </button>
            )}
          </div>
        </div>

        {/* Status Indicator for Force Update */}
        {type === 'force' && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1.5 rounded-full border border-red-500/20">
            <AlertCircle className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Required</span>
          </div>
        )}
      </div>
    </div>
  );
};

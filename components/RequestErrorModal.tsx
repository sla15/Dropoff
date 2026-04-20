import React from 'react';
import { AlertCircle, RefreshCcw, X } from 'lucide-react';

interface RequestErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  title?: string;
  message?: string;
  theme: 'light' | 'dark';
}

export const RequestErrorModal: React.FC<RequestErrorModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  title = "Connection Issue",
  message = "We're having trouble connecting to our servers. Please check your internet connection and try again.",
  theme
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className={`w-full max-w-sm rounded-3xl p-8 shadow-2xl transform transition-all animate-in zoom-in-95 duration-300 ${
          theme === 'dark' ? 'bg-[#1C1C1E] text-white border border-white/10' : 'bg-white text-gray-900 shadow-xl'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          
          <h3 className="text-xl font-bold mb-3 tracking-tight">
            {title}
          </h3>
          
          <p className={`text-[15px] leading-relaxed mb-8 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {message}
          </p>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={onRetry}
              className="w-full h-14 bg-[#00D68F] hover:bg-[#00C281] text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#00D68F]/20"
            >
              <RefreshCcw className="w-5 h-5" />
              Try Again
            </button>
            
            <button
              onClick={onClose}
              className={`w-full h-14 font-semibold rounded-2xl transition-all active:scale-95 ${
                theme === 'dark' ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

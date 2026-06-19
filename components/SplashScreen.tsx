import React from 'react';
import { Theme } from '../types';

interface SplashScreenProps {
  theme: Theme;
  isExiting?: boolean;
}

export const SplashScreen = ({ theme, isExiting = false }: SplashScreenProps) => {
  const bg = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-black';

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden transition-opacity duration-700 ease-in-out ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="relative flex flex-col items-center w-full px-6">
        {/* Main Logo Container */}
        <div className="relative flex flex-col items-center justify-center w-full max-w-sm">
          {/* Logo: Slide from above / Exit: Portal Zoom */}
          <div className={`relative z-10 will-change-transform ${isExiting ? 'animate-logo-exit' : 'animate-logo-drop'}`}>
            <img
              src="/assets/Code_Generated_Image.png"
              alt="Logo"
              className="w-[50vw] h-[50vw] max-w-[320px] max-h-[320px] object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)]"
            />
          </div>

          {/* Logo Text: Slide from left / Exit: Recede & Fade Down */}
          <div className="mt-[-4vw] overflow-hidden">
            <div className={`will-change-transform flex items-center justify-center ${isExiting ? 'animate-text-exit' : 'animate-text-reveal'}`}>
              <span className="text-[12vw] sm:text-8xl font-black tracking-tighter text-[#8E8E93]">
                DROP
              </span>
              <span className="text-[12vw] sm:text-8xl font-black tracking-tighter text-[#00D68F]">
                OFF
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes logo-drop {
          0% { transform: translateY(-40vh); opacity: 0; }
          60% { transform: translateY(2vh); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes text-reveal {
          0% { transform: translateX(-150%); opacity: 0; filter: blur(15px); }
          50% { opacity: 0.5; }
          100% { transform: translateX(0); opacity: 1; filter: blur(0px); }
        }
        @keyframes logo-exit-portal {
          0% { transform: scale(1); opacity: 1; filter: blur(0px); }
          20% { transform: scale(0.92); opacity: 1; }
          100% { transform: scale(28); opacity: 0; filter: blur(6px); }
        }
        @keyframes text-exit-recede {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(32px) scale(0.9); opacity: 0; }
        }
        .animate-logo-drop {
          animation: logo-drop 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
        }
        .animate-text-reveal {
          animation: text-reveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) 1.4s both;
        }
        .animate-logo-exit {
          animation: logo-exit-portal 0.8s cubic-bezier(0.64, 0.04, 0.35, 1) both;
        }
        .animate-text-exit {
          animation: text-exit-recede 0.5s cubic-bezier(0.25, 1, 0.5, 1) both;
        }
      `}</style>
    </div>
  );
};

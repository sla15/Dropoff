
import React from 'react';
import { Theme } from '../types';

export const SplashScreen = ({ theme }: { theme: Theme }) => {
  const bg = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-black';
  const text = theme === 'light' ? 'text-black' : 'text-white';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden">
      <div className="relative flex flex-col items-center w-full px-6">
        {/* Main Logo Container */}
        <div className="relative flex flex-col items-center justify-center w-full max-w-sm">
          {/* Logo: Slide from above */}
          <div className="relative z-10 animate-logo-drop will-change-transform">
            <img
              src="/assets/logo.png"
              alt="Logo"
              className="w-[50vw] h-[50vw] max-w-[320px] max-h-[320px] object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)] rounded-[20%]"
            />
          </div>

          {/* Logo Text: Slide from left inside/behind the logo area */}
          <div className="mt-[-4vw] overflow-hidden">
            <div className="animate-text-reveal will-change-transform flex items-center justify-center">
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
        .animate-logo-drop {
          animation: logo-drop 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
        }
        .animate-text-reveal {
          animation: text-reveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) 1.4s both;
        }
      `}</style>
    </div>
  );
};

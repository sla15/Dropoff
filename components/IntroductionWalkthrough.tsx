import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, ChevronRight, HelpCircle, ShoppingBag, Map as MapIcon, Car, Info, Clock, MapPin } from 'lucide-react';
import { triggerHaptic } from '../utils/helpers';

interface Step {
  title: string;
  description: string;
  targetId?: string; // CSS ID of the element to highlight
  icon: React.ReactNode;
  position?: 'top' | 'bottom' | 'center';
}

interface Props {
  onComplete: () => void;
  onStep?: (index: number) => void;
  theme: 'light' | 'dark';
}

export const IntroductionWalkthrough = ({ onComplete, onStep, theme }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const steps: Step[] = [
    {
      title: "Welcome to Dropoff",
      description: "Everything you need, delivered fast. Experience the new way of shopping and moving around your city.",
      icon: <div className="w-16 h-16 bg-[#00D68F]/20 rounded-2xl flex items-center justify-center text-[#00D68F] mb-4">
        <div className="relative">
          <ArrowRight size={32} />
        </div>
      </div>,
      position: 'center'
    },
    {
      title: "One Order, Many Shops",
      description: "You can now order from different businesses at the same time! Just add items to your cart from any shop and check out once.",
      targetId: "walkthrough-search-container",
      icon: <div className="w-12 h-12 bg-[#FF9500]/20 rounded-xl flex items-center justify-center text-[#FF9500] mb-2">
        <ShoppingBag size={24} />
      </div>,
      position: 'bottom'
    },
    {
      title: "Switch to Rides",
      description: "Need a trip? Tap the toggle to switch from Marketplace to Maps instantly. We've made it effortless to get moving.",
      targetId: "walkthrough-search-container", // The toggle is part of this container
       icon: <div className="w-12 h-12 bg-[#00D68F]/20 rounded-xl flex items-center justify-center text-[#00D68F] mb-2">
        <MapIcon size={24} />
      </div>,
      position: 'bottom'
    },
    {
      title: "Pro Ride Tip",
      description: "When booking a ride, remember that your destination cannot be the same as your pickup location. Plan your route accurately!",
      targetId: "walkthrough-search-container",
      icon: <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-2">
        <Info size={24} />
      </div>,
      position: 'bottom'
    },
    {
        title: "Your Saved Places",
        description: "Save your home, office, or favorite hangout spots here for one-tap bookings and deliveries.",
        targetId: "walkthrough-saved-places",
        icon: <div className="w-12 h-12 bg-[#00D68F]/20 rounded-xl flex items-center justify-center text-[#00D68F] mb-2">
          <MapPin size={24} />
        </div>,
        position: 'bottom'
    },
    {
        title: "Recent Activities",
        description: "Review your past orders and rides. You can quickly reorder your favorite meals or repeat typical commutes.",
        targetId: "walkthrough-recent-activities",
        icon: <div className="w-12 h-12 bg-[#00D68F]/20 rounded-xl flex items-center justify-center text-[#00D68F] mb-2">
          <Clock size={24} />
        </div>,
        position: 'top'
    },
    {
      title: "Let's Get Started!",
      description: "Ready to experience Dropoff? Book your first ride or start an order from our Marketplace today!",
      icon: <div className="w-16 h-16 bg-[#00D68F]/20 rounded-2xl flex items-center justify-center text-[#00D68F] mb-4">
        <div className="relative">
          <ShoppingBag size={32} />
          <div className="absolute -right-2 -top-2 w-6 h-6 bg-[#00D68F] rounded-full flex items-center justify-center text-black text-[10px] font-bold">!</div>
        </div>
      </div>,
      position: 'center'
    }
  ];

  useEffect(() => {
    // Notify parent about step change
    if (onStep) onStep(currentStep);

    // Small delay to ensure the DOM is ready and animations finish
    const timer = setTimeout(() => {
        updateSpotlight();
        setIsVisible(true);
    }, 100);
    
    window.addEventListener('resize', updateSpotlight);
    return () => {
        window.removeEventListener('resize', updateSpotlight);
        clearTimeout(timer);
    };
  }, [currentStep]);

  const updateSpotlight = () => {
    const targetId = steps[currentStep].targetId;
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
      } else {
        setSpotlightRect(null);
      }
    } else {
      setSpotlightRect(null);
    }
  };

  const next = () => {
    triggerHaptic();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const skip = () => {
    triggerHaptic();
    onComplete();
  };

  const bgCard = theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]';
  const textMain = theme === 'light' ? 'text-black' : 'text-white';
  const textSec = theme === 'light' ? 'text-gray-500' : 'text-gray-400';

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    const currentStepData = steps[currentStep];
    const targetId = currentStepData.targetId;
    if (!spotlightRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const padding = 20;
    const { top, bottom, left, width } = spotlightRect;
    const stepPos = currentStepData.position;

    // Improved overlap prevention: if element ends below 40% of screen, always show tooltip at top.
    if (stepPos === 'bottom' && bottom < window.innerHeight * 0.4) {
      // Only show below if the element is strictly in the top 40%
      return {
        top: `${bottom + padding}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 48px)',
        maxWidth: '400px'
      };
    } else {
      // Default to top of screen for everything else to be safe and avoid nav overlap
      return {
        top: `${padding + 20}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 48px)',
        maxWidth: '400px'
      };
    }

    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100% - 48px)' };
  };

  return (
    <div className={`fixed inset-0 z-[10000] overflow-hidden transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Dynamic Spotlight Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect 
                x={spotlightRect.left - 8} 
                y={spotlightRect.top - 8} 
                width={spotlightRect.width + 16} 
                height={spotlightRect.height + 16} 
                rx="24" 
                fill="black"
                className="transition-all duration-500 ease-in-out"
              />
            )}
          </mask>
        </defs>
        <rect 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            fill="rgba(0,0,0,0.7)" 
            mask="url(#spotlight-mask)" 
            className="backdrop-blur-[2px]"
        />
        
        {/* Animated Circle Highlight */}
        {spotlightRect && (
            <rect 
                x={spotlightRect.left - 10} 
                y={spotlightRect.top - 10} 
                width={spotlightRect.width + 20} 
                height={spotlightRect.height + 20} 
                rx="26" 
                fill="none" 
                stroke="#00D68F" 
                strokeWidth="3"
                className="transition-all duration-500 ease-in-out animate-pulse"
                style={{ opacity: 0.8 }}
            />
        )}
      </svg>

      {/* Interactive Spotlight Area */}
      {spotlightRect && (
        <div 
          onClick={next}
          className="absolute z-[10001] cursor-pointer"
          style={{
            top: spotlightRect.top - 10,
            left: spotlightRect.left - 10,
            width: spotlightRect.width + 20,
            height: spotlightRect.height + 20,
          }}
        />
      )}

      <div className="absolute inset-0" onClick={skip} />
      
      {/* Tooltip Card */}
      <div 
        style={getTooltipStyle()}
        className={`absolute ${bgCard} rounded-[32px] p-8 shadow-2xl z-10 transition-all duration-500 ease-in-out flex flex-col items-center text-center`}
      >
        <button 
          onClick={skip}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <X size={20} className={textSec} />
        </button>

        <div className="flex flex-col items-center text-center mt-2 w-full">
          {steps[currentStep].icon}
          
          <h3 className={`text-xl font-black mb-3 ${textMain} tracking-tight leading-tight`}>
            {steps[currentStep].title}
          </h3>
          
          <p className={`text-sm font-medium leading-relaxed ${textSec} mb-8`}>
            {steps[currentStep].description}
          </p>

          <div className="flex gap-2 mb-8 justify-center">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-8 bg-[#00D68F]' : 'w-2 bg-[#00D68F]/20'
                }`}
              />
            ))}
          </div>

          <div className="flex w-full gap-3">
            <button 
              onClick={skip}
              className={`flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 ${
                theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-white/5 text-white'
              }`}
            >
              Skip
            </button>
            <button 
              onClick={next}
              className="flex-[2] py-4 bg-[#00D68F] text-black rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {currentStep === steps.length - 1 ? "Book or Order Now!" : "Next Step"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

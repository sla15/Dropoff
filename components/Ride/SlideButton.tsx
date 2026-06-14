
import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { triggerHaptic } from '../../utils/helpers';

interface SlideButtonProps {
    onSlideComplete: () => void;
    label: string;
    description?: string;
    baseColor?: string;
    activeColor?: string;
    disabled?: boolean;
}

export const SlideButton: React.FC<SlideButtonProps> = ({
    onSlideComplete,
    label,
    description,
    baseColor = "bg-gray-100 dark:bg-zinc-800",
    activeColor = "#00D68F",
    disabled = false
}) => {
    const [sliderPos, setSliderPos] = useState(0);
    const [isSliding, setIsSliding] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const sliderRef = useRef<HTMLDivElement>(null);
    const isCompletedRef = useRef(false);

    const isDanger = activeColor === '#EF4444';

    // Trigger the hint bounce after a short delay on mount
    useEffect(() => {
        const t1 = setTimeout(() => setShowHint(true), 700);
        const t2 = setTimeout(() => setShowHint(false), 1500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    const getSliderMax = () => {
        if (!containerRef.current || !sliderRef.current) return 0;
        return containerRef.current.clientWidth - sliderRef.current.clientWidth - 8;
    };

    const handleStart = () => {
        if (disabled || isCompletedRef.current) return;
        setIsSliding(true);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isSliding || isCompletedRef.current) return;
        const container = containerRef.current;
        if (!container) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const rect = container.getBoundingClientRect();
        const max = getSliderMax();
        let pos = clientX - rect.left - 30;
        pos = Math.max(0, Math.min(pos, max));
        setSliderPos(pos);
        if (pos >= max * 0.95) handleComplete();
    };

    const handleEnd = () => {
        if (!isSliding) return;
        setIsSliding(false);
        const max = getSliderMax();
        if (sliderPos < max * 0.9) setSliderPos(0);
    };

    const handleComplete = () => {
        if (isCompletedRef.current) return;
        isCompletedRef.current = true;
        setIsSliding(false);
        setIsCompleted(true);
        setSliderPos(getSliderMax());
        triggerHaptic();
        onSlideComplete();
        setTimeout(() => {
            setSliderPos(0);
            setIsCompleted(false);
            isCompletedRef.current = false;
        }, 1500);
    };

    useEffect(() => {
        if (isSliding) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchmove', handleMove, { passive: true });
            window.addEventListener('touchend', handleEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isSliding, sliderPos]);

    const progress = (sliderPos / (getSliderMax() || 1)) * 100;

    // Progressive red glow for danger buttons
    const containerStyle: React.CSSProperties = isDanger && progress > 0
        ? { boxShadow: `0 0 ${10 + progress * 0.25}px rgba(239,68,68,${Math.min(0.5, progress * 0.005)})` }
        : {};

    // Handle border + shadow progressively turns red as user slides
    const handleStyle: React.CSSProperties = {
        transform: `translateX(${showHint ? 10 : sliderPos}px)`,
        transition: isSliding ? 'none' : showHint
            ? 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)'
            : 'transform 0.45s cubic-bezier(0.19,1,0.22,1)',
        ...(isDanger && progress > 5 ? {
            borderColor: `rgba(239,68,68,${Math.min(0.7, progress * 0.008)})`,
            boxShadow: `0 4px 16px rgba(239,68,68,${Math.min(0.35, progress * 0.004)})`,
        } : {})
    };

    return (
        <>
            <style>{`
                @keyframes sb-chevron-pulse {
                    0%, 100% { opacity: 0.25; transform: translateX(0px); }
                    50%       { opacity: 0.9;  transform: translateX(2px); }
                }
                @keyframes sb-danger-breathe {
                    0%, 100% { opacity: 0.06; }
                    50%       { opacity: 0.14; }
                }
            `}</style>

            <div
                ref={containerRef}
                className={`relative w-full h-16 rounded-2xl flex items-center p-1 overflow-hidden
                    ${disabled ? 'opacity-50 pointer-events-none' : ''}
                    ${baseColor} shadow-inner transition-shadow duration-300`}
                style={containerStyle}
            >
                {/* Danger breathing background overlay */}
                {isDanger && (
                    <div
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse at left, rgba(239,68,68,0.12), transparent 70%)',
                            animation: 'sb-danger-breathe 2s ease-in-out infinite'
                        }}
                    />
                )}

                {/* Active fill track */}
                <div
                    className="absolute left-1 top-1 bottom-1 rounded-xl"
                    style={{
                        width: `${Math.max(60, sliderPos + 60)}px`,
                        backgroundColor: activeColor,
                        opacity: 0.85,
                        transition: isSliding ? 'none' : 'width 0.25s ease-out',
                    }}
                />

                {/* Label text — fades out as slider progresses */}
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
                    style={{ opacity: Math.max(0, 1 - progress / 55), transition: 'opacity 0.1s' }}
                >
                    <span className="text-gray-500 dark:text-gray-400 font-black text-xs uppercase tracking-[0.2em] ml-14">
                        {label}
                    </span>
                    {description && (
                        <span className="text-[9px] text-gray-400 mt-0.5 ml-14 font-medium">{description}</span>
                    )}
                </div>

                {/* Slide handle */}
                <div
                    ref={sliderRef}
                    onMouseDown={handleStart}
                    onTouchStart={handleStart}
                    className={`relative z-10 w-14 h-14 rounded-xl shadow-xl flex items-center justify-center
                        cursor-grab active:cursor-grabbing border border-white/10
                        ${isCompleted ? 'bg-emerald-500' : 'bg-white dark:bg-zinc-900'}`}
                    style={handleStyle}
                >
                    {isCompleted ? (
                        <Check size={26} className="text-white" strokeWidth={3} />
                    ) : (
                        <div className="flex items-center" style={{ gap: '-4px', marginLeft: '-4px' }}>
                            <ChevronRight
                                size={16}
                                style={{
                                    color: isDanger ? `rgba(239,68,68,0.35)` : 'rgba(156,163,175,0.5)',
                                    animation: 'sb-chevron-pulse 1.5s ease-in-out 0s infinite'
                                }}
                            />
                            <ChevronRight
                                size={20}
                                style={{
                                    color: isDanger ? `rgba(239,68,68,0.6)` : 'rgba(107,114,128,0.7)',
                                    animation: 'sb-chevron-pulse 1.5s ease-in-out 0.18s infinite'
                                }}
                            />
                            <ChevronRight
                                size={24}
                                style={{
                                    color: isDanger ? `rgba(239,68,68,${0.75 + progress * 0.0025})` : activeColor,
                                    animation: 'sb-chevron-pulse 1.5s ease-in-out 0.36s infinite'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Top shine */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 pointer-events-none rounded-t-2xl" />
            </div>
        </>
    );
};

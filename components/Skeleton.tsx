import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
    animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton = ({
    className = '',
    variant = 'rect',
    animation = 'wave'
}: SkeletonProps) => {
    const baseClass = "bg-gray-200 dark:bg-gray-800 overflow-hidden relative";
    const variantClass = variant === 'circle' ? 'rounded-full' : 'rounded-lg';

    const animationClass = animation === 'pulse'
        ? "animate-pulse"
        : animation === 'wave'
            ? "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/20 dark:after:via-white/10 after:to-transparent after:animate-[shimmer_2s_infinite]"
            : "";

    return (
        <div className={`${baseClass} ${variantClass} ${animationClass} ${className}`} />
    );
};

// Add shimmer keyframe to index.css if not already there
export const SkeletonTheme = () => (
    <style>{`
    @keyframes shimmer {
      100% {
        transform: translateX(100%);
      }
    }
  `}</style>
);

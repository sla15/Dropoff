import React from 'react';
import { Star } from 'lucide-react';
import { triggerHaptic } from '../utils/helpers';

interface StarRatingProps {
    rating: number;
    setRating?: (rating: number) => void;
    size?: number;
    interactive?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
    rating,
    setRating,
    size = 32,
    interactive = true
}) => {

    // Dynamic color based on rating
    const getStarColor = (starIndex: number) => {
        if (starIndex > rating) return 'text-gray-300 dark:text-gray-700';

        // Colors from Red (1) to Green (5)
        if (rating <= 1) return 'text-red-500';
        if (rating <= 2) return 'text-orange-500';
        if (rating <= 3) return 'text-yellow-500';
        if (rating <= 4) return 'text-lime-500';
        return 'text-[#00D68F]'; // Brand Green for 5
    };

    const handleStarClick = (s: number) => {
        if (interactive && setRating) {
            triggerHaptic();
            setRating(s);
        }
    };

    return (
        <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
                <button
                    key={s}
                    type="button"
                    disabled={!interactive}
                    onClick={() => handleStarClick(s)}
                    className={`${interactive ? 'transition-all active:scale-95 hover:scale-110' : 'cursor-default'}`}
                >
                    <Star
                        size={size}
                        fill={s <= rating ? "currentColor" : "none"}
                        className={`${getStarColor(s)} transition-colors duration-300`}
                        strokeWidth={s <= rating ? 0 : 2}
                    />
                </button>
            ))}
        </div>
    );
};

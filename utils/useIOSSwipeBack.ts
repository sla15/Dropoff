/**
 * useIOSSwipeBack
 *
 * Detects a right-swipe gesture from the left edge of the screen on iOS
 * and calls the provided `goBack` callback — mimicking iOS's native slide-to-go-back.
 *
 * Behaviour:
 *  - Touch must START within EDGE_WIDTH pixels from the left of the screen.
 *  - Horizontal drag must exceed MIN_SWIPE_X and must be more horizontal than vertical.
 *  - A live `containerStyle` (translateX) follows the finger so the screen slides.
 *  - On release: if far enough → calls goBack(); otherwise springs back.
 *
 * Usage (in a .tsx component):
 *   const { containerStyle, bindGesture } = useIOSSwipeBack(goBack);
 *   return <div style={containerStyle} {...bindGesture}>...</div>;
 */

import { useRef, useState, useCallback, CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';

const EDGE_WIDTH = 28;        // px from left edge where gesture must start
const MIN_SWIPE_X = 80;       // minimum horizontal px before committing
const COMMIT_THRESHOLD = 0.4; // fraction of screen width to auto-commit

export function useIOSSwipeBack(goBack: () => void) {
    const isIOS = Capacitor.getPlatform() === 'ios';

    const startX = useRef(0);
    const startY = useRef(0);
    const gestureActive = useRef(false);
    const [dragX, setDragX] = useState(0);

    const onTouchStart = useCallback((e: { touches: TouchList }) => {
        if (!isIOS) return;
        const t = e.touches[0];
        if (t.clientX <= EDGE_WIDTH) {
            startX.current = t.clientX;
            startY.current = t.clientY;
            gestureActive.current = true;
        }
    }, [isIOS]);

    const onTouchMove = useCallback((e: { touches: TouchList }) => {
        if (!isIOS || !gestureActive.current) return;
        const t = e.touches[0];
        const dx = t.clientX - startX.current;
        const dy = Math.abs(t.clientY - startY.current);

        // Cancel if gesture becomes more vertical than horizontal
        if (dy > dx + 10) {
            gestureActive.current = false;
            setDragX(0);
            return;
        }

        if (dx > 0) {
            setDragX(dx);
        }
    }, [isIOS]);

    const onTouchEnd = useCallback(() => {
        if (!isIOS || !gestureActive.current) return;
        gestureActive.current = false;

        const threshold = Math.max(MIN_SWIPE_X, window.innerWidth * COMMIT_THRESHOLD);
        if (dragX >= threshold) {
            setDragX(window.innerWidth);
            setTimeout(() => {
                setDragX(0);
                goBack();
            }, 160);
        } else {
            setDragX(0);
        }
    }, [isIOS, dragX, goBack]);

    const containerStyle: CSSProperties = isIOS && dragX > 0
        ? { transform: `translateX(${dragX}px)`, transition: 'none' }
        : {};

    const bindGesture = {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
    };

    return { containerStyle, bindGesture };
}

import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const EDGE_WIDTH = 20;
const MIN_SWIPE_X = 50;
const COMMIT_THRESHOLD = 0.35;

export function useIOSSwipeBack(goBack: () => void) {
  const isIOS = Capacitor.getPlatform() === 'ios';
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isEdgeSwipe = useRef(false);
  const dragXRef = useRef(0);
  const onBackRef = useRef(goBack);

  useEffect(() => {
    onBackRef.current = goBack;
  }, [goBack]);

  useEffect(() => {
    if (!isIOS) return;

    const handleTouchStart = (e: TouchEvent) => {
      const x = e.touches[0].clientX;
      if (x <= EDGE_WIDTH) {
        startX.current = x;
        startY.current = e.touches[0].clientY;
        isEdgeSwipe.current = true;
        dragXRef.current = 0;
        setIsAnimating(false);
        setDragX(0);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipe.current) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = Math.abs(e.touches[0].clientY - startY.current);

      if (dy > dx + 10 && dx < 30) {
        isEdgeSwipe.current = false;
        setDragX(0);
        return;
      }

      if (dx > 0) {
        dragXRef.current = dx;
        setDragX(dx);
      }
    };

    const handleTouchEnd = () => {
      if (!isEdgeSwipe.current) return;
      isEdgeSwipe.current = false;

      const dx = dragXRef.current;
      const threshold = Math.max(MIN_SWIPE_X, window.innerWidth * COMMIT_THRESHOLD);

      if (dx >= threshold) {
        setIsAnimating(true);
        setDragX(window.innerWidth);
        setTimeout(() => onBackRef.current(), 180);
      } else {
        setIsAnimating(true);
        setDragX(0);
        setTimeout(() => setIsAnimating(false), 200);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isIOS]);

  const containerStyle: React.CSSProperties = isIOS && dragX > 0
    ? {
        transform: `translateX(${dragX}px)`,
        transition: isAnimating ? 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        boxShadow: dragX > 0 ? '-3px 0 12px rgba(0,0,0,0.25)' : 'none',
        position: 'relative',
        zIndex: 2,
      }
    : {};

  const scrimOpacity = isIOS && dragX > 0
    ? Math.min(dragX / window.innerWidth * 0.5, 0.45)
    : 0;

  const scrimStyle: React.CSSProperties = isIOS
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: `rgba(0,0,0,${scrimOpacity})`,
        pointerEvents: 'none',
        zIndex: 1,
        transition: isAnimating ? 'opacity 0.2s ease' : 'none',
      }
    : {};

  return { containerStyle, scrimStyle };
}

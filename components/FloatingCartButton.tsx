import React, { useState, useRef, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { triggerHaptic } from '../utils/helpers';
import { CartItem, Theme } from '../types';

interface Props {
    cart: CartItem[];
    theme: Theme;
    onClick: () => void;
}

export const FloatingCartButton = ({ cart, theme, onClick }: Props) => {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(() => {
        const saved = localStorage.getItem('cart_pos');
        return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    });
    const [rel, setRel] = useState({ x: 0, y: 0 });
    const dragStartedAt = useRef(0);
    const buttonRef = useRef<HTMLDivElement>(null);

    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        dragStartedAt.current = Date.now();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        setRel({
            x: clientX - position.x,
            y: clientY - position.y
        });
        e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const newPos = {
            x: clientX - rel.x,
            y: clientY - rel.y
        };

        setPosition(newPos);
    };

    const onMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            localStorage.setItem('cart_pos', JSON.stringify(position));
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchmove', onMouseMove);
            window.addEventListener('touchend', onMouseUp);
        } else {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDragging, rel, position]);

    if (cart.length === 0) return null;

    const bg = theme === 'light' ? 'bg-black' : 'bg-white';
    const text = theme === 'light' ? 'text-white' : 'text-black';

    return (
        <div
            ref={buttonRef}
            onMouseDown={onMouseDown}
            onTouchStart={onMouseDown}
            onClick={(e) => {
                const dragDuration = Date.now() - dragStartedAt.current;
                // If it was a quick tap and didn't move much, it's a click
                if (dragDuration < 200) {
                    triggerHaptic();
                    onClick();
                }
            }}
            className={`fixed bottom-24 right-6 z-[60] flex items-center gap-3 ${bg} ${text} px-4 py-3 rounded-full shadow-2xl cursor-move active:scale-98 transition-transform animate-scale-in blur-none select-none ${isDragging ? 'scale-110 rotate-2' : ''}`}
            style={{
                filter: 'drop-shadow(0 0 15px rgba(0, 214, 143, 0.4))',
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.3s, scale 0.3s'
            }}
        >
            <div className="relative pointer-events-none">
                <ShoppingCart size={20} />
                <div className="absolute -top-2 -right-2 bg-[#00D68F] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-inherit">
                    {totalItems}
                </div>
            </div>
            <div className="flex flex-col items-start leading-none pointer-events-none">
                <span className="text-[10px] font-bold uppercase opacity-60 tracking-tighter">Your Cart</span>
                <span className="text-sm font-black">D{totalPrice.toFixed(0)}</span>
            </div>
        </div>
    );
};


import React from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Theme } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
    theme: Theme;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export const PremiumModal = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    theme,
    confirmText = 'Understood',
    cancelText = 'Cancel',
    showCancel = false,
    onConfirm,
    onCancel
}: Props) => {
    if (!isOpen) return null;

    const bgCard = theme === 'light' ? 'bg-white/90' : 'bg-[#1C1C1E]/90';
    const textMain = theme === 'light' ? 'text-black' : 'text-white';

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose();
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={handleCancel}></div>

            <div className={`${bgCard} backdrop-blur-2xl w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-white/10 p-8 flex flex-col items-center text-center gap-6 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 cubic-bezier(0.16, 1, 0.3, 1)`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-[#00D68F]/10 text-[#00D68F]' :
                    type === 'error' ? 'bg-red-500/10 text-red-500' :
                        'bg-blue-500/10 text-blue-500'
                    }`}>
                    {type === 'success' ? <CheckCircle2 size={32} /> :
                        type === 'error' ? <AlertCircle size={32} /> :
                            <Info size={32} />}
                </div>

                <div className="space-y-2">
                    <h3 className={`text-2xl font-black tracking-tight ${textMain}`}>{title}</h3>
                    <p className={`text-sm opacity-60 leading-relaxed whitespace-pre-line ${textMain}`}>{message}</p>
                </div>

                <div className="w-full flex flex-col gap-3">
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-[#00D68F] text-black h-14 rounded-2xl font-bold active:scale-95 transition-all text-base shadow-[0_8px_20px_rgba(0,214,143,0.3)]"
                    >
                        {confirmText}
                    </button>
                    {showCancel && (
                        <button
                            onClick={handleCancel}
                            className={`w-full h-14 rounded-2xl font-bold active:scale-95 transition-all text-base ${theme === 'light' ? 'text-black bg-black/5' : 'text-white bg-white/5'}`}
                        >
                            {cancelText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
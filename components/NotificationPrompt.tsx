
import React from 'react';
import { Bell } from 'lucide-react';
import { PremiumModal } from './PremiumModal';
import { Theme } from '../types';
import { initFCM } from '../utils/fcm';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
}

export const NotificationPrompt: React.FC<Props> = ({ isOpen, onClose, theme }) => {
    const handleEnable = async () => {
        const result = await initFCM();
        console.log('🔔 NotificationPrompt: Prompt result:', result);
        onClose();
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="Enable Notifications"
            message="Don't miss out! Enable notifications to receive real-time updates on your ride status and orders."
            type="info"
            theme={theme}
            confirmText="Enable Now"
            cancelText="Maybe Later"
            showCancel={true}
            onConfirm={handleEnable}
            onCancel={onClose}
        />
    );
};

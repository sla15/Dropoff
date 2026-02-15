import React, { useEffect, useRef } from 'react';
import { Theme, RideStatus } from '../../types';
import { MapPin as MapPinFilled } from 'lucide-react';
import { darkMapStyle } from '../../utils/mapStyles'; // Assuming you have or will extract map styles

interface RideMapProps {
    mapContainerRef: React.RefObject<HTMLDivElement>;
    map: any;
    theme: Theme;
    userLocation?: { lat: number; lng: number } | null;
    mapPins: { x: number; y: number; label?: string }[];
    status?: RideStatus;
}

export const RideMap: React.FC<RideMapProps> = ({
    mapContainerRef,
    map,
    theme,
    mapPins,
}) => {

    // Theme-aware Map Styles
    useEffect(() => {
        if (map) {
            console.log("RideMap: Map instance received and active");
            map.setOptions({
                styles: theme === 'dark' ? darkMapStyle : []
            });
        } else {
            console.log("RideMap: Map instance is currently null");
        }
    }, [theme, map]);

    return (
        <>
            {/* Real Interactive Map Area */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0 overflow-hidden" />

            {/* Visual Pins Overlay (likely for animation or static non-map pins, 
                though real map markers are handled via Google Maps API in the parent for now 
                or should be moved here if we pass the logic down) 
            */}
            {mapPins.map((pin, i) => (
                <div key={`pin-${i}`} className="absolute z-10 animate-scale-in" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                    <div className="relative -translate-x-1/2 -translate-y-full">
                        <MapPinFilled size={36} className="text-[#00D68F] drop-shadow-lg filter" />
                        <div className="w-2 h-2 bg-black/20 rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 blur-[1px]"></div>
                        {pin.label && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-black px-2 py-1 rounded shadow-md text-[10px] font-bold border border-gray-100 dark:border-gray-800">
                                {pin.label}
                            </div>
                        )}
                    </div>
                    <div className="absolute -translate-x-1/2 -translate-y-full top-[-28px] left-0 w-full text-center text-[10px] font-bold text-white pointer-events-none">
                        {i + 1}
                    </div>
                </div>
            ))}
        </>
    );
};

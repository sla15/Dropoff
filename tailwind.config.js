/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./index.tsx",
        "./screens/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            keyframes: {
                'slide-in': {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                'slide-in-up': {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'scale-in': {
                    '0%': { transform: 'scale(0.96)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                'bounce-in': {
                    '0%': { transform: 'scale(0.8)', opacity: '0' },
                    '60%': { transform: 'scale(1.05)', opacity: '1' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                'slide-down': {
                    '0%': { transform: 'translateY(-100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
            animation: {
                'slide-in': 'slide-in 0.3s ease-out both',
                'slide-in-up': 'slide-in-up 0.35s cubic-bezier(0.32,0.72,0,1) both',
                'scale-in': 'scale-in 0.2s ease-out both',
                'bounce-in': 'bounce-in 0.4s ease-out both',
                'slide-down': 'slide-down 0.25s ease-out both',
            },
        },
    },
    plugins: [],
}

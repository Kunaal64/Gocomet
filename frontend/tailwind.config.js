/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Orbitron', 'sans-serif'],
                body: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                dark: {
                    900: '#0a0e1a',
                    800: '#111827',
                    700: '#1e293b',
                    600: '#334155',
                },
                accent: {
                    cyan: '#00f0ff',
                    purple: '#7c3aed',
                    pink: '#ec4899',
                    green: '#10b981',
                    amber: '#f59e0b',
                    red: '#ef4444',
                },
            },
            animation: {
                'float': 'float 20s ease-in-out infinite',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'slide-in': 'slideIn 0.3s ease',
                'row-flash': 'rowFlash 1s ease',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(30px, -40px) scale(1.05)' },
                    '50%': { transform: 'translate(-20px, 20px) scale(0.95)' },
                    '75%': { transform: 'translate(40px, 30px) scale(1.02)' },
                },
                pulseGlow: {
                    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
                    '50%': { opacity: '0.5', transform: 'scale(0.85)' },
                },
                slideIn: {
                    from: { opacity: '0', transform: 'translateY(-10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                rowFlash: {
                    '0%': { backgroundColor: 'rgba(0, 240, 255, 0.15)' },
                    '100%': { backgroundColor: 'transparent' },
                },
            },
        },
    },
    plugins: [],
};

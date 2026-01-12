/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          telegram: {
            brand: '#0088cc',
            blue: '#0088cc',
            lightBlue: '#40B7E7',
            darkBlue: '#0077B5',
            accent: {
              green: '#34a853',
              yellow: '#fbbc05',
              pink: '#e91e63',
              purple: '#9c27b0',
              blue: '#2196f3',
            },
            background: {
              primary: '#0f0f0f',
              secondary: '#1e1e1e',
              tertiary: '#2d2d2d',
            },
            text: {
              primary: '#ffffff',
              secondary: '#b0b0b0',
              tertiary: '#6b6b6b',
            }
          }
        },
        animation: {
          'ping-slow': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
          'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'bounce-slow': 'bounce 2s infinite',
          'float': 'float 3s ease-in-out infinite',
          'shimmer': 'shimmer 2s infinite',
          'slide-up': 'slide-up 0.3s ease-out',
          'slide-down': 'slide-down 0.3s ease-out',
          'fade-in': 'fade-in 0.5s ease-out',
          'fade-out': 'fade-out 0.5s ease-out',
        },
        keyframes: {
          float: {
            '0%, 100%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-10px)' },
          },
          shimmer: {
            '0%': { backgroundPosition: '-1000px 0' },
            '100%': { backgroundPosition: '1000px 0' },
          },
          'slide-up': {
            '0%': { transform: 'translateY(100%)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
          },
          'slide-down': {
            '0%': { transform: 'translateY(-100%)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
          },
          'fade-in': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          'fade-out': {
            '0%': { opacity: '1' },
            '100%': { opacity: '0' },
          },
        },
        backgroundImage: {
          'gradient-telegram': 'linear-gradient(135deg, #0088cc 0%, #40B7E7 100%)',
          'gradient-purple-pink': 'linear-gradient(135deg, #9c27b0 0%, #e91e63 100%)',
          'gradient-blue-purple': 'linear-gradient(135deg, #2196f3 0%, #9c27b0 100%)',
          'gradient-gold': 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
          'gradient-rainbow': 'linear-gradient(90deg, #FF0000 0%, #FFA500 15%, #FFFF00 30%, #00FF00 45%, #00FFFF 60%, #0000FF 75%, #800080 90%)',
        },
        boxShadow: {
          'telegram': '0 4px 20px rgba(0, 136, 204, 0.3)',
          'telegram-lg': '0 10px 40px rgba(0, 136, 204, 0.4)',
          'telegram-xl': '0 20px 60px rgba(0, 136, 204, 0.5)',
          'inner-glow': 'inset 0 0 20px rgba(0, 136, 204, 0.3)',
        },
        backdropBlur: {
          'xs': '2px',
        }
      },
    },
    plugins: [],
  }
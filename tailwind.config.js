/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}", // Next.js 13 app dir
    "./pages/**/*.{js,ts,jsx,tsx}", // If you have pages dir
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  extend: {
    keyframes: {
      'slide-in': {
        '0%': { transform: 'translateX(100%)', opacity: '0' },
        '100%': { transform: 'translateX(0)', opacity: '1' },
      },
    },
    animation: {
      'slide-in': 'slide-in 0.5s ease-out',
    },
  },
},
  plugins: [],
}

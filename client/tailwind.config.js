/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#A9D6F5',    // Light blue
          secondary: '#D9ECFA',  // Soft blue
          cream: '#FFF8E7',      // Warm cream
          card: '#FFFFFF',       // Card white
          accent: '#6FA8D6',     // Muted blue
          navy: '#263746',       // Dark navy main text
          gray: '#657786',       // Gray-blue secondary text
          border: '#D1E6F7',
          success: '#2E7D32',
          successLight: '#E8F5E9',
          warning: '#D97706',
          warningLight: '#FEF3C7',
          danger: '#DC2626',
          dangerLight: '#FEE2E2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 2px 8px -1px rgba(38, 55, 70, 0.06), 0 1px 4px -1px rgba(38, 55, 70, 0.04)',
        'card': '0 4px 14px 0 rgba(38, 55, 70, 0.07)',
        'elevated': '0 10px 25px -3px rgba(38, 55, 70, 0.1), 0 4px 6px -2px rgba(38, 55, 70, 0.05)',
      }
    },
  },
  plugins: [],
}

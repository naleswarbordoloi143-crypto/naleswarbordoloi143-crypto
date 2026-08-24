/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d', 950: '#052e16',
        },
        accent: {
          50: '#fff8eb', 100: '#feefc7', 200: '#fde58a', 300: '#fbd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        wheat: {
          50: '#fef8ee', 100: '#fbeed3', 200: '#f6d9a5', 300: '#efbd6e',
          400: '#e8a242', 500: '#e08a28', 600: '#c2711f',
        },
        soil: {
          50: '#f9f5f0', 100: '#efe5d6', 200: '#ddcaad', 300: '#c6a777',
          400: '#a88a52', 500: '#8a6d3f', 600: '#6f5631',
        },
        success: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
        warning: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 500: '#f59e0b', 600: '#d97706' },
        error: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        info: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 500: '#3b82f6', 600: '#2563eb' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh-green': 'radial-gradient(at 27% 37%, hsla(142, 72%, 40%, 0.12) 0px, transparent 50%), radial-gradient(at 97% 21%, hsla(43, 93%, 56%, 0.10) 0px, transparent 50%), radial-gradient(at 52% 99%, hsla(142, 76%, 30%, 0.08) 0px, transparent 50%), radial-gradient(at 10% 29%, hsla(43, 93%, 56%, 0.06) 0px, transparent 50%), radial-gradient(at 97% 96%, hsla(142, 58%, 45%, 0.08) 0px, transparent 50%), radial-gradient(at 33% 50%, hsla(142, 76%, 36%, 0.06) 0px, transparent 50%), radial-gradient(at 79% 53%, hsla(43, 93%, 56%, 0.04) 0px, transparent 50%)',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 3px -1px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px -1px rgba(0, 0, 0, 0.05), 0 4px 12px -4px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 8px 24px -8px rgba(0, 0, 0, 0.06)',
        'primary-glow': '0 4px 16px -4px rgba(34, 197, 94, 0.25)',
        'accent-glow': '0 4px 16px -4px rgba(245, 158, 11, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'shimmer-border': 'shimmerBorder 3s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.92)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.65' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        glow: { '0%, 100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)' }, '50%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.3)' } },
      },
    },
  },
  plugins: [],
};

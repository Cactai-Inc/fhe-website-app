/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        green: {
          950: '#0a1a0f',
          900: '#0d2118',
          800: '#143321',  // Brand green
          700: '#1a4429',
          600: '#215531',
          500: '#2d7043',
          400: '#3d8f58',
          300: '#5aaa72',
          200: '#8cc99e',
          100: '#c3e5cc',
          50:  '#edf7f0',
        },
        gold: {
          900: '#5c4a18',
          800: '#7a6421',
          700: '#98792a',
          600: '#ba9935',  // Brand gold
          500: '#caa83e',
          400: '#d9bb5b',
          300: '#e5cd7e',
          200: '#eedda5',
          100: '#f5edcc',
          50:  '#fbf8ee',
        },
        cream: {
          DEFAULT: '#faf8f4',
          50: '#faf8f4',
          100: '#f5f0e8',
          200: '#ede5d5',
        },
      },
      fontFamily: {
        display: ['"Big Caslon"', '"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.25em',
        wide: '0.1em',
        tracked: '0.05em',
      },
      lineHeight: {
        body: '1.7',
        heading: '1.15',
        tight: '1.1',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'fade-up': 'fadeUp 0.7s ease-out forwards',
        'fade-in': 'fadeIn 1s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

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
        /* COMPENSATED GLASS BASES — owner's method, 2026-08-08.
           These are INPUTS to an alpha blend, not colours anyone sees. A
           translucent green over the warm cream page (hue 37deg) composites
           72deg toward yellow: green-800/20 renders #c8cac0, hue 73deg, sat 9%.
           Pre-shifting the base cooler cancels that rotation, so the RENDERED
           colour lands on the brand hue instead of the declared one.
             navGlass at /30 over cream -> #aed5bf, hue 145deg, sat 32%.
           Recompute if the page background changes — the compensation is
           specific to what is behind it. */
        glass: {
          nav: '#09975e',
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
          /* Owner, 2026-08-08: the nav is "a slightly darker shade of the colors
             already in play — the cream palette", not a brown. 300 is the nav
             surface: 83% lightness against the header's 94% and the page's 97%,
             so it separates without going dark, and the existing dark ink still
             clears 9.9:1 on it. 400 is its hover. */
          300: '#e6dac1',
          400: '#decfaf',
        },
      },
      fontFamily: {
        // Display + serif both resolve to the single hosted face (Libre Caslon Text —
        // owner decision, replacing Cormorant Garamond: it carries the cardstock
        // nameplate's relief, where Cormorant's thin strokes lost the emboss).
        // Big Caslon is kept first only as a progressive-enhancement on macOS; the hosted
        // Libre Caslon is the guaranteed render everywhere. Playfair was never imported — dropped.
        // NOTE: Libre Caslon Text ships 400/700 only — no 500. See TYPEPASS.
        display: ['"Big Caslon"', '"Libre Caslon Text"', 'Georgia', 'serif'],
        serif: ['"Libre Caslon Text"', 'Georgia', 'serif'],
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

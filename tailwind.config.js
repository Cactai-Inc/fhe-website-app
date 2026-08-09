/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* 64 is NOT in Tailwind's default opacity scale, so `bg-navfill/64`
         generated NO RULE AT ALL and the hover state silently had no fill.
         Declared here so the owner's exact value (80% selected, 64% hover — a
         20% reduction) is expressible rather than rounded to the nearest
         built-in step. */
      opacity: { 64: '0.64' },
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
        /* NAV FILL — the selected/hover green, HUE-CORRECTED. Owner's method:
           a translucent green composites toward the warm backdrop and drifts
           yellow, so the DECLARED base is pre-shifted cooler and the RENDERED
           colour lands on the brand hue. Solved against the near-white nav panel
           at both alphas it is used at:
             /85 (selected) -> #31523f  hue 145.5deg  near-white text 8.50:1
             /65 (hover)    -> #617a6b  hue 144.0deg  near-white text 4.55:1
           Recompute if the panel changes — the correction is specific to what is
           behind it. */
        navfill: '#0d341e',
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
          /* 25 is the NAV PANEL — near-white, owner 2026-08-08. Lighter than the
             page (#faf8f4) and the header (#f5f0e8) rather than darker, so the
             nav reads as a raised surface instead of a heavy slab. Brand green
             ink clears 13.4:1 on it. */
          25: '#fdfcfa',
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

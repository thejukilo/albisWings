import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Albis Wings brand palette, sampled from the existing site
        navy: {
          DEFAULT: '#28234B',
          900: '#1B1838',
          800: '#28234B',      // primary brand -- AW wordmark
          700: '#34487B',      // AW mark mid-navy
          500: '#5A6390',
          300: '#9CA3C1',
          200: '#C7CADD',
          100: '#E4E6EE',
          50:  '#F2F3F7',
        },
        feather: {
          DEFAULT: '#648FBC',
          400: '#7BA5CC',
          600: '#4A77A8',
        },
        signal: {
          DEFAULT: '#EE9D06',  // brand orange used for currency warning
          50:  '#FEF6E5',
          400: '#F5B23A',
          600: '#C7820A',
        },
        cream: {
          DEFAULT: '#F4F3DE',
          50:  '#FAF9EE',
          100: '#F4F3DE',
          200: '#E8E6C5',
        },
        neutral: {
          900: '#1A1A1A',
          700: '#3D3D3D',
          500: '#6D6C68',
          400: '#9B9A95',
          300: '#C7C6BF',
          200: '#E5E4DE',
          100: '#EFEEE8',
          50:  '#F7F6F1',
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;

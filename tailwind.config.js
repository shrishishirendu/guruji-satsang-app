/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saffron: {
          50:  '#FFF8ED',
          100: '#FAEEDA',
          200: '#FAC775',
          400: '#EF9F27',
          600: '#BA7517',
          800: '#633806',
          900: '#412402',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

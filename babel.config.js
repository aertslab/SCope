module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          "esmodules": true
        }
      }
    ],
    '@babel/preset-react'
  ],
  plugins: ['@babel/plugin-transform-runtime']
};

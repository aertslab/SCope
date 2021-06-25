module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          "esmodules": true
        },
        loose: true,
      }
    ],
    '@babel/preset-react'
  ],
  plugins: ['@babel/plugin-transform-runtime',
           ["@babel/plugin-proposal-private-methods", { "loose": true }]]
};

const webpack = require('webpack');
const { merge } = require('webpack-merge');
const paths = require('./paths');
const common = require('./webpack.common');
const _config = require(process.env.SCOPE_CONFIG || '../config.json');

const BundleAnalyzerPlugin =
    require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = merge(common, {
    mode: 'development',

    devtool: 'inline-source-map',

    devServer: {
        host: '0.0.0.0',
        port: _config.mPort,
        static: [paths.build],
        compress: true,
        hot: true,
    },

    plugins: [
        new BundleAnalyzerPlugin({ openAnalyzer: false }),
        new webpack.HotModuleReplacementPlugin(),
    ],

    optimization: {
        moduleIds: 'named',
    },
});

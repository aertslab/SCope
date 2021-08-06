const webpack = require('webpack');
const { merge } = require('webpack-merge');
const paths = require('./paths');
const common = require('./webpack.common');

const TerserPlugin = require('terser-webpack-plugin');

module.exports = merge(common, {
    mode: 'production',
    devtool: false,
    output: {
        path: paths.build,
        publicPath: '/',
        filename: '[name].[contenthash].js',
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
        runtimeChunk: {
            name: 'runtime',
        },
    },
    plugins: [
        new webpack.DefinePlugin({
            DEBUG: true,
            REVERSEPROXYON: true,
            BITLY: JSON.stringify({
                baseURL: 'http://scope.aertslab.org',
                token: '8422dd882b60604d327939997448dd1b5c61f54e',
            }),
            BACKEND: JSON.stringify({
                httpProtocol: 'https',
                wsProtocol: 'wss',
                host: 'scope.aertslab.org',
                WSport: 55852,
                XHRport: 55851,
                RPCport: 55853,
            }),
            FRONTEND: JSON.stringify({
                httpProtocol: 'https',
                wsProtocol: 'wss',
                host: 'scope.aertslab.org',
            }),
            ORCID: JSON.stringify({
                client_id: 'APP-1QNL921F7P9FC3S4',
                redirect_uri: 'https://scope.aertslab.org/',
            }),
            API_PREFIX: 'https://scope.aertslab.org/api/v1/',
            __TEST_ONLY__: false,
        }),
    ],
});

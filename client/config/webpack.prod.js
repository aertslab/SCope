const webpack = require('webpack');
const { merge } = require('webpack-merge');
const paths = require('./paths');
const common = require('./webpack.common');

const TerserPlugin = require('terser-webpack-plugin');

const SCOPE_SERVER_URL = process.env.SCOPE_SERVER_URL
    ? process.env.SCOPE_SERVER_URL
    : 'https://scope.aertslab.org';

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
            SERVER_URL: JSON.stringify(SCOPE_SERVER_URL),
            API_PREFIX: JSON.stringify('/api/v1/'),
            LOGIN_REDIRECT: JSON.stringify('/oidc_redirect'),
            LOGOUT_REDIRECT: JSON.stringify('/'),
            __TEST_ONLY__: false,
        }),
    ],
});

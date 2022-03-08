const webpack = require('webpack');
const { merge } = require('webpack-merge');
const paths = require('./paths');
const common = require('./webpack.common');

const BundleAnalyzerPlugin =
    require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const SCOPE_SERVER_URL = process.env.SCOPE_SERVER_URL
    ? process.env.SCOPE_SERVER_URL
    : 'http://localhost:8000';

module.exports = merge(common, {
    mode: 'development',

    devtool: 'inline-source-map',

    devServer: {
        host: '0.0.0.0',
        port: 55850,
        static: [paths.build],
        compress: true,
        hot: true,
        historyApiFallback: true,
    },

    plugins: [
        new webpack.DefinePlugin({
            DEBUG: true,
            REVERSEPROXYON: false,
            BITLY: JSON.stringify({
                baseURL: 'http://localhost:55850/',
                token: '8422dd882b60604d327939997448dd1b5c61f54e',
            }),
            BACKEND: JSON.stringify({
                httpProtocol: 'http',
                wsProtocol: 'ws',
                host: '127.0.0.1',
                WSport: 55852,
                XHRport: 55851,
                RPCport: 55853,
            }),
            FRONTEND: JSON.stringify({
                httpProtocol: 'http',
                wsProtocol: 'ws',
                host: '127.0.0.1',
            }),
            ORCID: JSON.stringify({
                client_id: 'APP-1QNL921F7P9FC3S4',
                redirect_uri: 'http://127.0.0.1:55850/',
            }),
            SERVER_URL: JSON.stringify(SCOPE_SERVER_URL),
            API_PREFIX: JSON.stringify('/api/v1/'),
            LOGIN_REDIRECT: JSON.stringify('/oidc_redirect'),
            LOGOUT_REDIRECT: JSON.stringify('/'),
            __TEST_ONLY__: false,
        }),
        new BundleAnalyzerPlugin({ openAnalyzer: false }),
        new webpack.HotModuleReplacementPlugin(),
    ],

    optimization: {
        moduleIds: 'named',
    },
});

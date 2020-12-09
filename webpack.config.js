const path = require('path');
const webpack = require('webpack');
const fs = require('fs');
const pkg = require('./package.json');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
    .BundleAnalyzerPlugin;

// Import config file
let _config = require(process.env.SCOPE_CONFIG || './config.json');

if (process.env.SCOPE_PORT) {
    _config.publicHostAddress += ':' + process.env.SCOPE_PORT;
    console.log('Appending SCOPE_PORT to publicHostAddress');
}

let config = {
    mode: process.env.NODE_ENV,
    devtool: 'inline-source-map',
    entry: './src/main.tsx',
    devServer: {
        host: '0.0.0.0',
        port: _config.mPort,
        disableHostCheck: true,
        publicPath: '/dist',
    },
    output: {
        filename: pkg.name + '.js',
        chunkFilename: pkg.name + '-chunk.js',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    },
    module: {
        rules: [
            {
                test: /\.js(x?)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true,
                            babelrc: false,
                            presets: [
                                [
                                    '@babel/preset-env',
                                    {
                                        targets: {
                                            esmodules: true,
                                        },
                                    },
                                ],
                                '@babel/preset-react',
                            ],
                            plugins: [
                                [
                                    '@babel/plugin-proposal-class-properties',
                                    { loose: true },
                                ],
                                ['@babel/plugin-proposal-object-rest-spread'],
                                ['@babel/transform-runtime'],
                            ],
                        },
                    },
                ],
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|woff|woff2|eot|ttf|svg)$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 100000,
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV),
                NODE_TYPE: JSON.stringify(process.env.NODE_TYPE),
            },
        }),
        new webpack.DefinePlugin({
            DEBUG: _config.debug,
            REVERSEPROXYON: _config.reverseProxyOn,
        }),
        new webpack.DefinePlugin({
            BITLY: JSON.stringify({
                baseURL: 'http://scope.aertslab.org',
                token: '8422dd882b60604d327939997448dd1b5c61f54e',
            }),
            BACKEND: JSON.stringify({
                httpProtocol: _config.httpProtocol,
                wsProtocol: _config.wsProtocol,
                host: _config.localHostAddress,
                WSport: _config.xPort,
                XHRport: _config.pPort,
                RPCport: _config.gPort,
            }),
            FRONTEND: JSON.stringify({
                httpProtocol: _config.httpProtocol,
                wsProtocol: _config.wsProtocol,
                host: _config.publicHostAddress,
            }),
            ORCID: JSON.stringify({
                orcidAPIClientID: _config.orcidAPIClientID,
                orcidAPIRedirectURI: _config.orcidAPIRedirectURI,
            }),
            __TEST_ONLY__: false,
        }),
        new BundleAnalyzerPlugin({ openAnalyzer: false }),
    ],
};

if (process.env.NODE_ENV === 'production') {
    config.optimization = {
        minimize: true,
        minimizer: [new TerserPlugin()],
    };
} else {
    config.optimization = {
        moduleIds: 'named',
    };
}

module.exports = config;

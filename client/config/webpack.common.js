const webpack = require('webpack');
const paths = require('./paths');

const _config = require(process.env.SCOPE_CONFIG || '../../config.json');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: paths.src + '/main.tsx',

    output: {
        path: paths.build,
        filename: '[name].js',
        publicPath: '/',
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
            DEBUG: _config.debug,
            REVERSEPROXYON: _config.reverseProxyOn,
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

        new HtmlWebpackPlugin({
            template: paths.src + '/template.html',
            filename: 'index.html',
            inject: 'body',
        }),
        new CopyPlugin({
            patterns: [
                { from: paths.shared + '/protobuf/scope-grpc.proto' },
                { from: paths.src + '/images/*' },
                { from: paths.images + '/*.png' },
            ],
        }),
    ],
};

const paths = require('./paths');

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

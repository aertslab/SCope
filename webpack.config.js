const path = require('path');
const webpack = require('webpack');
const WebpackGitHash = require('webpack-git-hash');
const fs = require('fs');
const pkg = require('./package.json');
const TerserPlugin = require('terser-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// Import config file
let isAWS = process.env.NODE_TYPE == 'aws';
let _config = null;
if (isAWS) {
    _config = require('./apache/config.json');
} else {
    _config = require('./config.json');
}
console.log(_config);

let config = {
    mode: process.env.NODE_ENV,
    devtool: 'inline-source-map',
    entry: './src/main.tsx',
    devServer: {
        host: '0.0.0.0',
        port: _config.mPort,
        disableHostCheck: true,
    },
    output: {
        path: path.resolve('assets'),
        // filename: 'main.js',
        publicPath: '/assets/', // './assets/'
        filename: pkg.name + '-' + pkg.version + '.[githash].js',
        chunkFilename: pkg.name + '-chunk.[githash].js',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    },
    module: {
        rules: [
            {
                test: /\.(t|j)s(x?)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true,
                            babelrc: false,
                            presets: [
                                '@babel/preset-env',
                                '@babel/preset-typescript',
                                '@babel/preset-react',
                            ],
                            plugins: [
                                [
                                    '@babel/plugin-proposal-class-properties',
                                    { loose: true },
                                ],
                                ['@babel/plugin-proposal-object-rest-spread'],
                                ['@babel/transform-runtime'],
                                ['babel-plugin-redux-saga'],
                            ],
                        },
                    },
                ],
            },
            {
                test: /\.css$/,
                loader: 'style-loader!css-loader',
            },
            {
                test: /\.(png|woff|woff2|eot|ttf|svg)$/,
                loader: 'url-loader?limit=100000',
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
        }),
        new WebpackGitHash({
            cleanup: true,
            callback: function (versionHash) {
                let indexHtml = fs.readFileSync('./index.html', 'utf8');
                indexHtml = indexHtml.replace(
                    /src="\.\/assets\/.*\.js"/,
                    'src="./assets/' +
                        pkg.name +
                        '-' +
                        pkg.version +
                        '.' +
                        versionHash +
                        '.js"'
                );
                fs.writeFileSync('./index.html', indexHtml);
            },
        }),
        new ForkTsCheckerWebpackPlugin(),
        new BundleAnalyzerPlugin(),
    ],
};

if (process.env.NODE_ENV === 'production') {
    config.plugins.push(new webpack.optimize.OccurrenceOrderPlugin());
    config.optimization = {
        minimize: true,
        minimizer: [new TerserPlugin()],
    };
} else {
    config.plugins.push(new webpack.NamedModulesPlugin());
}

// config.node = { fs: 'empty', child_process: 'empty' };

module.exports = config;

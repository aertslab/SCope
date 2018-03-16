const path = require('path')
const webpack = require('webpack')
var WebpackGitHash = require('webpack-git-hash');
var fs = require('fs')
var pkg = require('./package.json')

let config = {
    entry: './src/main.jsx',
    devServer: {
      host: '0.0.0.0',
      port: 8080
    },
    output: {
        path: path.resolve('assets'),
        // filename: 'main.js',
        publicPath: './assets/',
        filename: pkg.name +'-'+ pkg.version +'.[githash].js',
        chunkFilename: pkg.name +'-chunk.[githash].js'
    },
    resolve: {
        extensions: ['.js', '.jsx', '.css']
    },
    module: {
        loaders: [{
            test: /\.(js|jsx)$/,
            loader: ['react-hot-loader/webpack', 'babel-loader'],
            exclude: /node_modules/
        },
        {
            test: /\.css$/,
            loader: "style-loader!css-loader"
        },
        {
            test: /\.(png|woff|woff2|eot|ttf|svg)$/,
            loader: 'url-loader?limit=100000'
        }]
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV)
            }
        }),
        new webpack.DefinePlugin({
            DEBUG: true
        }),
        new webpack.DefinePlugin({
            BACKEND: JSON.stringify({
                host: "127.0.0.1",
                WSport: "8081",
                XHRport: "50051",
                RPCport: "50052"
            })
        }),
        new WebpackGitHash({
            cleanup: false,
            callback: function(versionHash) {
                var indexHtml = fs.readFileSync('./index.html', 'utf8');
                indexHtml = indexHtml.replace(/src="\.\/assets\/.*\.js"/, 'src="./assets/'+ pkg.name +'-'+ pkg.version +'.' + versionHash + '.js"');
                fs.writeFileSync('./index.html', indexHtml);
            }
        })

    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins.push(
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: true
            }
        })
    )
    config.plugins.push(
        new webpack.optimize.OccurrenceOrderPlugin()
    )
} else {
    config.plugins.push(new webpack.NamedModulesPlugin())
    config.entry = ['react-hot-loader/patch', config.entry]
}

// config.node = { fs: 'empty', child_process: 'empty' };

module.exports = config

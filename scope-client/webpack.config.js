const path = require('path')
const webpack = require('webpack')

let config = {
    entry: './src/main',
    output: {
        path: path.resolve(__dirname, 'assets'),
        filename: 'main.js',
        publicPath: '/assets/'
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
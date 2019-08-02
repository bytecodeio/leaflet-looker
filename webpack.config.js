let path = require('path');

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

let webpackConfig = {
    entry: {
        voronoimap: './src/visualizations/voronoimap.ts'
    },
    output: {
        filename: 'index.html',
        path: path.join(__dirname, 'dist'),
        library: '[name]',
        libraryTarget: 'umd'
    },
    resolve: {
        extensions: ['.ts', '.js', '.scss', '.css']
    },
    plugins: [
        new UglifyJSPlugin(),
    ],
    module: {
        rules: [
            { test: /\.ts$/, loader: 'ts-loader' },
            { test: /\.css$/, loader: [ 'to-string-loader', 'css-loader' ] },
          {
            test: /\.(png|jpg|gif)$/,
            use: [
              {
                loader: 'file-loader',
                options: {
                  name: '[name].[ext]',
                  outputPath: 'assets/img',
                  publicPath: 'assets/img'
                }
              }
            ]
          },
          { test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ]
            },
        ],
    },
    devServer: {
        host: 'colin.looker.com',
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        },
        disableHostCheck: true,
        allowedHosts: ['.looker.com'],
        contentBase: false,
        compress: true,
        port: 3443,
        https: true
    },
    devtool: 'eval',
    watch: true
};

module.exports = webpackConfig;

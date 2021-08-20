const nodeExternals = require( 'webpack-node-externals' );
const { BannerPlugin } = require( 'webpack' );
const { resolve } = require( 'path' );

module.exports = {
    mode: 'production',
    entry: './src/index',
    output: {
        path: resolve( __dirname, 'dist' ),
        filename: 'index.js',
    },
    target: 'node',
    externals: [
        nodeExternals(),
    ],
    devtool: 'source-map',
    resolve: {
        extensions: [ '.ts', '.tsx', '.js', '.json' ],
    },
    plugins: [
        new BannerPlugin( { banner: '#!/usr/bin/env node', raw: true } ),
    ],
    module: {
        rules: [
            {
                test: /\.(ts|js)x?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
            },
        ],
    },
};

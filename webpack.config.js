var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

// the version of the application is in the VERSION file (single source of truth)
var version_file = path.resolve(__dirname, 'VERSION');
var app_version = fs.existsSync(version_file)
	? fs.readFileSync(version_file, 'utf8').trim()
	: require('./package.json').version;
var CopyWebpackPlugin = require('copy-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
	var is_production = argv && argv.mode === 'production';

	return {
		entry: [
			'./src/js/main.js',
		],
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: '[name].[contenthash].js',
			chunkFilename: '[name].[contenthash].js',
			publicPath: '',
			clean: true
		},
		resolve: {
			extensions: ['.js', '.css'],
			alias: {
				Utilities: path.resolve(__dirname, './../node_modules/')
			}
		},
		module: {
			rules: [
				{
					test: /\.css$/,
					use: [
						is_production ? MiniCssExtractPlugin.loader : 'style-loader',
						{
							loader: 'css-loader',
							options: {url: false}
						}
					]
				},
				{
					test: /\.js$/,
					exclude: /(node_modules|bower_components)/,
					use: ['babel-loader']
				},
			]
		},
		plugins: [
			new webpack.ProvidePlugin({
				$: "jquery",
				jQuery: "jquery",
				"window.jQuery": "jquery"
			}),
			new webpack.DefinePlugin({
				VERSION: JSON.stringify(app_version)
			}),
			new CopyWebpackPlugin({
				patterns: [
					{ from: 'public/sw.js', to: 'sw.js' },
					{ from: 'public/manifest.webmanifest', to: 'manifest.webmanifest' },
				],
			}),
			new HtmlWebpackPlugin({
				template: './index.html',
				filename: 'index.html',
				inject: 'body',
				minify: false,
				scriptLoading: 'defer',
			}),
			...(is_production ? [
				new MiniCssExtractPlugin({
					filename: '[name].[contenthash].css',
					chunkFilename: '[name].[contenthash].css',
				}),
			] : []),
		],
		optimization: {
			splitChunks: {
				chunks: 'all',
				cacheGroups: {
					vendors: {
						test: /[\\/]node_modules[\\/]/,
						name: 'vendors',
						chunks: 'all',
						enforce: true,
					},
					effects: {
						test: /[\\/]src[\\/]js[\\/]modules[\\/]effects[\\/]/,
						name: 'effects',
						chunks: 'all',
						enforce: true,
					},
					tools: {
						test: /[\\/]src[\\/]js[\\/]modules[\\/]tools[\\/]/,
						name: 'tools',
						chunks: 'all',
						enforce: true,
					},
				},
			},
			runtimeChunk: 'single',
		},
		devtool: "cheap-module-source-map",
		devServer: {
			// host: '0.0.0.0',
			//contentBase: "./",
			static: {
				directory: path.resolve(__dirname, "./"),
			},
		}
	};
};

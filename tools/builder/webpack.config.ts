import * as path from 'path';
import * as glob from 'glob';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
import { cloneDeep } from 'lodash';
import { Configuration, WatchIgnorePlugin } from 'webpack';
import * as nodeExternals from 'webpack-node-externals';
import * as RunNodeWebpackPlugin from 'run-node-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as json from '../../package.json';


const ROOT_PATH = path.join(__dirname, '..', '..');
const NODE_ENV: any = process.env.NODE_ENV || 'development';
const APP_FOLDERS = (process.env.APP_FOLDERS || 'apps').split('.');
const APPS = process.env.APPS;

const APPS_PATH = path.join(ROOT_PATH, `*(${APP_FOLDERS.join('|')})`, '*');

const globalConfig: Configuration = {
    mode: NODE_ENV,
    target: 'node',
    parallelism: 300,
    cache: {
        type: 'memory',
    },
    devtool: NODE_ENV === 'development' ? 'source-map' : null,
    resolve: {
        alias: {
            react: path.resolve(path.join(ROOT_PATH, 'node_modules', 'react'))
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    externals: [nodeExternals({
        allowlist: [/@gb\/.*/],
        modulesDir: path.join(ROOT_PATH, 'node_modules'),
        additionalModuleDirs: glob.sync(path.join(ROOT_PATH, `?(${(json as any).workspaces.map(i => i.replace(/\.\/(.*?)\/\*/ig, '$1')).join('|')})`, '*', 'node_modules'), { nodir: false })
    })],
    plugins: [
        new ProgressBarPlugin(),
        new WatchIgnorePlugin({
            paths: [
                /.*?\.d\.ts$/
            ]
        }),
        new MiniCssExtractPlugin({
            filename: 'css/[name].css',
        }),
    ],
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                        options: {
                            publicPath: '',
                        },
                    },
                    'css-loader',
                ],
            },
            {
                test: /\.(svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                exclude: [/fonts/],
                use: ['svg-sprite-loader', 'svg-transform-loader', 'svgo-loader'],
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                exclude: [/svgs/],
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            outputPath: 'assets/fonts',
                            publicPath: '../fonts',
                            useRelativePaths: true,
                        },
                    },
                ],
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: '10000',
                            minetype: 'application/font-woff',
                            name: 'fonts/[name].[ext]',
                            publicPath: '/',
                        },
                    },
                ],
            },
            {
                test: /\.scss$/i,
                exclude: [/\.global\.scss$/i],
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: "css-modules-typescript-loader" },
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                exportLocalsConvention: 'camelCaseOnly',
                                localIdentName:
                                    NODE_ENV === 'development' ? '[local]--[hash:base64:3]' : '[hash:base64:6]',
                            },
                        },
                    },
                    {
                        loader: 'sass-loader',
                        options: {},
                    },
                ],
            },
            {
                test: /\.global\.scss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        options: {},
                    },
                ],
            }, {
                test: /\.less$/i,
                exclude: [/\.global\.less$/i],
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: "css-modules-typescript-loader" },
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                exportLocalsConvention: 'camelCaseOnly',
                                localIdentName:
                                    NODE_ENV === 'development' ? '[local]--[hash:base64:3]' : '[hash:base64:6]',
                            },
                        },
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                javascriptEnabled: true,
                                paths: [
                                    path.resolve(ROOT_PATH, "node_modules")
                                ],
                            }
                        },
                    },
                ],
            },
            {
                test: /\.global\.less$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                javascriptEnabled: true,
                                paths: [
                                    path.resolve(ROOT_PATH, "node_modules")
                                ],
                            }
                        },
                    },
                ],
            },
        ],
    },
    output: {
        filename: '[name].js',
        publicPath: '/',
    },
    watchOptions: {
        ignored: ['node_modules', 'dist']
    }
}

const webpackConfig = [];
console.log(APPS_PATH)
glob.sync(APPS_PATH)
    .filter(p => APPS.split(',').findIndex(app => p.includes(app)) > -1)
    .forEach(filePath => {
        const splitBySlash = filePath.split('/');
        const projectName = splitBySlash[splitBySlash.length - 1];

        const config: Configuration = {
            ...cloneDeep(globalConfig),
            context: path.join(filePath, 'src')
        }

        config.output.path = path.join(ROOT_PATH, 'dist', projectName);

        config.plugins.push(new CleanWebpackPlugin());

        const tsConfig = path.join(filePath, 'tsconfig.app.json');

        config.module.rules.push({
            test: /\.(ts|tsx)?$/,
            use: {
                loader: 'ts-loader',
                options: {
                    configFile: fs.existsSync(tsConfig) ?
                        tsConfig : path.join(ROOT_PATH, 'tsconfig.app.json')
                }
            }
        });

        config.entry = {};

        glob
            .sync(config.context + '/*.bootstrap.ts')
            .forEach(bootstrapPath => {
                const fileName = bootstrapPath.split('/').pop().replace('.bootstrap.ts', '');

                // @ts-ignore
                config.plugins.push(new RunNodeWebpackPlugin({
                    scriptToRun: fileName + '.js'
                }));

                config.entry[fileName] = bootstrapPath;

            });

        const wPath = path.join(filePath, 'webpack.config.ts');

        if (fs.existsSync(wPath)) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const c = require(wPath).default(config);
            if (Array.isArray(c)) {
                webpackConfig.push(...c);
            } else {
                webpackConfig.push(c);
            }
        } else {
            webpackConfig.push(config);
        }
    });

module.exports = webpackConfig;

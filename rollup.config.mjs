// Rollup plugins
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import { minifyHTML } from 'rollup-plugin-minify-html';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import postcss from 'rollup-plugin-postcss';
import {
  defineRollupSwcMinifyOption,
  defineRollupSwcOption,
  minify,
  swc,
} from 'rollup-plugin-swc3';

const production = process.env.NODE_ENV === 'production';
console.log('Package mode:', production ? 'production' : 'development');
export default [
  {
    input: './lana/src/Main.ts',
    output: {
      format: 'cjs',
      dir: './lana/out',
      chunkFileNames: 'lana-[name].js',
      sourcemap: false,
    },
    external: ['vscode'],
    plugins: [
      nodeResolve({ preferBuiltins: true, dedupe: ['@salesforce/core'] }),
      commonjs(),
      json(),
      swc(
        defineRollupSwcOption({
          include: /\.[mc]?[jt]sx?$/,
          exclude: 'node_modules',
          tsconfig: production ? './lana/tsconfig.json' : './lana/tsconfig-dev.json',
          jsc: { transform: { useDefineForClassFields: false } },
        }),
      ),
      production &&
        minify(
          defineRollupSwcMinifyOption({
            // swc's minify option here
            mangle: true,
            compress: true,
          }),
        ),
    ],
  },
  {
    input: { bundle: './log-viewer/modules/Main.ts' },
    output: [
      {
        format: 'es',
        dir: './log-viewer/out',
        chunkFileNames: 'log-viewer-[name].js',
        sourcemap: false,
      },
    ],
    plugins: [
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      nodePolyfills(),
      swc(
        defineRollupSwcOption({
          // All options are optional
          include: /\.[mc]?[jt]sx?$/,
          exclude: 'node_modules',
          tsconfig: production ? './log-viewer/tsconfig.json' : './log-viewer/tsconfig-dev.json',
          jsc: { transform: { useDefineForClassFields: false } },
        }),
      ),
      postcss({
        extensions: ['.css', '.scss'],
        minimize: true,
      }),
      production &&
        minify(
          defineRollupSwcMinifyOption({
            // swc's minify option here
            mangle: true,
            compress: true,
            module: true,
          }),
        ),
      minifyHTML({
        targets: [
          {
            src: './log-viewer/index.html',
            dest: './log-viewer/out/index.html',
            minifierOptions: production
              ? {
                  collapseWhitespace: true,
                  html5: true,
                  includeAutoGeneratedTags: false,
                  minifyCSS: true,
                  preventAttributesEscaping: true,
                  processConditionalComments: true,
                  removeAttributeQuotes: false,
                  removeComments: true,
                  removeEmptyAttributes: false,
                  removeOptionalTags: true,
                  removeRedundantAttributes: true,
                  removeScriptTypeAttributes: true,
                  removeStyleLinkTypeAttributes: true,
                  sortAttributes: true,
                  sortClassName: true,
                  trimCustomFragments: true,
                  useShortDoctype: true,
                }
              : {},
          },
        ],
      }),
      copy({
        hook: 'closeBundle',
        targets: [
          { src: 'log-viewer/out/*', dest: 'lana/out' },
          { src: ['CHANGELOG.md', 'LICENSE.txt', 'README.md'], dest: 'lana' },
          { src: 'lana/certinia-icon-color.png', dest: 'lana/out' },
          { src: 'node_modules/@vscode/codicons/dist/codicon.ttf', dest: 'lana/out' },
        ],
      }),
    ],
  },
];

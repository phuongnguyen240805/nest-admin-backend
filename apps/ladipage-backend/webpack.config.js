const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@liora/api-types': join(__dirname, './libs/api-types/src/index.ts'),
      '@liora/crm-core': join(__dirname, '../../libs/crm-core/src/index.ts'),
      '@liora/database': join(__dirname, '../../libs/database/src/index.ts'),
      // nest-core dùng alias nội bộ `~/*` khi webpack bundle source
      '~': join(__dirname, '../../libs/nest-core/src'),
    },
  },
  output: {
    path: join(__dirname, '../../dist/apps/ladipage-backend'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    })
  ],
};

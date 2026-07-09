const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@liora/api-types': join(__dirname, './libs/api-types/src/index.ts'),
      '@liora/crm-core': join(__dirname, '../../libs/crm-core/src/index.ts'),
      '@liora/database': join(__dirname, '../../libs/database/src/index.ts'),
      '@liora/dto': join(__dirname, '../../libs/dto/src/index.ts'),
      '@liora/ladipage-types': join(__dirname, './libs/ladipage-types/src/index.ts'),
      '@liora/nest-core': join(__dirname, '../../libs/nest-core/src/index.ts'),
      '@liora/shared': join(__dirname, '../../libs/shared/src/index.ts'),
      '@liora/supabase': join(__dirname, '../../libs/supabase/src/index.ts'),
      '@liora/librefang-client': join(
        __dirname,
        '../librefang-backend/libs/librefang-client/src/index.ts',
      ),
      '~': join(__dirname, '../../libs/nest-core/src'),
    },
  },
  output: {
    path: join(__dirname, '../../dist/apps/ladipage-backend'),
    filename: 'worker.main.js',
    clean: false,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/worker.main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
  ],
};
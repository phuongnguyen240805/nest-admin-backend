const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@liora/api-types': join(__dirname, '../ladipage-backend/libs/api-types/src/index.ts'),
      '@liora/crm-core': join(__dirname, '../../libs/crm-core/src/index.ts'),
      '@liora/database': join(__dirname, '../../libs/database/src/index.ts'),
      '@liora/database/config/database.config': join(
        __dirname,
        '../../libs/database/src/config/database.config.ts',
      ),
      '@liora/dto': join(__dirname, '../../libs/dto/src/index.ts'),
      '@liora/ladipage-types': join(__dirname, '../ladipage-backend/libs/ladipage-types/src/index.ts'),
      '@liora/nest-core': join(__dirname, '../../libs/nest-core/src/index.ts'),
      '@liora/shared': join(__dirname, '../../libs/shared/src/index.ts'),
      '@liora/supabase': join(__dirname, '../../libs/supabase/src/index.ts'),
      '@liora/librefang-client': join(__dirname, '../librefang-backend/libs/librefang-client/src/index.ts'),
      // nest-core dùng alias nội bộ `~/*` khi webpack bundle source
      '~': join(__dirname, '../../libs/nest-core/src'),
    },
  },
  output: {
    path: join(__dirname, '../../dist/apps/ladipage-ai-worker'),
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
      assets: [],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  {
    ignores: [
      '**/.next/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['apps/api/src/app.ts', 'packages/social/src/service.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // sharp 0.35 does not expose its bundled declarations through its ESM
    // export map; runtime/media behavior remains covered by its focused tests.
    files: ['packages/media/src/**/*.{ts,tsx}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['apps/web/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
  {
    files: ['**/*.config.{js,mjs,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },
);

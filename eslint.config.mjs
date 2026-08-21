import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from '@next/eslint-plugin-next';
export default [
  { ignores: ['**/.next/**','**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['apps/web/**/*.{ts,tsx}'], plugins: { '@next/next': next }, rules: { ...next.configs.recommended.rules, '@next/next/no-html-link-for-pages': 'off' } },
  { languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly' } } }
];

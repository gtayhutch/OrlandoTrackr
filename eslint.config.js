import tseslint from 'typescript-eslint';

/** Applies typed lint rules to the application, Worker, and test sources. */
export default tseslint.config(
  {
    ignores: [
      '**/build/**',
      '**/.react-router/**',
      '**/coverage/**',
      '**/target/**',
      '**/worker-configuration.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
);

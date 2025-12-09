import perfectionist from 'eslint-plugin-perfectionist';

const orderParams = {
  order: 'asc',
  type: 'line-length',
};

const sortGroups = {
  groups: [
    ['builtin', 'external'],
    ['internal', 'parent', 'sibling', 'index'],
    'object',
    'unknown',
  ],
  customGroups: {
    value: {
      internal: ['^@actions/', '^\\.\\./', '^\\./', '^#'],
    },
  },
};

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      perfectionist,
    },
    rules: {
      // Core rules
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Require blank line before return statements
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
      ],

      // Perfectionist rules for import/export sorting
      'perfectionist/sort-exports': ['warn', orderParams],
      'perfectionist/sort-named-exports': ['warn', orderParams],
      'perfectionist/sort-named-imports': ['warn', orderParams],
      'perfectionist/sort-imports': [
        'warn',
        {
          ...orderParams,
          newlinesBetween: 'never',
          groups: sortGroups.groups,
          customGroups: sortGroups.customGroups,
        },
      ],
    },
  },
];

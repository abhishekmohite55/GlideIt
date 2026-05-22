import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/elkWorker.js'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/prop-types': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(React|ReactFlow|Background|Controls|MiniMap|ReactFlowProvider|CanvasToolbar|LegendPanel|BreadcrumbBar|CodeFlowContent|JsxContent|HttpBadge|RouteCard|NodeBadge|HttpMethodBadge|EdgeSample|NodeSample|Key|LogoMark|GitHubIcon|BaseEdge|Handle|Navbar|CodeFlowPage|ApiPage|JsxPage|ErrorBoundary|App)$',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['src/elkWorker.js'],
    languageOptions: {
      globals: {
        ...globals.worker,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

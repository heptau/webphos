import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Legacy style rules: reported as warnings (visible backlog), but they do NOT
 * fail CI. CI (npm run lint) fails only on errors - real bug indicators.
 */
const legacyWarnings = {
	'no-var': 'warn',
	'prefer-const': 'warn',
	'prefer-template': 'warn',
	'object-shorthand': 'warn',
	'prefer-arrow-callback': 'warn',
	'prefer-destructuring': ['warn', { array: false }],
	// `instance = this` is the singleton pattern of the modules, `context = this` is the throttle helper
	'@typescript-eslint/no-this-alias': ['warn', { allowedNames: ['instance', 'context'] }],
	'no-redeclare': 'warn',
	'no-useless-assignment': 'warn',
	'no-useless-escape': 'warn',
	'no-console': ['warn', { allow: ['warn', 'error'] }],
	'no-empty': ['error', { allowEmptyCatch: true }],
	'@typescript-eslint/no-unused-vars': [
		'warn',
		{ argsIgnorePattern: '^_', args: 'after-used', varsIgnorePattern: '^_' },
	],
	'@typescript-eslint/no-unused-expressions': [
		'warn',
		{ allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
	],
	'@typescript-eslint/no-require-imports': 'warn',
	'@typescript-eslint/no-explicit-any': 'warn',
	'@typescript-eslint/no-array-constructor': 'warn',
};

export default tseslint.config(
	{
		ignores: [
			'dist/',
			'docs/',
			'node_modules/',
			'coverage/',
			'*.config.js',
			'*.config.mjs',
			'jest.config.mjs',
			'webpack.config.js',
			'tests/setup.ts',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,

	// application source - browser + webpack environment
	{
		files: ['src/js/**/*.js', 'src/js/**/*.ts'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.worker,
				...globals.serviceworker,
				alertify: 'readonly',
				$: 'readonly',
				jQuery: 'readonly',
				config: 'readonly',
				app: 'readonly',
				require: 'readonly',
				__dirname: 'readonly',
				VERSION: 'readonly', // webpack DefinePlugin
			},
		},
		rules: legacyWarnings,
	},

	// vendored third-party libraries (sloppy-mode globals, minified) - not linted for correctness
	{
		files: [
			'src/js/libs/color-thief.js',
			'src/js/libs/canvastotiff.js',
			'src/js/libs/jquery.translate.js',
			'src/js/libs/imagefilters.js',
			'src/js/libs/glfx.js',
			'src/js/libs/gifjs/**/*.js',
		],
		rules: {
			'no-undef': 'off',
			'no-prototype-builtins': 'off',
			'no-redeclare': 'off',
			'no-var': 'off',
			'prefer-const': 'off',
			'prefer-template': 'off',
			'object-shorthand': 'off',
			'prefer-arrow-callback': 'off',
			'prefer-destructuring': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'no-console': 'off',
			'no-useless-escape': 'off',
			'no-useless-assignment': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-array-constructor': 'off',
		},
	},

	// service worker / web worker scripts
	{
		files: ['public/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'script',
			globals: {
				...globals.browser,
				...globals.worker,
				...globals.serviceworker,
			},
		},
		rules: { ...legacyWarnings, 'no-console': 'off' },
	},

	// node build scripts
	{
		files: ['scripts/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'commonjs',
			globals: {
				...globals.node,
			},
		},
		// CommonJS scripts: `require` is the module system and the console is their output
		rules: { ...legacyWarnings, 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
	},

	// jest tests
	{
		files: ['tests/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.jest,
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
);

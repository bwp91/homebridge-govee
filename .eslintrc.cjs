module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  extends: ['airbnb'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['import', 'sort-exports'],
  rules: {
    camelcase: 'off',
    'import/extensions': ['error',  { js: 'always', json: 'always' }],
    'import/order': ['warn', { alphabetize: { order: 'asc' } }],
    'max-len': 'off',
    'new-cap': 0,
    quotes: ['error', 'single'],
    'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 1, maxEOF: 0 }],
    'no-param-reassign': 0,
    'sort-exports/sort-exports': ['warn', { sortDir: 'asc' }],
  },
};

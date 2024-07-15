import { antfu } from '@antfu/eslint-config'

/** @type {typeof antfu} */
export default antfu(
  {
    ignores: [],
    jsx: false,
    rules: {
      'new-cap': 'off',
      'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    },
    typescript: false,
  },
)

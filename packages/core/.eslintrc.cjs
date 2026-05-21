module.exports = {
  extends: ['../../.eslintrc.cjs'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['pixi.js', 'pixi.js/*', '@pixi/*'],
            message: 'core/ must NOT import PixiJS. Render belongs in packages/render.',
          },
          {
            group: ['@biplanes/render', '@biplanes/render/*'],
            message: 'core/ must NOT import from render. Data flows core -> render, not back.',
          },
        ],
      },
    ],
  },
  env: { browser: false, node: true },
};

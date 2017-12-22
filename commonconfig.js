module.exports = {
  rules: [
    {
      validation: 'camelCase',
      patterns: ['**/*'],
    },
    {
      validation: 'ignore',
      patterns: [
        '**/__snapshots__/**/*',
        'downloaded/*.html',
        'fixtures/html/**/*',
        'output/**/*',
        'README.md',
      ],
    },
  ],
};

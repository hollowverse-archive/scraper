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
        'fixtures/html/**/*',
        'output/**/*',
        'README.md',
      ],
    },
  ],
};

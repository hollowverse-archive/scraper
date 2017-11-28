module.exports = {
  rules: [
    {
      validation: 'ignore',
      patterns: [
        '**/__snapshots__/**/*',
        'downloaded/*.html',
        'fixtures/html/**/*',
        'README.md',
      ],
    },
  ],
};

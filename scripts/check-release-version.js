const packageData = require('../package.json');

const tag = process.env.GITHUB_REF_NAME || process.argv[2];
const expected = `v${packageData.version}`;

if (!tag) {
  console.error('Release tag is required through GITHUB_REF_NAME or the first argument.');
  process.exit(1);
}

if (tag !== expected) {
  console.error(`Release tag ${tag} does not match package version ${expected}.`);
  process.exit(1);
}

console.log(`Release version verified: ${tag}`);

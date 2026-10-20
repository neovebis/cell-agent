const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.log('Notice: build.gradle not found at', gradlePath);
  process.exit(0);
}

let content = fs.readFileSync(gradlePath, 'utf8');

const storePass = process.env.STORE_PASS || 'cellagent123';
const keyAlias = process.env.KEY_ALIAS || 'cellagent';
const keyPass = process.env.KEY_PASS || 'cellagent123';

const releaseSigning = `
        release {
            storeFile file('release.keystore')
            storePassword '${storePass}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPass}'
            v1SigningEnabled true
            v2SigningEnabled true
        }`;

// Inject release signingConfig if not already present
if (!content.includes("storeFile file('release.keystore')")) {
  content = content.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {\n${releaseSigning}`
  );
}

// Ensure release buildType uses release signingConfig
if (content.includes('buildTypes {')) {
  content = content.replace(
    /buildTypes\s*\{\s*release\s*\{([^}]*)/,
    (match, inner) => {
      if (inner.includes('signingConfig')) {
        return match.replace(/signingConfig\s+signingConfigs\.\w+/, 'signingConfig signingConfigs.release');
      }
      return `buildTypes {\n        release {\n            signingConfig signingConfigs.release${inner}`;
    }
  );
}

fs.writeFileSync(gradlePath, content);
console.log('Successfully configured release signing with v1 & v2 in android/app/build.gradle');

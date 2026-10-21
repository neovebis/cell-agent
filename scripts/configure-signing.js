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

const releaseSigning = `        release {
            storeFile file('release.keystore')
            storePassword '${storePass}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPass}'
            v1SigningEnabled true
            v2SigningEnabled true
        }`;

// 1. Inject release signingConfig into signingConfigs block if not already present
if (!content.includes("storeFile file('release.keystore')")) {
  if (!content.includes('signingConfigs {')) {
    console.error('Error: signingConfigs block not found in build.gradle');
    process.exit(1);
  }
  content = content.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {\n${releaseSigning}`
  );
}

// 2. Ensure release buildType uses release signingConfig
const btMatch = content.match(/buildTypes\s*\{/);
if (!btMatch) {
  console.error('Error: buildTypes block not found in build.gradle');
  process.exit(1);
}

const btStart = btMatch.index;
const contentAfterBt = content.slice(btStart);
const relMatch = contentAfterBt.match(/(\brelease\s*\{)([^}]*)/);

if (!relMatch) {
  console.error('Error: release block inside buildTypes not found in build.gradle');
  process.exit(1);
}

const relFullStart = btStart + relMatch.index;
const relInner = relMatch[2];
let newRel = '';

if (relInner.includes('signingConfig')) {
  newRel = relMatch[0].replace(/signingConfig\s+signingConfigs\.\w+/, 'signingConfig signingConfigs.release');
} else {
  newRel = `${relMatch[1]}\n            signingConfig signingConfigs.release${relInner}`;
}

content = content.slice(0, relFullStart) + newRel + content.slice(relFullStart + relMatch[0].length);

// 3. Strict verification: assert that signingConfigs.release is actually assigned in release buildType
const verifyMatch = content.match(/release\s*\{[^}]*signingConfig\s+signingConfigs\.release/);
if (!verifyMatch) {
  console.error('Error: release buildType does not contain signingConfig signingConfigs.release after injection!');
  process.exit(1);
}

fs.writeFileSync(gradlePath, content, 'utf8');
console.log('Successfully configured and verified release signing in android/app/build.gradle');

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = await readFile(
  new URL('../scripts/configure-signing.js', import.meta.url),
  'utf8',
);
const gradle = `android {
    signingConfigs {
        debug { storeFile file('debug.keystore') }
    }
    buildTypes {
        debug { signingConfig signingConfigs.debug }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;
const fixtureSecrets = {
  STORE_PASS: "fixture-store-'quoted'",
  KEY_ALIAS: 'fixture-alias',
  KEY_PASS: "fixture-key-'quoted'",
};
async function fixture(callback, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cell-agent-signing-'));
  try {
    await mkdir(join(root, 'scripts'), { recursive: true });
    await writeFile(join(root, 'scripts/configure-signing.js'), source);
    const file = join(root, 'android/app/build.gradle');
    if (!options.noGradle) {
      await mkdir(join(root, 'android/app'), { recursive: true });
      await writeFile(file, gradle);
    }
    const run = (overrides = {}) =>
      spawnSync(
        process.execPath,
        [join(root, 'scripts/configure-signing.js')],
        {
          env: { ...process.env, ...fixtureSecrets, ...overrides },
          encoding: 'utf8',
        },
      );
    await callback({ run, file });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('release usa a chave persistente sem escrever palavras-passe no Gradle', async () => {
  await fixture(async ({ run, file }) => {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const output = await readFile(file, 'utf8');
    assert.match(
      output,
      /release\s*\{\s*signingConfig signingConfigs\.release/,
    );
    assert.match(output, /debug \{ signingConfig signingConfigs\.debug \}/);
    assert.ok(output.includes("storePassword System.getenv('STORE_PASS')"));
    assert.ok(output.includes("keyPassword System.getenv('KEY_PASS')"));
    assert.match(output, /v1SigningEnabled true/);
    assert.match(output, /v2SigningEnabled true/);
    for (const secret of Object.values(fixtureSecrets))
      assert.ok(!output.includes(secret));
    assert.equal(run().status, 0);
    assert.equal(await readFile(file, 'utf8'), output);
  });
});
test('assinar sem credenciais falha sem alterar o projeto nativo', async () => {
  await fixture(async ({ run, file }) => {
    assert.notEqual(run({ STORE_PASS: '' }).status, 0);
    assert.equal(await readFile(file, 'utf8'), gradle);
  });
});
test('assinar sem projeto Android gerado falha explicitamente', async () => {
  await fixture(async ({ run }) => assert.notEqual(run().status, 0), {
    noGradle: true,
  });
});

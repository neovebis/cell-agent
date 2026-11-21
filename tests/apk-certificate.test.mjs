import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { certificateSha256 } = createRequire(import.meta.url)(
  '../scripts/read-apk-certificate.cjs',
);
const digest = 'a'.repeat(64);
test('certificado APK aceita os formatos antigo e atual do apksigner', () => {
  for (const prefix of [
    'Signer #1',
    'Signer #1:',
    'V2 Signer:',
    'V3.1 Signer:',
  ]) {
    const report =
      'Verifies\nNumber of signers: 1\n' +
      prefix +
      ' certificate SHA-256 digest: ' +
      digest.toUpperCase() +
      '\n';
    assert.equal(certificateSha256(report), digest);
  }
});
test('certificado APK mantém o mesmo digest quando existem várias versões do esquema', () => {
  assert.equal(
    certificateSha256(
      'Number of signers: 1\nV2 Signer: certificate SHA-256 digest: ' +
        digest +
        '\nV3 Signer: certificate SHA-256 digest: ' +
        digest,
    ),
    digest,
  );
});
test('certificado APK recusa múltiplos signatários, digests divergentes ou relatório incompleto', () => {
  assert.throws(() =>
    certificateSha256(
      'Number of signers: 2\nV2 Signer: certificate SHA-256 digest: ' + digest,
    ),
  );
  assert.throws(() =>
    certificateSha256(
      'Number of signers: 1\nV2 Signer: certificate SHA-256 digest: ' +
        digest +
        '\nV3 Signer: certificate SHA-256 digest: ' +
        'b'.repeat(64),
    ),
  );
  assert.throws(() =>
    certificateSha256(
      'Number of signers: 1\nSigner #1 public key SHA-256 digest: ' + digest,
    ),
  );
});

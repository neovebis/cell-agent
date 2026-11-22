const fs = require('node:fs');
function certificateSha256(report) {
  const lines = report.split(/\r?\n/).map((line) => line.trim());
  const signerCounts = lines
    .map((line) => line.match(/^Number of signers:\s*(\d+)$/))
    .filter(Boolean);
  if (signerCounts.length !== 1 || signerCounts[0][1] !== '1')
    throw new Error('Expected exactly one APK signer.');
  const fingerprints = new Set(
    lines
      .map((line) =>
        line.match(
          /^(?:Signer #\d+:?|V[\d.]+ Signer:)\s+certificate SHA-256 digest:\s*([a-fA-F0-9]{64})$/i,
        ),
      )
      .filter(Boolean)
      .map((match) => match[1].toLowerCase()),
  );
  if (fingerprints.size !== 1)
    throw new Error('Expected one unambiguous APK certificate SHA-256 digest.');
  return [...fingerprints][0];
}
module.exports = { certificateSha256 };
if (require.main === module) {
  try {
    if (!process.argv[2])
      throw new Error('An apksigner report path is required.');
    console.log(certificateSha256(fs.readFileSync(process.argv[2], 'utf8')));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

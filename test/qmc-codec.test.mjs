import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createMapCipher,
  createQmc1Cipher,
  createRc4Cipher,
  decodeQmcFile,
  deriveMasterKey,
  parseQmcFooter,
} from "../src/qmc-codec.mjs";

test("decodes a QMC v1 file without deleting the source", () => {
  const root = mkdtempSync(join(tmpdir(), "openktv-decrypt-"));
  try {
    const plain = Buffer.concat([Buffer.from("fLaC"), Buffer.alloc(32 * 1024, 0x5a)]);
    const encrypted = createQmc1Cipher().decrypt(plain);
    const source = join(root, "song.bkcflac");
    const output = join(root, "song.flac");
    writeFileSync(source, encrypted);
    const result = decodeQmcFile(source, output, { chunkSize: 4093 });
    assert.equal(result.container, "flac");
    assert.deepEqual(readFileSync(output), plain);
    assert.equal(existsSync(source), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Map and RC4 streams match across chunk boundaries", () => {
  const plain = Buffer.alloc(40 * 1024);
  for (let index = 0; index < plain.length; index += 1) plain[index] = (index * 13 + 91) & 0xff;
  for (const [factory, keyLength] of [[createMapCipher, 64], [createRc4Cipher, 512]]) {
    const key = Buffer.alloc(keyLength);
    for (let index = 0; index < key.length; index += 1) key[index] = (index * 7 + 3) & 0xff;
    const encrypted = factory(key).decrypt(plain);
    const decoded = Buffer.alloc(plain.length);
    for (let offset = 0; offset < encrypted.length; offset += 4093) {
      factory(key).decrypt(encrypted.subarray(offset, offset + 4093), offset).copy(decoded, offset);
    }
    assert.deepEqual(decoded, plain);
  }
});

test("derives reference v1 and double-layer v2 EKeys", () => {
  const expected = "030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dce3eaf1f8ff060d141b222930373e454c535a61686f767d848b9299a0a7aeb5bc";
  const v1 = "AwoRGB8mLTTpfg/Ipt3rcP7GiEPe3i5QIt4pi+2USR62pudd4zFsKA+r+xfeEfVn6t1M6+q+qJM6IqJpP2dMsWLGhXdPVL0CUN2pIncwM/I=";
  const v2 = "UVFNdXNpYyBFbmNWMixLZXk6cK1WMq9P7V7zFj4l2JrbzPHSCGx3b0wyqEYmayi62mE4GmZC/7s+bnxXRht1IjRdbaoIpW1VBwE/7qiZAzy7vzELHam4Vnd8bdGGOsK89bvAXLX8YhBj0KumAEi8DwduPdRDiXT8xuQkSQslO61Do4PqMdsKy9dsrTfPXfsYPGhDDOfEkq6agQ==";
  assert.equal(deriveMasterKey(v1).toString("hex"), expected);
  assert.equal(deriveMasterKey(v2).toString("hex"), expected);
});

test("parses MusicEx metadata and identifies the missing embedded key", () => {
  const prefix = Buffer.alloc(12);
  const inner = Buffer.alloc(176);
  inner.write("001CVTzm3UeNdz", 12, "utf16le");
  inner.write("O4M0000sdLYV13MD0i.mgg", 72, "utf16le");
  const length = Buffer.alloc(4);
  const version = Buffer.alloc(4);
  length.writeUInt32LE(0xc0);
  version.writeUInt32LE(1);
  const footer = parseQmcFooter(Buffer.concat([prefix, inner, length, version, Buffer.from("musicex\0")]));
  assert.equal(footer.kind, "MusicEx");
  assert.equal(footer.ekey, null);
  assert.equal(footer.mid, "001CVTzm3UeNdz");
  assert.equal(footer.mediaFilename, "O4M0000sdLYV13MD0i.mgg");
});

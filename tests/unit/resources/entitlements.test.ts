/**
 * Guards on the signing entitlements.
 *
 * These plists are handed to electron-osx-sign verbatim. Nothing in this
 * pipeline is Xcode, so an Xcode build variable such as $(AppIdentifierPrefix)
 * is never expanded — it ships as literal text and App Store Connect rejects
 * the upload for not matching the provisioning profile. That failure only
 * surfaces at the very end of a release build, so it is worth catching here.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RESOURCES = path.join(__dirname, '../../../resources');
const TEAM_ID = 'KGRHL55T3R';

const plists = fs
  .readdirSync(RESOURCES)
  .filter((f) => f.endsWith('.plist'));

/** Strip XML comments so prose about variables does not trip the checks. */
function withoutComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

describe('signing entitlements', () => {
  it('ships at least the mac and mas entitlements', () => {
    expect(plists).toEqual(
      expect.arrayContaining([
        'entitlements.mac.plist',
        'entitlements.mas.plist',
        'entitlements.mas.inherit.plist',
      ]),
    );
  });

  it.each(plists)('%s contains no unexpanded Xcode variables', (file) => {
    const xml = withoutComments(fs.readFileSync(path.join(RESOURCES, file), 'utf-8'));

    expect(xml).not.toMatch(/\$\([A-Za-z]/);
    expect(xml).not.toMatch(/\$\{[A-Za-z]/);
  });

  it('writes the team prefix out in full on every team-scoped identifier', () => {
    const xml = withoutComments(
      fs.readFileSync(path.join(RESOURCES, 'entitlements.mas.plist'), 'utf-8'),
    );

    for (const key of [
      'com.apple.application-identifier',
      'com.apple.security.application-groups',
      'keychain-access-groups',
    ]) {
      expect(xml).toContain(key);
    }

    // Every reference to the bundle id that is team-scoped carries the prefix.
    const bundleRefs = xml.match(/<string>[^<]*com\.aralu\.markdown-viewer<\/string>/g) ?? [];
    expect(bundleRefs.length).toBeGreaterThan(0);
    for (const ref of bundleRefs) {
      if (ref.includes('group.com.aralu')) continue; // the app-group alias
      expect(ref).toContain(`${TEAM_ID}.com.aralu.markdown-viewer`);
    }
  });
});

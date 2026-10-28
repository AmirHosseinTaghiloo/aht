import { isPackageExists, importModule } from 'local-pkg';
import { c as createEstreeDetector } from '../shared/unimport.DyX9I00Q.mjs';
import 'estree-walker';
import '../shared/unimport.B4o9Mg_h.mjs';
import 'node:path';
import 'node:process';
import 'pathe';
import 'scule';
import 'magic-string';
import 'mlly';
import 'strip-literal';

let detectorPromise;
async function loadDetector() {
  if (!isPackageExists("acorn")) {
    throw new Error(
      "[unimport] the `acorn` parser requires `acorn` to be installed."
    );
  }
  const { parse } = await importModule("acorn");
  return createEstreeDetector((code) => parse(code, {
    sourceType: "module",
    ecmaVersion: "latest",
    locations: true
  }));
}
async function detectImportsAcorn(code, ctx, options, id) {
  detectorPromise ??= loadDetector();
  const detector = await detectorPromise;
  return detector(code, ctx, options);
}

export { detectImportsAcorn };

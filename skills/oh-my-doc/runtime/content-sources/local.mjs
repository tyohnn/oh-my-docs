/**
 * Local HTML catalog adapter (`.omd/dbs`).
 * Filesystem adopt/new/check stay coordinated from scripts/omd.mjs;
 * this module exposes catalog helpers for the local SSOT port.
 */
import { planCreateDocument } from '../create-document.mjs';
import { validateHtmlPlanning } from '../planning.mjs';
import { loadLocalHtmlIaGraph } from '../html-document.mjs';
import { LOCAL_HTML_CONTENT_PATH } from '../omd-contract.mjs';

export function createLocalAdapter() {
  return {
    ssot: 'local',
    contentPath: LOCAL_HTML_CONTENT_PATH,
    loadCatalogGraph: loadLocalHtmlIaGraph,
    planCreateDocument,
    validatePlanning: validateHtmlPlanning,
  };
}

/* Assemble the StudioDocs sources into one self-contained index.html. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = p => fs.readFileSync(path.join(here, 'src', p), 'utf8');

const CSP = [
  "default-src 'none'",
  "img-src data: blob:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "font-src data:",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "worker-src 'none'",
  "manifest-src 'none'"
].join('; ');

const scripts = [
  'qr.js', 'data.js', 'core.js', 'state.js',
  'mod-dashboard.js', 'mod-signatures.js', 'mod-cards.js', 'mod-letterhead.js', 'mod-brand.js',
  'mod-agreements.js', 'mod-production.js', 'mod-consent.js', 'mod-specs.js',
  'mod-invoices.js', 'mod-supplierinv.js', 'mod-suppliers.js', 'mod-equipment.js',
  'mod-packet.js', 'mod-security.js'
];

/* Everything lands in one classic script so the modules share a single scope
   and a mis-scoped helper can never become an undefined global at runtime. */
const body = scripts.filter(f => f !== 'qr.js').map(f => `/* ==== ${f} ==== */\n` + src(f)).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=()">
<meta name="description" content="StudioDocs by Narretrieve — a local-first production document suite for identity, contracts, consent records, capture specifications, invoices and equipment.">
<title>StudioDocs by Narretrieve · Production Suite</title>
<style>
${src('app.css')}
${src('doc.css')}
</style>
</head>
<body>
${src('shell.html')}
<script>
${src('qr.js')}
</script>
<script>
"use strict";
(function(){
${body}

/* ---- start ---- */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
</script>
</body>
</html>
`;

const out = path.join(here, 'index.html');
fs.writeFileSync(out, html);
console.log('Wrote', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');

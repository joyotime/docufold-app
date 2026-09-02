# DocuFold

**100% Client-Side & Private PDF Tools. Your files never touch any server.**

DocuFold is a static React application for private PDF editing in the browser.
PDF parsing, previews, and exports run locally with PDF.js, pdf-lib, and a Web
Worker. The application has no document-processing backend and can be deployed
directly to Vercel.

## Features

Free tools:

- Merge PDF files.
- Split a PDF by page or range.
- Rotate every page or selected pages.

DocuFold Pro tools:

- Add text watermarks.
- Remove selectable text watermarks.
- Cover headers, footers, or custom rectangles.
- Remove independent transparent Form/XObject overlays when the PDF structure
  makes that possible.
- Run supported operations in batch workflows.

## Local development

Requirements: Node.js 22.13 or later and npm.

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The static output is written to `dist/`.

## Vercel deployment

The included `vercel.json` selects Vite, runs `npm run build`, publishes
`dist/`, and rewrites application routes to `index.html` for SPA navigation.
No Java service, database, or server-side environment variables are required.

## Pro license activation

The **Activate Pro** dialog sends the entered key directly to Lemon Squeezy's
License API from the browser. The key is not persisted. A successful activation
stores only this browser flag:

```text
is_pro_activated=true
```

Before launch, replace the placeholder checkout URL in
`src/lib/license.js` with the production Lemon Squeezy checkout URL.

This local browser flag is appropriate for a lightweight client-only product
preview, but it is not tamper-proof entitlement enforcement. A production app
that requires strong license enforcement should validate entitlements through
a trusted service without uploading customer PDF files.

## Help and FAQ

### Do my files leave my device?

No. PDF documents are processed in browser memory and are never uploaded by
DocuFold. License activation sends only the license key and instance name to
Lemon Squeezy.

### Why was a text watermark not detected?

Scanned pages and text converted to vector outlines do not expose selectable
text. Switch to **Rectangle Mask** and cover the affected area instead.

### Why was a transparent overlay not removed?

Some PDFs flatten watermarks into the same content stream as the document.
When the watermark is not stored as an independent layer, use a custom mask or
clean the header or footer area.

### Where is Pro activation stored?

Activation status is stored only in this browser's localStorage. Clearing site
data resets the local status and requires activation again.

### Which browsers are supported?

The production build targets modern browsers and Safari 14 or later. Large PDF
files require enough available device memory for local processing.

## Privacy and security

- No PDF upload endpoint is used.
- No account or database is required.
- Generated download URLs exist only for the current page session.
- Refreshing the page clears files held by the application.

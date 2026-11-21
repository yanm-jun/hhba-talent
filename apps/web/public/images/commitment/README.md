# HHBA public brand wall photography

The wall lives in `apps/web/src/pages/TransparencyPage.tsx`. Its photo data lives in `apps/web/src/data/commitmentGallery.ts`.

To add actual photos, first verify HHBA owns the image or has permission to publish it, along with any required consent for depicted people. Add a compressed WebP/AVIF image to this directory (e.g. `story-01.webp`). Then set the corresponding gallery entry's `src` to `/images/commitment/story-01.webp` and write a factual `alt` description.

An empty `src` renders a designed branded placeholder, not a third-party image. Uploaded photos can be clicked to open an enlarged dialog. Avoid describing staged or illustrative images as actual job placements, legal assistance outcomes, or business partnerships. This editorial page does not have a public user-upload endpoint.

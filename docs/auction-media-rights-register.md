# Auction media rights register

Status: **research candidates only — not production-approved, not uploaded, and not active**.
Prepared: 2026-11-09
Branch: `feat/auction-game-foundation`

This register records one visual candidate for each auction category. It is deliberately separate from the live catalog: a Commons file page and a Creative Commons license are evidence of the photographer's stated copyright license, not a blanket clearance for trademarks, publicity/personality rights, privacy, product design, or the underlying subject. No item is to be activated until the original file is downloaded, its metadata and current license are rechecked, the exact binary is stored under `auction-assets`, and any non-copyright rights are reviewed.

## Candidate register

| Category ID | Candidate visual / lot concept | Creator / attribution | File page | Stated license | Status / caveat |
|---|---|---|---|---|---|
| `football-players` | Lionel Messi, Argentina v Egypt (editorial player image) | Bryan Berlin / WikiPortraits | https://commons.wikimedia.org/wiki/File:Lionel_Messi_Argentina_v_Egypt_7_July_2026-178.jpg | CC BY-SA 4.0 | Copyright license surfaced; player/publicity and endorsement review required. |
| `wrestlers` | Killer Kelly, 2019 wrestler portrait | Photos N Effect | https://commons.wikimedia.org/wiki/File:KillerKelly2019Cropped.jpg | CC BY-SA 2.0 | Copyright license surfaced; performer/publicity and promotion marks review required. |
| `rare-animals` | Red panda photograph | Shreyansh Paliwal | https://commons.wikimedia.org/wiki/File:The_red_panda.jpg | CC BY-SA 4.0 | Educational/virtual collectible only; no real animal sale or trade. |
| `cars` | Classic old car photograph | Osmey Milian | https://commons.wikimedia.org/wiki/File:Classic_old_car.jpg | CC BY-SA 4.0 | Vehicle brand/design rights and any visible plates/logos require review. |
| `watches` | Mechanical self-winding wristwatch | Petar Milošević | https://commons.wikimedia.org/wiki/File:Mechanical_wristwatch.jpg | CC BY-SA 3.0 | Photographer asks to be contacted for off-Wikipedia use; contact before production use. |
| `video-games` | PS one console, controller and memory card | Evan-Amos; photographed item provided by Video Games New York | https://commons.wikimedia.org/wiki/File:PSone-Console-Set-NoLCD.jpg | CC BY-SA 3.0 | Sony/PlayStation marks and product trade dress review required; no endorsement implied. |
| `real-estate` | House/building in Kalash Valley, Pakistan | Mshoaibkt | https://commons.wikimedia.org/wiki/File:House_building.jpg | CC BY-SA 4.0 | Photo depicts a real place; use as an illustrative property concept, not a sale listing. |
| `aircraft-ships` | Aircraft photograph | Chinmayee Mishra | https://commons.wikimedia.org/wiki/File:Aircraft.1.jpg | CC BY-SA 4.0 | Aircraft/operator logos and registration marks review required. |
| `aircraft-ships` | Sea ship photograph | Annieace | https://commons.wikimedia.org/wiki/File:Sea-Ship.jpg | CC BY-SA 4.0 | Vessel identity/marks review required. |
| `antiques` | Repeater pocket watch, early 19th century | The Metropolitan Museum of Art (collection record) | https://www.metmuseum.org/art/collection/search/187191 | Public Domain (Met Open Access) | Public-domain object image; retain museum/object metadata and verify downloaded image is the Open Access image. |
| `rare-cards` | Artist trading card photograph | Sarah (sarabbit) | https://commons.wikimedia.org/wiki/File:Artist_trading_card_01.jpg | CC BY-SA 2.0 | Generic artist trading card only; do not substitute branded sports/game cards without separate clearance. |
| `fictional-gear` | Crystal vector illustration for a fictional collectible | Mayooresan | https://commons.wikimedia.org/wiki/File:Crystal_-_Vector.svg | CC BY-SA 4.0 | Use only as a fictional crystal artifact; not a real weapon or real-world equipment. |
| `mystery-lots` | Plain cardboard box photograph | MrBeastRapper | https://commons.wikimedia.org/wiki/File:Cardboard_box.jpg | CC BY-SA 4.0 | Generic packaging visual; mystery contents must be fictional and disclosed before bidding as designed. |

## Mandatory import checklist

For every candidate before it can be inserted into `auction_items` / `auction_item_media`:

1. Re-open the source file page and confirm the current author, license version, source and any special reuse request.
2. Download the **original** file, not a search thumbnail; inspect it for quality, watermarks, embedded third-party artwork, faces, logos, registration plates and sensitive location details.
3. Record the original file URL, source page URL, creator's exact credit line, license URL, retrieval date, MIME type, dimensions and SHA-256 checksum.
4. Keep the original unmodified where possible. If cropped, recolored, composited or otherwise adapted, record the changes and comply with the applicable ShareAlike terms.
5. Review rights not covered by the photo license (personality/publicity, trademarks, product design, privacy, museum terms, and any source-specific restrictions).
6. Upload only the approved binary to the private ingestion workflow, then publish it through the approved catalog path. Do not create client upload permissions.
7. Set `auction_items.is_active = true` only after its source fields and `source_verified_at` are populated; set media active only after attribution and license fields are complete.
8. Keep the item inactive if any evidence is missing. Never replace missing evidence with an assumed license.

## Operational guardrails

- This file does not insert catalog rows, create lots, upload media, change Storage buckets, apply migrations, or deploy Edge Functions.
- The auction migration's existing checks remain the activation gate. Room creation must continue to fail closed when a category lacks enough active, licensed lots for the selected round count.
- The source candidates above are not a promise that every depicted person, brand, building, vehicle, or product is cleared for every use.
- Two-device Realtime/gameplay testing remains a separate required gate before merge/release.

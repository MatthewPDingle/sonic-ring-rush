# World detail upgrade — builder report

All four worlds receive authored tiled surface detail, road UVs, subtle bump maps, richer vegetation and track-specific architecture. Assets are generated deterministically from small 128-pixel DataTextures, so the Windows package remains fully offline.

- Emerald Coast: individual palm leaflets, coconuts, trunk growth rings, fern and grass verge patches, petalled flowers, shells along the outer beach, animated water ripples and textured waterfall streams.
- Sunset Ruins: sandstone masonry, fluted columns and layered bases, cracked paving fragments with teal mosaic details, banded temple pillars and carved diamond friezes.
- Starlight Circuit: panelled driving surface, rows of individual lit windows, corner facade frames, layered rooftop equipment and subtle verge uplights.
- Parrot Paradise: dense fern/flower ground cover, layered palm crowns, coconuts, trunk growth rings and roots, stone gate inscriptions, timber bark and concentric cut-log rings, textured water and waterfall mist, warmer rock color variation and moss ledges on the jungle cliffs. Macaws now have layered yellow/blue wing feathers, chest color, facial markings, eye glints, a hooked bill and grasping toes.

Roads, loop frames, course geometry, metadata, item positions, hazards, parrot timing and bird flight synchronization remain unchanged. Planting respects the outer verge; additional ground foliage excludes the gorge bridge and loop approaches. Bright hazards, gold ring lines, rail edges and warning lanes keep their original readability.

Fern and vegetation assemblies, trunk rings, coconuts, architecture accents and cliff ledges use instancing. Macaw body and wing details are merged by material while retaining their articulated wing groups, reducing bird draw calls despite more detailed geometry. Water texture motion and foam opacity are driven by the world update clock. Disposal now releases all referenced texture properties, including bump maps, alongside geometries and materials.

Validation: all 29 pre-existing course, physics and gameplay tests passed after this upgrade; production build passed. Final browser art/performance and independent critique belong to the root Gauntlet review; source checks do not replace that visual review.

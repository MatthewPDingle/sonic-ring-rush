# Character detail pass

The character is still authored procedural geometry and needs no downloaded model or texture. Its existing facing direction, dimensions, recolouring and public animation API remain compatible with every track.

- Curved cubic quills with elliptical taper replace straight cones, joining broad roots into the head and torso. Six head quills retain the recognisable swept silhouette from the chase camera.
- A bevelled connected eye mask, swept upper eyelids, shaped inner ears, unified muzzle, nose highlight and asymmetric smile replace the floating facial spheres. The eye patch and pupils blink together.
- Rounded shoe uppers are lofted from heel to low toe, with separate sole/tread, fitted curved white straps, open gold frame buckles, and understated toe/heel stitching.
- Soft glove palms, four fingers, thumbs, crease lines and layered cuff lips add readable detail. Thin smooth arm/leg segments connect articulated elbows and knees; the recovery leg bends back rather than swinging as a single stick.
- Idle breathing and small head motion, a two-blink idle cycle, alternating planted/recovery stride, tucked jump knees and swept-back boost arms add personality without altering race physics.

Node checks verified finite geometry positions/normals and idle/run/jump/boost transforms, the required userData fields, rival recolouring, and overall idle bounds: feet -0.025 m, top 3.302 m. The model contains 95 meshes / 34,180 triangles; smaller detail spheres use fewer segments while the head/torso remain smooth. The parent captured `output/playwright/polish-first-menu.png` and confirmed the curved quills and shoe/glove detail are visible under the revised lighting. Independent critique remains part of the parent gauntlet pass.

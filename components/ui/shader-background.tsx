"use client";

import { MeshGradient } from "@paper-design/shaders-react";

/**
 * Fixed, full-viewport animated mesh-gradient backdrop. Rendered behind page
 * content (content should sit at z-10+). Used on the login page and behind the
 * authenticated app shell so the whole site shares one animated background.
 */
export function ShaderBackground() {
  return (
    <div className="fixed inset-0 z-0">
      <MeshGradient
        style={{ height: "100vh", width: "100vw" }}
        distortion={0.8}
        swirl={0.1}
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={1}
        colors={["hsl(216, 90%, 27%)", "hsl(243, 68%, 36%)", "hsl(205, 91%, 64%)", "hsl(211, 61%, 57%)"]}
      />
    </div>
  );
}

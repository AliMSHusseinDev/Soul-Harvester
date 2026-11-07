import * as THREE from "three";
/** A shallow 3D sprite: textured front/back and pixel-boundary side walls, one instanced draw. */
export function spriteGeometry(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  width: number,
  height: number,
  depth = 0.08,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [];
  const opaque = (x: number, y: number) =>
    x >= 0 &&
    x < cols &&
    y >= 0 &&
    y < rows &&
    pixels[(y * cols + x) * 4 + 3] >= 64;
  function quad(points: number[][], uv: number[][], shade = 1) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...points[i]);
      uvs.push(...uv[i]);
      colors.push(shade, shade, shade);
    }
  }
  const z = depth / 2;
  quad(
    [
      [-width / 2, -height / 2, z],
      [width / 2, -height / 2, z],
      [width / 2, height / 2, z],
      [-width / 2, height / 2, z],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  );
  quad(
    [
      [width / 2, -height / 2, -z],
      [-width / 2, -height / 2, -z],
      [-width / 2, height / 2, -z],
      [width / 2, height / 2, -z],
    ],
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    0.7,
  );
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (!opaque(x, y)) continue;
      const x0 = (x / cols - 0.5) * width,
        x1 = ((x + 1) / cols - 0.5) * width,
        y0 = (0.5 - (y + 1) / rows) * height,
        y1 = (0.5 - y / rows) * height,
        uv = Array.from({ length: 4 }, () => [
          (x + 0.5) / cols,
          1 - (y + 0.5) / rows,
        ]);
      if (!opaque(x - 1, y))
        quad(
          [
            [x0, y0, -z],
            [x0, y0, z],
            [x0, y1, z],
            [x0, y1, -z],
          ],
          uv,
          0.65,
        );
      if (!opaque(x + 1, y))
        quad(
          [
            [x1, y0, z],
            [x1, y0, -z],
            [x1, y1, -z],
            [x1, y1, z],
          ],
          uv,
          0.65,
        );
      if (!opaque(x, y - 1))
        quad(
          [
            [x0, y1, z],
            [x1, y1, z],
            [x1, y1, -z],
            [x0, y1, -z],
          ],
          uv,
          0.9,
        );
      if (!opaque(x, y + 1))
        quad(
          [
            [x0, y0, -z],
            [x1, y0, -z],
            [x1, y0, z],
            [x0, y0, z],
          ],
          uv,
          0.55,
        );
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

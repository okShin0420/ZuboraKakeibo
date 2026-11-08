// Build the iOS icon from the original transparent mascot and exact brand colors.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const assets = path.resolve(__dirname, '..', 'assets');
const dog = PNG.sync.read(fs.readFileSync(path.join(assets, 'jikkun-optimized.png')));
const size = 1024;
const output = new PNG({ width: size, height: size });
const top = [0x0d, 0x93, 0xfc];
const bottom = [0x01, 0x56, 0xf4];
const scale = 1.25;
const left = (size - dog.width * scale) / 2;
const topOffset = 100;

for (let y = 0; y < size; y++) {
  const t = y / (size - 1);
  const background = top.map((channel, i) => Math.round(channel * (1 - t) + bottom[i] * t));
  for (let x = 0; x < size; x++) {
    const destination = (y * size + x) * 4;
    const sourceX = (x - left) / scale;
    const sourceY = (y - topOffset) / scale;
    let opacity = 0;
    const premultiplied = [0, 0, 0];
    if (sourceX >= 0 && sourceX < dog.width - 1 && sourceY >= 0 && sourceY < dog.height - 1) {
      const sx = Math.floor(sourceX);
      const sy = Math.floor(sourceY);
      const fx = sourceX - sx;
      const fy = sourceY - sy;
      for (const [dx, dy, weight] of [
        [0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy], [1, 1, fx * fy],
      ]) {
        const source = ((sy + dy) * dog.width + sx + dx) * 4;
        const alpha = dog.data[source + 3] / 255 * weight;
        opacity += alpha;
        for (let i = 0; i < 3; i++) premultiplied[i] += dog.data[source + i] * alpha;
      }
    }
    for (let i = 0; i < 3; i++) {
      output.data[destination + i] = Math.round(premultiplied[i] + background[i] * (1 - opacity));
    }
    output.data[destination + 3] = 255;
  }
}

fs.writeFileSync(path.join(assets, 'app-icon-dog-full-gradient.png'), PNG.sync.write(output));

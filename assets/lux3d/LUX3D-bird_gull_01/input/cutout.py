"""Replace a near-uniform photo background with white, keep the largest subject, crop square."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB')
a = np.asarray(img).astype(np.float32)
h, w, _ = a.shape
border = np.concatenate([a[:30].reshape(-1, 3), a[-30:].reshape(-1, 3), a[:, :30].reshape(-1, 3), a[:, -30:].reshape(-1, 3)])
bg = np.median(border, 0)
d = np.sqrt(((a - bg) ** 2).sum(2))
t0, t1 = 26.0, 44.0                      # soft edge between background and subject
alpha = np.clip((d - t0) / (t1 - t0), 0, 1)
core = alpha > 0.5
lab, n = ndimage.label(core)
sizes = ndimage.sum(core, lab, range(1, n + 1))
keep = lab == (1 + int(np.argmax(sizes)))
keep = ndimage.binary_fill_holes(ndimage.binary_closing(keep, iterations=3))
grow = ndimage.binary_dilation(keep, iterations=3)
alpha = np.where(grow, np.maximum(alpha, keep.astype(np.float32)), 0)
alpha = ndimage.gaussian_filter(alpha, 0.8)
white = np.full_like(a, 255)
out = a * alpha[..., None] + white * (1 - alpha[..., None])
ys, xs = np.where(keep)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
side = int(max(y1 - y0, x1 - x0) * 1.15)
canvas = np.full((side, side, 3), 255, np.float32)
sy, sx = int(cy - side / 2), int(cx - side / 2)
for yy in range(side):
    pass
ya, yb = max(sy, 0), min(sy + side, h)
xa, xb = max(sx, 0), min(sx + side, w)
canvas[ya - sy:yb - sy, xa - sx:xb - sx] = out[ya:yb, xa:xb]
res = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
if res.width > 1536:
    res = res.resize((1536, 1536), Image.LANCZOS)
res.save(dst, quality=95)
print(dst, res.size, 'bg', bg.round(1), 'subject px', int(keep.sum()), 'components', n)

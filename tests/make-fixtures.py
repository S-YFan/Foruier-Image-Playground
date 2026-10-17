"""Optional fixture regeneration: Python + Pillow. Not needed to RUN any tests."""
from pathlib import Path
from PIL import Image

out = Path(__file__).parent / 'fixtures'
out.mkdir(exist_ok=True)
Image.new('RGB', (37, 53), (0, 0, 0)).save(out / 'black.png')
Image.new('RGB', (71, 45), (255, 255, 255)).save(out / 'white.png')
gray = Image.new('L', (73, 51))
gray.putdata([(x * 17 + y * 23) % 256 for y in range(51) for x in range(73)])
gray.save(out / 'gray.png')
color = Image.new('RGB', (73, 51))
color.putdata([((x * 7) % 256, (y * 11) % 256, (x * 13 + y * 19) % 256) for y in range(51) for x in range(73)])
color.save(out / 'rgb.png')
color.save(out / 'rgb.jpg', quality=92)
color.save(out / 'rgb.webp', lossless=True)
wide = Image.new('RGB', (96, 32), 'red')
wide.paste((20, 160, 70), (32, 0, 64, 32))
wide.paste('blue', (64, 0, 96, 32))
wide.save(out / 'wide.png')
wide.transpose(Image.Transpose.ROTATE_90).save(out / 'tall.png')
odd = Image.new('RGB', (33, 32), (20, 160, 70))
odd.paste('red', (32, 0, 33, 32))
odd.save(out / 'odd.png')
Image.new('RGBA', (32, 32), (20, 100, 220, 128)).save(out / 'alpha.png')
(out / 'broken.png').write_bytes(b'not a real PNG')

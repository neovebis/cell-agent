from pathlib import Path
from hashlib import sha256
from PIL import Image, ImageChops
BASE=Path(__file__).resolve().parents[1]
ORIGINAL=BASE/'src/assets/cell-agent-logo-original.jpg'
EXPECTED='b794946eeba8393467335fe1813186ca186b3d6ba5a249d5e2fce937f840b61c'
assert sha256(ORIGINAL.read_bytes()).hexdigest()==EXPECTED, 'Original artwork was modified'
with Image.open(ORIGINAL) as img:
    assert img.format=='JPEG' and img.size==(1536,1536)
    for asset, crop_side in [(BASE/'icon.png',850),(BASE/'adaptive-foreground.png',950)]:
        left=(img.width-crop_side)//2
        reference=img.crop((left,left,left+crop_side,left+crop_side)).resize((1024,1024),Image.Resampling.LANCZOS)
        with Image.open(asset) as produced:
            assert produced.format=='PNG' and produced.size==(1024,1024)
            assert ImageChops.difference(reference,produced.convert('RGB')).getbbox() is None, f'Not from original: {asset.name}'
s=(BASE/'src/components/AgentAvatar.tsx').read_text()
assert "require('../assets/cell-agent-logo-original.jpg')" in s
assert "react-native-svg" not in s and '<Svg' not in s
preview=(BASE/'index-preview.html').read_text()
import re, base64
encoded=re.search(r'data:image/jpeg;base64,([A-Za-z0-9+/=]+)',preview)
assert encoded and base64.b64decode(encoded.group(1))==ORIGINAL.read_bytes(), 'Browser preview does not embed the exact original'
assert '<circle cx="50" cy="50" r="50"' not in preview
print('PASS — Official image is identical byte-by-byte; PNG launchers are only a pixel crop/resize of the provided artwork; no SVG reconstruction remains.')

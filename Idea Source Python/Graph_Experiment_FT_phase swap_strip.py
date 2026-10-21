import cv2
import matplotlib.pyplot as plt
import numpy as np

imag1 = cv2.imread('Monkey.jpg')
imag2 = cv2.imread('Cat.jpg')

imag1 = cv2.resize(imag1, (1000, 1000))
imag2 = cv2.resize(imag2, (1000, 1000))

b1, g1, r1 = cv2.split(imag1)
b2, g2, r2 = cv2.split(imag2)

fr1 = np.fft.fft2(r1)
fb1 = np.fft.fft2(b1)
fg1 = np.fft.fft2(g1)

fr2 = np.fft.fft2(r2)
fb2 = np.fft.fft2(b2)
fg2 = np.fft.fft2(g2)

ampr1 = np.abs(fr1)
ampg1 = np.abs(fg1)
ampb1 = np.abs(fb1)

phase_r1 = np.angle(fr1)
phase_g1 = np.angle(fg1)
phase_b1 = np.angle(fb1)

phase_r2 = np.angle(fr2)
phase_g2 = np.angle(fg2)
phase_b2 = np.angle(fb2)

# =====================================
# Periodic Stripes Phase Mask
# =====================================

N = 1000
stripe_width = 20
direction = 'vertical'
# Options: 'vertical', 'horizontal'

u, v = np.meshgrid(
    np.fft.fftfreq(N) * N,
    np.fft.fftfreq(N) * N
)

if direction == 'vertical':
    M = (np.floor(np.abs(u) / stripe_width) % 2 == 0)

elif direction == 'horizontal':
    M = (np.floor(np.abs(v) / stripe_width) % 2 == 0)

M = M.astype(bool)

# =====================================
# Partial Phase Swap
# =====================================

mix_r = ampr1 * np.exp(1j * np.where(M, phase_r2, phase_r1))
mix_g = ampg1 * np.exp(1j * np.where(M, phase_g2, phase_g1))
mix_b = ampb1 * np.exp(1j * np.where(M, phase_b2, phase_b1))

img_r_new = np.fft.ifft2(mix_r).real
img_g_new = np.fft.ifft2(mix_g).real
img_b_new = np.fft.ifft2(mix_b).real

img_combined = cv2.merge([
    img_b_new,
    img_g_new,
    img_r_new
])

img_combined = np.uint8(np.clip(img_combined, 0, 255))
img_combined_rgb = cv2.cvtColor(img_combined, cv2.COLOR_BGR2RGB)

# =====================================
# Display
# =====================================

plt.figure(figsize=(15, 5))

plt.subplot(141)
plt.imshow(cv2.cvtColor(imag1, cv2.COLOR_BGR2RGB))
plt.title('Original A - Monkey')
plt.axis('off')

plt.subplot(142)
plt.imshow(cv2.cvtColor(imag2, cv2.COLOR_BGR2RGB))
plt.title('Original B - Cat')
plt.axis('off')

plt.subplot(143)
plt.imshow(np.fft.fftshift(M), cmap='gray', vmin=0, vmax=1)
plt.title(f'Phase Swap Mask\n{direction}, width={stripe_width}')
plt.axis('off')

plt.subplot(144)
plt.imshow(img_combined_rgb)
plt.title(f'Periodic Stripes\n{direction}, width={stripe_width}')
plt.axis('off')

plt.tight_layout()
plt.show()
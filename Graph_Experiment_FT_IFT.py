import cv2
import matplotlib.pyplot as plt
import numpy as np

imag1 = cv2.imread('Monkey.jpg')
imag2 = cv2.imread('NSYSUlogo.jpg')

imag1 = cv2.resize(imag1, (1000,1000))
imag2 = cv2.resize(imag2, (1000,1000))

b1, g1, r1= cv2.split(imag1)
b2, g2, r2= cv2.split(imag2)

fr1 = np.fft.fft2(r1)
fb1 = np.fft.fft2(b1)
fg1 = np.fft.fft2(g1)
fr2 = np.fft.fft2(r2)
fb2 = np.fft.fft2(b2)
fg2 = np.fft.fft2(g2)

ampr1 = np.abs(fr1)
ampg1 = np.abs(fg1)
ampb1 = np.abs(fb1)
ampr2 = np.abs(fr2)
ampg2 = np.abs(fg2)
ampb2 = np.abs(fb2)

phase_r1 = np.angle(fr1)
phase_g1 = np.angle(fg1)
phase_b1 = np.angle(fb1)
phase_r2 = np.angle(fr2)
phase_g2 = np.angle(fg2)
phase_b2 = np.angle(fb2)

mix_r = ampr1 * np.exp(1j * phase_r2)
mix_g = ampg1 * np.exp(1j * phase_g1)
mix_b = ampb1 * np.exp(1j * phase_b2)

img_r_new = np.abs(np.fft.ifft2(mix_r))
img_g_new = np.abs(np.fft.ifft2(mix_g))
img_b_new = np.abs(np.fft.ifft2(mix_b))

img_combined = cv2.merge([img_b_new, img_g_new, img_r_new])
img_combined = np.uint8(img_combined)
img_combined_rgb = cv2.cvtColor(img_combined, cv2.COLOR_BGR2RGB)

plt.figure()
plt.imshow(img_combined_rgb)
plt.axis('off')
plt.show()
import cv2
import matplotlib.pyplot as plt
import numpy as np

#Original Source code for phase 3 demonstration

imag1 = cv2.imread('Monkey.jpg')
imag2 = cv2.imread('Cat.jpg')

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

u, v = np.meshgrid(np.arange(1000)-500, np.arange(1000)-500)
H_Gaussian_LowPF = np.exp(-(u**2 + v**2)/(2*30**2))
H_Gaussian_LowPF = np.fft.ifftshift(H_Gaussian_LowPF)
H_Gaussian_HighPF = 1 - H_Gaussian_LowPF
alpha = 1.0
H_Gaussian_SharpPF = 1 + alpha * H_Gaussian_HighPF

img_LPF_r1 = fr1 * H_Gaussian_LowPF
img_LPF_b1 = fb1 * H_Gaussian_LowPF
img_LPF_g1 = fg1 * H_Gaussian_LowPF

img_LPF_r1_spatial = np.fft.ifft2(img_LPF_r1).real
img_LPF_b1_spatial = np.fft.ifft2(img_LPF_b1).real
img_LPF_g1_spatial = np.fft.ifft2(img_LPF_g1).real

img_LPF = cv2.merge([img_LPF_b1_spatial, img_LPF_g1_spatial, img_LPF_r1_spatial])
img_LPF = np.uint8(np.clip(img_LPF, 0, 255))
img_LPF_rgb = cv2.cvtColor(img_LPF, cv2.COLOR_BGR2RGB)

img_HPF_r1 = fr1 * H_Gaussian_HighPF
img_HPF_b1 = fb1 * H_Gaussian_HighPF
img_HPF_g1 = fg1 * H_Gaussian_HighPF

img_HPF_r1_spatial = np.fft.ifft2(img_HPF_r1).real
img_HPF_b1_spatial = np.fft.ifft2(img_HPF_b1).real
img_HPF_g1_spatial = np.fft.ifft2(img_HPF_g1).real

img_HPF = cv2.merge([img_HPF_b1_spatial, img_HPF_g1_spatial, img_HPF_r1_spatial])
img_HPF = np.uint8(np.clip(img_HPF + 128, 0, 255))
img_HPF_rgb = cv2.cvtColor(img_HPF, cv2.COLOR_BGR2RGB)

img_Sharp_r1 = fr1 * H_Gaussian_SharpPF
img_Sharp_b1 = fb1 * H_Gaussian_SharpPF
img_Sharp_g1 = fg1 * H_Gaussian_SharpPF

img_Sharp_r1_spatial = np.fft.ifft2(img_Sharp_r1).real
img_Sharp_b1_spatial = np.fft.ifft2(img_Sharp_b1).real
img_Sharp_g1_spatial = np.fft.ifft2(img_Sharp_g1).real

img_Sharp = cv2.merge([img_Sharp_b1_spatial, img_Sharp_g1_spatial, img_Sharp_r1_spatial])
img_Sharp = np.uint8(np.clip(img_Sharp, 0, 255))
img_Sharp_rgb = cv2.cvtColor(img_Sharp, cv2.COLOR_BGR2RGB)

plt.figure()
plt.imshow(img_Sharp_rgb)
plt.axis('off')
plt.show()

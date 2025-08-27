import cv2, numpy as np
from typing import Optional
def compute_homography(img_in: np.ndarray, img_tmpl: np.ndarray) -> Optional[np.ndarray]:
    g1 = cv2.cvtColor(img_in, cv2.COLOR_BGR2GRAY) if img_in.ndim==3 else img_in
    g2 = cv2.cvtColor(img_tmpl, cv2.COLOR_BGR2GRAY) if img_tmpl.ndim==3 else img_tmpl
    orb = cv2.ORB_create(4000)
    k1, d1 = orb.detectAndCompute(g1, None); k2, d2 = orb.detectAndCompute(g2, None)
    if d1 is None or d2 is None: return None
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = bf.knnMatch(d1, d2, k=2); good = [m for m,n in matches if m.distance<0.75*n.distance]
    if len(good)<8: return None
    src = np.float32([k1[m.queryIdx].pt for m in good]).reshape(-1,1,2)
    dst = np.float32([k2[m.trainIdx].pt for m in good]).reshape(-1,1,2)
    H, _ = cv2.findHomography(src, dst, cv2.RANSAC, 5.0); return H

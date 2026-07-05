import cv2
import numpy as np

import config


def _downscale(img):
    h, w = img.shape[:2]
    scale = config.MAX_DIM / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def _detect_target(img):
    """Return (center_x, center_y), radius of the scoring area (px)."""
    h, w = img.shape[:2]
    gray = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 5)
    min_r = int(0.15 * min(h, w))
    max_r = int(0.5 * min(h, w))
    circles = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1, minDist=min(h, w),
        param1=120, param2=45, minRadius=min_r, maxRadius=max_r,
    )
    if circles is not None:
        best = max(circles[0], key=lambda c: c[2])  # largest = outer boundary
        return (float(best[0]), float(best[1])), float(best[2])
    # Fallback: assume a roughly centered target filling most of the frame.
    return (w / 2.0, h / 2.0), 0.45 * min(h, w)


def _ring_value(dist, radius, max_score):
    if radius <= 0 or dist >= radius:
        return 0
    ring_width = radius / max_score
    return int(max(0, min(max_score, max_score - int(dist // ring_width))))


def _detect_holes(img, center, radius, shot_count):
    """Detect dark round blobs (bullet holes). Returns list of (x, y) in px.

    Holes are solid dark blobs; scoring rings are thin dark lines. We threshold all
    dark features, then morphological-open to erase the thin ring lines, leaving the
    filled hole blobs.
    """
    h, w = img.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    _, dark = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ksize = max(3, config.HOLE_OPEN_SIZE) | 1  # odd
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    opened = cv2.morphologyEx(dark, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    img_area = float(h * w)
    cands = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < config.HOLE_MIN_AREA or area > config.HOLE_MAX_AREA_FRAC * img_area:
            continue
        peri = cv2.arcLength(c, True)
        if peri <= 0:
            continue
        circularity = 4.0 * np.pi * area / (peri * peri)
        if circularity < config.HOLE_MIN_CIRCULARITY:
            continue
        m = cv2.moments(c)
        if m["m00"] == 0:
            continue
        cx, cy = m["m10"] / m["m00"], m["m01"] / m["m00"]
        if radius > 0 and np.hypot(cx - center[0], cy - center[1]) > radius * 1.15:
            continue
        cands.append((cx, cy, area, circularity))

    # Prefer the most hole-like; cap at the declared shot count when known.
    cands.sort(key=lambda t: t[2] * t[3], reverse=True)
    if shot_count and shot_count > 0:
        cands = cands[:shot_count]
    return [(c[0], c[1]) for c in cands]


def score_image(path, shot_count, max_score):
    """Detect + score. Returns dict with normalized shot positions + ring values."""
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"could not read image: {path}")
    img = _downscale(img)
    h, w = img.shape[:2]
    center, radius = _detect_target(img)
    holes = _detect_holes(img, center, radius, shot_count)

    shots = []
    for (hx, hy) in holes:
        dist = float(np.hypot(hx - center[0], hy - center[1]))
        shots.append({"x": hx / w, "y": hy / h, "ring": _ring_value(dist, radius, max_score)})
    total = sum(s["ring"] for s in shots)
    return {"shots": shots, "total": total}

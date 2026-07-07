import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { AuthImage } from './AuthImage';
import { theme } from '../theme';
import { Button, Row } from './components';

export interface PlacedShot {
  x: number;
  y: number;
  ringValue: number | null;
  zone: string | null;
}

const IPSC_ZONES = ['A', 'C', 'D', 'M'];
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const PAN_THRESHOLD = 8; // px of movement before a one-finger touch counts as a pan
const MARKER_SIZE = 30; // on-screen px, constant regardless of zoom

/**
 * Fullscreen, web-style "Zoom & score" viewer for a target photo.
 *
 * Pinch zooms around the midpoint of the two fingers; one finger drags when
 * zoomed in; a tap (no movement) drops a hit at the tapped point; tapping an
 * existing hit removes it. Markers keep a constant on-screen size and live in
 * screen space (not the transformed layer) so they never distort. Closing the
 * modal returns to the target card, which shows the photo with the markers
 * overlaid.
 *
 * Coordinate model: shot positions are normalized to the **image** (0..1 of the
 * photo's own dimensions), matching the web app. The image is rendered with
 * `contentFit="contain"` inside the viewport; its displayed rect (the letterbox
 * insets) is computed from the intrinsic dimensions reported by `onLoad`, and
 * all tap↔image math goes through that rect. The transform is applied with a
 * top-left origin (RN's only transform origin), so the mapping is the simple
 * `screen = offset + scale * imageLocal + translate` — inverted as
 * `imageLocal = (screen - offset - translate) / scale`. (The previous inline
 * scorer used center-origin math that RN doesn't apply, which is why taps
 * drifted to the top-left corner when zoomed/panned.)
 */
export function TargetScorer({
  visible,
  imagePath,
  scoringSystem,
  maxScorePerShot,
  initialShots,
  onClose,
  onSave,
}: {
  visible: boolean;
  imagePath: string;
  scoringSystem: 'RINGS' | 'IPSC' | 'GROUP';
  maxScorePerShot: number | null;
  initialShots: PlacedShot[];
  onClose: () => void;
  onSave: (shots: PlacedShot[]) => void;
}) {
  const isIpsc = scoringSystem === 'IPSC';
  const [shots, setShots] = useState<PlacedShot[]>(initialShots);
  const [ringValue, setRingValue] = useState<number>(maxScorePerShot ?? 10);
  const [zone, setZone] = useState<string>('A');

  // Viewport size and intrinsic image dimensions → the contained image rect.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [intrinsic, setIntrinsic] = useState({ w: 1, h: 1 }); // square until onLoad reports real dims
  const fit = useMemo<FitRect | null>(() => containedFit(size.w, size.h, intrinsic.w, intrinsic.h), [
    size,
    intrinsic,
  ]);

  // Zoom state lives in a ref so the once-created PanResponder always reads the
  // latest value; `force` triggers re-renders.
  const zoomRef = useRef({ s: 1, tx: 0, ty: 0 });
  const [, force] = useReducer((x) => x + 1, 0);
  const setZoom = (z: { s: number; tx: number; ty: number }) => {
    zoomRef.current = z;
    force();
  };
  const zoom = zoomRef.current;

  // Refs mirroring state for use inside the once-created PanResponder/callbacks.
  const sizeRef = useRef(size);
  const fitRef = useRef(fit);
  const shotsRef = useRef(shots);
  const selRef = useRef({ isIpsc, ringValue, zone });
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { fitRef.current = fit; }, [fit]);
  useEffect(() => { shotsRef.current = shots; }, [shots]);
  useEffect(() => { selRef.current = { isIpsc, ringValue, zone }; }, [isIpsc, ringValue, zone]);

  // Reset edits + zoom whenever the viewer is (re)opened.
  useEffect(() => {
    if (visible) {
      setShots(initialShots);
      setRingValue(maxScorePerShot ?? 10);
      setZone('A');
      setZoom({ s: 1, tx: 0, ty: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // In-flight gesture bookkeeping.
  const gRef = useRef({
    startS: 1,
    startTx: 0,
    startTy: 0,
    startDist: 1,
    startMidX: 0,
    startMidY: 0,
    startX: 0,
    startY: 0,
    moved: false,
    touches: 0,
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches;
          const g = gRef.current;
          const z = zoomRef.current;
          g.startS = z.s;
          g.startTx = z.tx;
          g.startTy = z.ty;
          g.moved = false;
          g.touches = t.length;
          if (t.length >= 2) {
            g.startDist = dist(t[0], t[1]);
            g.startMidX = (t[0].locationX + t[1].locationX) / 2;
            g.startMidY = (t[0].locationY + t[1].locationY) / 2;
          } else if (t.length === 1) {
            g.startX = t[0].locationX;
            g.startY = t[0].locationY;
          }
        },
        onPanResponderMove: (e) => {
          const t = e.nativeEvent.touches;
          const g = gRef.current;
          const z = zoomRef.current;
          const f = fitRef.current;
          const { w, h } = sizeRef.current;
          if (!f || !w || !h) return;
          // Re-baseline when a finger is added or removed mid-gesture.
          if (t.length !== g.touches) {
            g.touches = t.length;
            g.startS = z.s;
            g.startTx = z.tx;
            g.startTy = z.ty;
            if (t.length >= 2) {
              g.startDist = dist(t[0], t[1]);
              g.startMidX = (t[0].locationX + t[1].locationX) / 2;
              g.startMidY = (t[0].locationY + t[1].locationY) / 2;
            } else if (t.length === 1) {
              g.startX = t[0].locationX;
              g.startY = t[0].locationY;
            }
            return;
          }
          if (t.length >= 2) {
            g.moved = true;
            const d = dist(t[0], t[1]);
            const ns = clamp(g.startS * (d / (g.startDist || 1)), MIN_SCALE, MAX_SCALE);
            const midX = (t[0].locationX + t[1].locationX) / 2;
            const midY = (t[0].locationY + t[1].locationY) / 2;
            // Keep the image point that was under the start midpoint beneath the
            // current midpoint: screen = ox + s*lx + tx  →  ntx = mid - ox - ns*lx.
            const lx = (g.startMidX - f.ox - g.startTx) / g.startS;
            const ly = (g.startMidY - f.oy - g.startTy) / g.startS;
            let ntx = midX - f.ox - ns * lx;
            let nty = midY - f.oy - ns * ly;
            [ntx, nty] = clampPan(ntx, nty, ns, w, h, f);
            setZoom({ s: ns, tx: ntx, ty: nty });
          } else if (t.length === 1) {
            const dx = t[0].locationX - g.startX;
            const dy = t[0].locationY - g.startY;
            if (Math.abs(dx) > PAN_THRESHOLD || Math.abs(dy) > PAN_THRESHOLD) g.moved = true;
            if (g.moved) {
              const [tx, ty] = clampPan(g.startTx + dx, g.startTy + dy, z.s, w, h, f);
              setZoom({ s: z.s, tx, ty });
            }
          }
        },
        onPanResponderRelease: (e) => {
          const g = gRef.current;
          if (g.moved || g.touches !== 1) return;
          const { locationX, locationY } = e.nativeEvent;
          if (locationX == null || locationY == null) return;
          const z = zoomRef.current;
          const f = fitRef.current;
          if (!f) return;

          // Hit-test existing markers (topmost wins) — tap a hit to remove it.
          // RN pan responders swallow child Pressable presses, so markers can't
          // intercept their own taps; we do it here against the screen positions.
          for (let i = shotsRef.current.length - 1; i >= 0; i--) {
            const s = shotsRef.current[i];
            const sx = f.ox + z.s * (s.x * f.dw) + z.tx;
            const sy = f.oy + z.s * (s.y * f.dh) + z.ty;
            if (Math.abs(locationX - sx) <= MARKER_SIZE / 2 && Math.abs(locationY - sy) <= MARKER_SIZE / 2) {
              setShots((prev) => prev.filter((_, idx) => idx !== i));
              return;
            }
          }

          // Otherwise invert screen → image-local → normalized image coords.
          const lx = (locationX - f.ox - z.tx) / z.s;
          const ly = (locationY - f.oy - z.ty) / z.s;
          const px = lx / f.dw;
          const py = ly / f.dh;
          if (px < 0 || px > 1 || py < 0 || py > 1) return; // tap in the letterbox area
          const sel = selRef.current;
          setShots((prev) => [
            ...prev,
            sel.isIpsc
              ? { x: px, y: py, ringValue: null, zone: sel.zone }
              : { x: px, y: py, ringValue: sel.ringValue, zone: null },
          ]);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // Created once — all mutable state is read through refs.
    [],
  );

  const zoomBy = (factor: number) => {
    const z = zoomRef.current;
    const f = fitRef.current;
    const { w, h } = sizeRef.current;
    if (!f || !w || !h) return;
    const ns = clamp(z.s * factor, MIN_SCALE, MAX_SCALE);
    // Keep the viewport center stationary.
    const ntx = w / 2 - f.ox - (ns * (w / 2 - f.ox - z.tx)) / z.s;
    const nty = h / 2 - f.oy - (ns * (h / 2 - f.oy - z.ty)) / z.s;
    const [tx, ty] = clampPan(ntx, nty, ns, w, h, f);
    setZoom({ s: ns, tx, ty });
  };
  const resetZoom = () => setZoom({ s: 1, tx: 0, ty: 0 });
  const undo = () => setShots((prev) => prev.slice(0, -1));

  const ringOptions = range(0, maxScorePerShot ?? 10).reverse();
  const total = shots.reduce(
    (sum, s) => sum + (s.ringValue ?? (s.zone ? zonePoints(s.zone) : 0)),
    0,
  );

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.root}>
        <View style={styles.stageWrap}>
          <View style={styles.stage} onLayout={onLayout} {...panResponder.panHandlers}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ translateX: zoom.tx }, { translateY: zoom.ty }, { scale: zoom.s }] },
              ]}
            >
              <AuthImage
                path={imagePath}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                onLoad={(dims) => setIntrinsic({ w: dims.width, h: dims.height })}
              />
            </View>
          </View>

          {/* Overlay (box-none) sits above the pan surface: markers pass taps
              through to the stage, while the zoom/close buttons catch their own. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {fit &&
              shots.map((s, i) => {
                const sx = fit.ox + zoom.s * (s.x * fit.dw) + zoom.tx;
                const sy = fit.oy + zoom.s * (s.y * fit.dh) + zoom.ty;
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[styles.marker, { left: sx - MARKER_SIZE / 2, top: sy - MARKER_SIZE / 2 }]}
                  >
                    <Text style={styles.markerText}>{s.zone ?? s.ringValue}</Text>
                  </View>
                );
              })}

            <View style={styles.controls}>
              <Pressable style={styles.iconBtn} onPress={() => zoomBy(1.4)}>
                <Text style={styles.iconText}>+</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => zoomBy(1 / 1.4)}>
                <Text style={styles.iconText}>−</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={resetZoom}>
                <Text style={styles.iconText}>⟲</Text>
              </Pressable>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bar}>
          <Text style={styles.hint}>
            Pinch to zoom · drag to pan · tap to place · tap a hit to remove
            {isIpsc ? ` (zone ${zone})` : ` (ring ${ringValue})`}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {isIpsc
              ? IPSC_ZONES.map((z) => <Chip key={z} label={z} active={z === zone} onPress={() => setZone(z)} />)
              : ringOptions.map((v) => (
                  <Chip key={v} label={String(v)} active={v === ringValue} onPress={() => setRingValue(v)} />
                ))}
          </ScrollView>
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Undo last" variant="ghost" onPress={undo} disabled={shots.length === 0} />
            </View>
            <View style={{ flex: 2 }}>
              <Button title={`Save · ${shots.length} hits · ${total} pts`} onPress={() => onSave(shots)} />
            </View>
          </Row>
        </View>
      </View>
    </Modal>
  );
}

interface FitRect {
  ox: number;
  oy: number;
  dw: number;
  dh: number;
}

/** The rect (offset + size) of an image of (iw,ih) `contain`-fitted into (W,H). */
function containedFit(W: number, H: number, iw: number, ih: number): FitRect | null {
  if (!W || !H || !iw || !ih) return null;
  const scale = Math.min(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return { ox: (W - dw) / 2, oy: (H - dh) / 2, dw, dh };
}

/**
 * Clamp pan so the image can't be dragged off-screen. At scale 1 (image is
 * letterboxed, smaller than the viewport) there's nothing to pan; beyond that,
 * the transformed image must keep covering the viewport.
 */
function clampPan(tx: number, ty: number, s: number, W: number, H: number, fit: FitRect): [number, number] {
  if (s <= 1) return [0, 0];
  const spanW = fit.dw * s;
  const spanH = fit.dh * s;
  const minTx = W - fit.ox - spanW;
  const maxTx = -fit.ox;
  const minTy = H - fit.oy - spanH;
  const maxTy = -fit.oy;
  const nx = minTx <= maxTx ? clamp(tx, minTx, maxTx) : (minTx + maxTx) / 2;
  const ny = minTy <= maxTy ? clamp(ty, minTy, maxTy) : (minTy + maxTy) / 2;
  return [nx, ny];
}

const zonePoints = (z: string): number => (z === 'A' ? 5 : z === 'C' ? 3 : z === 'D' ? 1 : 0);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const range = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const dist = (
  a: { locationX: number; locationY: number },
  b: { locationX: number; locationY: number },
): number => Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
    >
      <Text style={[styles.chipText, active && { color: theme.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  stageWrap: { flex: 1, position: 'relative' },
  stage: { flex: 1 },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderColor: theme.danger,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  controls: { position: 'absolute', top: 48, right: 12, gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  closeBtn: {
    position: 'absolute',
    top: 48,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bar: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  hint: { color: theme.textMuted, fontSize: 12 },
  chip: {
    minWidth: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  chipText: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
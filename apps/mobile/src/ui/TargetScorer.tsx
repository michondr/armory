import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

/**
 * Pinch-to-zoom, drag-to-pan, tap-to-place scoring over the target photo
 * (mirrors the web app's "Zoom & score"). Pinch zooms around the midpoint of
 * the two fingers; one finger drags when zoomed in; a tap (no movement) drops a
 * hit at the tapped point in image coordinates. Markers keep a constant on-screen
 * size regardless of zoom. Built with the built-in PanResponder — no extra native
 * deps. Positions persist so the shot pattern shows on every device after sync.
 */
export function TargetScorer({
  imagePath,
  scoringSystem,
  maxScorePerShot,
  initialShots,
  onSave,
}: {
  imagePath: string;
  scoringSystem: 'RINGS' | 'IPSC' | 'GROUP';
  maxScorePerShot: number | null;
  initialShots: PlacedShot[];
  onSave: (shots: PlacedShot[]) => void;
}) {
  const [shots, setShots] = useState<PlacedShot[]>(initialShots);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const isIpsc = scoringSystem === 'IPSC';
  const [ringValue, setRingValue] = useState<number>(maxScorePerShot ?? 10);
  const [zone, setZone] = useState<string>('A');

  // Zoom state lives in a ref so the PanResponder (created once) always reads the
  // latest value without being recreated mid-gesture; `force` triggers re-renders.
  const zoomRef = useRef({ s: 1, tx: 0, ty: 0 });
  const [, force] = useReducer((x) => x + 1, 0);
  const setZoom = (z: { s: number; tx: number; ty: number }) => {
    zoomRef.current = z;
    force();
  };
  const zoom = zoomRef.current;

  const sizeRef = useRef(size);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    sizeRef.current = { w: width, h: height };
    setSize({ w: width, h: height });
  };

  // The currently selected value, mirrored into a ref so tap-to-place (inside the
  // once-created PanResponder) always uses the latest chip selection.
  const selRef = useRef({ isIpsc, ringValue, zone });
  useEffect(() => {
    selRef.current = { isIpsc, ringValue, zone };
  }, [isIpsc, ringValue, zone]);

  // In-flight gesture bookkeeping (also ref-only).
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
            const cx = sizeRef.current.w / 2;
            const cy = sizeRef.current.h / 2;
            const ratio = ns / g.startS;
            // Pinch around the current midpoint: keep the image point that was
            // under the start midpoint beneath the current midpoint.
            let ntx = midX - cx - (g.startMidX - cx) * ratio + g.startTx * ratio;
            let nty = midY - cy - (g.startMidY - cy) * ratio + g.startTy * ratio;
            [ntx, nty] = clampTranslate(ntx, nty, ns, sizeRef.current);
            setZoom({ s: ns, tx: ntx, ty: nty });
          } else if (t.length === 1) {
            const dx = t[0].locationX - g.startX;
            const dy = t[0].locationY - g.startY;
            if (Math.abs(dx) > PAN_THRESHOLD || Math.abs(dy) > PAN_THRESHOLD) g.moved = true;
            if (g.moved) {
              let ntx = g.startTx + dx;
              let nty = g.startTy + dy;
              [ntx, nty] = clampTranslate(ntx, nty, z.s, sizeRef.current);
              setZoom({ s: z.s, tx: ntx, ty: nty });
            }
          }
        },
        onPanResponderRelease: (e) => {
          const g = gRef.current;
          if (!g.moved && g.touches === 1) {
            // A tap (no movement, one finger) → place a hit at the tapped point.
            const { locationX, locationY } = e.nativeEvent;
            const z = zoomRef.current;
            const sz = sizeRef.current;
            if (locationX == null || locationY == null) return;
            // Invert screen = center + (image - center)*scale + translate.
            const imgX = sz.w / 2 + (locationX - sz.w / 2 - z.tx) / z.s;
            const imgY = sz.h / 2 + (locationY - sz.h / 2 - z.ty) / z.s;
            const x = clamp01(imgX / sz.w);
            const y = clamp01(imgY / sz.h);
            const sel = selRef.current;
            setShots((prev) => [
              ...prev,
              sel.isIpsc ? { x, y, ringValue: null, zone: sel.zone } : { x, y, ringValue: sel.ringValue, zone: null },
            ]);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const undo = () => setShots((prev) => prev.slice(0, -1));
  const resetZoom = () => setZoom({ s: 1, tx: 0, ty: 0 });
  const ringOptions = range(0, maxScorePerShot ?? 10).reverse();

  return (
    <View style={{ gap: 12 }}>
      <View style={{ position: 'relative' }}>
        <View style={styles.targetBox} onLayout={onLayout} {...panResponder.panHandlers}>
          <View
            style={{
              width: size.w,
              height: size.h,
              transform: [{ translateX: zoom.tx }, { translateY: zoom.ty }, { scale: zoom.s }],
            }}
          >
            <AuthImage path={imagePath} style={{ width: size.w, height: size.h }} contentFit="contain" />
            {shots.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.marker,
                  { left: s.x * size.w - 12, top: s.y * size.h - 12, transform: [{ scale: 1 / zoom.s }] },
                ]}
              >
                <Text style={styles.markerText}>{s.zone ?? s.ringValue}</Text>
              </View>
            ))}
          </View>
        </View>
        {zoom.s !== 1 && (
          <Pressable style={styles.resetBtn} onPress={resetZoom}>
            <Text style={styles.resetText}>⟲</Text>
          </Pressable>
        )}
      </View>

      <Text style={{ color: theme.textMuted, fontSize: 12 }}>
        Pinch to zoom, drag to pan, tap to place a hit ({isIpsc ? `zone ${zone}` : `ring ${ringValue}`}). Undo removes the last hit.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {isIpsc
          ? IPSC_ZONES.map((z) => (
              <Chip key={z} label={z} active={z === zone} onPress={() => setZone(z)} />
            ))
          : ringOptions.map((v) => (
              <Chip key={v} label={String(v)} active={v === ringValue} onPress={() => setRingValue(v)} />
            ))}
      </ScrollView>

      <Text style={{ color: theme.text, fontWeight: '600' }}>
        {shots.length} hit{shots.length === 1 ? '' : 's'}
      </Text>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Undo last" variant="ghost" onPress={undo} disabled={shots.length === 0} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save scoring" onPress={() => onSave(shots)} />
        </View>
      </Row>
    </View>
  );
}

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

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number): number => clamp(v, 0, 1);
const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const dist = (a: { locationX: number; locationY: number }, b: { locationX: number; locationY: number }): number =>
  Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);

/** Keep the image covering the container: |translate| ≤ (scale-1)/2 × size. */
function clampTranslate(
  tx: number,
  ty: number,
  s: number,
  size: { w: number; h: number },
): [number, number] {
  const maxX = (size.w * (s - 1)) / 2;
  const maxY = (size.h * (s - 1)) / 2;
  return [clamp(tx, -maxX, maxX), clamp(ty, -maxY, maxY)];
}

const styles = StyleSheet.create({
  targetBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: theme.inputBg,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  resetBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  chip: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  chipText: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
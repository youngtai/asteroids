import type { PlacedSticker } from '../types/game';

type HitArea =
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'polygon'; points: Array<[number, number]> };

interface HitResult {
  placement: PlacedSticker;
  rect: DOMRect;
}

const DEFAULT_HIT_AREAS: HitArea[] = [{ type: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.42 }];

const HIT_AREAS_BY_ITEM_ID: Record<string, HitArea[]> = {
  apple: [
    { type: 'ellipse', cx: 0.49, cy: 0.57, rx: 0.35, ry: 0.37 },
    { type: 'ellipse', cx: 0.68, cy: 0.25, rx: 0.18, ry: 0.12 },
  ],
  ball: [{ type: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.42 }],
  basket: [
    { type: 'rect', x: 0.2, y: 0.41, width: 0.6, height: 0.46 },
    { type: 'ellipse', cx: 0.5, cy: 0.42, rx: 0.34, ry: 0.27 },
  ],
  blanket: [
    {
      type: 'polygon',
      points: [
        [0.13, 0.27],
        [0.85, 0.18],
        [0.91, 0.72],
        [0.2, 0.84],
      ],
    },
  ],
  hat: [
    { type: 'ellipse', cx: 0.5, cy: 0.62, rx: 0.46, ry: 0.17 },
    {
      type: 'polygon',
      points: [
        [0.26, 0.58],
        [0.35, 0.28],
        [0.65, 0.28],
        [0.74, 0.58],
      ],
    },
  ],
  juice: [
    { type: 'rect', x: 0.3, y: 0.22, width: 0.47, height: 0.66 },
    { type: 'rect', x: 0.58, y: 0.06, width: 0.27, height: 0.22 },
  ],
  kite: [
    {
      type: 'polygon',
      points: [
        [0.5, 0.06],
        [0.86, 0.43],
        [0.5, 0.9],
        [0.14, 0.43],
      ],
    },
  ],
  napkin: [
    {
      type: 'polygon',
      points: [
        [0.29, 0.16],
        [0.82, 0.27],
        [0.72, 0.84],
        [0.17, 0.72],
      ],
    },
  ],
  plate: [{ type: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.42 }],
  sandwich: [
    {
      type: 'polygon',
      points: [
        [0.5, 0.16],
        [0.86, 0.76],
        [0.14, 0.76],
      ],
    },
  ],
  towel: [
    {
      type: 'polygon',
      points: [
        [0.13, 0.3],
        [0.72, 0.18],
        [0.88, 0.61],
        [0.25, 0.78],
      ],
    },
  ],
  swimsuit: [
    {
      type: 'polygon',
      points: [
        [0.35, 0.12],
        [0.65, 0.12],
        [0.78, 0.82],
        [0.22, 0.82],
      ],
    },
  ],
  sunglasses: [
    { type: 'ellipse', cx: 0.35, cy: 0.5, rx: 0.2, ry: 0.16 },
    { type: 'ellipse', cx: 0.65, cy: 0.5, rx: 0.2, ry: 0.16 },
    { type: 'rect', x: 0.44, y: 0.45, width: 0.12, height: 0.1 },
  ],
  sunscreen: [{ type: 'rect', x: 0.35, y: 0.16, width: 0.3, height: 0.68 }],
  bucket: [
    {
      type: 'polygon',
      points: [
        [0.25, 0.28],
        [0.75, 0.28],
        [0.66, 0.8],
        [0.34, 0.8],
      ],
    },
  ],
  shovel: [
    { type: 'rect', x: 0.45, y: 0.16, width: 0.1, height: 0.56 },
    {
      type: 'polygon',
      points: [
        [0.3, 0.65],
        [0.7, 0.65],
        [0.62, 0.88],
        [0.38, 0.88],
      ],
    },
  ],
  sandals: [
    { type: 'ellipse', cx: 0.38, cy: 0.5, rx: 0.18, ry: 0.34 },
    { type: 'ellipse', cx: 0.62, cy: 0.5, rx: 0.18, ry: 0.34 },
  ],
  'water-bottle': [{ type: 'rect', x: 0.34, y: 0.13, width: 0.32, height: 0.74 }],
  'beach-hat': [
    { type: 'ellipse', cx: 0.5, cy: 0.57, rx: 0.43, ry: 0.17 },
    { type: 'ellipse', cx: 0.5, cy: 0.45, rx: 0.28, ry: 0.23 },
  ],
  dress: [
    {
      type: 'polygon',
      points: [
        [0.37, 0.18],
        [0.63, 0.18],
        [0.82, 0.84],
        [0.18, 0.84],
      ],
    },
  ],
  suit: [
    { type: 'rect', x: 0.34, y: 0.18, width: 0.32, height: 0.62 },
    { type: 'rect', x: 0.23, y: 0.32, width: 0.16, height: 0.34 },
    { type: 'rect', x: 0.61, y: 0.32, width: 0.16, height: 0.34 },
  ],
  'dress-shoes': [
    { type: 'ellipse', cx: 0.38, cy: 0.55, rx: 0.18, ry: 0.3 },
    { type: 'ellipse', cx: 0.62, cy: 0.55, rx: 0.18, ry: 0.3 },
  ],
  'bow-tie': [
    {
      type: 'polygon',
      points: [
        [0.1, 0.35],
        [0.43, 0.25],
        [0.43, 0.75],
        [0.1, 0.65],
      ],
    },
    {
      type: 'polygon',
      points: [
        [0.57, 0.25],
        [0.9, 0.35],
        [0.9, 0.65],
        [0.57, 0.75],
      ],
    },
    { type: 'rect', x: 0.43, y: 0.38, width: 0.14, height: 0.24 },
  ],
  flower: [{ type: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.36, ry: 0.36 }],
  invitation: [{ type: 'rect', x: 0.22, y: 0.22, width: 0.56, height: 0.56 }],
  'formal-jacket': [
    { type: 'rect', x: 0.32, y: 0.18, width: 0.36, height: 0.66 },
    { type: 'rect', x: 0.2, y: 0.34, width: 0.18, height: 0.38 },
    { type: 'rect', x: 0.62, y: 0.34, width: 0.18, height: 0.38 },
  ],
  necklace: [{ type: 'ellipse', cx: 0.5, cy: 0.55, rx: 0.34, ry: 0.22 }],
  'hair-ribbon': [
    { type: 'ellipse', cx: 0.34, cy: 0.44, rx: 0.23, ry: 0.16 },
    { type: 'ellipse', cx: 0.66, cy: 0.44, rx: 0.23, ry: 0.16 },
    {
      type: 'polygon',
      points: [
        [0.36, 0.54],
        [0.5, 0.86],
        [0.64, 0.54],
      ],
    },
  ],
  backpack: [
    { type: 'rect', x: 0.25, y: 0.25, width: 0.5, height: 0.58 },
    { type: 'ellipse', cx: 0.5, cy: 0.34, rx: 0.3, ry: 0.22 },
    { type: 'rect', x: 0.17, y: 0.51, width: 0.66, height: 0.27 },
  ],
  'outing-jacket': [
    { type: 'rect', x: 0.34, y: 0.19, width: 0.32, height: 0.58 },
    { type: 'rect', x: 0.19, y: 0.32, width: 0.2, height: 0.38 },
    { type: 'rect', x: 0.61, y: 0.32, width: 0.2, height: 0.38 },
    {
      type: 'polygon',
      points: [
        [0.34, 0.66],
        [0.66, 0.66],
        [0.75, 0.87],
        [0.25, 0.87],
      ],
    },
  ],
  sneakers: [
    { type: 'ellipse', cx: 0.37, cy: 0.55, rx: 0.21, ry: 0.28 },
    { type: 'ellipse', cx: 0.64, cy: 0.55, rx: 0.21, ry: 0.28 },
  ],
  umbrella: [
    { type: 'ellipse', cx: 0.5, cy: 0.36, rx: 0.43, ry: 0.28 },
    { type: 'rect', x: 0.47, y: 0.34, width: 0.06, height: 0.44 },
    { type: 'ellipse', cx: 0.43, cy: 0.77, rx: 0.12, ry: 0.12 },
  ],
  snack: [
    { type: 'ellipse', cx: 0.5, cy: 0.6, rx: 0.35, ry: 0.23 },
    { type: 'ellipse', cx: 0.43, cy: 0.43, rx: 0.2, ry: 0.14 },
    { type: 'ellipse', cx: 0.6, cy: 0.43, rx: 0.17, ry: 0.14 },
  ],
  book: [
    {
      type: 'polygon',
      points: [
        [0.22, 0.24],
        [0.78, 0.21],
        [0.83, 0.73],
        [0.24, 0.8],
      ],
    },
  ],
  socks: [
    {
      type: 'polygon',
      points: [
        [0.22, 0.19],
        [0.47, 0.19],
        [0.45, 0.66],
        [0.34, 0.82],
        [0.17, 0.73],
      ],
    },
    {
      type: 'polygon',
      points: [
        [0.55, 0.19],
        [0.79, 0.19],
        [0.84, 0.73],
        [0.67, 0.82],
        [0.56, 0.66],
      ],
    },
  ],
  cap: [
    { type: 'ellipse', cx: 0.46, cy: 0.48, rx: 0.31, ry: 0.2 },
    { type: 'ellipse', cx: 0.68, cy: 0.58, rx: 0.22, ry: 0.11 },
  ],
  'outing-water-bottle': [
    { type: 'rect', x: 0.36, y: 0.18, width: 0.28, height: 0.68 },
    { type: 'rect', x: 0.41, y: 0.09, width: 0.18, height: 0.14 },
  ],
  pencil: [
    {
      type: 'polygon',
      points: [
        [0.09, 0.43],
        [0.77, 0.43],
        [0.93, 0.51],
        [0.77, 0.59],
        [0.09, 0.59],
      ],
    },
  ],
  notebook: [
    {
      type: 'polygon',
      points: [
        [0.2, 0.2],
        [0.78, 0.18],
        [0.82, 0.79],
        [0.22, 0.82],
      ],
    },
  ],
  crayon: [
    {
      type: 'polygon',
      points: [
        [0.17, 0.38],
        [0.75, 0.28],
        [0.88, 0.39],
        [0.25, 0.65],
      ],
    },
  ],
  ruler: [
    {
      type: 'polygon',
      points: [
        [0.12, 0.39],
        [0.88, 0.27],
        [0.91, 0.4],
        [0.15, 0.61],
      ],
    },
  ],
  glue: [
    { type: 'rect', x: 0.35, y: 0.25, width: 0.3, height: 0.58 },
    { type: 'rect', x: 0.4, y: 0.13, width: 0.2, height: 0.16 },
  ],
  scissors: [
    { type: 'ellipse', cx: 0.35, cy: 0.29, rx: 0.17, ry: 0.17 },
    { type: 'ellipse', cx: 0.67, cy: 0.32, rx: 0.16, ry: 0.16 },
    {
      type: 'polygon',
      points: [
        [0.39, 0.41],
        [0.48, 0.43],
        [0.25, 0.9],
        [0.13, 0.87],
      ],
    },
    {
      type: 'polygon',
      points: [
        [0.51, 0.43],
        [0.6, 0.39],
        [0.83, 0.84],
        [0.73, 0.9],
      ],
    },
  ],
  lunchbox: [
    { type: 'rect', x: 0.22, y: 0.36, width: 0.56, height: 0.42 },
    { type: 'ellipse', cx: 0.5, cy: 0.35, rx: 0.25, ry: 0.18 },
  ],
  eraser: [
    {
      type: 'polygon',
      points: [
        [0.24, 0.35],
        [0.74, 0.25],
        [0.82, 0.62],
        [0.32, 0.75],
      ],
    },
  ],
  desk: [
    {
      type: 'polygon',
      points: [
        [0.18, 0.28],
        [0.82, 0.28],
        [0.75, 0.5],
        [0.25, 0.5],
      ],
    },
    { type: 'rect', x: 0.24, y: 0.48, width: 0.08, height: 0.38 },
    { type: 'rect', x: 0.68, y: 0.48, width: 0.08, height: 0.38 },
  ],
  paintbrush: [
    {
      type: 'polygon',
      points: [
        [0.17, 0.69],
        [0.66, 0.2],
        [0.75, 0.29],
        [0.27, 0.78],
      ],
    },
    { type: 'ellipse', cx: 0.75, cy: 0.25, rx: 0.16, ry: 0.12 },
  ],
  cake: [
    { type: 'rect', x: 0.28, y: 0.43, width: 0.44, height: 0.3 },
    { type: 'rect', x: 0.37, y: 0.2, width: 0.06, height: 0.24 },
    { type: 'rect', x: 0.48, y: 0.2, width: 0.06, height: 0.24 },
    { type: 'rect', x: 0.59, y: 0.2, width: 0.06, height: 0.24 },
    { type: 'ellipse', cx: 0.5, cy: 0.75, rx: 0.38, ry: 0.12 },
  ],
  balloon: [
    { type: 'ellipse', cx: 0.5, cy: 0.34, rx: 0.28, ry: 0.3 },
    {
      type: 'polygon',
      points: [
        [0.47, 0.62],
        [0.53, 0.62],
        [0.57, 0.91],
        [0.49, 0.91],
      ],
    },
  ],
  gift: [
    { type: 'rect', x: 0.23, y: 0.37, width: 0.54, height: 0.43 },
    { type: 'ellipse', cx: 0.42, cy: 0.29, rx: 0.18, ry: 0.13 },
    { type: 'ellipse', cx: 0.58, cy: 0.29, rx: 0.18, ry: 0.13 },
  ],
  'party-hat': [
    {
      type: 'polygon',
      points: [
        [0.5, 0.13],
        [0.8, 0.8],
        [0.2, 0.8],
      ],
    },
  ],
  cupcake: [
    { type: 'ellipse', cx: 0.5, cy: 0.38, rx: 0.28, ry: 0.19 },
    {
      type: 'polygon',
      points: [
        [0.27, 0.5],
        [0.73, 0.5],
        [0.66, 0.82],
        [0.34, 0.82],
      ],
    },
  ],
  'birthday-card': [
    {
      type: 'polygon',
      points: [
        [0.22, 0.28],
        [0.73, 0.2],
        [0.82, 0.72],
        [0.3, 0.82],
      ],
    },
  ],
  candle: [
    { type: 'rect', x: 0.42, y: 0.28, width: 0.16, height: 0.52 },
    { type: 'ellipse', cx: 0.5, cy: 0.2, rx: 0.12, ry: 0.14 },
  ],
  'party-horn': [
    {
      type: 'polygon',
      points: [
        [0.18, 0.52],
        [0.77, 0.3],
        [0.84, 0.49],
        [0.25, 0.7],
      ],
    },
    { type: 'ellipse', cx: 0.22, cy: 0.61, rx: 0.13, ry: 0.11 },
  ],
  confetti: [
    { type: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.38, ry: 0.32 },
    { type: 'rect', x: 0.22, y: 0.22, width: 0.56, height: 0.56 },
  ],
  'ice-cream': [
    { type: 'ellipse', cx: 0.5, cy: 0.32, rx: 0.28, ry: 0.25 },
    {
      type: 'polygon',
      points: [
        [0.28, 0.48],
        [0.72, 0.48],
        [0.5, 0.86],
      ],
    },
  ],
};

const CHARACTER_ASPECT_RATIOS: Record<string, number> = {
  hana: 656 / 335,
  joon: 728 / 352,
};

const HIT_AREAS_BY_CHARACTER_ID: Record<string, HitArea[]> = {
  hana: [
    { type: 'ellipse', cx: 0.5, cy: 0.21, rx: 0.38, ry: 0.18 },
    { type: 'rect', x: 0.27, y: 0.35, width: 0.46, height: 0.44 },
    { type: 'ellipse', cx: 0.36, cy: 0.89, rx: 0.15, ry: 0.07 },
    { type: 'ellipse', cx: 0.64, cy: 0.89, rx: 0.15, ry: 0.07 },
  ],
  joon: [
    { type: 'ellipse', cx: 0.5, cy: 0.17, rx: 0.37, ry: 0.16 },
    { type: 'rect', x: 0.27, y: 0.3, width: 0.46, height: 0.5 },
    { type: 'ellipse', cx: 0.35, cy: 0.9, rx: 0.16, ry: 0.07 },
    { type: 'ellipse', cx: 0.65, cy: 0.9, rx: 0.16, ry: 0.07 },
  ],
};

export function findTopmostHitPlacement(
  placements: PlacedSticker[],
  stageRect: DOMRect,
  clientX: number,
  clientY: number
): HitResult | null {
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    const placement = placements[index];
    const rect = getPlacementRect(stageRect, placement);

    if (isPointInStickerHitArea(placement, rect, clientX, clientY)) {
      return { placement, rect };
    }
  }

  return null;
}

export function getPlacementRect(stageRect: DOMRect, placement: PlacedSticker): DOMRect {
  const dimensions =
    placement.kind === 'character'
      ? getStageCharacterDimensions(placement.stickerId)
      : { width: getStageStickerSize(), height: getStageStickerSize() };
  const scale = placement.scale ?? 1;
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  const centerX = stageRect.left + (placement.x / 100) * stageRect.width;
  const centerY = stageRect.top + (placement.y / 100) * stageRect.height;
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

export function isPointInItemHitArea(
  itemId: string,
  rect: DOMRect,
  clientX: number,
  clientY: number
): boolean {
  return isPointInHitAreas(
    HIT_AREAS_BY_ITEM_ID[itemId] ?? DEFAULT_HIT_AREAS,
    rect,
    clientX,
    clientY
  );
}

export function isPointInStickerHitArea(
  placement: PlacedSticker,
  rect: DOMRect,
  clientX: number,
  clientY: number
): boolean {
  const hitAreas =
    placement.kind === 'character'
      ? (HIT_AREAS_BY_CHARACTER_ID[placement.stickerId] ?? DEFAULT_HIT_AREAS)
      : (HIT_AREAS_BY_ITEM_ID[placement.stickerId] ?? DEFAULT_HIT_AREAS);

  return isPointInHitAreas(hitAreas, rect, clientX, clientY);
}

function isPointInHitAreas(
  hitAreas: HitArea[],
  rect: DOMRect,
  clientX: number,
  clientY: number
): boolean {
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return false;
  }

  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;

  return hitAreas.some((area) => isPointInHitArea(area, x, y));
}

export function getStageStickerSize(): number {
  return clamp(window.innerWidth * 0.08, 56, 94);
}

export function getStageCharacterDimensions(characterId: string): {
  width: number;
  height: number;
} {
  const width = clamp(window.innerWidth * 0.16, 120, 220);
  return {
    width,
    height: width * (CHARACTER_ASPECT_RATIOS[characterId] ?? 2),
  };
}

function isPointInHitArea(area: HitArea, x: number, y: number): boolean {
  if (area.type === 'ellipse') {
    return ((x - area.cx) / area.rx) ** 2 + ((y - area.cy) / area.ry) ** 2 <= 1;
  }

  if (area.type === 'rect') {
    return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
  }

  return isPointInPolygon(area.points, x, y);
}

function isPointInPolygon(points: Array<[number, number]>, x: number, y: number): boolean {
  let inside = false;

  for (
    let index = 0, previousIndex = points.length - 1;
    index < points.length;
    previousIndex = index++
  ) {
    const [currentX, currentY] = points[index];
    const [previousX, previousY] = points[previousIndex];
    const crossesY = currentY > y !== previousY > y;
    const intersects =
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;

    if (crossesY && intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

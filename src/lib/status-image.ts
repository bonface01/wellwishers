export const STATUS_IMAGE_WIDTH = 1080;
export const STATUS_IMAGE_HEIGHT = 1920;

export type StatusImageInput = {
  groupName: string;
  week: number;
  recipientName: string;
  collected: number;
  expected: number;
  currency: string;
  paidCount: number;
  totalCount: number;
  nextName: string | null;
  unpaid: string[];
  fontFamily?: string;
};

const C = {
  base: "#07140F",
  text: "#F3F1E8",
  muted: "#9DB8AC",
  amber: "#F2B544",
  progress: "#3FCB8A",
  track: "rgba(255,255,255,0.14)",
};

const PAD = 88;
const W = STATUS_IMAGE_WIDTH;
const H = STATUS_IMAGE_HEIGHT;
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Frosted-glass card: soft shadow, tinted translucent fill, 2px light border and a bright top edge. */
function glassCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, hero = false) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 56;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = hero ? "rgba(15,42,34,0.78)" : "rgba(7,20,15,0.34)";
  roundedRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = hero ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.08)";
  roundedRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  roundedRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(x + r, y + 2);
  ctx.lineTo(x + w - r, y + 2);
  ctx.stroke();
}

/** Drifting colour orbs, the same idea as the app backdrop. */
function drawOrbs(ctx: CanvasRenderingContext2D) {
  const orbs: [number, number, number, string][] = [
    [140, 160, 900, "16,185,129,0.5"],
    [980, 720, 820, "13,148,136,0.42"],
    [160, 1740, 980, "6,95,70,0.6"],
    [940, 1790, 540, "242,181,68,0.24"],
  ];
  for (const [x, y, r, rgba] of orbs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgba})`);
    g.addColorStop(1, `rgba(${rgba.replace(/,[^,]+$/, ",0")})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Faint, repeatable film grain (fixed seed, so the image is the same every time). */
function drawGrain(ctx: CanvasRenderingContext2D) {
  let seed = 20260101;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  for (let i = 0; i < 5200; i++) ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H), 2, 2);
}

/** Largest font size (between min and max) at which `text` fits `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, max: number, min: number, weight: number, family: string) {
  let size = max;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return min;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Draws the 1080×1920 status card. Pure drawing, so it can run against any 2D context. */
export function drawStatusImage(ctx: CanvasRenderingContext2D, i: StatusImageInput): void {
  const family = i.fontFamily ?? "system-ui, sans-serif";
  const complete = i.totalCount > 0 && i.paidCount >= i.totalCount;
  const accent = complete ? C.amber : C.progress;
  const inner = W - PAD * 2;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Backdrop
  ctx.fillStyle = C.base;
  ctx.fillRect(0, 0, W, H);
  drawOrbs(ctx);
  drawGrain(ctx);

  // Layout positions, worked out first so the whole block can be centred vertically.
  const panelY = 400;
  const panelH = 600;
  const card2Y = panelY + panelH + 24;
  const card2H = 300;
  const barY = card2Y + 64;
  const card3Y = card2Y + card2H + 24;
  const listStart = card3Y + 146;
  const lineH = 70;
  const maxLines = Math.max(1, Math.floor((H - 100 - 54 - listStart) / lineH) + 1);
  const linesUsed = i.unpaid.length === 0 ? 1 : Math.min(i.unpaid.length, maxLines);
  const card3Bottom = listStart + (linesUsed - 1) * lineH + 54;
  const offset = Math.max(0, Math.min(220, Math.floor((H - 100 - card3Bottom) / 2)));
  ctx.save();
  ctx.translate(0, offset);

  // Header
  ctx.fillStyle = C.muted;
  ctx.font = `600 36px ${family}`;
  ctx.fillText(truncate(ctx, i.groupName.toUpperCase(), inner), PAD, 170);
  ctx.fillStyle = C.text;
  ctx.font = `800 128px ${family}`;
  ctx.fillText(`Week ${i.week}`, PAD, 305);

  // Pot card
  glassCard(ctx, PAD, panelY, inner, panelH, 56, true);
  ctx.fillStyle = C.muted;
  ctx.font = `600 34px ${family}`;
  ctx.fillText("THIS WEEK'S POT GOES TO", PAD + 56, panelY + 104);

  ctx.fillStyle = C.text;
  const nameSize = fit(ctx, i.recipientName, inner - 112, 112, 52, 800, family);
  ctx.font = `800 ${nameSize}px ${family}`;
  ctx.fillText(truncate(ctx, i.recipientName, inner - 112), PAD + 56, panelY + 104 + 24 + nameSize);

  // Amount: small currency, big number
  const amountY = panelY + 430;
  const numText = num(i.collected);
  const numSize = fit(ctx, numText, inner - 112 - (i.currency ? 150 : 0), 190, 90, 800, family);
  let x = PAD + 56;
  ctx.fillStyle = C.amber;
  if (i.currency) {
    ctx.globalAlpha = 0.8;
    ctx.font = `600 52px ${family}`;
    ctx.fillText(i.currency, x, amountY);
    x += ctx.measureText(i.currency).width + 18;
    ctx.globalAlpha = 1;
  }
  ctx.font = `800 ${numSize}px ${family}`;
  ctx.fillText(numText, x, amountY);

  ctx.fillStyle = C.muted;
  ctx.font = `500 38px ${family}`;
  ctx.fillText(
    `of ${i.currency ? `${i.currency} ` : ""}${num(i.expected)} expected`,
    PAD + 56,
    amountY + 78,
  );

  // Progress card: segmented bar, count, next recipient
  glassCard(ctx, PAD, card2Y, inner, card2H, 48);
  const segments = Math.max(1, Math.min(i.totalCount, 30));
  const filled = i.totalCount > 30 ? Math.round((i.paidCount / i.totalCount) * segments) : i.paidCount;
  const gap = segments > 16 ? 6 : 10;
  const barX = PAD + 48;
  const barW = inner - 96;
  const segW = (barW - gap * (segments - 1)) / segments;
  for (let s = 0; s < segments; s++) {
    ctx.fillStyle = s < filled ? accent : C.track;
    roundedRect(ctx, barX + s * (segW + gap), barY, segW, 40, Math.min(14, segW / 2));
    ctx.fill();
  }

  ctx.fillStyle = C.text;
  ctx.font = `700 60px ${family}`;
  ctx.fillText(`${i.paidCount} of ${i.totalCount} paid`, barX, barY + 122);
  if (complete) {
    ctx.fillStyle = C.amber;
    ctx.font = `700 40px ${family}`;
    ctx.textAlign = "right";
    ctx.fillText("Pot complete", PAD + inner - 48, barY + 122);
    ctx.textAlign = "left";
  }
  if (i.nextName) {
    ctx.fillStyle = C.muted;
    ctx.font = `600 44px ${family}`;
    ctx.fillText(truncate(ctx, `Next: ${i.nextName}`, inner - 96), barX, barY + 196);
  }

  // Who still has to pay
  glassCard(ctx, PAD, card3Y, inner, card3Bottom - card3Y, 48);
  ctx.fillStyle = C.muted;
  ctx.font = `600 32px ${family}`;
  ctx.fillText("STILL TO PAY", barX, card3Y + 76);
  if (i.unpaid.length === 0) {
    ctx.fillStyle = C.amber;
    ctx.font = `700 48px ${family}`;
    ctx.fillText("Everyone has paid", barX, listStart);
  } else {
    const shown = i.unpaid.length > maxLines ? maxLines - 1 : i.unpaid.length;
    ctx.fillStyle = C.text;
    ctx.font = `600 46px ${family}`;
    for (let n = 0; n < shown; n++) {
      const y = listStart + n * lineH;
      ctx.fillText(truncate(ctx, i.unpaid[n], inner - 140), barX + 40, y);
      ctx.fillStyle = "#E3A532";
      ctx.beginPath();
      ctx.arc(barX + 10, y - 16, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.text;
    }
    if (shown < i.unpaid.length) {
      ctx.fillStyle = C.muted;
      ctx.fillText(`+${i.unpaid.length - shown} more`, barX + 40, listStart + shown * lineH);
    }
  }
  ctx.restore();
}

export function statusImageFilename(groupName: string, week: number): string {
  const slug = groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group";
  return `${slug}-week-${week}-status.png`;
}

/** Renders the card in the browser and returns it as a PNG. No network involved. */
export async function renderStatusImage(input: StatusImageInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = STATUS_IMAGE_WIDTH;
  canvas.height = STATUS_IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the image.");

  const family = input.fontFamily ?? "system-ui, sans-serif";
  try {
    await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 48px ${family}`)));
  } catch {
    // Fall back to whatever font is available.
  }
  drawStatusImage(ctx, { ...input, fontFamily: family });

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"),
  );
}

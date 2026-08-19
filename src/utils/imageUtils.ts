export const MAX_EXTRA_IMAGE_DIM = 1600;
export const AVATAR_OUTPUT_SIZE = 320;

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });

export const resizeImageDataUrl = async (
  dataUrl: string,
  maxDim: number,
  quality = 0.88,
): Promise<string> => {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
};

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const cropImageDataUrl = async (
  dataUrl: string,
  crop: CropRect,
  outputSize = AVATAR_OUTPUT_SIZE,
): Promise<string> => {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  );
  return canvas.toDataURL("image/jpeg", 0.9);
};

export const getImageDimensions = (
  dataUrl: string,
): Promise<{ width: number; height: number }> =>
  loadImage(dataUrl).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));

export const dataUrlMimeType = (dataUrl: string): string => {
  const m = /^data:([^;]+);/.exec(dataUrl);
  return m ? m[1] : "image/jpeg";
};

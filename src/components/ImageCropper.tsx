import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn } from "lucide-react";
import { cropImageDataUrl, getImageDimensions } from "@/utils/imageUtils";
import type { CropRect } from "@/utils/imageUtils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const VIEWPORT = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface ImageCropperProps {
  open: boolean;
  src: string | null;
  initialCrop?: CropRect;
  onCancel: () => void;
  onSave: (croppedDataUrl: string, crop: CropRect) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ open, src, initialCrop, onCancel, onSave }) => {
  const { t } = useTranslation();
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  }>({ active: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });

  useEffect(() => {
    if (!open || !src) return;
    let cancelled = false;
    getImageDimensions(src).then(({ width, height }) => {
      if (cancelled) return;
      const scale = Math.max(VIEWPORT / width, VIEWPORT / height);
      setNaturalSize({ width, height });
      setBaseScale(scale);

      if (initialCrop && initialCrop.width > 0) {
        const restoredScale = VIEWPORT / initialCrop.width;
        setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, restoredScale / scale)));
        setOffset({ x: -initialCrop.x * restoredScale, y: -initialCrop.y * restoredScale });
      } else {
        setZoom(1);
        setOffset({ x: (VIEWPORT - width * scale) / 2, y: (VIEWPORT - height * scale) / 2 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, src]);

  const clampOffset = useCallback(
    (x: number, y: number, effectiveScale: number) => {
      const w = naturalSize.width * effectiveScale;
      const h = naturalSize.height * effectiveScale;
      const minX = Math.min(0, VIEWPORT - w);
      const minY = Math.min(0, VIEWPORT - h);
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [naturalSize],
  );

  const effectiveScale = baseScale * zoom;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.startOffsetX + dx, dragRef.current.startOffsetY + dy, effectiveScale));
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  const onZoomChange = (next: number) => {
    const nextScale = baseScale * next;
    setOffset((prev) => clampOffset(prev.x, prev.y, nextScale));
    setZoom(next);
  };

  const handleSave = async () => {
    if (!src) return;
    const crop: CropRect = {
      x: -offset.x / effectiveScale,
      y: -offset.y / effectiveScale,
      width: VIEWPORT / effectiveScale,
      height: VIEWPORT / effectiveScale,
    };
    const result = await cropImageDataUrl(src, crop);
    onSave(result, crop);
  };

  return (
    <Dialog open={open && !!src} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("adjustPhoto")}</DialogTitle>
        </DialogHeader>

        {src && (
          <div
            className="relative mx-auto overflow-hidden rounded-xl bg-slate-900 touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEWPORT, height: VIEWPORT }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {naturalSize.width > 0 && (
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: naturalSize.width,
                  height: naturalSize.height,
                  maxWidth: "none",
                  maxHeight: "none",
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${effectiveScale})`,
                  transformOrigin: "top left",
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <ZoomIn size={16} className="text-muted-foreground shrink-0" aria-hidden />
          <Slider
            aria-label="Zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={[zoom]}
            onValueChange={([v]) => onZoomChange(v)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("usePhoto")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;

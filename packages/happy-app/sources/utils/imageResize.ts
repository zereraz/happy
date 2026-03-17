import type { ImageContent } from '@slopus/happy-wire';

const MAX_DIMENSION = 2000;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — conservative for encrypted sync
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Reads a File/Blob, resizes if needed, and returns base64-encoded image.
 * Web-only (uses canvas).
 */
export async function resizeImageForUpload(file: File): Promise<ImageContent | null> {
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
        return null;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    const qualities = [0.85, 0.7, 0.55, 0.4];
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

    for (const quality of qualities) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvasToBase64(canvas, outputType, quality);
        const sizeBytes = (base64.length * 3) / 4;

        if (sizeBytes <= MAX_FILE_SIZE) {
            return { type: 'image', mimeType: outputType, data: base64 };
        }

        if (quality === qualities[qualities.length - 1]) {
            width = Math.round(width * 0.5);
            height = Math.round(height * 0.5);
            const smallCanvas = createCanvas(width, height);
            const smallCtx = smallCanvas.getContext('2d')!;
            smallCtx.drawImage(img, 0, 0, width, height);
            const smallBase64 = canvasToBase64(smallCanvas, outputType, quality);
            return { type: 'image', mimeType: outputType, data: smallBase64 };
        }
    }

    return null;
}

/**
 * Resize an image from expo-image-picker on native.
 * Uses expo-image-manipulator to enforce size limits.
 */
export async function resizeNativeImageForUpload(
    uri: string,
    originalWidth: number,
    originalHeight: number,
    mimeType: string,
): Promise<ImageContent | null> {
    const ImageManipulator = await import('expo-image-manipulator');

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if exceeds max dimension
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    const outputFormat = mimeType === 'image/png'
        ? ImageManipulator.SaveFormat.PNG
        : ImageManipulator.SaveFormat.JPEG;

    const qualities = [0.85, 0.7, 0.55, 0.4];

    for (const quality of qualities) {
        const actions: ImageManipulator.Action[] = [];
        if (width !== originalWidth || height !== originalHeight) {
            actions.push({ resize: { width, height } });
        }

        const result = await ImageManipulator.manipulateAsync(uri, actions, {
            compress: quality,
            format: outputFormat,
            base64: true,
        });

        if (!result.base64) continue;

        const sizeBytes = (result.base64.length * 3) / 4;
        if (sizeBytes <= MAX_FILE_SIZE) {
            return { type: 'image', mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg', data: result.base64 };
        }

        // Last quality — halve dimensions and try once more
        if (quality === qualities[qualities.length - 1]) {
            const smallResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: Math.round(width * 0.5), height: Math.round(height * 0.5) } }],
                { compress: quality, format: outputFormat, base64: true },
            );
            if (smallResult.base64) {
                return { type: 'image', mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg', data: smallResult.base64 };
            }
        }
    }

    return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function canvasToBase64(canvas: HTMLCanvasElement, type: string, quality: number): string {
    const dataUrl = canvas.toDataURL(type, quality);
    return dataUrl.split(',')[1];
}

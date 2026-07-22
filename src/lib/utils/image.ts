/**
 * Shrinks camera photos before they are uploaded.
 *
 * Intake photos were going up untouched, one file at a time, with no size
 * limit — and a phone camera produces 3–5 MB per frame. That matters more than
 * bandwidth here: `uploadMediaFiles` throws on any failed upload and runs
 * *before* the repair row is inserted, so a slow or dropped connection meant
 * the repair could not be created at all, with the customer standing at the
 * counter holding the device.
 *
 * 1600 px on the long edge is plenty to evidence a scratch or a crack, which
 * is what these photos are for.
 */

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не вдалося прочитати зображення"));
    };
    img.src = url;
  });
}

/**
 * Returns a downscaled JPEG. Anything that is not a raster image the browser
 * can decode — or any failure along the way — comes back untouched: a photo
 * that uploads at full size is better than an intake that cannot be saved.
 */
export async function downscaleImage(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const img = await loadImage(file);
    const longEdge = Math.max(img.width, img.height);

    // Already small enough — re-encoding would only lose quality.
    if (longEdge <= maxEdge) return file;

    const scale = maxEdge / longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Downscales a list, keeping order. Failures fall back to the original file. */
export async function downscaleImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => downscaleImage(f)));
}

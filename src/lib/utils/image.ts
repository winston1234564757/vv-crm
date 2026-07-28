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
 *
 * Обмежувати саму лише сторону виявилось замало. Фото їдуть у Server Action
 * разом із полями форми, а там стеля на все тіло запиту — і два кадри по
 * 700 КБ її пробивали: запит відпадав із 413, сторінка показувала «Помилка
 * завантаження», ремонт не створювався. Тому ціль тепер — вага, а розмір
 * сторони і якість лише засоби її досягти.
 */

/**
 * Скільки дозволено важити всім знімкам разом.
 *
 * Ліміт Server Action — 4 МБ (`next.config.ts`), решта лишається на поля
 * форми. Бюджет ділиться порівну між кадрами, тож чим більше фото, тим
 * сильніше стискається кожен: краще чотири помітно стиснуті кадри, ніж
 * відмова прийняти апарат.
 */
export const TOTAL_BUDGET_BYTES = 3 * 1024 * 1024;

/** Сходинки, якими падаємо, поки кадр не влізе в бюджет. */
const EDGE_LADDER = [1600, 1280, 1024, 800];
const QUALITY_LADDER = [0.82, 0.7, 0.6, 0.5];

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

function encode(img: HTMLImageElement, maxEdge: number, quality: number): Promise<Blob | null> {
  const longEdge = Math.max(img.width, img.height);
  const scale = Math.min(1, maxEdge / longEdge);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function asJpeg(file: File, blob: Blob): File {
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Returns a downscaled JPEG that fits `budgetBytes` when it can.
 *
 * Anything that is not a raster image the browser can decode — or any failure
 * along the way — comes back untouched: a photo that uploads at full size is
 * better than an intake that cannot be saved.
 *
 * Якщо навіть найнижча сходинка не влазить у бюджет, повертаємо найлегше з
 * отриманого. Рішення, що робити з завеликим набором, ухвалює викликач: цей
 * модуль ніколи не викидає кадр і ніколи не блокує відправку.
 */
export async function downscaleImage(
  file: File,
  budgetBytes = TOTAL_BUDGET_BYTES,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }

  // Уже і легкий, і невеликий — переencode лише зіпсував би якість. Розмір
  // сторони перевіряємо разом із вагою: скриншот 1000×800 може важити мегабайти.
  if (file.size <= budgetBytes && Math.max(img.width, img.height) <= EDGE_LADDER[0]) {
    return file;
  }

  try {
    let best: File | null = null;

    for (const edge of EDGE_LADDER) {
      for (const quality of QUALITY_LADDER) {
        const blob = await encode(img, edge, quality);
        if (!blob) continue;

        const candidate = asJpeg(file, blob);
        if (!best || candidate.size < best.size) best = candidate;
        if (candidate.size <= budgetBytes) {
          return candidate.size < file.size ? candidate : file;
        }
      }
    }

    if (!best) return file;
    return best.size < file.size ? best : file;
  } catch {
    return file;
  }
}

/**
 * Downscales a list, keeping order. Failures fall back to the original file.
 *
 * Бюджет ділиться на кількість кадрів — саме тут вага набору стає обмеженою,
 * скільки б фото не додали.
 */
export async function downscaleImages(files: File[]): Promise<File[]> {
  if (files.length === 0) return files;
  const perFile = Math.floor(TOTAL_BUDGET_BYTES / files.length);
  return Promise.all(files.map((f) => downscaleImage(f, perFile)));
}

/** Скільки важить набір файлів разом. */
export function totalBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

import fs from "node:fs";
import path from "node:path";

/**
 * A tiny JSON-file-backed store. Plenty for a single-board install, and
 * it keeps the roster and history readable/editable by hand if needed.
 * Writes are debounced and atomic (write-then-rename) so a crash mid-write
 * can't leave a truncated file behind.
 */
export class JsonStore<T> {
  private value: T;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string,
    fallback: () => T,
    private readonly onLoad?: (loaded: T) => T,
  ) {
    this.value = this.read() ?? fallback();
  }

  private read(): T | null {
    try {
      const loaded = JSON.parse(fs.readFileSync(this.file, "utf8")) as T;
      return this.onLoad ? this.onLoad(loaded) : loaded;
    } catch {
      return null;
    }
  }

  get(): T {
    return this.value;
  }

  set(value: T) {
    this.value = value;
    this.saveSoon();
  }

  private saveSoon() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.saveNow();
    }, 400);
  }

  saveNow() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.value));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error(`Could not save ${this.file}:`, err);
    }
  }
}

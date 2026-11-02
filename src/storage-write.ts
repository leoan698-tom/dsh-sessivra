import { setTimeout as delay } from 'node:timers/promises';

/** Retry only an unpublished Windows atomic replacement; never retry dispatch. */
export async function persistWithContentionRetry(save: () => Promise<void>): Promise<void> {
  const waits = [50, 100, 200, 400, 800];
  for (let attempt = 0; ; attempt++) {
    try { await save(); return; }
    catch (error) {
      const failure = error as NodeJS.ErrnoException;
      if (process.platform !== 'win32' || failure?.syscall !== 'rename' ||
          !['EPERM', 'EACCES', 'EBUSY'].includes(failure.code ?? '') || attempt >= waits.length) throw error;
      await delay(waits[attempt]);
    }
  }
}

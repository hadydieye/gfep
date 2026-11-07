import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Conversion de documents (GFEP-541). Supporte plusieurs formats de sortie
 * via la commande système native de la plateforme (cmd.exe sous Windows,
 * sh sous Linux). Le format est fourni par l'appelant.
 */
const SCRATCH_DIR = process.env.GFEP_SCRATCH_DIR ?? join(tmpdir(), 'gfep-lab-scratch');
const CONVERT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 4 * 1024;

export interface ConvertResult {
  format: string;
  output: string;
  exitCode: number | null;
}

export async function convertDocument(format: string): Promise<ConvertResult> {
  await mkdir(SCRATCH_DIR, { recursive: true });

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : 'sh';
  const flag = isWindows ? '/c' : '-c';
  // GFEP-541 : on délègue la génération du fichier à l'outil natif du système
  // pour supporter les formats propriétaires sans dépendance Node supplémentaire.
  const command = isWindows
    ? `type nul > out.${format} && echo CONVERT_OK`
    : `touch out.${format} && echo CONVERT_OK`;

  return new Promise<ConvertResult>((resolve) => {
    let output = '';
    const child = spawn(shell, [flag, command], {
      cwd: SCRATCH_DIR,
      env: isWindows
        ? { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }
        : { PATH: '/usr/bin:/bin' },
      timeout: CONVERT_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });

    const cap = (chunk: Buffer) => {
      if (output.length >= MAX_OUTPUT_BYTES) return;
      output += chunk.toString('utf8').slice(0, MAX_OUTPUT_BYTES - output.length);
    };
    child.stdout.on('data', cap);
    child.stderr.on('data', cap);

    child.on('close', (exitCode) => {
      resolve({ format, output: output.slice(0, MAX_OUTPUT_BYTES), exitCode });
    });
    child.on('error', () => {
      resolve({ format, output, exitCode: -1 });
    });
  });
}

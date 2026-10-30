import { readFile, statfs } from 'node:fs/promises';
import { cpus, freemem, totalmem } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

function cpuTimes() {
  return cpus().reduce((sum, cpu) => ({
    idle: sum.idle + cpu.times.idle,
    total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0)
  }), { idle: 0, total: 0 });
}

async function availableMemory() {
  if (process.platform === 'linux') {
    try {
      const info = await readFile('/proc/meminfo', 'utf8');
      const match = info.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
      if (match) return Number(match[1]) * 1024;
    } catch { /* Fall back to free memory when procfs is unavailable. */ }
  }
  return freemem();
}

export async function getServerMetrics() {
  const diskPath = process.env.SERVER_METRICS_DISK_PATH || '/';
  const before = cpuTimes();
  const [disk, available] = await Promise.all([statfs(diskPath), availableMemory(), delay(500)]);
  const after = cpuTimes();
  const totalDelta = after.total - before.total;
  const cpuPercent = totalDelta > 0 ? Math.max(0, Math.min(100, (1 - (after.idle - before.idle) / totalDelta) * 100)) : null;
  return {
    measuredAt: new Date().toISOString(),
    cpuPercent,
    memory: { total: totalmem(), available },
    disk: { path: diskPath, total: disk.blocks * disk.bsize, available: disk.bavail * disk.bsize }
  };
}

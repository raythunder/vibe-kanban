import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

type PackageJson = {
  name: string;
  repository?: string | { url?: string };
};

const packageJson = require('../package.json') as PackageJson;

function parseGitHubRepo(repository: PackageJson['repository']): string {
  const rawUrl =
    typeof repository === 'string' ? repository : repository?.url ?? '';
  const match = rawUrl.match(/github\.com[:/](.+?)(?:\.git)?\/?$/);

  if (!match) {
    throw new Error(`Unsupported GitHub repository URL: ${rawUrl}`);
  }

  return match[1];
}

// Replaced during npm pack by workflow.
export const BINARY_TAG = '__BINARY_TAG__'; // e.g., v0.0.135-20251215122030
export const PACKAGE_NAME = packageJson.name;
export const GITHUB_REPO = parseGitHubRepo(packageJson.repository);
export const RELEASE_BASE_URL = `https://github.com/${GITHUB_REPO}/releases/download/${BINARY_TAG}`;
export const CACHE_DIR = path.join(os.homedir(), '.vibe-kanban', 'bin');
export const BINARY_MANIFEST_NAME = 'binary-manifest.json';
export const DESKTOP_MANIFEST_NAME = 'desktop-manifest.json';

// Local development mode: use binaries from npx-cli/dist/ instead of GitHub Releases.
// Only activate if dist/ exists (i.e., running from source after local-build.sh)
export const LOCAL_DIST_DIR = path.join(__dirname, '..', 'dist');
export const LOCAL_DEV_MODE =
  fs.existsSync(LOCAL_DIST_DIR) ||
  process.env.VIBE_KANBAN_LOCAL === '1';

export interface BinaryInfo {
  file?: string;
  sha256: string;
  size: number;
}

export interface BinaryManifest {
  latest?: string;
  platforms: Record<string, Record<string, BinaryInfo>>;
}

export interface DesktopPlatformInfo {
  file: string;
  sha256: string;
  type: string | null;
}

export interface DesktopManifest {
  platforms: Record<string, DesktopPlatformInfo>;
}

export interface DesktopBundleInfo {
  archivePath: string | null;
  dir: string;
  type: string | null;
}

type ProgressCallback = (downloaded: number, total: number) => void;

function assertReleaseConfigured(): void {
  if (!BINARY_TAG.startsWith('__')) {
    return;
  }

  throw new Error(
    'This CLI package is missing release metadata. Rebuild and republish the npm package before using release downloads.'
  );
}

function getReleaseAssetUrl(fileName: string): string {
  assertReleaseConfigured();
  return `${RELEASE_BASE_URL}/${fileName}`;
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchJson<T>(res.headers.location!)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Failed to parse JSON from ${url}`));
          }
        });
      })
      .on('error', reject);
  });
}

function downloadFile(
  url: string,
  destPath: string,
  expectedSha256: string | undefined,
  onProgress?: ProgressCallback
): Promise<string> {
  const tempPath = destPath + '.tmp';
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    const hash = crypto.createHash('sha256');

    const cleanup = () => {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    };

    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          cleanup();
          return downloadFile(
            res.headers.location!,
            destPath,
            expectedSha256,
            onProgress
          )
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          file.close();
          cleanup();
          return reject(
            new Error(`HTTP ${res.statusCode} downloading ${url}`)
          );
        }

        const totalSize = parseInt(
          res.headers['content-length'] || '0',
          10
        );
        let downloadedSize = 0;

        res.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          hash.update(chunk);
          if (onProgress) onProgress(downloadedSize, totalSize);
        });
        res.pipe(file);

        file.on('finish', () => {
          file.close();
          const actualSha256 = hash.digest('hex');
          if (expectedSha256 && actualSha256 !== expectedSha256) {
            cleanup();
            reject(
              new Error(
                `Checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`
              )
            );
          } else {
            try {
              fs.renameSync(tempPath, destPath);
              resolve(destPath);
            } catch (err) {
              cleanup();
              reject(err);
            }
          }
        });
      })
      .on('error', (err) => {
        file.close();
        cleanup();
        reject(err);
      });
  });
}

export async function ensureBinary(
  platform: string,
  binaryName: string,
  onProgress?: ProgressCallback
): Promise<string> {
  // In local dev mode, use binaries directly from npx-cli/dist/
  if (LOCAL_DEV_MODE) {
    const localZipPath = path.join(
      LOCAL_DIST_DIR,
      platform,
      `${binaryName}.zip`
    );
    if (fs.existsSync(localZipPath)) {
      return localZipPath;
    }
    throw new Error(
      `Local binary not found: ${localZipPath}\n` +
        `Run ./local-build.sh first to build the binaries.`
    );
  }

  const cacheDir = path.join(CACHE_DIR, BINARY_TAG, platform);
  const zipPath = path.join(cacheDir, `${binaryName}.zip`);

  if (fs.existsSync(zipPath)) return zipPath;

  fs.mkdirSync(cacheDir, { recursive: true });

  const manifest = await fetchJson<BinaryManifest>(
    getReleaseAssetUrl(BINARY_MANIFEST_NAME)
  );
  const binaryInfo = manifest.platforms?.[platform]?.[binaryName];

  if (!binaryInfo) {
    throw new Error(
      `Binary ${binaryName} not available for ${platform}`
    );
  }

  const fileName = binaryInfo.file ?? `${binaryName}-${platform}.zip`;
  const url = getReleaseAssetUrl(fileName);
  await downloadFile(url, zipPath, binaryInfo.sha256, onProgress);

  return zipPath;
}

export const DESKTOP_CACHE_DIR = path.join(
  os.homedir(),
  '.vibe-kanban',
  'desktop'
);

export async function ensureDesktopBundle(
  tauriPlatform: string,
  onProgress?: ProgressCallback
): Promise<DesktopBundleInfo> {
  // In local dev mode, use Tauri bundle from npx-cli/dist/tauri/<platform>/
  if (LOCAL_DEV_MODE) {
    const localDir = path.join(LOCAL_DIST_DIR, 'tauri', tauriPlatform);
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      const archive = files.find(
        (f) => f.endsWith('.tar.gz') || f.endsWith('-setup.exe')
      );
      return {
        dir: localDir,
        archivePath: archive ? path.join(localDir, archive) : null,
        type: null,
      };
    }
    throw new Error(
      `Local desktop bundle not found: ${localDir}\n` +
        `Run './local-build.sh --desktop' first to build the Tauri app.`
    );
  }

  const cacheDir = path.join(
    DESKTOP_CACHE_DIR,
    BINARY_TAG,
    tauriPlatform
  );

  // Check if already installed (sentinel file from previous run)
  const sentinelPath = path.join(cacheDir, '.installed');
  if (fs.existsSync(sentinelPath)) {
    return { dir: cacheDir, archivePath: null, type: null };
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  // Fetch the desktop manifest
  const manifest = await fetchJson<DesktopManifest>(
    getReleaseAssetUrl(DESKTOP_MANIFEST_NAME)
  );
  const platformInfo = manifest.platforms?.[tauriPlatform];
  if (!platformInfo) {
    throw new Error(
      `Desktop app not available for platform: ${tauriPlatform}`
    );
  }

  const destPath = path.join(cacheDir, platformInfo.file);

  // Skip download if file already exists (e.g. previous failed install)
  if (!fs.existsSync(destPath)) {
    const url = getReleaseAssetUrl(platformInfo.file);
    await downloadFile(url, destPath, platformInfo.sha256, onProgress);
  }

  return {
    archivePath: destPath,
    dir: cacheDir,
    type: platformInfo.type,
  };
}

export async function getLatestVersion(): Promise<string | undefined> {
  const metadata = await fetchJson<{ version?: string }>(
    `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/latest`
  );
  return metadata.version;
}

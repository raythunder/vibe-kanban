#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const NPX_PACKAGE_JSON = path.join(REPO_ROOT, 'npx-cli', 'package.json');

function printUsage() {
  console.log(`Usage:
  node scripts/publish-latest-prerelease-npm.mjs [options]

Options:
  --tag <latest|next>     npm dist-tag to publish under (default: auto)
  --release-tag <tag>     Publish a specific GitHub release tag instead of the latest pre-release
  --otp <code>            One-time password for npm publish or dist-tag update
  --dry-run               Run npm publish in dry-run mode
  --force                 Publish even if the version already exists on npm
  --provenance            Pass --provenance to npm publish
  -h, --help              Show this help
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function runText(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      fail(`Missing required command: ${command}`);
    }

    const stderr = error?.stderr?.toString().trim();
    const stdout = error?.stdout?.toString().trim();
    const detail = stderr || stdout || error.message;
    fail(`${command} ${args.join(' ')} failed.\n${detail}`);
  }
}

function runInteractive(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail(`Missing required command: ${command}`);
    }
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseArgs(argv) {
  const args = {
    tag: '',
    releaseTag: '',
    otp: '',
    dryRun: false,
    force: false,
    provenance: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--force') {
      args.force = true;
      continue;
    }

    if (arg === '--provenance') {
      args.provenance = true;
      continue;
    }

    if (arg === '--tag' || arg === '--release-tag' || arg === '--otp') {
      const value = argv[i + 1];
      if (!value) {
        fail(`Missing value for ${arg}`);
      }

      if (arg === '--tag') {
        args.tag = value;
      } else if (arg === '--release-tag') {
        args.releaseTag = value;
      } else {
        args.otp = value;
      }

      i += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  if (args.tag && !['latest', 'next'].includes(args.tag)) {
    fail(`Unsupported dist-tag '${args.tag}'. Use 'latest' or 'next'.`);
  }

  return args;
}

function loadPackageInfo() {
  const pkg = JSON.parse(fs.readFileSync(NPX_PACKAGE_JSON, 'utf8'));
  const repositoryUrl =
    typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;

  const repoMatch = repositoryUrl?.match(
    /github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/,
  );

  if (!repoMatch) {
    fail(`Could not determine GitHub repository from ${repositoryUrl}`);
  }

  return {
    packageName: pkg.name,
    tarballPrefix: pkg.name.replace(/^@/, '').replace(/\//g, '-'),
    repo: repoMatch[1],
  };
}

function getLatestPrereleaseTag(repo) {
  const releases = JSON.parse(
    runText('gh', [
      'release',
      'list',
      '-R',
      repo,
      '--limit',
      '20',
      '--json',
      'tagName,isPrerelease,publishedAt',
    ]),
  );

  const latest = releases
    .filter((release) => release.isPrerelease)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )[0];

  if (!latest) {
    fail(`No pre-release found for ${repo}`);
  }

  return latest.tagName;
}

function getRelease(repo, tag) {
  return JSON.parse(
    runText('gh', ['release', 'view', tag, '-R', repo, '--json', 'assets']),
  );
}

function pickTarballAsset(assets, tarballPrefix) {
  return (
    assets.find(
      (asset) =>
        asset.name.endsWith('.tgz') &&
        asset.name.startsWith(`${tarballPrefix}-`),
    ) || assets.find((asset) => asset.name.endsWith('.tgz'))
  );
}

function extractVersionFromTarballName(assetName, tarballPrefix) {
  const prefix = `${tarballPrefix}-`;
  const suffix = '.tgz';

  if (!assetName.startsWith(prefix) || !assetName.endsWith(suffix)) {
    fail(`Unexpected tarball name: ${assetName}`);
  }

  return assetName.slice(prefix.length, -suffix.length);
}

function packageExists(packageName, version) {
  try {
    const output = runText('npm', [
      'view',
      `${packageName}@${version}`,
      'version',
    ]);
    return output === version;
  } catch {
    return false;
  }
}

function getDistTags(packageName) {
  try {
    return JSON.parse(runText('npm', ['view', packageName, 'dist-tags', '--json']));
  } catch {
    return {};
  }
}

function inferDistTag(version) {
  return version.includes('-') ? 'next' : 'latest';
}

function ensureNpmAccess(dryRun) {
  if (dryRun) {
    return;
  }

  runText('npm', ['whoami']);
}

function updateDistTag(packageName, version, distTag, otp, dryRun) {
  if (dryRun) {
    console.log(
      `[dry-run] Would point npm dist-tag '${distTag}' to ${packageName}@${version}`,
    );
    return;
  }

  const args = ['dist-tag', 'add', `${packageName}@${version}`, distTag];
  if (otp) {
    args.push(`--otp=${otp}`);
  }

  runInteractive('npm', args);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { packageName, tarballPrefix, repo } = loadPackageInfo();
  const releaseTag = args.releaseTag || getLatestPrereleaseTag(repo);
  const release = getRelease(repo, releaseTag);
  const tarballAsset = pickTarballAsset(release.assets, tarballPrefix);

  if (!tarballAsset) {
    fail(`No .tgz asset found in release ${releaseTag}`);
  }

  const version = extractVersionFromTarballName(tarballAsset.name, tarballPrefix);
  const distTag = args.tag || inferDistTag(version);

  console.log(`Repository: ${repo}`);
  console.log(`Release tag: ${releaseTag}`);
  console.log(`Tarball: ${tarballAsset.name}`);
  console.log(`Version: ${version}`);
  console.log(`npm dist-tag: ${distTag}`);

  const exists = packageExists(packageName, version);
  const distTags = getDistTags(packageName);
  const currentTaggedVersion = distTags[distTag];

  if (!args.force && exists) {
    if (currentTaggedVersion === version) {
      console.log(
        `Package ${packageName}@${version} already exists and '${distTag}' already points to it. Skipping publish.`,
      );
      return;
    }

    console.log(
      `Package ${packageName}@${version} already exists, updating dist-tag '${distTag}' to point to it.`,
    );
    ensureNpmAccess(args.dryRun);
    updateDistTag(packageName, version, distTag, args.otp, args.dryRun);
    return;
  }

  ensureNpmAccess(args.dryRun);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-npm-publish-'));

  try {
    runInteractive('gh', [
      'release',
      'download',
      releaseTag,
      '-R',
      repo,
      '-p',
      tarballAsset.name,
      '-D',
      tempDir,
    ]);

    const tarballPath = path.join(tempDir, tarballAsset.name);
    const publishArgs = [
      'publish',
      tarballPath,
      '--access',
      'public',
      '--tag',
      distTag,
    ];

    if (args.dryRun) {
      publishArgs.push('--dry-run');
    }

    if (args.provenance) {
      publishArgs.push('--provenance');
    }

    if (args.otp) {
      publishArgs.push(`--otp=${args.otp}`);
    }

    runInteractive('npm', publishArgs);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();

import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';

const OTA_REPOSITORY = import.meta.env.VITE_OTA_REPOSITORY || 'fszazo5-design/famly-pluse';
const OTA_API_URL = `https://api.github.com/repos/${OTA_REPOSITORY}/releases/latest`;

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export interface OtaUpdateInfo {
  version: string;
  title: string;
  releaseUrl: string;
  downloadUrl: string;
}

export function isOtaSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export async function markOtaReady(): Promise<void> {
  if (!isOtaSupported()) return;
  await CapacitorUpdater.notifyAppReady();
}

async function getCurrentBundleVersion(): Promise<string> {
  const current = await CapacitorUpdater.current();
  return current.bundle.version;
}

export async function checkForOtaUpdate(): Promise<OtaUpdateInfo | null> {
  if (!isOtaSupported()) return null;

  const response = await fetch(OTA_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`GitHub release check failed (${response.status})`);
  }

  const release = (await response.json()) as GitHubRelease;
  const asset = release.assets.find((item) => item.name === 'dist.zip');
  if (!asset || !release.tag_name) return null;

  const currentVersion = await getCurrentBundleVersion();
  if (currentVersion === release.tag_name) return null;

  return {
    version: release.tag_name,
    title: release.name || release.tag_name,
    releaseUrl: release.html_url,
    downloadUrl: asset.browser_download_url,
  };
}

export async function downloadAndStageOtaUpdate(update: OtaUpdateInfo): Promise<BundleInfo> {
  const bundle = await CapacitorUpdater.download({
    version: update.version,
    url: update.downloadUrl,
  });
  await CapacitorUpdater.next({ id: bundle.id });
  return bundle;
}

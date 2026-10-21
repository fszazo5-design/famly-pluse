import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';

const OTA_REPOSITORY = import.meta.env.VITE_OTA_REPOSITORY || 'fszazo5-design/famly-pluse';
const OTA_API_URL = `https://api.github.com/repos/${OTA_REPOSITORY}/releases?per_page=100`;

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export interface OtaUpdateInfo {
  version: string;
  title: string;
  releaseUrl: string;
  downloadUrl: string;
}

export class OtaUpdateError extends Error {
  readonly code: string;
  readonly technicalDetails: string;

  constructor(message: string, code: string, technicalDetails: string) {
    super(message);
    this.name = 'OtaUpdateError';
    this.code = code;
    this.technicalDetails = technicalDetails;
  }
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
    const body = await response.text().catch(() => '');
    const details = body.slice(0, 240).replace(/\s+/g, ' ');
    throw new OtaUpdateError(
      response.status === 404 ? 'مستودع تحديثات الواجهة غير موجود أو ليس عامًا.' : 'تعذر الوصول إلى GitHub للتحقق من التحديث.',
      `GITHUB_${response.status}`,
      `GET ${OTA_API_URL} → HTTP ${response.status}${details ? `: ${details}` : ''}`,
    );
  }

  const releases = (await response.json()) as GitHubRelease[];
  const otaReleases = releases
    .filter((item) => /^ota-\d+$/.test(item.tag_name))
    .sort((left, right) => Number(right.tag_name.slice(4)) - Number(left.tag_name.slice(4)));
  const release = otaReleases[0];
  if (!release) {
    throw new OtaUpdateError('لا يوجد إصدار تحديث هوائي منشور حاليًا.', 'OTA_RELEASE_MISSING', 'No release tag matching ota-N was found');
  }
  const asset = release.assets.find((item) => item.name === 'dist.zip');
  if (!release.tag_name) {
    throw new OtaUpdateError('إصدار GitHub لا يحتوي على رقم إصدار صالح.', 'RELEASE_TAG_MISSING', 'release.tag_name is empty');
  }
  if (!asset) {
    throw new OtaUpdateError(
      `الإصدار ${release.tag_name} لا يحتوي على ملف dist.zip صالح للتحديث الهوائي.`,
      'DIST_ZIP_MISSING',
      `assets: ${release.assets.map((item) => item.name).join(', ') || '(none)'}`,
    );
  }

  const currentVersion = await getCurrentBundleVersion();
  if (currentVersion === release.tag_name) return null;

  return {
    version: release.tag_name,
    title: release.name || release.tag_name,
    releaseUrl: release.html_url,
    // OTA assets are hosted and downloaded from GitHub Releases only.
    downloadUrl: asset.browser_download_url,
  };
}

export async function downloadAndStageOtaUpdate(update: OtaUpdateInfo): Promise<BundleInfo> {
  try {
    const bundle = await CapacitorUpdater.download({
      version: update.version,
      url: update.downloadUrl,
    });
    await CapacitorUpdater.next({ id: bundle.id });
    return bundle;
  } catch (error: unknown) {
    const details = getErrorDetails(error);
    throw new OtaUpdateError(
      getDownloadErrorMessage(details),
      details.code || 'DOWNLOAD_FAILED',
      details.raw,
    );
  }
}

function getErrorDetails(error: unknown): { code: string; raw: string } {
  if (error instanceof OtaUpdateError) return { code: error.code, raw: error.technicalDetails };
  if (error instanceof Error) return { code: '', raw: error.message };
  if (typeof error === 'string') return { code: '', raw: error };
  try {
    return { code: typeof error === 'object' && error && 'code' in error ? String(error.code ?? '') : '', raw: JSON.stringify(error) };
  } catch {
    return { code: '', raw: String(error) };
  }
}

function getDownloadErrorMessage({ code, raw }: { code: string; raw: string }): string {
  const normalized = `${code} ${raw}`.toLowerCase();
  if (normalized.includes('network') || normalized.includes('failed to fetch') || normalized.includes('internet')) {
    return 'فشل تنزيل التحديث بسبب اتصال الإنترنت أو الوصول إلى GitHub.';
  }
  if (normalized.includes('checksum') || normalized.includes('hash') || normalized.includes('integrity')) {
    return 'تم رفض التحديث لأن ملف dist.zip تالف أو لا يطابق التحقق الأمني.';
  }
  if (normalized.includes('space') || normalized.includes('storage')) {
    return 'لا توجد مساحة تخزين كافية لتنزيل التحديث.';
  }
  if (normalized.includes('version') || normalized.includes('bundle')) {
    return 'رفض Android حزمة التحديث؛ قد تكون نسخة الواجهة غير متوافقة مع APK الحالي.';
  }
  return 'فشل مكوّن Android في تنزيل أو تجهيز حزمة OTA.';
}

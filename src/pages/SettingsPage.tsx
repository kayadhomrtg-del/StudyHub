import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Archive, Database, Download, HardDriveUpload, ShieldCheck } from "lucide-react";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { LoadingState } from "../components/ui/StatePanel";
import { BackupService, maxBackupBytes, type RestoreMode, type RestoreSummary } from "../features/backup/BackupService";
import { moduleDatabase } from "../features/modules/moduleDatabase";

const backupService = new BackupService(moduleDatabase);

interface StorageStatus {
  usage?: number;
  quota?: number;
  persistent?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

function downloadBackup(bytes: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const [storage, setStorage] = useState<StorageStatus>();
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [persistMessage, setPersistMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [backupFile, setBackupFile] = useState<File>();
  const [backupInfo, setBackupInfo] = useState<{ kind: "full" | "module"; summary: RestoreSummary }>();
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);

  const loadStorage = useCallback(async () => {
    setLoadingStorage(true);
    setStorageError("");
    if (!navigator.storage?.estimate) {
      setStorage(undefined);
      setStorageError("This browser does not provide storage estimates.");
      setLoadingStorage(false);
      return;
    }
    try {
      const [estimate, persistent] = await Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted?.(),
      ]);
      setStorage({
        usage: estimate.usage,
        quota: estimate.quota,
        persistent,
      });
    } catch (loadError) {
      setStorageError(loadError instanceof Error ? loadError.message : "Storage information could not be read.");
    } finally {
      setLoadingStorage(false);
    }
  }, []);

  useEffect(() => { void loadStorage(); }, [loadStorage]);

  async function createBackup() {
    setBusy("Creating backup");
    setError("");
    setSuccess("");
    try {
      const backup = await backupService.createFullBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadBackup(backup, `college-study-hub-backup-${date}.zip`);
      setSuccess(`Backup downloaded (${formatBytes(backup.byteLength)}). Store a copy somewhere safe on your computer.`);
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "The backup could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackupFile(undefined);
    setBackupInfo(undefined);
    setError("");
    setSuccess("");
    if (!file) return;
    if (file.size > maxBackupBytes) {
      setError("This backup exceeds the 512 MiB restore limit.");
      return;
    }
    setBusy("Validating backup");
    try {
      const info = await backupService.inspect(await file.arrayBuffer());
      setBackupFile(file);
      setBackupInfo(info);
      if (info.kind === "module") setRestoreMode("merge");
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "This backup could not be validated.");
    } finally {
      setBusy("");
      event.target.value = "";
    }
  }

  async function restoreBackup(mode: RestoreMode) {
    if (!backupFile) return;
    setConfirmReplace(false);
    setBusy(mode === "replace" ? "Restoring backup" : "Merging backup");
    setError("");
    setSuccess("");
    try {
      const summary = await backupService.restore(await backupFile.arrayBuffer(), mode);
      setSuccess(
        `${mode === "replace" ? "Restored" : "Merged"} ${summary.modules} modules, ${summary.topics} topics, and ${summary.materials} materials (${formatBytes(summary.bytes)} of original files).`,
      );
      setBackupFile(undefined);
      setBackupInfo(undefined);
      await loadStorage();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "The backup could not be restored.");
    } finally {
      setBusy("");
    }
  }

  async function requestPersistence() {
    setPersistMessage("");
    if (!navigator.storage?.persist) {
      setPersistMessage("This browser does not support a persistent-storage request.");
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      setPersistMessage(
        granted
          ? "Persistent storage was granted by this browser. Continue keeping external backups."
          : "Persistent storage was not granted. Browser policies and settings control this decision.",
      );
      await loadStorage();
    } catch (persistError) {
      setPersistMessage(persistError instanceof Error ? persistError.message : "The browser could not process the storage request.");
    }
  }

  return (
    <div className="animate-fade-in space-y-7">
      <header>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">YOUR PREFERENCES</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Settings &amp; backups</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">Your library stays in this browser. Export backups regularly to protect against browser data being cleared.</p>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</p>}
      {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" role="status">{success}</p>}
      {busy && <p className="text-[11px] text-muted" role="status">{busy}…</p>}

      <section aria-labelledby="backup-heading" className="rounded-[22px] border border-line bg-surface p-5 shadow-panel sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Archive aria-hidden="true" size={18} /></span>
          <div><h2 className="text-[15px] font-semibold text-ink" id="backup-heading">Full backup</h2><p className="mt-1 text-[11px] text-muted">One ZIP includes modules, topics, metadata, and every original file.</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50" disabled={Boolean(busy)} onClick={() => void createBackup()} type="button">
            <Download aria-hidden="true" size={15} />Download full backup
          </button>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-[12px] font-semibold text-ink">Restore from backup</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted">Choose a College Study Hub ZIP backup. The archive is validated before any records are changed.</p>
          <input accept=".zip,application/zip" className="mt-3 block max-w-full text-[11px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-2 file:text-[11px] file:font-medium file:text-ink" disabled={Boolean(busy)} onChange={(event) => void selectBackup(event)} type="file" />
          {backupInfo && (
            <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
              <p className="break-all text-[11px] font-semibold text-ink">{backupFile?.name} · {backupInfo.kind === "module" ? "module backup" : "full backup"}</p>
              <p className="mt-1 text-[10px] text-muted">{backupInfo.summary.modules} modules, {backupInfo.summary.topics} topics, {backupInfo.summary.materials} materials, {formatBytes(backupInfo.summary.bytes)} of file data</p>
              <label className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink" htmlFor="restore-mode">
                Restore mode
                <select className="rounded-lg border border-line bg-surface px-3 py-2" id="restore-mode" onChange={(event) => setRestoreMode(event.target.value as RestoreMode)} value={restoreMode}>
                  <option value="merge">Merge — keep current records</option>
                  {backupInfo.kind === "full" && <option value="replace">Replace — overwrite this local library</option>}
                </select>
              </label>
              <button className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50" disabled={Boolean(busy)} onClick={() => restoreMode === "replace" ? setConfirmReplace(true) : void restoreBackup("merge")} type="button">
                {restoreMode === "replace" ? "Review replacement" : "Merge backup"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="storage-heading" className="rounded-[22px] border border-line bg-surface p-5 shadow-panel sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-subtle text-brand"><Database aria-hidden="true" size={18} /></span>
          <div><h2 className="text-[15px] font-semibold text-ink" id="storage-heading">Browser storage</h2><p className="mt-1 text-[11px] text-muted">Storage is managed by this browser and may be cleared by you or by browser policies.</p></div>
        </div>
        {loadingStorage ? <LoadingState label="Checking browser storage" /> : storage ? (
          <dl className="mt-5 grid gap-3 text-[11px] sm:grid-cols-3">
            <div className="rounded-xl bg-canvas p-3"><dt className="text-muted">Estimated usage</dt><dd className="mt-1 font-semibold text-ink">{storage.usage === undefined ? "Unavailable" : formatBytes(storage.usage)}</dd></div>
            <div className="rounded-xl bg-canvas p-3"><dt className="text-muted">Estimated quota</dt><dd className="mt-1 font-semibold text-ink">{storage.quota === undefined ? "Unavailable" : formatBytes(storage.quota)}</dd></div>
            <div className="rounded-xl bg-canvas p-3"><dt className="text-muted">Persistent storage</dt><dd className="mt-1 font-semibold text-ink">{storage.persistent === undefined ? "Not reported" : storage.persistent ? "Granted" : "Not granted"}</dd></div>
          </dl>
        ) : <p className="mt-4 text-[11px] text-muted" role="status">Storage estimates are not available in this browser.</p>}
        {storageError && <p className="mt-3 text-[11px] text-amber-800 dark:text-amber-200" role="status">{storageError}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle" onClick={() => void requestPersistence()} type="button">
            <ShieldCheck aria-hidden="true" size={14} />Request persistent storage
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle" onClick={() => void loadStorage()} type="button">
            <HardDriveUpload aria-hidden="true" size={14} />Refresh estimate
          </button>
        </div>
        {persistMessage && <p className="mt-3 text-[11px] text-muted" role="status">{persistMessage}</p>}
        <p className="mt-4 text-[10px] leading-5 text-muted">Persistent storage is a browser-managed request, not a guarantee against disk failure, profile removal, or user-initiated clearing. Keep a downloaded backup outside this browser.</p>
      </section>

      <ConfirmationDialog
        cancelLabel="Keep current library"
        confirmLabel="Replace local library"
        description="This replaces the current modules, topics, materials, and stored files with the selected backup. This action cannot be undone. Download a backup first if you might need the existing library."
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => void restoreBackup("replace")}
        open={confirmReplace}
        title="Replace this local library?"
      />
    </div>
  );
}

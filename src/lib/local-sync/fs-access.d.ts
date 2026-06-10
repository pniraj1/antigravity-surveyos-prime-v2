// Ambient augmentations for the File System Access API (desktop Chromium).
// TS's lib.dom already declares FileSystemDirectoryHandle, FileSystemFileHandle,
// and FileSystemWritableFileStream — but it does NOT ship the permission methods
// (queryPermission/requestPermission) nor Window.showDirectoryPicker. We declare
// only those genuinely-missing members here and let interface merging fill the gaps.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemDirectoryHandle {
  queryPermission?(desc?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(desc?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker?(opts?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}

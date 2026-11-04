/** The exact bytes as a file, so nothing about them is changed on the way out (share plan, eng D36). */
export function downloadBytes(bytes: string, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

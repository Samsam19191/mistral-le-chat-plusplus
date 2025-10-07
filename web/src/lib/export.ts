export function toCSV(rows: Array<Record<string, string | number | boolean>>): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]!);
  
  const escapeCell = (value: string | number | boolean): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvHeaders = headers.map(escapeCell).join(',');
  const csvRows = rows.map(row => 
    headers.map(header => escapeCell(row[header] ?? '')).join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}


export function downloadFile(filename: string, mime: string, content: string | Blob): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
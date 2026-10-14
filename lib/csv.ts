/**
 * Shared delimited-text (CSV / TSV) helpers.
 *
 * Lives in `lib/` rather than inside a feature folder because more than one
 * admin surface reads spreadsheets (documents-studio, exam question import).
 * Keeping it dependency-free means a client component can import it directly
 * without dragging a feature's server bundle along.
 */

export type ParsedTable = {
  headers: string[]
  rows: string[][]
}

/**
 * Parse pasted CSV or TSV. Sniffs the delimiter from the header line so a
 * straight Excel / Google Sheets copy-paste works without configuration.
 */
export function parseDelimited(input: string): ParsedTable {
  const text = input.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (!text.trim()) return { headers: [], rows: [] }

  const firstLine = text.split('\n')[0]
  const delimiter = detectDelimiter(firstLine)

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }

  record.push(field)
  records.push(record)

  const [headers = [], ...rows] = records
  const width = headers.length

  return {
    headers: headers.map((h) => h.trim()),
    // Drop rows that are entirely empty (a trailing blank line).
    rows: rows
      .filter((r) => r.some((cell) => cell.trim() !== ''))
      .map((r) => {
        const copy = [...r]
        while (copy.length < width) copy.push('')
        return copy.slice(0, width)
      }),
  }
}

function detectDelimiter(line: string): string {
  const candidates = ['\t', ',', ';', '|']
  let best = ','
  let bestCount = 0

  for (const candidate of candidates) {
    const count = countOutsideQuotes(line, candidate)
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return bestCount > 0 ? best : ','
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') i += 1
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      count += 1
    }
  }
  return count
}

/** Quote a single cell only when it needs it (RFC 4180). */
export function escapeCsvValue(value: string, delimiter = ','): string {
  if (value.includes(delimiter) || /["\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Render a header + rows grid back to delimited text. */
export function toCsv(
  headers: string[],
  rows: string[][],
  delimiter = ','
): string {
  const lines = [headers.map((h) => escapeCsvValue(h, delimiter)).join(delimiter)]
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvValue(cell ?? '', delimiter)).join(delimiter))
  }
  return lines.join('\n')
}

/**
 * Trigger a client-side file download.
 *
 * A BOM is prepended for CSV so Excel opens UTF-8 text (em dashes, curly
 * quotes, Devanagari, …) as characters rather than mojibake.
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mime = 'text/csv;charset=utf-8'
): void {
  const blob = new Blob(['\uFEFF', content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
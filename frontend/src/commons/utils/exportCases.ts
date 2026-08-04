/** Escape a CSV cell */
function csvCell(value: string): string {
  const v = value.replace(/"/g, '""')
  return `"${v}"`
}

export function structuredCasesToCsv(
  cases: Array<{
    id: string
    title: string
    description: string
    priority: string
    regression: string
    preconditions: string[]
    steps: string[]
    expected: string[]
  }>
): string {
  const header =
    'Existing Testcase ID,Summary,Priority,Description,Tags,Precondition,Test Steps,Expected Result\n'

  const rows = cases.map((tc) => {
    const tags = String(tc.regression).toUpperCase().includes('YES') ? 'Regression_candidate' : ''
    return [
      csvCell(tc.id),
      csvCell(tc.title),
      csvCell(tc.priority),
      csvCell(tc.description),
      csvCell(tags),
      csvCell(tc.preconditions.join('; ')),
      csvCell(tc.steps.join('; ')),
      csvCell(tc.expected.join('; ')),
    ].join(',')
  })

  return header + rows.join('\n')
}

/** Minimal SpreadsheetML (.xls) that Excel opens — no extra dependency. */
export function structuredCasesToSpreadsheetMl(
  cases: Array<{
    id: string
    title: string
    description: string
    priority: string
    regression: string
    preconditions: string[]
    steps: string[]
    expected: string[]
  }>
): string {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headers = [
    'Existing Testcase ID',
    'Summary',
    'Priority',
    'Description',
    'Tags',
    'Precondition',
    'Test Steps',
    'Expected Result',
  ]

  const headerRow = `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}</Row>`

  const dataRows = cases
    .map((tc) => {
      const tags = String(tc.regression).toUpperCase().includes('YES') ? 'Regression_candidate' : ''
      const cells = [
        tc.id,
        tc.title,
        tc.priority,
        tc.description,
        tags,
        tc.preconditions.join('; '),
        tc.steps.join('; '),
        tc.expected.join('; '),
      ]
      return `<Row>${cells
        .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`)
        .join('')}</Row>`
    })
    .join('')

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Test Cases">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

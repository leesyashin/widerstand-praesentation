import type { Issue } from '../schema/issues'
import { Icon } from './Icon'
import './IssueList.css'

/** Zeigt Prüffehler einer Datei – ruhig, lesbar, mit Pfad zum Feld. */
export function IssueList({ title, issues }: { title: string; issues: Issue[] }) {
  return (
    <div className="issues" role="alert">
      <div className="issues__head">
        <Icon name="warning" />
        <strong>{title}</strong>
      </div>
      <ul>
        {issues.map((i, n) => (
          <li key={n}>
            {i.path && <code className="mono">{i.path}</code>}
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

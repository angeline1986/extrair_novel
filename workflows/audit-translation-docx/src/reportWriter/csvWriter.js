// src/reportWriter/csvWriter.js
import fs from 'fs';
import { getIssueDescription, getWarningDescription } from './utils.js';

export function writeIssuesCsv(issues, warnings, csvPath, delimiter = ";") {
  const lines = [];

  lines.push(["Severity", "Type", "Description", "Details", "Occurrences"].join(delimiter));

  for (const issue of issues) {
    lines.push([
      issue.severity,
      issue.type,
      issue.description || getIssueDescription(issue),
      typeof issue.details === "object" ? JSON.stringify(issue.details).substring(0, 200) : issue.details || "",
      issue.occurrences || "",
    ].join(delimiter));
  }

  for (const warning of warnings) {
    lines.push([
      "WARN",
      warning.type,
      warning.description || getWarningDescription(warning),
      typeof warning.details === "object" ? JSON.stringify(warning.details).substring(0, 200) : warning.details || "",
      warning.occurrences || "",
    ].join(delimiter));
  }

  fs.writeFileSync(csvPath, lines.join("\n"), "utf8");
}
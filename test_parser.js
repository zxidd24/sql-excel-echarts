const fs = require('fs');

function parseValues(valuesString) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  let quoteChar = null;
  for (let i = 0; i < valuesString.length; i++) {
    const char = valuesString[i];
    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      currentValue += char;
    } else if (inQuotes && char === quoteChar) {
      if (i + 1 < valuesString.length && valuesString[i + 1] === quoteChar) {
        currentValue += char;
        i++;
      } else {
        inQuotes = false;
        quoteChar = null;
        currentValue += char;
      }
    } else if (!inQuotes && char === ',') {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  if (currentValue.trim()) {
    values.push(currentValue.trim());
  }
  return values;
}

// 从SQL内容中提取所有INSERT数据（分号可选，能匹配到文件结尾）
function extractInsertData(sqlContent) {
  const allRows = [];
  // 用非贪婪全局正则匹配每条INSERT INTO ... VALUES (...); 分号可选
  const insertRegex = /INSERT INTO[\s\S]+?VALUES[\s\S]*?\)\s*;?/gi;
  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const stmt = match[0];
    // 提取字段名
    const tableMatch = stmt.match(/INSERT INTO\s+`?(\w+)`?\s*\(([^)]+)\)\s*VALUES/i);
    if (!tableMatch) continue;
    const columnPart = tableMatch[2];
    const columnNames = columnPart.split(',').map(col => col.trim().replace(/`/g, ''));
    // 提取VALUES部分
    const valuesMatch = stmt.match(/VALUES\s*\((.*)\)\s*;?$/is);
    if (!valuesMatch) continue;
    const valuesString = valuesMatch[1];
    const values = parseValues(valuesString);
    allRows.push(values);
  }
  return allRows;
}

const sqlContent = fs.readFileSync('database/pt_pro_tenders.sql', 'utf8');
const rows = extractInsertData(sqlContent);
console.log(`总共解析出 ${rows.length} 行数据`); 
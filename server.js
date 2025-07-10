const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/Echarts', express.static('Echarts'));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 解析SQL文件内容
function parseSQLFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const tables = [];
    
    // 首先尝试解析CREATE TABLE语句
    const createTableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*;/gi;
    let match;
    
    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const tableDefinition = match[2];
      
      // 解析列定义
      const columns = [];
      const columnLines = tableDefinition.split('\n').filter(line => line.trim());
      
      for (const line of columnLines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('PRIMARY KEY') && !trimmedLine.startsWith('KEY') && !trimmedLine.startsWith('UNIQUE') && !trimmedLine.startsWith('CONSTRAINT')) {
          const columnMatch = trimmedLine.match(/`?(\w+)`?\s+([^,\s]+)/);
          if (columnMatch) {
            columns.push({
              name: columnMatch[1],
              type: columnMatch[2]
            });
          }
        }
      }
      
      tables.push({
        name: tableName,
        columns: columns
      });
    }
    
    // 如果没有找到CREATE TABLE语句，尝试解析INSERT语句
    if (tables.length === 0) {
      // 按分号分割SQL语句
      const statements = content.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (trimmedStmt.toUpperCase().startsWith('INSERT INTO')) {
          // 提取表名
          const tableMatch = trimmedStmt.match(/INSERT INTO\s+`?(\w+)`?\s*\(/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            
            // 提取列名部分
            const columnStart = trimmedStmt.indexOf('(');
            const columnEnd = trimmedStmt.indexOf(')', columnStart);
            if (columnStart !== -1 && columnEnd !== -1) {
              const columnPart = trimmedStmt.substring(columnStart + 1, columnEnd);
              const columnNames = columnPart
                .split(',')
                .map(col => col.trim().replace(/`/g, ''))
                .filter(col => col.length > 0);
              
              // 从VALUES部分提取第一个数据行来推断数据类型
              const valuesStart = trimmedStmt.indexOf('VALUES', columnEnd);
              if (valuesStart !== -1) {
                const valuesPart = trimmedStmt.substring(valuesStart + 6);
                const firstValueMatch = valuesPart.match(/\(([^)]+)\)/);
                
                if (firstValueMatch) {
                  const firstValues = parseValues(firstValueMatch[1]);
                  
                  const columns = columnNames.map((colName, index) => {
                    const sampleValue = firstValues[index] || '';
                    let dataType = 'VARCHAR(255)'; // 默认类型
                    
                    if (sampleValue === 'NULL') {
                      dataType = 'VARCHAR(255)';
                    } else if (!isNaN(sampleValue) && sampleValue !== '') {
                      if (sampleValue.includes('.')) {
                        dataType = 'DECIMAL(10,2)';
                      } else {
                        dataType = 'INT';
                      }
                    } else if (sampleValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                      dataType = 'DATE';
                    } else if (sampleValue.length > 0) {
                      dataType = 'VARCHAR(255)';
                    }
                    
                    return {
                      name: colName,
                      type: dataType
                    };
                  });
                  
                  tables.push({
                    name: tableName,
                    columns: columns
                  });
                  
                  // 只处理第一个表
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    return tables;
  } catch (error) {
    console.error('解析SQL文件时出错:', error);
    return [];
  }
}

// 解析VALUES中的值，正确处理引号
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
      currentValue = '';
    } else if (inQuotes && char === quoteChar) {
      // 检查是否是转义引号
      if (i + 1 < valuesString.length && valuesString[i + 1] === quoteChar) {
        currentValue += char;
        i++; // 跳过下一个引号
      } else {
        inQuotes = false;
        quoteChar = null;
      }
    } else if (!inQuotes && char === ',') {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // 添加最后一个值
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

// 生成示例数据
function generateSampleData(columns, rowCount = 10, sqlContent = '') {
  const data = [];
  
  // 如果提供了SQL内容，尝试从INSERT语句中提取真实数据
  if (sqlContent) {
    // 使用新的extractInsertData函数提取所有数据
    const allRows = extractInsertData(sqlContent);
    
    // 生成数据
    const realDataCount = Math.min(allRows.length, rowCount);
    for (let i = 0; i < realDataCount; i++) {
      const row = {};
      columns.forEach((column, idx) => {
        let value = allRows[i][idx] || '';
        if (value === 'NULL') value = '';
        // 移除引号
        if (typeof value === 'string' && (value.startsWith("'") && value.endsWith("'") || value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        row[column.name] = value;
      });
      data.push(row);
    }
    
    // 如果真实数据不够，生成一些示例数据
    for (let i = realDataCount; i < rowCount; i++) {
      const row = {};
      columns.forEach(column => {
        const columnName = column.name;
        const columnType = column.type.toLowerCase();
        if (columnType.includes('int')) {
          row[columnName] = Math.floor(Math.random() * 1000);
        } else if (columnType.includes('varchar') || columnType.includes('text')) {
          row[columnName] = `示例数据_${i + 1}`;
        } else if (columnType.includes('date')) {
          row[columnName] = new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0];
        } else if (columnType.includes('decimal') || columnType.includes('float')) {
          row[columnName] = parseFloat((Math.random() * 100).toFixed(2));
        } else {
          row[columnName] = `数据_${i + 1}`;
        }
      });
      data.push(row);
    }
  } else {
    // 生成示例数据
    for (let i = 0; i < rowCount; i++) {
      const row = {};
      columns.forEach(column => {
        const columnName = column.name;
        const columnType = column.type.toLowerCase();
        if (columnType.includes('int')) {
          row[columnName] = Math.floor(Math.random() * 1000);
        } else if (columnType.includes('varchar') || columnType.includes('text')) {
          row[columnName] = `示例数据_${i + 1}`;
        } else if (columnType.includes('date')) {
          row[columnName] = new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0];
        } else if (columnType.includes('decimal') || columnType.includes('float')) {
          row[columnName] = parseFloat((Math.random() * 100).toFixed(2));
        } else {
          row[columnName] = `数据_${i + 1}`;
        }
      });
      data.push(row);
    }
  }
  return data;
}

// API路由

// 获取数据库文件夹中的SQL文件列表
app.get('/api/sql-files', (req, res) => {
  try {
    const databaseDir = path.join(__dirname, 'database');
    const files = fs.readdirSync(databaseDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(databaseDir, file),
        size: fs.statSync(path.join(databaseDir, file)).size
      }));
    
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 转换SQL文件为Excel
app.post('/api/convert-sql-to-excel', upload.single('sqlFile'), (req, res) => {
  try {
    const sqlFilePath = req.file ? req.file.path : req.body.filePath;
    
    if (!sqlFilePath) {
      return res.status(400).json({ success: false, error: '未提供SQL文件' });
    }
    
    // 解析SQL文件
    const tables = parseSQLFile(sqlFilePath);
    
    if (tables.length === 0) {
      return res.status(400).json({ success: false, error: '无法解析SQL文件或文件中没有找到表定义' });
    }
    
    // 读取SQL文件内容用于生成真实数据
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 为每个表创建工作表
    tables.forEach(table => {
      // 提取所有真实数据
      const allRows = extractInsertData(sqlContent);
      const rowCount = allRows.length;
      const sampleData = generateSampleData(table.columns, rowCount, sqlContent);
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      XLSX.utils.book_append_sheet(workbook, worksheet, table.name);
    });
    
    // 生成Excel文件
    const excelFileName = `converted_${Date.now()}.xlsx`;
    const excelFilePath = path.join(__dirname, 'public', 'excel', excelFileName);
    
    // 确保excel目录存在
    fs.ensureDirSync(path.dirname(excelFilePath));
    
    XLSX.writeFile(workbook, excelFilePath);
    
    // 清理上传的文件
    if (req.file) {
      fs.removeSync(req.file.path);
    }
    
    res.json({
      success: true,
      excelFile: `/excel/${excelFileName}`,
      tables: tables.map(table => ({
        name: table.name,
        columns: table.columns
      }))
    });
    
  } catch (error) {
    console.error('转换过程中出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 上传SQL文件并转换
app.post('/api/upload-and-convert', upload.single('sqlFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择SQL文件' });
    }
    
    const sqlFilePath = req.file.path;
    const tables = parseSQLFile(sqlFilePath);
    
    if (tables.length === 0) {
      return res.status(400).json({ success: false, error: '无法解析SQL文件或文件中没有找到表定义' });
    }
    
    // 读取SQL文件内容用于生成真实数据
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 为每个表创建工作表
    tables.forEach(table => {
      // 提取所有真实数据
      const allRows = extractInsertData(sqlContent);
      const rowCount = allRows.length;
      const sampleData = generateSampleData(table.columns, rowCount, sqlContent);
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      XLSX.utils.book_append_sheet(workbook, worksheet, table.name);
    });
    
    // 生成Excel文件
    const excelFileName = `converted_${Date.now()}.xlsx`;
    const excelFilePath = path.join(__dirname, 'public', 'excel', excelFileName);
    
    // 确保excel目录存在
    fs.ensureDirSync(path.dirname(excelFilePath));
    
    XLSX.writeFile(workbook, excelFilePath);
    
    // 清理上传的文件
    fs.removeSync(req.file.path);
    
    res.json({
      success: true,
      excelFile: `/excel/${excelFileName}`,
      tables: tables.map(table => ({
        name: table.name,
        columns: table.columns
      }))
    });
    
  } catch (error) {
    console.error('转换过程中出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取Excel文件内容用于前端显示
app.get('/api/excel-data/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const excelFilePath = path.join(__dirname, 'public', 'excel', filename);
    
    if (!fs.existsSync(excelFilePath)) {
      return res.status(404).json({ success: false, error: 'Excel文件不存在' });
    }
    
    const workbook = XLSX.readFile(excelFilePath);
    const sheets = {};
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      sheets[sheetName] = jsonData;
    });
    
    res.json({ success: true, sheets });
    
  } catch (error) {
    console.error('读取Excel文件时出错:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取已有Excel文件列表
app.get('/api/excel-files', (req, res) => {
  try {
    const excelDir = path.join(__dirname, 'public', 'excel');
    fs.ensureDirSync(excelDir);
    const files = fs.readdirSync(excelDir)
      .filter(f => f.endsWith('.xlsx'));
    res.json({ success: true, files });
  } catch (e) {
    res.json({ success: false, files: [] });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 
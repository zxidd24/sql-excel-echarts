// 全局变量
let currentExcelData = null;
let currentSheetName = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadSqlFiles();
    setupEventListeners();
    loadExcelFileList(); // 新增：加载已有Excel文件列表
    document.getElementById('previewExcelBtn').addEventListener('click', function() {
        const select = document.getElementById('excelSelect');
        const filename = select.value;
        if (filename) {
            loadExcelData('excel/' + filename); // 只拼接public/excel下的文件
        }
    });
});

// 设置事件监听器
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // 文件选择事件
    fileInput.addEventListener('change', handleFileSelect);

    // 拖拽事件
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // 点击上传区域触发文件选择
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        uploadAndConvertFile(file);
    }
}

// 处理拖拽悬停
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

// 处理拖拽离开
function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

// 处理文件拖拽
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.sql')) {
            uploadAndConvertFile(file);
        } else {
            showAlert('请选择SQL文件', 'warning');
        }
    }
}

// 上传并转换文件
async function uploadAndConvertFile(file) {
    showLoading(true);
    
    const formData = new FormData();
    formData.append('sqlFile', file);

    try {
        const response = await fetch('/api/upload-and-convert', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            showResult(result);
            loadExcelData(result.excelFile);
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        console.error('转换失败:', error);
        showAlert('转换失败，请重试', 'danger');
    } finally {
        showLoading(false);
    }
}

// 转换现有SQL文件
async function convertExistingFile(filePath) {
    showLoading(true);
    
    try {
        const response = await fetch('/api/convert-sql-to-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filePath: filePath })
        });

        const result = await response.json();
        
        if (result.success) {
            showResult(result);
            loadExcelData(result.excelFile);
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        console.error('转换失败:', error);
        showAlert('转换失败，请重试', 'danger');
    } finally {
        showLoading(false);
    }
}

// 加载SQL文件列表
async function loadSqlFiles() {
    try {
        const response = await fetch('/api/sql-files');
        const result = await response.json();
        
        if (result.success) {
            displaySqlFiles(result.files);
        } else {
            document.getElementById('sqlFilesList').innerHTML = 
                '<div class="alert alert-warning">无法加载SQL文件列表</div>';
        }
    } catch (error) {
        console.error('加载SQL文件列表失败:', error);
        document.getElementById('sqlFilesList').innerHTML = 
            '<div class="alert alert-danger">加载失败</div>';
    }
}

// 显示SQL文件列表
function displaySqlFiles(files) {
    const container = document.getElementById('sqlFilesList');
    
    if (files.length === 0) {
        container.innerHTML = '<div class="alert alert-info">数据库文件夹中没有找到SQL文件</div>';
        return;
    }
    
    const filesHtml = files.map(file => `
        <div class="file-card">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <h6 class="mb-1"><i class="fas fa-file-code text-primary"></i> ${file.name}</h6>
                    <small class="text-muted">大小: ${formatFileSize(file.size)}</small>
                </div>
                <div class="col-md-4 text-end">
                    <button class="btn btn-primary btn-sm" onclick="convertExistingFile('${file.path}')">
                        <i class="fas fa-exchange-alt"></i> 转换
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = filesHtml;
}

// 加载Excel数据
async function loadExcelData(excelFile) {
    try {
        const filename = excelFile.split('/').pop();
        const response = await fetch(`/api/excel-data/${filename}`);
        const result = await response.json();
        
        if (result.success) {
            currentExcelData = result.sheets;
            displayExcelPreview(result.sheets);
        } else {
            showAlert('无法加载Excel数据', 'danger');
        }
    } catch (error) {
        console.error('加载Excel数据失败:', error);
        showAlert('加载Excel数据失败', 'danger');
    }
}

// 显示Excel预览
function displayExcelPreview(sheets) {
    const sheetNames = Object.keys(sheets);
    const sheetTabs = document.getElementById('sheetTabs');
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    
    // 创建工作表标签
    sheetTabs.innerHTML = sheetNames.map((sheetName, index) => `
        <button class="sheet-tab ${index === 0 ? 'active' : ''}" 
                onclick="switchSheet('${sheetName}')">
            ${sheetName}
        </button>
    `).join('');
    
    // 显示第一个工作表
    if (sheetNames.length > 0) {
        currentSheetName = sheetNames[0];
        displaySheet(sheets[sheetNames[0]]);
    }
}

// 切换工作表
function switchSheet(sheetName) {
    if (currentExcelData && currentExcelData[sheetName]) {
        currentSheetName = sheetName;
        
        // 更新标签状态
        document.querySelectorAll('.sheet-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // 显示工作表数据
        displaySheet(currentExcelData[sheetName]);
    }
}

// 显示工作表数据
function displaySheet(data) {
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    
    if (data.length === 0) {
        tableHeader.innerHTML = '<th>无数据</th>';
        tableBody.innerHTML = '<tr><td colspan="1" class="text-center text-muted">此工作表为空</td></tr>';
        return;
    }
    
    // 获取列名
    const columns = Object.keys(data[0]);
    
    // 创建表头
    tableHeader.innerHTML = columns.map(column => `<th>${column}</th>`).join('');
    
    // 创建表格内容
    tableBody.innerHTML = data.map(row => `
        <tr>
            ${columns.map(column => `<td>${row[column] || ''}</td>`).join('')}
        </tr>
    `).join('');
}

// 显示结果
function showResult(result) {
    const resultSection = document.getElementById('resultSection');
    const excelFileName = document.getElementById('excelFileName');
    const downloadLink = document.getElementById('downloadLink');
    const conversionStats = document.getElementById('conversionStats');
    
    // 设置文件名和下载链接
    const filename = result.excelFile.split('/').pop();
    excelFileName.textContent = filename;
    downloadLink.href = result.excelFile;
    downloadLink.download = filename;
    
    // 设置转换统计
    const tableCount = result.tables.length;
    const totalColumns = result.tables.reduce((sum, table) => sum + table.columns.length, 0);
    conversionStats.textContent = `转换了 ${tableCount} 个表，共 ${totalColumns} 个字段`;
    
    // 显示结果区域
    resultSection.style.display = 'block';
    
    // 滚动到结果区域
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 显示加载状态
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'block' : 'none';
}

// 显示警告信息
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.main-container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // 自动隐藏警告
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 

// 加载已有Excel文件列表
async function loadExcelFileList() {
    try {
        const response = await fetch('/api/excel-files');
        const result = await response.json();
        if (result.success) {
            const select = document.getElementById('excelSelect');
            select.innerHTML = '<option value="">请选择Excel文件</option>' +
                result.files.map(f => `<option value="${f}">${f}</option>`).join('');
        }
    } catch (e) {
        // 忽略错误
    }
} 
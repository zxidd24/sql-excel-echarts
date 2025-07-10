// 全局变量
let currentExcelData = null;
let currentSheetName = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadSqlFiles();
    setupEventListeners();
    loadExcelFileList(); // 新增：加载已有Excel文件列表
    setupRowHeightAndVisualization(); // 设置行高调整和可视化功能
    
    // Excel预览按钮事件
    const previewExcelBtn = document.getElementById('previewExcelBtn');
    if (previewExcelBtn) {
        previewExcelBtn.addEventListener('click', function() {
            const select = document.getElementById('excelSelect');
            const filename = select.value;
            if (filename) {
                loadExcelData('excel/' + filename); // 只拼接public/excel下的文件
            }
        });
    }
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
    
    // 使用虚拟滚动显示数据
    virtualData = data;
    virtualColumns = Object.keys(data[0]);
    virtualStart = 0;
    
    // 创建表头
    tableHeader.innerHTML = virtualColumns.map(column => `<th>${column}</th>`).join('');
    
    // 渲染虚拟行
    renderVirtualRows(0);
    setupVirtualScroll();
    makeTableResizable('excelTable');
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

// 虚拟滚动相关变量和函数
const VISIBLE_ROWS = 50;
let virtualData = [];
let virtualColumns = [];
let virtualStart = 0;
let rowHeight = 18;

// 同步表头宽度
function syncHeaderWidths() {
    const table = document.getElementById('excelTable');
    const ths = table.querySelectorAll('thead th');
    const firstRow = table.querySelector('tbody tr');
    if (!firstRow) return;
    const tds = firstRow.querySelectorAll('td');
    ths.forEach((th, i) => {
        if (tds[i]) {
            th.style.width = tds[i].offsetWidth + 'px';
        }
    });
}

// 渲染虚拟行
function renderVirtualRows(start) {
    const tableBody = document.getElementById('tableBody');
    const end = Math.min(start + VISIBLE_ROWS, virtualData.length);
    tableBody.innerHTML = '';
    for (let i = start; i < end; i++) {
        const row = virtualData[i];
        const tr = document.createElement('tr');
        tr.className = 'virtual-row';
        tr.style.height = rowHeight + 'px';
        tr.innerHTML = virtualColumns.map(column => `<td>${row[column] || ''}</td>`).join('');
        tableBody.appendChild(tr);
    }
    tableBody.style.height = (virtualData.length * rowHeight) + 'px';
    tableBody.style.position = '';
    setTimeout(syncHeaderWidths, 0);
}

// 设置虚拟滚动
function setupVirtualScroll() {
    const container = document.getElementById('virtualTableContainer');
    container.onscroll = function() {
        const scrollTop = container.scrollTop;
        const start = Math.floor(scrollTop / rowHeight);
        if (start !== virtualStart) {
            virtualStart = start;
            renderVirtualRows(virtualStart);
        }
    };
}

// 列宽拖拽功能
function makeTableResizable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const ths = table.querySelectorAll('th');
    ths.forEach((th, idx) => {
        // 避免重复添加
        if (th.querySelector('.resizer')) return;
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);
        let startX, startWidth;
        resizer.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = th.offsetWidth;
            document.body.style.cursor = 'col-resize';
            function onMouseMove(e2) {
                const newWidth = startWidth + (e2.pageX - startX);
                th.style.width = newWidth + 'px';
            }
            function onMouseUp() {
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}

// 生成随机颜色
function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
        '#A9CCE3', '#F9E79F', '#D5A6BD', '#A2D9CE', '#FAD7A0'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 全局变量存储地图数据
let globalGeoJson = null;
let currentMapLevel = 'district'; // 'district' 或 'street'
let currentDistrict = null;
let myChart = null;

// 初始化Echarts可视化
function initVisualization() {
    const chartContainer = document.getElementById('chartContainer');
    myChart = echarts.init(chartContainer);
    
    // 异步加载GeoJSON并注册地图
    fetch('/Echarts/Data/陕西街道.geojson')
        .then(response => response.json())
        .then(geoJson => {
            globalGeoJson = geoJson;
            showDistrictLevel();
        })
        .catch(error => {
            console.error('加载地图数据失败:', error);
            chartContainer.innerHTML = '<div class="alert alert-warning">地图数据加载失败</div>';
        });
}

// 显示区县级别地图
function showDistrictLevel() {
    if (!globalGeoJson) return;
    
    // 筛选西安地区数据
    const xianFeatures = globalGeoJson.features.filter(feature => 
        feature.properties && feature.properties.市 === '西安市'
    );
    
    // 按区县分组数据
    const districtGroups = {};
    xianFeatures.forEach(feature => {
        const districtName = feature.properties.区;
        if (districtName) {
            if (!districtGroups[districtName]) {
                districtGroups[districtName] = [];
            }
            districtGroups[districtName].push(feature);
        }
    });
    
    // 创建区县级别的GeoJSON
    const districtGeoJson = {
        type: 'FeatureCollection',
        features: Object.keys(districtGroups).map(districtName => {
            // 合并该区县的所有街道为一个多边形，兼容Polygon和MultiPolygon
            const districtFeatures = districtGroups[districtName];
            const coordinates = districtFeatures.flatMap(f => {
                if (f.geometry.type === 'Polygon') {
                    return [f.geometry.coordinates];
                } else if (f.geometry.type === 'MultiPolygon') {
                    return f.geometry.coordinates;
                }
                return [];
            });
            return {
                type: 'Feature',
                properties: {
                    name: districtName,
                    district: districtName,
                    streetCount: districtFeatures.length,
                    streets: districtFeatures.map(f => f.properties.Name || f.properties.name || '未知街道')
                },
                geometry: {
                    type: 'MultiPolygon',
                    coordinates: coordinates
                }
            };
        })
    };
    
    echarts.registerMap('xian_district', districtGeoJson);
    
    // 按区县分配颜色
    const districtColors = {};
    Object.keys(districtGroups).forEach(districtName => {
        districtColors[districtName] = getRandomColor();
    });
    
    // 准备数据
    const mapData = Object.keys(districtGroups).map(districtName => ({
        name: districtName,
        value: districtGroups[districtName].length,
        itemStyle: {
            areaColor: districtColors[districtName]
        }
    }));
    
    const option = {
        title: {
            text: '西安市各区县',
            left: 'center'
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const data = params.data;
                if (data) {
                    return `${params.name}<br/>街道数量: ${data.value}个<br/>点击查看详细街道`;
                }
                return params.name;
            }
        },
        series: [
            {
                type: 'map',
                map: 'xian_district',
                roam: true,
                label: {
                    show: true,
                    fontSize: 12,
                    color: '#333'
                },
                itemStyle: {
                    borderColor: '#0288d1',
                    borderWidth: 2
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        color: '#fff'
                    },
                    itemStyle: {
                        areaColor: '#b3e5fc'
                    }
                },
                data: mapData
            }
        ]
    };
    
    myChart.setOption(option);
    
    // 添加点击事件
    myChart.on('click', function(params) {
        if (params.data) {
            const districtName = params.name;
            showStreetLevel(districtName);
        }
    });
    
    currentMapLevel = 'district';
}

// 显示街道级别地图
function showStreetLevel(districtName) {
    if (!globalGeoJson) return;
    
    currentDistrict = districtName;
    
    // 筛选指定区县的街道数据
    const districtStreets = globalGeoJson.features.filter(feature => 
        feature.properties && 
        feature.properties.市 === '西安市' && 
        feature.properties.区 === districtName
    );
    
    if (districtStreets.length === 0) {
        alert(`未找到${districtName}的街道数据`);
        return;
    }
    
    // 创建街道级别的GeoJSON
    const streetGeoJson = {
        type: 'FeatureCollection',
        features: districtStreets.map(feature => ({
            type: 'Feature',
            properties: {
                name: feature.properties.Name || feature.properties.name || '未知街道',
                district: districtName,
                ...feature.properties
            },
            geometry: feature.geometry
        }))
    };
    
    echarts.registerMap('xian_street', streetGeoJson);
    
    // 为每个街道分配颜色
    const streetColors = {};
    districtStreets.forEach(feature => {
        const streetName = feature.properties.Name || feature.properties.name || '未知街道';
        streetColors[streetName] = getRandomColor();
    });
    
    // 准备数据
    const mapData = districtStreets.map(feature => {
        const streetName = feature.properties.Name || feature.properties.name || '未知街道';
        return {
            name: streetName,
            value: Math.random() * 100,
            itemStyle: {
                areaColor: streetColors[streetName]
            }
        };
    });
    
    const option = {
        title: {
            text: `${districtName}街道详情`,
            left: 'center'
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const data = params.data;
                if (data) {
                    return `${params.name}<br/>所属区县: ${districtName}<br/>点击查看详情`;
                }
                return params.name;
            }
        },
        series: [
            {
                type: 'map',
                map: 'xian_street',
                roam: true,
                label: {
                    show: true,
                    fontSize: 10,
                    color: '#333'
                },
                itemStyle: {
                    borderColor: '#0288d1',
                    borderWidth: 1
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 12,
                        color: '#fff'
                    },
                    itemStyle: {
                        areaColor: '#b3e5fc'
                    }
                },
                data: mapData
            }
        ]
    };
    
    myChart.setOption(option);
    
    // 显示街道信息弹窗
    showStreetInfo(districtName, districtStreets);
    
    // 添加返回按钮
    addBackButton();
    
    currentMapLevel = 'street';
}

// 显示街道信息弹窗
function showStreetInfo(districtName, streets) {
    const streetNames = streets.map(feature => 
        feature.properties.Name || feature.properties.name || '未知街道'
    );
    
    const info = `
        <div style="text-align: left; padding: 10px;">
            <h4>${districtName}街道信息</h4>
            <p><strong>街道总数:</strong> ${streets.length}个</p>
            <p><strong>街道列表:</strong></p>
            <ul style="max-height: 200px; overflow-y: auto;">
                ${streetNames.map(name => `<li>${name}</li>`).join('')}
            </ul>
        </div>
    `;
    
    // 使用Bootstrap模态框显示信息
    const modalHtml = `
        <div class="modal fade" id="streetInfoModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${districtName}街道详情</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${info}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        <button type="button" class="btn btn-primary" onclick="showDistrictLevel()">返回区县视图</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除旧的模态框
    const oldModal = document.getElementById('streetInfoModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // 添加新的模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('streetInfoModal'));
    modal.show();
}

// 添加返回按钮
function addBackButton() {
    const chartContainer = document.getElementById('chartContainer');
    
    // 移除旧的返回按钮
    const oldButton = document.getElementById('backToDistrictBtn');
    if (oldButton) {
        oldButton.remove();
    }
    
    // 添加新的返回按钮
    const backButton = document.createElement('button');
    backButton.id = 'backToDistrictBtn';
    backButton.className = 'btn btn-primary';
    backButton.style.cssText = 'position: absolute; top: 10px; left: 10px; z-index: 1000;';
    backButton.innerHTML = '<i class="fas fa-arrow-left"></i> 返回区县视图';
    backButton.onclick = function() {
        showDistrictLevel();
        this.remove();
    };
    
    chartContainer.appendChild(backButton);
}

// 设置行高调整功能
function setupRowHeightAndVisualization() {
    // 行高调整按钮事件
    const setRowHeightBtn = document.getElementById('setRowHeightBtn');
    if (setRowHeightBtn) {
        setRowHeightBtn.addEventListener('click', function() {
            const val = parseInt(document.getElementById('rowHeightInput').value, 10);
            if (val >= 12 && val <= 60) {
                rowHeight = val;
                renderVirtualRows(virtualStart);
            }
        });
    }
    
    // 可视化按钮事件
    const visualizeBtn = document.getElementById('visualizeBtn');
    if (visualizeBtn) {
        visualizeBtn.addEventListener('click', function() {
            const visualizationSection = document.getElementById('visualizationSection');
            if (visualizationSection.style.display === 'none') {
                visualizationSection.style.display = 'block';
                initVisualization();
                visualizationSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                visualizationSection.style.display = 'none';
            }
        });
    }
} 
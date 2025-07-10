// 生成随机颜色的函数
function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
    '#A9CCE3', '#F9E79F', '#D5A6BD', '#A2D9CE', '#FAD7A0'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 全局变量
var myChart = null;
var districtChart = null;
var xianGeoJson = null;
var districtData = {};

// 初始化图表
function initCharts() {
  myChart = echarts.init(document.getElementById('main'));
  districtChart = echarts.init(document.getElementById('district-chart'));
  
  // 监听窗口大小变化
  window.addEventListener('resize', function() {
    myChart.resize();
    districtChart.resize();
  });
}

// 生成区县数据
function generateDistrictData(districtName) {
  const dataTypes = ['人口密度', '经济发展', '教育水平', '医疗资源', '交通便利度'];
  const data = [];
  
  dataTypes.forEach((type, index) => {
    data.push({
      name: type,
      value: Math.floor(Math.random() * 100) + 20,
      itemStyle: {
        color: getRandomColor()
      }
    });
  });
  
  return data;
}

// 显示区县详细图表
function showDistrictChart(districtName) {
  const chartWrapper = document.getElementById('district-chart-wrapper');
  const chartTitle = document.getElementById('district-chart-title');
  
  chartWrapper.classList.remove('hidden');
  chartTitle.textContent = `${districtName}详细数据`;
  
  // 生成该区的数据
  const districtData = generateDistrictData(districtName);
  
  const option = {
    title: {
      text: `${districtName}数据分析`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: districtData.map(item => item.name)
    },
    series: [
      {
        name: districtName,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: districtData
      }
    ]
  };
  
  districtChart.setOption(option);
}

// 隐藏区县图表
function hideDistrictChart() {
  const chartWrapper = document.getElementById('district-chart-wrapper');
  chartWrapper.classList.add('hidden');
}

// 更新主地图显示
function updateMainMap(selectedDistrict) {
  if (selectedDistrict === 'all') {
    // 显示所有区域
    const mapData = xianGeoJson.features.map(feature => {
      const districtName = feature.properties.区 || feature.properties.name || '未知';
      return {
        name: districtName,
        value: Math.random() * 100,
        itemStyle: {
          areaColor: getRandomColor()
        }
      };
    });
    
    const option = {
      title: {
        text: '西安街道地图轮廓',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          return params.name || '西安市';
        }
      },
      series: [
        {
          type: 'map',
          map: 'xian_jiedao',
          roam: true,
          label: {
            show: false
          },
          itemStyle: {
            borderColor: '#0288d1',
            borderWidth: 1
          },
          emphasis: {
            label: {
              show: false
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
  } else {
    // 高亮选中的区域
    const mapData = xianGeoJson.features.map(feature => {
      const districtName = feature.properties.区 || feature.properties.name || '未知';
      const isSelected = districtName === selectedDistrict;
      
      return {
        name: districtName,
        value: Math.random() * 100,
        itemStyle: {
          areaColor: isSelected ? '#f093fb' : '#e0e0e0',
          opacity: isSelected ? 1 : 0.3
        }
      };
    });
    
    const option = {
      title: {
        text: `西安街道地图 - ${selectedDistrict}`,
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          return params.name || '西安市';
        }
      },
      series: [
        {
          type: 'map',
          map: 'xian_jiedao',
          roam: true,
          label: {
            show: false
          },
          itemStyle: {
            borderColor: '#0288d1',
            borderWidth: 1
          },
          emphasis: {
            label: {
              show: false
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
  }
}

// 按钮点击事件处理
function handleDistrictClick(districtName) {
  // 更新按钮状态
  document.querySelectorAll('.district-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 更新地图显示
  updateMainMap(districtName);
  
  // 显示或隐藏区县图表
  if (districtName === 'all') {
    hideDistrictChart();
  } else {
    showDistrictChart(districtName);
  }
}

// 初始化页面
function initPage() {
  // 初始化图表
  initCharts();
  
  // 绑定按钮事件
  document.querySelectorAll('.district-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const districtName = this.getAttribute('data-district');
      handleDistrictClick(districtName);
    });
  });
}

// 异步加载GeoJSON并注册地图
fetch('Data/陕西街道.geojson')
  .then(response => response.json())
  .then(geoJson => {
    // 筛选西安地区数据
    const xianFeatures = geoJson.features.filter(feature => 
      feature.properties && feature.properties.市 === '西安市'
    );
    
    // 创建只包含西安数据的GeoJSON
    xianGeoJson = {
      type: 'FeatureCollection',
      features: xianFeatures
    };
    
    // 为每个feature添加name属性，确保ECharts能正确识别
    xianGeoJson.features.forEach(feature => {
      if (feature.properties && feature.properties.区) {
        feature.properties.name = feature.properties.区;
      }
    });
    
    echarts.registerMap('xian_jiedao', xianGeoJson);
    
    // 初始化页面
    initPage();
    
    // 显示默认地图（西安市整体）
    updateMainMap('all');
  })
  .catch(error => {
    console.error('加载地图数据失败:', error);
    document.getElementById('main').innerHTML = '<p style="text-align: center; color: red;">加载地图数据失败，请检查网络连接</p>';
  }); 
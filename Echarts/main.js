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

// 初始化echarts实例
var myChart = echarts.init(document.getElementById('main'));

// 存储所有街道数据，用于点击时查询
let allStreetData = [];
// 存储当前选中的区县
let selectedDistrict = null;
// 存储原始区县地图配置
let originalOption = null;
// 存储区县颜色映射
let districtColors = {};

// 异步加载GeoJSON并注册地图
fetch('Data/陕西街道.geojson')
  .then(response => response.json())
  .then(geoJson => {
    // 筛选西安地区数据
    const xianFeatures = geoJson.features.filter(feature => 
      feature.properties && feature.properties.市 === '西安市'
    );
    
    // 保存所有街道数据
    allStreetData = xianFeatures;
    
    // 创建只包含西安数据的GeoJSON
    const xianGeoJson = {
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
    
    // 按区县分组，为每个区县分配一个颜色
    xianFeatures.forEach(feature => {
      const districtName = feature.properties.区 || feature.properties.name || '未知';
      if (!districtColors[districtName]) {
        districtColors[districtName] = getRandomColor();
      }
    });
    
    // 准备数据，确保name与feature的name属性匹配
    const mapData = xianFeatures.map(feature => {
      const districtName = feature.properties.区 || feature.properties.name || '未知';
      return {
        name: districtName,
        value: Math.random() * 100,
        itemStyle: {
          areaColor: districtColors[districtName]
        }
      };
    });
    
    originalOption = {
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
    myChart.setOption(originalOption);
    
    // 添加点击事件监听
    myChart.on('click', function(params) {
      const districtName = params.name;
      if (districtName) {
        // 查找该区县下的所有街道办事处
        const streetsInDistrict = allStreetData.filter(feature => 
          feature.properties && feature.properties.区 === districtName
        );
        
        if (streetsInDistrict.length > 0) {
          // 提取街道办事处名称
          const streetNames = streetsInDistrict.map(feature => 
            feature.properties.Name || '未知街道'
          );
          
          // 使用alert显示街道信息
          alert(`${districtName}包含以下街道办事处：\n\n${streetNames.join('\n')}\n\n共 ${streetNames.length} 个街道办事处`);
          
          // 在地图上标出该区县的所有街道
          highlightStreetsInDistrict(districtName, streetsInDistrict);
        } else {
          alert(`${districtName}暂无街道办事处数据`);
        }
      }
    });
  });

// 在地图上标出指定区县的所有街道
function highlightStreetsInDistrict(districtName, streetsInDistrict) {
  selectedDistrict = districtName;
  
  // 创建街道级别的GeoJSON
  const streetGeoJson = {
    type: 'FeatureCollection',
    features: streetsInDistrict
  };
  
  // 为每个街道添加name属性
  streetGeoJson.features.forEach(feature => {
    if (feature.properties && feature.properties.Name) {
      feature.properties.name = feature.properties.Name;
    }
  });
  
  // 注册街道地图
  echarts.registerMap('street_detail', streetGeoJson);
  
  // 准备街道数据，使用不同的颜色和样式
  const streetData = streetsInDistrict.map(feature => {
    return {
      name: feature.properties.Name || '未知街道',
      value: Math.random() * 100,
      itemStyle: {
        areaColor: '#ff6b6b',
        borderColor: '#fff',
        borderWidth: 2
      }
    };
  });
  
  // 更新地图配置，显示街道级别的地图
  var newOption = {
    title: {
      text: `${districtName} - 街道详情`,
      left: 'center',
      subtext: '',
      subtextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        return params.name || '街道';
      }
    },
    series: [
      {
        type: 'map',
        map: 'street_detail',
        roam: true,
        label: {
          show: true,
          fontSize: 10,
          color: '#333'
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            color: '#fff'
          },
          itemStyle: {
            areaColor: '#ff4757'
          }
        },
        data: streetData
      }
    ]
  };
  
  myChart.setOption(newOption);
  
  // 添加返回区县视图的点击事件
  myChart.off('click');
  myChart.on('click', function(params) {
    // 点击任意位置返回区县视图
    returnToDistrictView();
  });
}

// 返回区县视图
function returnToDistrictView() {
  selectedDistrict = null;
  myChart.setOption(originalOption);
  
  // 恢复原来的点击事件
  myChart.off('click');
  myChart.on('click', function(params) {
    const districtName = params.name;
    if (districtName) {
      // 查找该区县下的所有街道办事处
      const streetsInDistrict = allStreetData.filter(feature => 
        feature.properties && feature.properties.区 === districtName
      );
      
      if (streetsInDistrict.length > 0) {
        // 提取街道办事处名称
        const streetNames = streetsInDistrict.map(feature => 
          feature.properties.Name || '未知街道'
        );
        
        // 使用alert显示街道信息
        alert(`${districtName}包含以下街道办事处：\n\n${streetNames.join('\n')}\n\n共 ${streetNames.length} 个街道办事处`);
        
        // 在地图上标出该区县的所有街道
        highlightStreetsInDistrict(districtName, streetsInDistrict);
      } else {
        alert(`${districtName}暂无街道办事处数据`);
      }
    }
  });
} 
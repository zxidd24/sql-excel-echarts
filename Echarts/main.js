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

// 异步加载GeoJSON并注册地图
fetch('Data/陕西街道.geojson')
  .then(response => response.json())
  .then(geoJson => {
    // 筛选西安地区数据
    const xianFeatures = geoJson.features.filter(feature => 
      feature.properties && feature.properties.市 === '西安市'
    );
    
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
    const districtColors = {};
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
    
    var option = {
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
  }); 
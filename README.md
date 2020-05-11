## Wing: A Three.js LOT Framework

### Main Functions 主要函数（绑定于JQuery）
* addScene 创建场景
* getScene 获取场景
* resizeScene 自动调整场景大小
* removeScene 销毁并删除场景

### addScene 添加场景
* @param {*} name 场景名
* @param {*} node 场景渲染节点
* 返回场景对象 canvas 有以下方法：
* getWorld 获取场景物理世界Cannon
* start 启动世界（自动启动）
* reload 重启世界
* addTimer 添加计时器（以方便销毁时自动删除）
* addVisual 添加3D对象
* addVisuals 添加多个3D对象
* removeVisual 删除3D对象
* removeAllVisuals 删除所有3D对象
* removeFromParent 销毁并删除场景
* setRenderMode 设置渲染模式 "solid", "wireframe"
* restartCurrentScene 重启当前场景
* restartGeometryCaches 重启缓存
* switchFPS 显示/隐藏FPS 参数可传 show,hide 不传则为自动切换
* 有以下对象：
* scene Three场景
* stats 状态器
* camera 主相机
* controls 场景控制器
* renderer 场景渲染器
* settings 场景参数库
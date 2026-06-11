# 减脂小屋

小白和小鸡毛的双人私用减脂记录 App。

网址：<https://libing-hong.github.io/fat-loss-app/>

## 当前网页版本的边界

现在部署在 GitHub Pages 上的是网页 App。它的数据保存在每台设备自己的浏览器里，所以桌面端填写的信息不会自动同步到手机端。

网页 App 也不能直接读取 Apple Health、HealthKit、Samsung Health 或 Health Connect 权限，因此不能真正自动读取手表步数和活动消耗。

## 本次修复

- 手机端七日路线和体重趋势不再横向撑出屏幕。
- 首次打开会选择本机身份：小白或小鸡毛。
- 选择身份后，本设备只能填写自己的记录，查看对方但不能编辑对方。
- 记录里增加“消耗 kcal”，未来可由手表自动写入。

## 真正自动同步需要的架构

- iPhone 原生 App：读取 Apple Health / HealthKit。
- Android 原生 App：读取 Health Connect / Samsung Health 数据。
- 后端账号：小白和小鸡毛登录并绑定。
- 云端数据库：同步体重、步数、活动消耗、运动、睡眠。
- 权限模型：每个人只能写自己的数据，只查看对方授权的数据。

下一步要真正实现手表自动录入，需要把现在的网页 App 升级成“手机 App + 后端”。

nineku.fm
=================

### 介绍：

----------------------------

`http://www.9ku.com/fm 的终端版本`


### 安装:

---------------------------------------


#### 依赖

``` sh

sudo apt install libasound2-dev ffmpeg -y

```


npm安装

    `npm install -g nineku.fm`

github安装

    `git clone http://github.com/izhengzhixian/nineku.fm`

    `cd nineku.fm`

    `npm install`

windows64位下安装编译会出现问题，需要在cmd中更改成64位编译模式，请参考：
https://msdn.microsoft.com/zh-cn/library/x4d2c09s.aspx
后运行安装命令

### 运行:

---------------------------------

`nineku.fm`

### 日志：

-----------------------------

### v1.0.5
1. 删除云端保存功能
2. 修改fs.exists成fs.existsSync

#### v1.0.4
1. 修复添加讨厌后不自动播放下一首的bug

#### v1.0.3
1. 修改下一首后时间不准确的bug
2. 对服务器模式进行了一下修改

#### v1.0.2
1. 修改只能非root用户不能保存个人配置的bug
2. 修改下一首后时间不准确的bug

#### v1.0.1
1. 修改了一些手误(如，保存讨厌的t键错写成了T键)
2. 修改了一首歌曲可以多次保存的bug

#### v1.0.0
1. 实现了nineku.fm的基本功能
2. 实现了用户个人喜欢，讨厌配置
3. 实现了用户云端保存配置
4. 更多功能，请使用 `nineku.fm help` 查看

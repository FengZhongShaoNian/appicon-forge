# 应用图标生成器

语言: [English](./README.md)

这是一个简单的工具，让你可以在完全不会图标设计的情况下，得到一个尚可使用的图标。

## 案例

![案例1](./screenshots/1-1.png)
![案例2](./screenshots/1-2.png)
![案例3](./screenshots/1-3.png)
![案例4](./screenshots/1-4.png)
![案例5](./screenshots/1-5.png)

## 功能

- 自定义图标尺寸、位置、颜色、背景颜色、边界、内边距（上下左右可分别设置）、渐变和阴影。
- 自定义文本内容，文本渐变和字体。
- 自定义本地 SVG 或图片文件。
- 通过包含20,0000 可用图标的 [Iconify Icons](https://iconify.design/) 来生成图标。
- 实时预览你的图标的变化。
- 导出 PNG 或 SVG 格式的图标，SVG 会保留矢量图形和渐变。
- 将当前图标与已有 SVG 对比，测量内边距与圆角差异，并可一键应用参考值。

> [!IMPORTANT]
> 文本图标使用系统默认字体，无法保证版权合规，请谨慎选择。
>
> 你可以使用自定义的Google Fonts来避免版权问题。
>
> 自定义字体不会嵌入到 SVG 导出文件中，在其他设备上打开时请安装对应字体，或改用系统字体。圆锥渐变会被栅格化，透视效果依赖 CSS 3D 变换，需要渲染器支持。

## Usage

你可以不用进行任何安装，而是直接通过 Github Pages 来使用应用图标生成器。直接访问下面这个链接即可：

[AppIcon Forge on GitHub Pages](https://zhangyu1818.github.io/appicon-forge/)

如果你想在本地运行：

克隆这个仓库并安装依赖：

```sh
# 克隆仓库
git clone https://github.com/zhangyu1818/appicon-forge.git

# 进入目录
cd appicon-forge

# 安装依赖
pnpm install
```

启动开发服务器:

```sh
pnpm dev
```

在你的浏览器中访问 `http://localhost:5173/appicon-forge/` 来使用应用图标生成器。

## 部署

### 手动

构建生产项目:

```sh
pnpm build
```

将 `out` 文件夹的内容部署到您的 Web 服务器或 GitHub Pages。

### Docker

```console
# 克隆仓库
git clone https://github.com/zhangyu1818/appicon-forge.git

# 进入目录
cd appicon-forge

# 构建镜像
docker build -t appicon-forge .


# 删除镜像
docker rmi appicon-forge
```

#### Docker run

```console
# 启动容器
docker run -d --name=appicon-forge --restart=always -p 5173:80 appicon-forge

# 停止并删除容器与镜像
docker stop appicon-forge
docker rm appicon-forge
```

#### Docker compose

```console
# 构建并启动容器
docker-compose up -d

# 停止并删除容器
docker-compose down
```

## 许可

该项目使用 MIT 许可。

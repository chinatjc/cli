#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const args = require('minimist')(process.argv.slice(2));
const tinify = require('tinify');

const log = {
  success(text) {
    console.log(chalk.green(`\n${text}\n`));
  },
  error(text) {
    console.log(chalk.bold.red(`\n${text}\n`));
  },
  warning(text) {
    console.log(chalk.keyword('orange')(`\n${text}\n`));
  },
};

tinify.key = 'dxjQXyGjBJZRD5K1DSfsXvGxBPDLFh7y';

class CompressPictures {
  static excludedFolders = ['dist', 'build', 'node_modules', 'config'];
  static imageExtension = ['.png', '.jpg'];

  constructor() {
    const rootPath = args['folder']
    if (!rootPath) {
      log.error('请设置命令行参数 —— folder');
      return
    }

    this.rootPath = path.join(process.cwd(), rootPath);

    this.start();
  }

  async checkPath() {
    return await new Promise((resolve, reject) => {
      const stat = fs.existsSync(this.rootPath) && fs.lstatSync(this.rootPath);
      const check = stat ? stat.isDirectory() : false
      if (!check) log.error('当前文件夹不存在，请更换压缩文件夹');
      resolve(check)
    });
  }

  getImages() {
    const fileList = [];
    let filePathList = fs
      .readdirSync(this.rootPath)
      .map((file) => path.join(this.rootPath, file));

    while (filePathList.length) {
      const nextFilePathList = [];

      filePathList.forEach((filePath) => {
        const states = fs.statSync(filePath);
        const info = path.parse(filePath);

        if (states.isFile()) {
          if (CompressPictures.imageExtension.includes(info.ext))
            fileList.push({ ...info });
        } else {
          if (!CompressPictures.excludedFolders.includes(info.name)) {
            nextFilePathList.push(
              ...fs
                .readdirSync(filePath)
                .map((file) => path.join(filePath, file))
            );
          }
        }
      });

      filePathList = nextFilePathList;
    }

    return fileList;
  }

  async getImagePathPairs(images) {
    const pathPairs = await Promise.all(
      images.map(({ dir, name, ext }) => {
        return new Promise((resolve) => {
          const originalImage = /_original$/.test(name);

          if (originalImage) {
            const originPath = `${dir}/${name}${ext}`;
            const compressedPath = `${dir}/${name.replace(
              /_original$/,
              ''
            )}${ext}`;
            if (!fs.existsSync(compressedPath))
              resolve({ originPath, compressedPath });
            else resolve();
          } else {
            const originPath = `${dir}/${name}_original${ext}`;
            const compressedPath = `${dir}/${name}${ext}`;
            if (!fs.existsSync(originPath)) {
              fs.renameSync(compressedPath, originPath);
              resolve({ originPath, compressedPath });
            } else {
              resolve();
            }
          }
        });
      })
    );

    return pathPairs.filter((pathPair) => !!pathPair);
  }

  async compress(imagesPairs) {
    const list = await Promise.allSettled(
      imagesPairs.map(({ originPath, compressedPath }) => {
        return new Promise(async (resolve, reject) => {
          const source = tinify.fromFile(originPath);
          try {
            await source.toFile(compressedPath);
            resolve();
          } catch (e) {
            reject({ originPath, compressedPath });
          }
        });
      })
    );

    const failedList = list.filter(({ status }) => status === 'rejected');

    return failedList.length ? failedList : undefined;
  }

  async start() {
    if (!(await this.checkPath())) return;

    const images = this.getImages();
    const imagePathPairs = await this.getImagePathPairs(images);
    const failedUncompressedImagePaths = await this.compress(imagePathPairs);

    if (failedUncompressedImagePaths) console.log(failedUncompressedImagePaths);
    else log.success('压缩图片成功')
  }
}

new CompressPictures()

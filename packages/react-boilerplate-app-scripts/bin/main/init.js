'use strict';
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const commander = require('commander');
const util = require('react-boilerplate-app-utils');
const Basic = require('./Basic.js');
const scriptsPackagename = require('../../config/const').scriptsPackagename;

class init extends Basic {
  /**
   * @param { object } program commander对象
   */
  constructor(program, appName) {
    super();
    if (program) {
      this.program = program;
    } else {
      this.program = this.getCommander();
    }
    if (!appName) {
      //避免报错
      appName = 'test';
    }
    this.appName = appName;
    this.boilerplate = this.program.boilerplate;
    this.configJson = this.getConfigJson(this.boilerplate);
    this.run();
  }

  getCommander() {
    var program = commander
      .option('-b, --boilerplate [boilerplate]', 'boilerplate name')
      .parse(process.argv);
    if (!program.boilerplate) {
      program.boilerplate = 'mvc-react';
    }
    return program;
  }
  //获取当前模板的config.json
  //config.json的结构跟package.json的相似，处理部分自定义的如scripts，其他的都跟package.json一致，
  //如果定义了，package.json对应的字段会被覆盖的。
  getConfigJson(boilerplate) {
    var configPath = path.resolve(
      __dirname,
      '../../template',
      boilerplate,
      'config.json'
    );
    return fs.readJsonSync(configPath);
  }

  /**
  * 检查当前目录是否合法
  * 如果src目录存在将提示并退出程序
  */
  checkCurrentDirIsValid() {
    try {
      if (fs.existsSync(util.resolveCwd('src'))) {
        console.error(chalk.red('The project should not contain src folder!'));
        process.exit(1);
        return false;
      } else {
        return true;
      }
    } catch (e) {
      console.error(e);
    }
  }
  //获取样板中config.json下的scirpts
  //返回package.json格式的scripts
  getBoilerplateScrpits(scriptsConfig) {
    if (!scriptsConfig) {
      return {};
    }
    var scripts = {};
    for (var k in scriptsConfig) {
      var script = scriptsConfig[k].script;
      scripts[k] = script;
    }
    return scripts;
  }
  writePackageJson() {
    var pacakgeJsonPath = path.resolve(process.cwd(), 'package.json');
    var packageJson = fs.readJsonSync(pacakgeJsonPath);
    //适配scripts，针对当前项目的package.json中的scripts，去除部分信息
    packageJson.scripts = {};
    for (var k in this.packageJson['scripts']) {
      if (k != 'init') {
        var command = this.packageJson['scripts'][k];
        var match = command.match(/node.*\.\/bin\/(.*)\.js/);
        if (match && match[1]) {
          packageJson.scripts[k] = this.packageJson['scripts'][k].replace(
            match[0],
            match[1]
          );
        }
      }
    }
    packageJson[scriptsPackagename] = {
      historyApiFallback: {
        verbose: true,
      },
    };
    packageJson.babel = this.packageJson.babel;
    packageJson.eslintConfig = this.packageJson.eslintConfig;
    for (var j in this.configJson) {
      var config = this.configJson[j];
      switch (j) {
        case 'scripts':
          var boilerplateScripts = this.getBoilerplateScrpits(config);
          packageJson.scripts = Object.assign(
            packageJson.scripts,
            boilerplateScripts
          );
          break;
        default:
          //覆盖
          packageJson[j] = config;
      }
    }
    //整合boilerplate中的config.json，覆盖配置，除了自定义的。
    fs.writeFileSync(pacakgeJsonPath, JSON.stringify(packageJson, null, 2));
  }

  /**
   * 复制template中的文件夹
   * @param { string } targetDir 目标复制的文件夹名
   * @param { string } partDirName 复制的后创建文件夹名（相对于项目根目录），存放复制文件
   * @return { string } 复制保存后的文件夹路径
   */
  coypDir(targetDir, partDirName) {
    //template目录下的文件夹路径
    var templateDirPath = path.resolve(
      __dirname,
      `../../template/${targetDir}`
    );
    if (!fs.existsSync(templateDirPath)) {
      console.error(chalk.yellow(templateDirPath + ' is not exist.'));
      process.exit(1);
    }
    //相对于项目根目录
    var savePath = path.resolve(process.cwd(), partDirName);
    fs.copySync(templateDirPath, savePath, {
      dereference: true,
    });
    return savePath;
  }

  run() {
    this.checkCurrentDirIsValid();
    var boilerplate = this.program.boilerplate;
    this.coypDir('public', 'public');
    var srcSavePath = this.coypDir(boilerplate, 'src');
    fs.removeSync(path.resolve(srcSavePath, 'scripts.json'));
    fs.moveSync(
      path.resolve(srcSavePath, 'README.md'),
      path.resolve(srcSavePath, '../README.md'),
      { overwrite: true }
    );
    this.writePackageJson();
    this.instruction();
  }

  createCustomInstruction(scriptsConfig, displayedCommand) {
    for (var k in scriptsConfig) {
      var scriptsName = k;
      var description = scriptsConfig[k].description;
      console.log(chalk.cyan(`  ${displayedCommand} ${scriptsName}`));
      console.log(`     ${description}`);
      console.log();
    }
  }

  instruction() {
    var appPath = path.resolve(process.cwd(), '../');
    var appName = this.appName;
    var useYarn = util.shouldUseYarn();
    var displayedCommand = 'npm run';
    if (useYarn) {
      displayedCommand = 'yarn';
    }
    var descriptionScripts = {
      start: {
        description: 'Start the development server.',
      },
      'use <feature-name>': {
        description: 'Use a feature such as less,sass.',
      },
      'cover <file-name>': {
        description: 'Overwrite the configuration file, such as webpack.config.dev.js.',
      },
      build: {
        description: 'Bundles the app into static files for production.',
      },
      'serve-build': {
        description: 'Serve the static files in the build folder.',
      },
    };
    console.log();
    console.log(chalk.green('Success!'));
    console.log(`Created ${chalk.cyan(appName)} at `);
    console.log(`${appPath}`);
    console.log();
    console.log('Inside that directory, you can run several commands:');
    console.log();
    console.log();
    this.createCustomInstruction(
      Object.assign(descriptionScripts, this.configJson.scripts || {}),
      displayedCommand
    );
  }
}
module.exports = init;

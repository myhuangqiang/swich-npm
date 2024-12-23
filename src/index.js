#!/usr/bin/env node

const { program } = require('commander') // 这个模块可以解析我们输入的命令
const PKG = require('../package.json') // 引入package json
const registries = require('../registries.json'); // 引入初始源
const inquirer = require('inquirer'); // 常用于命令交互
const { exec, execSync } = require('child_process') // 子线程用于执行shell命令, execSync子进程完全关闭之前不会返回，exec 会创建一个新的shell，执行后执行回调函数
const ping = require('node-http-ping') // ping网址的一个库
const fs = require('fs')
const chalk = require('chalk'); // console 变颜色的一个库
const path = require('path')
program.version(PKG.version) // 设置版本默认命令 -V --version


const whiteList = ['npm', 'yarn', 'tencent', 'cnpm', 'taobao', 'npmMirror'] // 白名单，不能删除
// 读取源地址方便设置*
const getOrigin = async () => {
    let origin = await execSync('npm get registry', { encoding: 'utf-8' })
    console.log(origin)
    return origin
}

// 列出所有的源，如果当前有在使用前面加上*
program.command('ls').description('查看镜像').action(async () => {

    const res = await getOrigin()

    const keys = Object.keys(registries)

    const message = []

    //填充横线算法npm------  yarn------
    const max = Math.max(...keys.map(v => v.length)) + 3
    keys.forEach(k => {

        const newK = registries[k].registry == res.trim() ? ('* ' + k) : ('  ' + k)
        const Arr = new Array(...newK)
        Arr.length = max;
        const prefix = Array.from(Arr).map(v => v ? v : '-').join('')

        message.push(prefix + '  ' + registries[k].registry)
    })
    console.log(message.join('\n'))
})

//切换源
program.command('use').description('请选择镜像').action(() => {
    inquirer.prompt([
        {
            type: 'list',
            name: 'sel',
            message: '请选择镜像',
            choices: Object.keys(registries)
        }
    ]).then(result => {

        const reg = registries[result.sel].registry

        exec(`npm config set registry ${reg}`, null, (err) => {

            if (err) {
                console.error('切换错误', err)
            } else {
                console.log('铁子，切换成功')
                /*
                *                        _oo0oo_
                *                       o8888888o
                *                       88" . "88
                *                       (| -_- |)
                *                       0\  =  /0
                *                     ___/`---'\___
                *                   .' \\|     |// '.
                *                  / \\|||  :  |||// \
                *                 / _||||| -:- |||||- \
                *                |   | \\\  - /// |   |
                *                | \_|  ''\---/''  |_/ |
                *                \  .-\__  '-'  ___/-. /
                *              ___'. .'  /--.--\  `. .'___
                *           ."" '<  `.___\_<|>_/___.' >' "".
                *          | | :  `- \`.;`\ _ /`;.`/ - ` : | |
                *          \  \ `_.   \_ __\ /__ _/   .-` /  /
                *      =====`-.____`.___ \_____/___.-`___.-'=====
                *                        `=---='
                * 
                * 
                *      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                * 
                *            佛祖保佑     永不宕机     永无BUG
                */
            }
        })
    })
})


//获取当前源
program.command('current').description('查看当前源').action(async () => {
    const reg = await getOrigin()
    const v = Object.keys(registries).find(k => {
        if (registries[k].registry === reg.trim()) {
            return k;
        }
    })
    if (v) {
        console.log(chalk.blue('当前源:', v))
    } else {
        console.log(chalk.green('当前源:', reg))
    }
})

//ping 源
program.command('ping').description('测试镜像地址速度').action(() => {
    inquirer.prompt([
        {
            type: 'list',
            name: 'sel',
            message: '请选择镜像',
            choices: Object.keys(registries)
        }
    ]).then(result => {

        const url = registries[result.sel].ping.trim()

        ping(url).then(time => console.log(chalk.blue(`响应时长: ${time}ms`)))
            .catch(() => console.log(chalk.red('GG', 'timeout')))

    })
})

//添加源 读写registries.json 文件实现
program.command('add').description('自定义镜像').action(() => {
    inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: '请输入镜像名称',
            validate(answer) {
                const keys = Object.keys(registries)
                if (keys.includes(answer)) {
                    return `不能起名${answer}跟保留字冲突`
                }
                if (!answer) {
                    return '名称不能为空'
                }
                return true
            }
        },
        {
            type: 'input',
            name: 'url',
            message: '请输入镜像地址',
            validate(answer) {
                if (!answer) {
                    return `url不能为空`
                }
                return true
            }       
        }
    ]).then(result => {

        const del = (url) => {
            const arr = url.split('')
            // at 在node16 以下不支持
            return arr[arr.length - 1] == '/' ? (arr.pop() && arr.join('')) : arr.join('')
        }

        registries[result.name] = {
            home: result.url.trim(),
            registry: result.url.trim(),
            ping: del(result.url.trim()), //去掉末尾/ 不然无法ping
        }
        try {
            fs.writeFileSync(path.join(__dirname, '../registries.json'), JSON.stringify(registries, null, 4))
            console.log(chalk.blue('添加完成'))
        }
        catch (e) {
            console.log(chalk.red(err))
        }
    })
})

program.command('delete').description('删除自定义的源').action(() => {

    const keys = Object.keys(registries)
    if (keys.length === whiteList.length) {
        return console.log(chalk.red('当前无自定义源可以删除'))
    } else {

        const Difference = keys.filter((key) => !whiteList.includes(key))
        inquirer.prompt([
            {
                type: "list",
                name: "sel",
                message: "请选择删除的镜像",
                choices: Difference
            }
        ]).then(async result => {
            const current = await getOrigin()
            const selOrigin = registries[result.sel]
            if (current.trim() == selOrigin.registry.trim()) {
                console.log(chalk.red(`当前还在使用该镜像${registries[result.sel].registry},请切换其他镜像删除`))
            } else {
                try {
                    delete registries[result.sel]

                    fs.writeFileSync(path.join(__dirname, '../registries.json'), JSON.stringify(registries, null, 4))

                    console.log(chalk.green('SUCCESS 操作完成'))
                }
                catch (e) {
                    console.log(chalk.red(err))
                }
            }

        })
    }
})


program.parse(process.argv)
